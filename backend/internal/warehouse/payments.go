package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Payment is a payment to a supplier, as the API shows it. One entered with
// a purchase names it (PurchaseID, PurchaseNumber) and is changed through
// the purchase alone.
type Payment struct {
	ID             int64
	SupplierID     int64
	PurchaseID     *int64
	PurchaseNumber *int32
	Amount         string
	PaidOn         time.Time
	Note           *string
	CreatedByName  *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// PaymentInput is what a payment is saved with, as the client sent it.
type PaymentInput struct {
	Amount *string
	PaidOn string
	Note   *string
}

// PaymentPage is one page of a supplier's payments.
type PaymentPage struct {
	Items    []Payment
	Total    int64
	Page     int
	PageSize int
}

// checkedPayment is an input as it is kept.
type checkedPayment struct {
	Amount pgtype.Numeric
	PaidOn time.Time
	Note   *string
}

// checkPayment reads an input. What is wrong is told in this order: the
// amount, the day, the note.
func checkPayment(in PaymentInput) (checkedPayment, error) {
	var c checkedPayment
	var err error
	if c.Amount, err = paymentAmount(in.Amount); err != nil {
		return checkedPayment{}, err
	}
	if c.PaidOn, err = day(in.PaidOn); err != nil {
		return checkedPayment{}, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return checkedPayment{}, err
	}
	return c, nil
}

func toPayment(r gen.GetPaymentRow) Payment {
	return Payment{
		ID: r.ID, SupplierID: r.SupplierID, PurchaseID: r.PurchaseID, PurchaseNumber: r.PurchaseNumber,
		Amount: amount(r.Amount), PaidOn: r.PaidOn, Note: r.Note,
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func getPayment(ctx context.Context, q *gen.Queries, companyID, supplierID, id int64) (Payment, error) {
	r, err := q.GetPayment(ctx, gen.GetPaymentParams{ID: id, SupplierID: supplierID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Payment{}, errPaymentNotFound
	}
	if err != nil {
		return Payment{}, err
	}
	return toPayment(r), nil
}

// ListPayments is a page of the supplier's live payments, the newest first.
// The supplier comes first: one that is not there is not found.
func (s *Service) ListPayments(ctx context.Context, companyID, supplierID int64, page int) (PaymentPage, error) {
	if err := pageOf(page); err != nil {
		return PaymentPage{}, err
	}
	if _, err := getSupplier(ctx, s.q, companyID, supplierID); err != nil {
		return PaymentPage{}, err
	}
	total, err := s.q.CountPayments(ctx, gen.CountPaymentsParams{SupplierID: supplierID, CompanyID: companyID})
	if err != nil {
		return PaymentPage{}, err
	}
	rows, err := s.q.ListPayments(ctx, gen.ListPaymentsParams{
		SupplierID: supplierID, CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize),
	})
	if err != nil {
		return PaymentPage{}, err
	}
	items := make([]Payment, 0, len(rows))
	for _, r := range rows {
		items = append(items, toPayment(gen.GetPaymentRow(r)))
	}
	return PaymentPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}

// AddPayment enters a payment to the company's supplier (an inactive one
// too: what is owed is still paid), as the member with phone by. The
// supplier comes first; then what is wrong is told in the order of
// checkPayment.
func (s *Service) AddPayment(ctx context.Context, companyID int64, by string, supplierID int64, in PaymentInput) (Payment, error) {
	var p Payment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, supplierID); err != nil {
			return err
		}
		c, err := checkPayment(in)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreatePayment(ctx, gen.CreatePaymentParams{
			CompanyID: companyID, SupplierID: supplierID, Amount: c.Amount, PaidOn: c.PaidOn, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		p, err = getPayment(ctx, q, companyID, supplierID, row.ID)
		return err
	})
	return p, err
}

// UpdatePayment saves a payment entered on its own with other fields. The
// payment comes first: one that is not there is not found, one entered with
// a purchase is changed through the purchase alone (409).
func (s *Service) UpdatePayment(ctx context.Context, companyID, supplierID, paymentID int64, in PaymentInput) (Payment, error) {
	var p Payment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getPayment(ctx, q, companyID, supplierID, paymentID)
		if err != nil {
			return err
		}
		if was.PurchaseID != nil {
			return errPaymentLinked
		}
		c, err := checkPayment(in)
		if err != nil {
			return err
		}
		if _, err := q.UpdatePayment(ctx, gen.UpdatePaymentParams{ID: paymentID, CompanyID: companyID, Amount: c.Amount, PaidOn: c.PaidOn, Note: c.Note}); err != nil {
			return err
		}
		p, err = getPayment(ctx, q, companyID, supplierID, paymentID)
		return err
	})
	return p, err
}

// DeletePayment hides a payment entered on its own; one entered with a
// purchase goes with the purchase alone (409).
func (s *Service) DeletePayment(ctx context.Context, companyID, supplierID, paymentID int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getPayment(ctx, q, companyID, supplierID, paymentID)
		if err != nil {
			return err
		}
		if was.PurchaseID != nil {
			return errPaymentLinked
		}
		_, err = q.DeletePayment(ctx, gen.DeletePaymentParams{ID: paymentID, CompanyID: companyID})
		return err
	})
}
