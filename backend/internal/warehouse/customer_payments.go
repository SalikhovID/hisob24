package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// The money documents of a customer (logic/sales.md, section 5): the
// payments from them (on their own, or entered with a sale), their opening
// debt or advance, and their statement. The checks are the suppliers'
// (checkPayment, checkOpening); the kinds and the queries are the
// customers'.

var (
	errCustomerNotFound        = apperr.New(apperr.NotFound, "not_found", "Mijoz topilmadi")
	errCustomerPaymentLinked   = apperr.New(apperr.Conflict, "payment_linked", "Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang")
	errCustomerOpeningNotFound = apperr.New(apperr.NotFound, "not_found", "Hujjat topilmadi")
)

// CustomerPayment is a payment from a customer, as the API shows it: into
// an account, in the account's currency, by the document's rate; what it
// comes to in so'm. One entered with a sale names it (SaleID, SaleNumber)
// and is changed through the sale alone.
type CustomerPayment struct {
	ID            int64
	CustomerID    int64
	SaleID        *int64
	SaleNumber    *int32
	BankAccountID int64
	AccountName   string
	Amount        string
	CurrencyID    int64
	Rate          string
	AmountUZS     string
	At            time.Time
	Note          *string
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// CustomerPaymentPage is one page of a customer's payments.
type CustomerPaymentPage struct {
	Items    []CustomerPayment
	Total    int64
	Page     int
	PageSize int
}

// CustomerOpening is an opening balance of a customer as the API shows it:
// a debt (they owe) or an advance (they paid ahead).
type CustomerOpening struct {
	ID            int64
	Kind          string
	CustomerID    int64
	Amount        string
	CurrencyID    int64
	Rate          string
	AmountUZS     string
	At            time.Time
	Note          *string
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// CustomerOpeningPage is one page of a customer's opening balances.
type CustomerOpeningPage struct {
	Items    []CustomerOpening
	Total    int64
	Page     int
	PageSize int
}

// customerExists refuses a customer that is not the company's live one.
func customerExists(ctx context.Context, q *gen.Queries, companyID, customerID int64) error {
	if _, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: customerID, CompanyID: companyID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errCustomerNotFound
		}
		return err
	}
	return nil
}

func toCustomerPayment(r gen.GetCustomerPaymentRow) CustomerPayment {
	return CustomerPayment{
		ID: r.ID, CustomerID: r.CustomerID, SaleID: r.SaleID, SaleNumber: r.SaleNumber, BankAccountID: r.BankAccountID, AccountName: r.AccountName,
		Amount: amount(r.Amount), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate), AmountUZS: amount(r.AmountUzs), At: r.DocAt.UTC(), Note: r.Note,
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func getCustomerPayment(ctx context.Context, q *gen.Queries, companyID, customerID, id int64) (CustomerPayment, error) {
	r, err := q.GetCustomerPayment(ctx, gen.GetCustomerPaymentParams{ID: id, CustomerID: customerID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return CustomerPayment{}, errPaymentNotFound
	}
	if err != nil {
		return CustomerPayment{}, err
	}
	return toCustomerPayment(r), nil
}

// ListCustomerPayments is a page of the customer's live payments, the
// newest first. The customer comes first: one that is not there is not found.
func (s *Service) ListCustomerPayments(ctx context.Context, companyID, customerID int64, page int) (CustomerPaymentPage, error) {
	if err := pageOf(page); err != nil {
		return CustomerPaymentPage{}, err
	}
	if err := customerExists(ctx, s.q, companyID, customerID); err != nil {
		return CustomerPaymentPage{}, err
	}
	total, err := s.q.CountCustomerPayments(ctx, gen.CountCustomerPaymentsParams{CustomerID: customerID, CompanyID: companyID})
	if err != nil {
		return CustomerPaymentPage{}, err
	}
	rows, err := s.q.ListCustomerPayments(ctx, gen.ListCustomerPaymentsParams{CustomerID: customerID, CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return CustomerPaymentPage{}, err
	}
	items := make([]CustomerPayment, 0, len(rows))
	for _, r := range rows {
		items = append(items, toCustomerPayment(gen.GetCustomerPaymentRow(r)))
	}
	return CustomerPaymentPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}

// AddCustomerPayment enters a payment from the company's customer into an
// account, as the member with phone by. The customer comes first; then
// what is wrong is told in the order of checkPayment.
func (s *Service) AddCustomerPayment(ctx context.Context, companyID int64, by string, customerID int64, in PaymentInput) (CustomerPayment, error) {
	var p CustomerPayment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if err := customerExists(ctx, q, companyID, customerID); err != nil {
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
		number, err := ledger.NextNumber(ctx, q, companyID, ledger.CustomerPayment)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: companyID, Kind: string(ledger.CustomerPayment), Number: number, DocAt: c.At, CustomerID: &customerID, BankAccountID: &c.Account.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		p, err = getCustomerPayment(ctx, q, companyID, customerID, row.ID)
		return err
	})
	return p, err
}

// UpdateCustomerPayment saves a payment entered on its own with other
// fields, as the member with phone by. The payment comes first: one that
// is not there is not found, one entered with a sale is changed through
// the sale alone (409). The account it already names is kept even when
// inactive.
func (s *Service) UpdateCustomerPayment(ctx context.Context, companyID int64, by string, customerID, paymentID int64, in PaymentInput) (CustomerPayment, error) {
	var p CustomerPayment
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getCustomerPayment(ctx, q, companyID, customerID, paymentID)
		if err != nil {
			return err
		}
		if was.SaleID != nil {
			return errCustomerPaymentLinked
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
			ID: paymentID, CompanyID: companyID, DocAt: c.At, CustomerID: &customerID, BankAccountID: &c.Account.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: paymentID, Total: c.Amount}); err != nil {
			return err
		}
		p, err = getCustomerPayment(ctx, q, companyID, customerID, paymentID)
		return err
	})
	return p, err
}

// DeleteCustomerPayment hides a payment entered on its own; one entered
// with a sale goes with the sale alone (409).
func (s *Service) DeleteCustomerPayment(ctx context.Context, companyID, customerID, paymentID int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getCustomerPayment(ctx, q, companyID, customerID, paymentID)
		if err != nil {
			return err
		}
		if was.SaleID != nil {
			return errCustomerPaymentLinked
		}
		_, err = q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: paymentID, CompanyID: companyID})
		return err
	})
}

// kindOfCustomerOpening is the journal's kind of a customer's opening
// balance, "" for one the API does not know.
func kindOfCustomerOpening(kind string) ledger.Kind {
	switch kind {
	case OpeningDebt:
		return ledger.CustomerDebt
	case OpeningPrepay:
		return ledger.CustomerPrepay
	}
	return ""
}

func toCustomerOpening(r gen.GetCustomerOpeningRow) CustomerOpening {
	kind := OpeningDebt
	if r.Kind == string(ledger.CustomerPrepay) {
		kind = OpeningPrepay
	}
	return CustomerOpening{
		ID: r.ID, Kind: kind, CustomerID: r.CustomerID, Amount: amount(r.Amount), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate),
		AmountUZS: amount(r.AmountUzs), At: r.DocAt.UTC(), Note: r.Note, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func getCustomerOpening(ctx context.Context, q *gen.Queries, companyID, customerID, id int64) (CustomerOpening, error) {
	r, err := q.GetCustomerOpening(ctx, gen.GetCustomerOpeningParams{ID: id, CustomerID: customerID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return CustomerOpening{}, errCustomerOpeningNotFound
	}
	if err != nil {
		return CustomerOpening{}, err
	}
	return toCustomerOpening(r), nil
}

// ListCustomerOpenings is a page of the customer's live opening balances,
// the newest first. The customer comes first.
func (s *Service) ListCustomerOpenings(ctx context.Context, companyID, customerID int64, page int) (CustomerOpeningPage, error) {
	if err := pageOf(page); err != nil {
		return CustomerOpeningPage{}, err
	}
	if err := customerExists(ctx, s.q, companyID, customerID); err != nil {
		return CustomerOpeningPage{}, err
	}
	total, err := s.q.CountCustomerOpenings(ctx, gen.CountCustomerOpeningsParams{CustomerID: customerID, CompanyID: companyID})
	if err != nil {
		return CustomerOpeningPage{}, err
	}
	rows, err := s.q.ListCustomerOpenings(ctx, gen.ListCustomerOpeningsParams{CustomerID: customerID, CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return CustomerOpeningPage{}, err
	}
	items := make([]CustomerOpening, 0, len(rows))
	for _, r := range rows {
		items = append(items, toCustomerOpening(gen.GetCustomerOpeningRow(r)))
	}
	return CustomerOpeningPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}

// AddCustomerOpening enters an opening balance of the company's customer,
// as the member with phone by. The customer comes first; then what is
// wrong is told in the order of checkOpening.
func (s *Service) AddCustomerOpening(ctx context.Context, companyID int64, by string, customerID int64, in OpeningInput) (CustomerOpening, error) {
	var o CustomerOpening
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if err := customerExists(ctx, q, companyID, customerID); err != nil {
			return err
		}
		c, err := checkOpening(ctx, q, companyID, by, in, nil)
		if err != nil {
			return err
		}
		kind := kindOfCustomerOpening(in.Kind)
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, companyID, kind)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: companyID, Kind: string(kind), Number: number, DocAt: c.At, CustomerID: &customerID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		o, err = getCustomerOpening(ctx, q, companyID, customerID, row.ID)
		return err
	})
	return o, err
}

// UpdateCustomerOpening saves an opening balance with other fields, as the
// member with phone by; its kind stays ("Tur o'zgartirilmaydi" when another
// is sent). The record comes first.
func (s *Service) UpdateCustomerOpening(ctx context.Context, companyID int64, by string, customerID, id int64, in OpeningInput) (CustomerOpening, error) {
	var o CustomerOpening
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getCustomerOpening(ctx, q, companyID, customerID, id)
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: companyID})
		if err != nil {
			return err
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkOpening(ctx, q, companyID, by, in, &current)
		if err != nil {
			return err
		}
		if in.Kind != was.Kind {
			return invalid("Tur o'zgartirilmaydi")
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: companyID, DocAt: c.At, CustomerID: &customerID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note}); err != nil {
			return err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: id, Total: c.Amount}); err != nil {
			return err
		}
		o, err = getCustomerOpening(ctx, q, companyID, customerID, id)
		return err
	})
	return o, err
}

// DeleteCustomerOpening hides an opening balance.
func (s *Service) DeleteCustomerOpening(ctx context.Context, companyID, customerID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getCustomerOpening(ctx, q, companyID, customerID, id); err != nil {
			return err
		}
		_, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: companyID})
		return err
	})
}

// CustomerStatement is a page of the customer's statement: their live
// documents in time, the newest first, each with what they owed after it.
// The customer comes first.
func (s *Service) CustomerStatement(ctx context.Context, companyID, customerID int64, page int) (StatementPage, error) {
	if err := pageOf(page); err != nil {
		return StatementPage{}, err
	}
	if err := customerExists(ctx, s.q, companyID, customerID); err != nil {
		return StatementPage{}, err
	}
	return partyStatement(ctx, s.q, "customer", companyID, customerID, page)
}
