// Package customer runs a company's customers and what its owner sets up
// for them: the customer types with their fields, and the dropdowns the
// choice fields take their options from (logic/customers.md).
package customer

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Service runs the customer operations of every company; each call names
// the company it acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the customer service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}
