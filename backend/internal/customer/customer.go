// Package customer runs a company's customers and what its owner sets up
// for them: the customer types with their fields, and the dropdowns the
// choice fields take their options from (logic/customers.md).
package customer

import (
	"errors"
	"strings"
	"unicode/utf8"

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
