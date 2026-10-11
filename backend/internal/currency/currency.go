// Package currency keeps the currencies of the companies
// (logic/currencies.md): the catalog, which ones a company has turned on,
// and the rates it keeps against the so'm.
package currency

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// UZS is the so'm: every company's base currency, always on.
const UZS int64 = 1

// Currency is a currency of the catalog.
type Currency struct {
	ID     int64
	Code   string
	Name   string
	Symbol string
}

// CompanyCurrency is a currency the company has turned on, with the rate in
// force now ("12800.0000", so'm per unit): "1.0000" for the so'm, nil while
// none was set.
type CompanyCurrency struct {
	Currency
	Rate *string
}

// Service runs the currencies of every company.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the currency service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

var (
	errCompanyNotFound = apperr.New(apperr.NotFound, "not_found", "Kompaniya topilmadi")
	errUnknownCurrency = invalid("Valyuta noto'g'ri")
	// ErrNotAllowed: the currency is not turned on in the company.
	ErrNotAllowed = apperr.New(apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")
)

func invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}

func toCurrency(c gen.Currency) Currency {
	return Currency{ID: c.ID, Code: c.Code, Name: c.Name, Symbol: c.Symbol}
}

// Catalog is every currency there is, the so'm first.
func (s *Service) Catalog(ctx context.Context) ([]Currency, error) {
	rows, err := s.q.ListCurrencies(ctx)
	if err != nil {
		return nil, err
	}
	list := make([]Currency, 0, len(rows))
	for _, r := range rows {
		list = append(list, toCurrency(r))
	}
	return list, nil
}

// OfCompany is the currencies the company has turned on, each with the
// rate in force now.
func (s *Service) OfCompany(ctx context.Context, companyID int64) ([]CompanyCurrency, error) {
	return ofCompany(ctx, s.q, companyID)
}

func ofCompany(ctx context.Context, q *gen.Queries, companyID int64) ([]CompanyCurrency, error) {
	rows, err := q.ListCompanyCurrencies(ctx, companyID)
	if err != nil {
		return nil, err
	}
	rate, err := RateAt(ctx, q, companyID, now())
	if err != nil {
		return nil, err
	}
	list := make([]CompanyCurrency, 0, len(rows))
	for _, r := range rows {
		c := CompanyCurrency{Currency: toCurrency(r)}
		switch {
		case r.ID == UZS:
			c.Rate = ptr("1.0000")
		case rate != nil && !zero(ColumnOf(*rate, r.ID)):
			c.Rate = ptr(RateText(ColumnOf(*rate, r.ID)))
		}
		list = append(list, c)
	}
	return list, nil
}

// SetOfCompany turns on the currencies with the ids given and off the rest,
// as the admin: the so'm stays on whether named or not. One of the ids not
// in the catalog is refused (400); a currency a live product is priced in
// cannot be turned off (409 currency_in_use). The company's currencies as
// they are after.
func (s *Service) SetOfCompany(ctx context.Context, companyID int64, ids []int64, adminID int64) ([]CompanyCurrency, error) {
	var list []CompanyCurrency
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errCompanyNotFound
			}
			return err
		}
		wanted := map[int64]bool{UZS: true}
		for _, id := range ids {
			if _, err := q.GetCurrency(ctx, id); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return errUnknownCurrency
				}
				return err
			}
			wanted[id] = true
		}
		current, err := q.ListCompanyCurrencies(ctx, companyID)
		if err != nil {
			return err
		}
		on := map[int64]bool{}
		for _, c := range current {
			on[c.ID] = true
			if wanted[c.ID] {
				continue
			}
			used, err := q.CountCurrencyProducts(ctx, gen.CountCurrencyProductsParams{CompanyID: companyID, CurrencyID: c.ID})
			if err != nil {
				return err
			}
			if used > 0 {
				return apperr.New(apperr.Conflict, "currency_in_use", fmt.Sprintf("Bu valyutada %d ta mahsulot bor", used))
			}
			if err := q.RemoveCompanyCurrency(ctx, gen.RemoveCompanyCurrencyParams{CompanyID: companyID, CurrencyID: c.ID}); err != nil {
				return err
			}
		}
		for id := range wanted {
			if on[id] {
				continue
			}
			if err := q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: companyID, CurrencyID: id, AddedBy: &adminID}); err != nil {
				return err
			}
		}
		list, err = ofCompany(ctx, q, companyID)
		return err
	})
	return list, err
}

func ptr[T any](v T) *T { return &v }
