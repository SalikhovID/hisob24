package currency

import (
	"context"
	"errors"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// PageSize is how many rows a page of the history holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// ratePattern is a rate as the client writes it: so'm per unit, up to ten
// digits and four decimals ("12800.5").
var ratePattern = regexp.MustCompile(`^\d{1,10}(\.\d{1,4})?$`)

// Rate reads a rate the client sent: above zero, four decimals at most.
func Rate(raw string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if !ratePattern.MatchString(raw) || n.Scan(raw) != nil || zero(n) {
		return pgtype.Numeric{}, invalid("Kurs noto'g'ri")
	}
	return n, nil
}

// RateText is a stored rate as the API shows it, with four decimals
// ("12800.0000"): pgx decodes a zero numeric without its scale.
func RateText(n pgtype.Numeric) string {
	v, err := n.Value()
	if err != nil {
		return "0.0000"
	}
	s, ok := v.(string)
	if !ok {
		return "0.0000"
	}
	whole, decimals, _ := strings.Cut(s, ".")
	for len(decimals) < 4 {
		decimals += "0"
	}
	return whole + "." + decimals
}

// zero tells whether the rate is nothing: no rate, or 0 however written.
func zero(n pgtype.Numeric) bool {
	return !n.Valid || n.Int == nil || n.Int.Sign() == 0
}

// zeroRate is 0, as a currency that is off is kept.
func zeroRate() pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(0), Valid: true}
}

// now is the clock; a variable so a test may move it.
var now = time.Now

// Rates is a standard rate row as the API shows it: the rates in so'm per
// unit, who set it (the name they go by in the company) and when.
type Rates struct {
	ID        int64
	USD       string
	EUR       string
	RUB       string
	SetByName *string
	SetAt     time.Time
}

// RatesInput is what the settings send: the rate of each currency to
// change; one left out keeps the previous row's.
type RatesInput struct {
	USD *string
	EUR *string
	RUB *string
}

// RatesPage is one page of the history.
type RatesPage struct {
	Items    []Rates
	Total    int64
	Page     int
	PageSize int
}

// History is a page of the company's standard rate rows, the newest first.
func (s *Service) History(ctx context.Context, companyID int64, page int) (RatesPage, error) {
	if page < 1 || page > maxPage {
		return RatesPage{}, invalid("Sahifa raqami noto'g'ri")
	}
	total, err := s.q.CountRates(ctx, companyID)
	if err != nil {
		return RatesPage{}, err
	}
	rows, err := s.q.ListRates(ctx, gen.ListRatesParams{CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return RatesPage{}, err
	}
	items := make([]Rates, 0, len(rows))
	for _, r := range rows {
		items = append(items, Rates{ID: r.ID, USD: RateText(r.Usd), EUR: RateText(r.Eur), RUB: RateText(r.Rub), SetByName: r.SetByName, SetAt: r.SetAt})
	}
	return RatesPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}

// SetRates enters a standard rate row as the member with phone by: each
// currency the company has on takes the rate given, or the previous row's;
// one that is off takes none (a rate given for it is refused). Nothing
// given at all is refused.
func (s *Service) SetRates(ctx context.Context, companyID int64, by string, in RatesInput) (Rates, error) {
	if in.USD == nil && in.EUR == nil && in.RUB == nil {
		return Rates{}, invalid("Kursni kiriting")
	}
	var out Rates
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errCompanyNotFound
			}
			return err
		}
		on, err := q.ListCompanyCurrencies(ctx, companyID)
		if err != nil {
			return err
		}
		enabled := map[int64]bool{}
		for _, c := range on {
			enabled[c.ID] = true
		}
		prev, err := RateAt(ctx, q, companyID, now())
		if err != nil {
			return err
		}
		rates := map[int64]pgtype.Numeric{}
		for id, given := range map[int64]*string{2: in.USD, 3: in.EUR, 4: in.RUB} {
			switch {
			case given != nil && !enabled[id]:
				return ErrNotAllowed
			case given != nil:
				n, err := Rate(*given)
				if err != nil {
					return err
				}
				rates[id] = n
			case enabled[id] && prev != nil:
				rates[id] = ColumnOf(*prev, id)
			default:
				rates[id] = zeroRate()
			}
		}
		name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: by, CompanyID: companyID})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		row, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: companyID, Usd: rates[2], Eur: rates[3], Rub: rates[4], Status: 1, SetBy: by, SetByName: name})
		if err != nil {
			return err
		}
		out = Rates{ID: row.ID, USD: RateText(row.Usd), EUR: RateText(row.Eur), RUB: RateText(row.Rub), SetByName: name, SetAt: row.SetAt}
		return nil
	})
	return out, err
}

// RateAt is the standard rate row in force at the moment: the newest set at
// or before it, or the earliest when none was yet; nil when the company has
// none at all.
func RateAt(ctx context.Context, q *gen.Queries, companyID int64, at time.Time) (*gen.CurrencyRate, error) {
	row, err := q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: companyID, At: at})
	if errors.Is(err, pgx.ErrNoRows) {
		row, err = q.GetFirstRate(ctx, companyID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// ColumnOf is the rate of the currency in the row: the so'm 1, the others
// as kept; 0 for a currency the row does not know.
func ColumnOf(r gen.CurrencyRate, currencyID int64) pgtype.Numeric {
	switch currencyID {
	case 1:
		return r.Uzs
	case 2:
		return r.Usd
	case 3:
		return r.Eur
	case 4:
		return r.Rub
	}
	return zeroRate()
}
