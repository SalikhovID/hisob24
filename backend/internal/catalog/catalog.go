// Package catalog runs a company's products and services
// (logic/products.md): the goods it buys into its stock, each with a unit,
// and the services it offers.
package catalog

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// The kinds a row of the catalog is of.
const (
	KindProduct = "product"
	KindService = "service"
)

// How long a name, a SKU and a note may be, in characters.
const (
	MaxName = 120
	MaxSKU  = 60
	MaxNote = 500
)

var (
	errProductNotFound = apperr.New(apperr.NotFound, "not_found", "Mahsulot topilmadi")
	errSKUTaken        = apperr.New(apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	errNoKind          = invalid("Turni tanlang")
	errNoUnit          = invalid("Birlikni tanlang")
	errServiceUnit     = invalid("Xizmatga birlik berilmaydi")
	errServiceSKU      = invalid("Xizmatga artikul berilmaydi")
)

// Scope is a member's reach in a company: the company and the locations of
// it they may work in. The stock a member sees is these locations'.
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

// Service runs the catalog of every company; each call names the scope it
// acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the catalog service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// write runs fn in one transaction that holds the company the way a write of
// its customers does (LockCompanyCustomers): the writes of a company's
// catalog, customers, tasks and, later, purchases take turns, so what one of
// them checks cannot change under it.
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

// Product is a product or a service of a company, as the API shows it. The
// amounts are text, as the database writes them ("150000.50").
type Product struct {
	ID    int64
	Kind  string
	Name  string
	Unit  *string
	SKU   *string
	Price *string
	Note  *string
	// Active says whether it is still offered (logic/products.md, 3.3).
	Active bool
	// Quantity is the product's stock in the scope's locations (or the one
	// asked for), three decimals; nil for a service.
	Quantity *string
	// LastPrice is the price of the product's newest live purchase line,
	// whatever the location; nil when it was never bought.
	LastPrice *string
	// CreatedByName is the name the member who entered it goes by in the
	// company; nil when they go by none.
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Input is what a product or a service is saved with, as the client sent
// it. Kind is read on entry alone: it never changes.
type Input struct {
	Kind  string
	Name  string
	Unit  *string
	SKU   *string
	Price *string
	Note  *string
}

// checked is an input as it is kept: the name clean, the unit of a product
// one of the Units (a service has none, and no SKU), the price an amount or
// none, the SKU and the note trimmed or none.
type checked struct {
	Name  string
	Unit  *string
	SKU   *string
	Price pgtype.Numeric
	Note  *string
}

// check reads an input of the kind. What is wrong is told in this order:
// the kind, the name, the unit, the SKU, the price, the note.
func check(kind string, in Input) (checked, error) {
	if kind != KindProduct && kind != KindService {
		return checked{}, errNoKind
	}
	name, err := cleanName(in.Name)
	if err != nil {
		return checked{}, err
	}
	c := checked{Name: name}
	unit := trimmed(in.Unit)
	switch {
	case kind == KindService && unit != nil:
		return checked{}, errServiceUnit
	case kind == KindProduct && (unit == nil || !unitKnown(*unit)):
		return checked{}, errNoUnit
	}
	c.Unit = unit
	if kind == KindService && trimmed(in.SKU) != nil {
		return checked{}, errServiceSKU
	}
	if c.SKU, err = cleanOptional(in.SKU, MaxSKU, "Artikul 60 belgidan oshmasin"); err != nil {
		return checked{}, err
	}
	if c.Price, err = Money(in.Price, "Narx noto'g'ri"); err != nil {
		return checked{}, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return checked{}, err
	}
	return c, nil
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

// nameTaken is the refusal of a name another row of the kind has.
func nameTaken(kind string) error {
	if kind == KindService {
		return apperr.New(apperr.Conflict, "name_taken", "Bu nomli xizmat allaqachon bor")
	}
	return apperr.New(apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor")
}

// takenError tells which unique index refused the row: the SKU's or the
// name's.
func takenError(err error, kind string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == "products_sku" {
		return errSKUTaken
	}
	return nameTaken(kind)
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

func toProduct(r gen.GetProductRow) Product {
	return Product{
		ID: r.ID, Kind: r.Kind, Name: r.Name, Unit: r.Unit, SKU: r.Sku, Price: Amount(r.Price), Note: r.Note, Active: r.IsActive,
		Quantity: QuantityText(r.Quantity), LastPrice: Amount(r.LastPrice),
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}
