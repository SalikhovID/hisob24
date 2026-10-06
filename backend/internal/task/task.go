// Package task runs a company's tasks and what its owner sets up for them:
// the stages (the columns of the board) and the task types with their fields
// (logic/tasks.md).
package task

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// Service runs the task operations of every company; each call names the
// company it acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the task service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// write runs fn in one transaction that holds the company the way the
// customer writes do: the writes of a company's tasks, of its customers and
// of their settings take turns, so what one of them checks (a name, a count,
// an order) cannot change under it.
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
