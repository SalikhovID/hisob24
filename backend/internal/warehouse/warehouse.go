// Package warehouse runs a company's warehouse (logic/warehouse.md): the
// suppliers it buys from, its purchases into the stock of its locations,
// the stock itself, and the payments to the suppliers and what is owed them.
package warehouse

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// PageSize is how many rows a page of a list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// How long a name and a note may be, in characters.
const (
	MaxName = 120
	MaxNote = 500
)

var (
	errSupplierNotFound  = apperr.New(apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
	errPurchaseNotFound  = apperr.New(apperr.NotFound, "not_found", "Xarid topilmadi")
	errPaymentNotFound   = apperr.New(apperr.NotFound, "not_found", "To'lov topilmadi")
	errSupplierNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	errPaymentLinked     = apperr.New(apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	errStockInsufficient = apperr.New(apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q")
	errNoLocation        = invalid("Lokatsiyani tanlang")
)

// Scope is a member's reach in a company: the company and the locations of
// it they may work in. The purchases a member reads, enters and changes are
// those of these locations alone; the suppliers and the balances are the
// company's.
type Scope struct {
	CompanyID   int64
	LocationIDs []int64
}

// has tells whether the location is one of the scope's.
func (sc Scope) has(locationID int64) bool {
	for _, id := range sc.LocationIDs {
		if id == locationID {
			return true
		}
	}
	return false
}

// Service runs the warehouse of every company; each call names the company
// (or the scope) it acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the warehouse service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// write runs fn in one transaction that holds the company the way a write of
// its customers does (LockCompanyCustomers): the writes of a company's
// warehouse, catalog, customers and tasks take turns, so a purchase's
// number, the stock and the balances are never raced.
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

// cleanName is a name as it is kept: without the spaces around it, not
// empty and not longer than MaxName.
func cleanName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	switch {
	case name == "":
		return "", invalid("Nomni kiriting")
	case utf8.RuneCountInString(name) > MaxName:
		return "", invalid("Nom 120 belgidan oshmasin")
	}
	return name, nil
}

// trimmed is an optional text without the spaces around it; nil when there
// is nothing left.
func trimmed(raw *string) *string {
	if raw == nil {
		return nil
	}
	text := strings.TrimSpace(*raw)
	if text == "" {
		return nil
	}
	return &text
}

// cleanOptional is an optional text as it is kept: trimmed, nil when empty,
// refused with tooLong past max characters.
func cleanOptional(raw *string, max int, tooLong string) (*string, error) {
	text := trimmed(raw)
	if text != nil && utf8.RuneCountInString(*text) > max {
		return nil, invalid(tooLong)
	}
	return text, nil
}

// memberName is the name the member goes by in the company, nil when they
// go by none or are not its member (they may have been taken out while the
// request ran).
func memberName(ctx context.Context, q *gen.Queries, companyID int64, phone string) (*string, error) {
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return name, err
}
