package ledger

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// The inputs every document shares (logic/warehouse.md, section 1;
// logic/finance.md, section 5): a page of a list, a note, an amount, an
// account, a span of days. The services of the warehouse, the sales and
// the finance read them here, with one wording.

const (
	// PageSize is how many rows a page of a list holds.
	PageSize = 20
	// maxPage keeps a page's offset inside int32.
	maxPage = 1_000_000
	// MaxNote is how long a note may be, in characters.
	MaxNote = 500
)

// PageOf reads a page number: from 1, with an offset that fits int32.
func PageOf(page int) error {
	if page < 1 || page > maxPage {
		return fields.Invalid("Sahifa raqami noto'g'ri")
	}
	return nil
}

// Note reads an optional note: trimmed, none when blank, MaxNote
// characters at most.
func Note(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	text := strings.TrimSpace(*raw)
	if text == "" {
		return nil, nil
	}
	if utf8.RuneCountInString(text) > MaxNote {
		return nil, fields.Invalid("Izoh 500 belgidan oshmasin")
	}
	return &text, nil
}

// Amount reads an amount of money: one is needed («Summani kiriting»),
// above zero, two decimals at most («Summa noto'g'ri»).
func Amount(raw *string) (pgtype.Numeric, error) {
	if raw == nil || *raw == "" {
		return pgtype.Numeric{}, fields.Invalid("Summani kiriting")
	}
	n, err := catalog.Money(raw, "Summa noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if catalog.Zero(n) {
		return pgtype.Numeric{}, fields.Invalid("Summa noto'g'ri")
	}
	return n, nil
}

// AccountFor reads the account a document names: one of the company's
// («Akkauntni tanlang» otherwise), active unless it is the one the document
// already names, keep («Akkaunt nofaol»).
func AccountFor(ctx context.Context, q *gen.Queries, companyID, id, keep int64) (gen.BankAccount, error) {
	if id == 0 {
		return gen.BankAccount{}, fields.Invalid("Akkauntni tanlang")
	}
	account, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.BankAccount{}, fields.Invalid("Akkauntni tanlang")
	}
	if err != nil {
		return gen.BankAccount{}, err
	}
	if !account.IsActive && account.ID != keep {
		return gen.BankAccount{}, fields.Invalid("Akkaunt nofaol")
	}
	return account, nil
}

// DayRange reads a span of days (from and to as YYYY-MM-DD, either
// optional) in the zone, as the UTC moment it starts at and the one it
// ends before: the midnight after the last day. A day that is not one, or
// a span that runs backwards, is refused («Sana noto'g'ri»); a zone that
// is not known is a failure of ours, the zone being the user's as the
// database keeps it.
func DayRange(from, to, tz string) (start, end *time.Time, err error) {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, nil, err
	}
	if from != "" {
		day, err := time.ParseInLocation("2006-01-02", from, loc)
		if err != nil {
			return nil, nil, fields.Invalid("Sana noto'g'ri")
		}
		moment := day.UTC()
		start = &moment
	}
	if to != "" {
		day, err := time.ParseInLocation("2006-01-02", to, loc)
		if err != nil {
			return nil, nil, fields.Invalid("Sana noto'g'ri")
		}
		moment := day.AddDate(0, 0, 1).UTC()
		end = &moment
	}
	if start != nil && end != nil && !start.Before(*end) {
		return nil, nil, fields.Invalid("Sana noto'g'ri")
	}
	return start, end, nil
}

// MemberName is the name the member goes by in the company, nil when they
// go by none or are not its member (they may have been taken out while
// the request ran): what a document keeps as created_by_name.
func MemberName(ctx context.Context, q *gen.Queries, companyID int64, phone string) (*string, error) {
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return name, err
}
