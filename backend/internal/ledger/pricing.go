package ledger

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// Pricing is a document's currency and the rate row it refers to, with the
// rate of that currency in it (so'm per unit; 1 for the so'm).
type Pricing struct {
	CurrencyID int64
	RateID     int64
	Rate       pgtype.Numeric
}

// PriceInput is what the client says about a document's currency: the
// currency (none: so'm) and the rate (none: the standard rate at the
// document's moment).
type PriceInput struct {
	CurrencyID *int64
	Rate       *string
}

// RateText is the document's rate as the API shows it ("12800.0000").
func RateText(p Pricing) string {
	return currency.RateText(p.Rate)
}

// PriceIn settles a document's currency and rate row (logic/currencies.md,
// sections 4 and 5), as the member with phone by, for the moment at: the
// currency has to be one of the catalog the company has turned on; without
// a rate given the standard row in force at the moment is taken (the
// company's zero row for the so'm when it has none; "Kursni kiriting" for
// another currency with no rate yet); with the standard rate given, that
// row; with another rate, the document's own row (status 2) with the other
// currencies' rates from the standard row. On an edit, current is the
// document's pricing now: a rate given back as it is keeps the row.
func PriceIn(ctx context.Context, q *gen.Queries, companyID int64, in PriceInput, at time.Time, by string, current *Pricing) (Pricing, error) {
	currencyID := currency.UZS
	if in.CurrencyID != nil && *in.CurrencyID != 0 {
		currencyID = *in.CurrencyID
	}
	if currencyID != currency.UZS {
		if _, err := q.GetCurrency(ctx, currencyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return Pricing{}, fields.Invalid("Valyuta noto'g'ri")
			}
			return Pricing{}, err
		}
		on, err := q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: companyID, CurrencyID: currencyID})
		if err != nil {
			return Pricing{}, err
		}
		if !on {
			return Pricing{}, currency.ErrNotAllowed
		}
	}
	var given *pgtype.Numeric
	if in.Rate != nil && strings.TrimSpace(*in.Rate) != "" {
		n, err := currency.Rate(strings.TrimSpace(*in.Rate))
		if err != nil {
			return Pricing{}, err
		}
		given = &n
	}
	standard, err := currency.RateAt(ctx, q, companyID, at)
	if err != nil {
		return Pricing{}, err
	}
	if currencyID == currency.UZS {
		if given != nil && rat(*given).Cmp(big.NewRat(1, 1)) != 0 {
			return Pricing{}, fields.Invalid("Kurs noto'g'ri")
		}
		if standard != nil {
			return Pricing{CurrencyID: currencyID, RateID: standard.ID, Rate: standard.Uzs}, nil
		}
		row, err := fallbackRate(ctx, q, companyID, by)
		if err != nil {
			return Pricing{}, err
		}
		return Pricing{CurrencyID: currencyID, RateID: row.ID, Rate: row.Uzs}, nil
	}
	if given == nil {
		if standard == nil || isZero(currency.ColumnOf(*standard, currencyID)) {
			return Pricing{}, fields.Invalid("Kursni kiriting")
		}
		return Pricing{CurrencyID: currencyID, RateID: standard.ID, Rate: currency.ColumnOf(*standard, currencyID)}, nil
	}
	if current != nil && current.CurrencyID == currencyID && same(current.Rate, *given) {
		return *current, nil
	}
	if standard != nil && same(currency.ColumnOf(*standard, currencyID), *given) {
		return Pricing{CurrencyID: currencyID, RateID: standard.ID, Rate: *given}, nil
	}
	rates := map[int64]pgtype.Numeric{2: zeroRate(), 3: zeroRate(), 4: zeroRate()}
	if standard != nil {
		rates = map[int64]pgtype.Numeric{2: standard.Usd, 3: standard.Eur, 4: standard.Rub}
	}
	rates[currencyID] = *given
	row, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: companyID, Usd: rates[2], Eur: rates[3], Rub: rates[4], Status: 2, SetBy: by})
	if err != nil {
		return Pricing{}, err
	}
	return Pricing{CurrencyID: currencyID, RateID: row.ID, Rate: *given}, nil
}

// fallbackRate is the company's zero row, made on the first ask: what a
// document in so'm refers to while the company has set no rates.
func fallbackRate(ctx context.Context, q *gen.Queries, companyID int64, by string) (gen.CurrencyRate, error) {
	row, err := q.GetFallbackRate(ctx, companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return q.CreateRate(ctx, gen.CreateRateParams{CompanyID: companyID, Usd: zeroRate(), Eur: zeroRate(), Rub: zeroRate(), Status: 2, SetBy: by})
	}
	return row, err
}

// same tells whether two rates are the same number, however written.
func same(a, b pgtype.Numeric) bool {
	return rat(a).Cmp(rat(b)) == 0
}

func isZero(n pgtype.Numeric) bool {
	return rat(n).Sign() == 0
}

func zeroRate() pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(0), Valid: true}
}

// RateRowAt is the rate row a document with no rate of its own refers to
// (a cash document, logic/finance.md, section 5): the standard row in
// force at the moment (the first standard row before any), or the
// company's zero row while it has set no rates.
func RateRowAt(ctx context.Context, q *gen.Queries, companyID int64, at time.Time, by string) (int64, error) {
	standard, err := currency.RateAt(ctx, q, companyID, at)
	if err != nil {
		return 0, err
	}
	if standard != nil {
		return standard.ID, nil
	}
	row, err := fallbackRate(ctx, q, companyID, by)
	if err != nil {
		return 0, err
	}
	return row.ID, nil
}
