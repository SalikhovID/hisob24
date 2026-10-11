package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// The opening balances of a supplier (logic/warehouse.md, section 6): what
// was owed it (a debt) or paid it in advance (an advance) when the company
// started keeping its books here.
const (
	OpeningDebt   = "debt"
	OpeningPrepay = "prepay"
)

var errOpeningNotFound = apperr.New(apperr.NotFound, "not_found", "Hujjat topilmadi")

// Opening is an opening balance as the API shows it.
type Opening struct {
	ID            int64
	Kind          string
	SupplierID    int64
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

// OpeningInput is what an opening balance is saved with, as the client
// sent it: the kind, the amount in the currency (so'm unless given), the
// moment, the rate (none: the standard one) and a note.
type OpeningInput struct {
	Kind       string
	Amount     *string
	CurrencyID *int64
	Rate       *string
	At         string
	Note       *string
}

// OpeningPage is one page of a supplier's opening balances.
type OpeningPage struct {
	Items    []Opening
	Total    int64
	Page     int
	PageSize int
}

type checkedOpening struct {
	Kind    ledger.Kind
	Amount  pgtype.Numeric
	At      time.Time
	Pricing ledger.Pricing
	Note    *string
}

// kindOfOpening is the journal's kind of an opening balance, "" for one
// the API does not know.
func kindOfOpening(kind string) ledger.Kind {
	switch kind {
	case OpeningDebt:
		return ledger.SupplierDebt
	case OpeningPrepay:
		return ledger.SupplierPrepay
	}
	return ""
}

// openingKindOf is the API's kind of a journal document.
func openingKindOf(kind string) string {
	if kind == string(ledger.SupplierPrepay) {
		return OpeningPrepay
	}
	return OpeningDebt
}

// checkOpening reads an input, inside the write, as the member with phone
// by. What is wrong is told in this order: the kind, the amount, the
// moment, the currency and the rate (current: the document's pricing now),
// the note.
func checkOpening(ctx context.Context, q *gen.Queries, companyID int64, by string, in OpeningInput, current *ledger.Pricing) (checkedOpening, error) {
	var c checkedOpening
	if in.Kind == "" {
		return c, invalid("Turni tanlang")
	}
	if c.Kind = kindOfOpening(in.Kind); c.Kind == "" {
		return c, invalid("Tur noto'g'ri")
	}
	var err error
	if c.Amount, err = paymentAmount(in.Amount); err != nil {
		return c, err
	}
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Pricing, err = ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{CurrencyID: in.CurrencyID, Rate: in.Rate}, c.At, by, current); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	return c, nil
}

func toOpening(r gen.GetOpeningRow) Opening {
	return Opening{
		ID: r.ID, Kind: openingKindOf(r.Kind), SupplierID: r.SupplierID, Amount: amount(r.Amount), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate),
		AmountUZS: amount(r.AmountUzs), At: r.DocAt.UTC(), Note: r.Note, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func getOpening(ctx context.Context, q *gen.Queries, companyID, supplierID, id int64) (Opening, error) {
	r, err := q.GetOpening(ctx, gen.GetOpeningParams{ID: id, SupplierID: supplierID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Opening{}, errOpeningNotFound
	}
	if err != nil {
		return Opening{}, err
	}
	return toOpening(r), nil
}

// ListOpenings is a page of the supplier's live opening balances, the
// newest first. The supplier comes first: one that is not there is not found.
func (s *Service) ListOpenings(ctx context.Context, companyID, supplierID int64, page int) (OpeningPage, error) {
	if err := pageOf(page); err != nil {
		return OpeningPage{}, err
	}
	if _, err := getSupplier(ctx, s.q, companyID, supplierID); err != nil {
		return OpeningPage{}, err
	}
	total, err := s.q.CountOpenings(ctx, gen.CountOpeningsParams{SupplierID: supplierID, CompanyID: companyID})
	if err != nil {
		return OpeningPage{}, err
	}
	rows, err := s.q.ListOpenings(ctx, gen.ListOpeningsParams{SupplierID: supplierID, CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return OpeningPage{}, err
	}
	items := make([]Opening, 0, len(rows))
	for _, r := range rows {
		items = append(items, toOpening(gen.GetOpeningRow(r)))
	}
	return OpeningPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}

// AddOpening enters an opening balance of the company's supplier (an
// inactive one too), as the member with phone by. The supplier comes
// first; then what is wrong is told in the order of checkOpening.
func (s *Service) AddOpening(ctx context.Context, companyID int64, by string, supplierID int64, in OpeningInput) (Opening, error) {
	var o Opening
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, supplierID); err != nil {
			return err
		}
		c, err := checkOpening(ctx, q, companyID, by, in, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, companyID, c.Kind)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: companyID, Kind: string(c.Kind), Number: number, DocAt: c.At, SupplierID: &supplierID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		o, err = getOpening(ctx, q, companyID, supplierID, row.ID)
		return err
	})
	return o, err
}

// UpdateOpening saves an opening balance with other fields, as the member
// with phone by; its kind stays ("Tur o'zgartirilmaydi" when another is
// sent). The record comes first: one that is not there is not found.
func (s *Service) UpdateOpening(ctx context.Context, companyID int64, by string, supplierID, id int64, in OpeningInput) (Opening, error) {
	var o Opening
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getOpening(ctx, q, companyID, supplierID, id)
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
		if openingKindOf(string(c.Kind)) != was.Kind {
			return invalid("Tur o'zgartirilmaydi")
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: companyID, DocAt: c.At, SupplierID: &supplierID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note}); err != nil {
			return err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: id, Total: c.Amount}); err != nil {
			return err
		}
		o, err = getOpening(ctx, q, companyID, supplierID, id)
		return err
	})
	return o, err
}

// DeleteOpening hides an opening balance.
func (s *Service) DeleteOpening(ctx context.Context, companyID, supplierID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getOpening(ctx, q, companyID, supplierID, id); err != nil {
			return err
		}
		_, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: companyID})
		return err
	})
}
