// Package customer runs a company's customers and what its owner sets up
// for them: the customer types with their fields, and the dropdowns the
// choice fields take their options from (logic/customers.md).
package customer

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
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

// maxName is how long the name of a type, a field, a dropdown or an option
// may be, in characters.
const maxName = 60

func invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}

// cleanName is a name as it is kept: without the spaces around it, not empty
// and not longer than maxName.
func cleanName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	switch {
	case name == "":
		return "", invalid("Nomni kiriting")
	case utf8.RuneCountInString(name) > maxName:
		return "", invalid("Nom 60 belgidan oshmasin")
	}
	return name, nil
}

// taken tells that a name is in use already: its unique index refused it.
func taken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// errOrderChanged refuses a new order that does not name what is there now:
// the list was changed elsewhere since the client read it.
var errOrderChanged = apperr.New(apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

// sameIDs tells whether ids names each of live once and nothing else.
func sameIDs(ids, live []int64) bool {
	if len(ids) != len(live) {
		return false
	}
	left := make(map[int64]bool, len(live))
	for _, id := range live {
		left[id] = true
	}
	for _, id := range ids {
		if !left[id] {
			return false
		}
		delete(left, id)
	}
	return true
}
