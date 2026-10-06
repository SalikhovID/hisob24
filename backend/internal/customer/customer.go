// Package customer runs a company's customers and what its owner sets up
// for them: the customer types with their fields, and the dropdowns the
// choice fields take their options from (logic/customers.md).
package customer

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// What a form of fields is made of is shared with the tasks
// (internal/fields); these names keep the customer API as it was.
type (
	Field  = fields.Field
	Option = fields.Option
	Values = fields.Values
	Change = fields.Change
)

// The kinds a field may be of.
const (
	KindString        = fields.KindString
	KindInt           = fields.KindInt
	KindDropdown      = fields.KindDropdown
	KindMultiDropdown = fields.KindMultiDropdown
	KindRadio         = fields.KindRadio
	KindCheckbox      = fields.KindCheckbox
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

// write runs fn in one transaction that holds the company: the writes of a
// company's customers and of their settings take turns, so what one of them
// checks (a name, a count, an order) cannot change under it. Nothing else
// waits for them: someone joining the company or signing in to it goes on.
func (s *Service) write(ctx context.Context, companyID int64, fn func(q *gen.Queries) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			return err
		}
		return fn(q)
	})
}

func invalid(message string) error {
	return fields.Invalid(message)
}
