// Package company runs the admin panel's company operations.
package company

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Service runs the company operations.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the company service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// Company is a company with the days its paid period has left, counted from
// the database's today; negative once it has expired.
type Company struct {
	gen.Company
	DaysLeft int
}

func invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}

// withDaysLeft counts in Unix seconds: both dates are UTC midnights, and a
// far end date would overflow the time.Duration that Sub returns.
func withDaysLeft(c gen.Company, today time.Time) Company {
	return Company{Company: c, DaysLeft: int((c.EndDate.Unix() - today.Unix()) / 86400)}
}
