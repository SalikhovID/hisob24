package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// Payment is a payment to a supplier, as the API shows it: out of an
// account, in the account's currency, by the document's rate; what it
// comes to in so'm. One entered with a purchase names it (PurchaseID,
// PurchaseNumber) and is changed through the purchase alone.
type Payment struct {
	ID             int64
	SupplierID     int64
	PurchaseID     *int64
	PurchaseNumber *int32
	BankAccountID  int64
	AccountName    string
	Amount         string
	CurrencyID     int64
	Rate           string
	AmountUZS      string
	At             time.Time
	Note           *string
	CreatedByName  *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// PaymentInput is what a payment is saved with, as the client sent it: the
// account, the amount in its currency, the moment, the rate (none: the
// standard one at the moment) and a note.
type PaymentInput struct {
	BankAccountID int64
	Amount        *string
	At            string
	Rate          *string
	Note          *string
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
	Account gen.BankAccount
	Amount  pgtype.Numeric
	At      time.Time
	Pricing ledger.Pricing
	Note    *string
}

// checkPayment reads an input against the company, inside the write, as
// the member with phone by. What is wrong is told in this order
// (logic/warehouse.md, section 6): the account (one of the company's;
// active unless it is the one the payment already names, keep), the
// amount, the moment, the rate (current: the payment's pricing now), the
// note.
func checkPayment(ctx context.Context, q *gen.Queries, companyID int64, by string, in PaymentInput, keep int64, current *ledger.Pricing) (checkedPayment, error) {
	var c checkedPayment
	if in.BankAccountID == 0 {
		return c, invalid("Akkauntni tanlang")
	}
	account, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: in.BankAccountID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return c, invalid("Akkauntni tanlang")
	}
	if err != nil {
		return c, err
	}
	if !account.IsActive && account.ID != keep {
		return c, invalid("Akkaunt nofaol")
	}
	c.Account = account
	if c.Amount, err = paymentAmount(in.Amount); err != nil {
		return c, err
	}
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Pricing, err = ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{CurrencyID: &account.CurrencyID, Rate: in.Rate}, c.At, by, current); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	return c, nil
}

func toPayment(r gen.GetPaymentRow) Payment {
	return Payment{
		ID: r.ID, SupplierID: r.SupplierID, PurchaseID: r.PurchaseID, PurchaseNumber: r.PurchaseNumber, BankAccountID: r.BankAccountID, AccountName: r.AccountName,
		Amount: amount(r.Amount), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate), AmountUZS: amount(r.AmountUzs), At: r.DocAt.UTC(), Note: r.Note,
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
// too: what is owed is still paid) out of an account, as the member with
// phone by. The supplier comes first; then what is wrong is told in the
// order of checkPayment.
func (s *Service) AddPayment(ctx context.Context, companyID int64, by string, supplierID int64, in PaymentInput) (Payment, error) {
	var p Payment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, supplierID); err != nil {
			return err
		}
		c, err := checkPayment(ctx, q, companyID, by, in, 0, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, companyID, ledger.SupplierPayment)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: companyID, Kind: string(ledger.SupplierPayment), Number: number, DocAt: c.At, SupplierID: &supplierID, BankAccountID: &c.Account.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		p, err = getPayment(ctx, q, companyID, supplierID, row.ID)
		return err
	})
	return p, err
}

// UpdatePayment saves a payment entered on its own with other fields, as
// the member with phone by. The payment comes first: one that is not there
// is not found, one entered with a purchase is changed through the
// purchase alone (409). The account it already names is kept even when
// inactive.
func (s *Service) UpdatePayment(ctx context.Context, companyID int64, by string, supplierID, paymentID int64, in PaymentInput) (Payment, error) {
	var p Payment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getPayment(ctx, q, companyID, supplierID, paymentID)
		if err != nil {
			return err
		}
		if was.PurchaseID != nil {
			return errPaymentLinked
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: paymentID, CompanyID: companyID})
		if err != nil {
			return err
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkPayment(ctx, q, companyID, by, in, was.BankAccountID, &current)
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: paymentID, CompanyID: companyID, DocAt: c.At, SupplierID: &supplierID, BankAccountID: &c.Account.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: paymentID, Total: c.Amount}); err != nil {
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
		_, err = q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: paymentID, CompanyID: companyID})
		return err
	})
}
