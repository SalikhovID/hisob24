// Package finance runs a company's money (logic/finance.md): the accounts
// its cash sits in, which the admin keeps, and the categories its expenses
// and its other income are filed under, which the owner keeps.
package finance

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Service runs the finance of every company.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the finance service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

var errCompanyNotFound = apperr.New(apperr.NotFound, "not_found", "Kompaniya topilmadi")

func invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}

// write runs fn in one transaction that holds the company the way a write
// of its customers does (LockCompanyCustomers): the writes of a company's
// settings and documents take turns.
func (s *Service) write(ctx context.Context, companyID int64, fn func(q *gen.Queries) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errCompanyNotFound
			}
			return err
		}
		return fn(q)
	})
}

// currencyAllowed says whether an account may be in the currency: one of
// the catalog (400 otherwise) that the company has turned on (400
// currency_not_allowed otherwise).
func currencyAllowed(ctx context.Context, q *gen.Queries, companyID, currencyID int64) error {
	if currencyID == 0 {
		return invalid("Valyutani tanlang")
	}
	if _, err := q.GetCurrency(ctx, currencyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return invalid("Valyuta noto'g'ri")
		}
		return err
	}
	has, err := q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: companyID, CurrencyID: currencyID})
	if err != nil {
		return err
	}
	if !has {
		return currency.ErrNotAllowed
	}
	return nil
}
