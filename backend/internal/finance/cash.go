package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
)

// The cash documents (logic/finance.md, section 5): an opening balance of
// the cash, an expense or other income, a transfer between accounts, a
// conversion. They are read as one shape, Document; each kind is entered
// and saved with its own input.

var errDocumentNotFound = apperr.New(apperr.NotFound, "not_found", "Hujjat topilmadi")

// Document is a cash document as the API shows it: its account (the
// source), in the account's currency; the account it goes to and the
// amount that arrives (a transfer, a conversion); its category (an
// expense, an income); the rate a conversion comes to.
type Document struct {
	ID              int64
	Kind            ledger.Kind
	Number          int32
	At              time.Time
	BankAccountID   int64
	AccountName     string
	CurrencyID      int64
	Amount          string
	ToBankAccountID *int64
	ToAccountName   *string
	ToCurrencyID    *int64
	ToAmount        *string
	CategoryID      *int64
	CategoryName    *string
	Rate            *string
	Note            *string
	CreatedByName   *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// DocumentPage is one page of cash documents.
type DocumentPage struct {
	Items    []Document
	Total    int64
	Page     int
	PageSize int
}

// ListInput is what a list of cash documents is narrowed to: the kinds
// (one or more), an account (as the source or the target), a category, a
// span of moments (From included, To excluded), and the page.
type ListInput struct {
	Kinds      []ledger.Kind
	AccountID  *int64
	CategoryID *int64
	From       *time.Time
	To         *time.Time
	Page       int
}

func kindsOf(kinds []ledger.Kind) []string {
	names := make([]string, 0, len(kinds))
	for _, k := range kinds {
		names = append(names, string(k))
	}
	return names
}

// amountOf is a stored amount as the API shows it ("150000.50").
func amountOf(n pgtype.Numeric) string {
	if text := numtext.Amount(n); text != nil {
		return *text
	}
	return "0.00"
}

func toDocument(r gen.GetCashDocumentRow) Document {
	d := Document{
		ID: r.ID, Kind: ledger.Kind(r.Kind), Number: r.Number, At: r.DocAt.UTC(), AccountName: r.AccountName, CurrencyID: r.CurrencyID, Amount: amountOf(r.Total),
		ToBankAccountID: r.ToBankAccountID, ToAccountName: r.ToAccountName, ToCurrencyID: r.ToCurrencyID, ToAmount: numtext.Amount(r.ToTotal),
		CategoryID: r.CategoryID, CategoryName: r.CategoryName, Note: r.Note, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if r.BankAccountID != nil {
		d.BankAccountID = *r.BankAccountID
	}
	return d
}

func getDocument(ctx context.Context, q *gen.Queries, companyID, id int64, kinds []ledger.Kind) (Document, error) {
	r, err := q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: id, CompanyID: companyID, Kinds: kindsOf(kinds)})
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, errDocumentNotFound
	}
	if err != nil {
		return Document{}, err
	}
	return toDocument(r), nil
}

// ListDocuments is a page of the company's live cash documents of the
// kinds, the newest first, narrowed as in says.
func (s *Service) ListDocuments(ctx context.Context, companyID int64, in ListInput) (DocumentPage, error) {
	if err := ledger.PageOf(in.Page); err != nil {
		return DocumentPage{}, err
	}
	kinds := kindsOf(in.Kinds)
	total, err := s.q.CountCashDocuments(ctx, gen.CountCashDocumentsParams{CompanyID: companyID, Kinds: kinds, AccountID: in.AccountID, CategoryID: in.CategoryID, FromAt: in.From, ToAt: in.To})
	if err != nil {
		return DocumentPage{}, err
	}
	rows, err := s.q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{
		CompanyID: companyID, Kinds: kinds, AccountID: in.AccountID, CategoryID: in.CategoryID, FromAt: in.From, ToAt: in.To,
		Limit: ledger.PageSize, Offset: int32((in.Page - 1) * ledger.PageSize),
	})
	if err != nil {
		return DocumentPage{}, err
	}
	items := make([]Document, 0, len(rows))
	for _, r := range rows {
		items = append(items, toDocument(gen.GetCashDocumentRow(r)))
	}
	return DocumentPage{Items: items, Total: total, Page: in.Page, PageSize: ledger.PageSize}, nil
}

// GetDocument is the company's live cash document of one of the kinds; one
// of another kind, another company's or deleted is not found.
func (s *Service) GetDocument(ctx context.Context, companyID, id int64, kinds ...ledger.Kind) (Document, error) {
	return getDocument(ctx, s.q, companyID, id, kinds)
}

// DeleteDocument hides the company's cash document of one of the kinds: its
// number is never given again. One that is not there is not found.
func (s *Service) DeleteDocument(ctx context.Context, companyID, id int64, kinds ...ledger.Kind) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getDocument(ctx, q, companyID, id, kinds); err != nil {
			return err
		}
		_, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: companyID})
		return err
	})
}

// head is what every cash document is saved with, as it is kept: the
// account, the moment and the rate row in force then, the amount, the note.
type head struct {
	account gen.BankAccount
	at      time.Time
	rateID  int64
	amount  pgtype.Numeric
	note    *string
}

// checkHead reads the fields every cash document shares, in the order of
// logic/finance.md, section 5: the account (keep: the one the document
// already names, off or not), the moment, the amount, the note. between
// runs after the account, for what a kind checks between the account and
// the moment (a category, the account a transfer goes to).
func checkHead(ctx context.Context, q *gen.Queries, companyID int64, by string, accountID int64, keep int64, at string, amount, note *string, between func(account gen.BankAccount) error) (head, error) {
	var h head
	account, err := ledger.AccountFor(ctx, q, companyID, accountID, keep)
	if err != nil {
		return h, err
	}
	h.account = account
	if between != nil {
		if err := between(account); err != nil {
			return h, err
		}
	}
	if h.at, err = ledger.At(at); err != nil {
		return h, err
	}
	if h.rateID, err = ledger.RateRowAt(ctx, q, companyID, h.at, by); err != nil {
		return h, err
	}
	if h.amount, err = ledger.Amount(amount); err != nil {
		return h, err
	}
	if h.note, err = ledger.Note(note); err != nil {
		return h, err
	}
	return h, nil
}

// enter writes a new cash document of the kind with the head and whatever
// else the kind names (fill), numbered on within the kind, as the member
// with phone by, and reads it back.
func enter(ctx context.Context, q *gen.Queries, companyID int64, by string, kind ledger.Kind, h head, fill func(p *gen.CreateTransactionParams)) (Document, error) {
	name, err := ledger.MemberName(ctx, q, companyID, by)
	if err != nil {
		return Document{}, err
	}
	number, err := ledger.NextNumber(ctx, q, companyID, kind)
	if err != nil {
		return Document{}, err
	}
	p := gen.CreateTransactionParams{
		CompanyID: companyID, Kind: string(kind), Number: number, DocAt: h.at, BankAccountID: &h.account.ID,
		CurrencyID: h.account.CurrencyID, CurrencyRateID: h.rateID, Total: h.amount, Note: h.note, CreatedBy: by, CreatedByName: name,
	}
	if fill != nil {
		fill(&p)
	}
	row, err := q.CreateTransaction(ctx, p)
	if err != nil {
		return Document{}, err
	}
	return getDocument(ctx, q, companyID, row.ID, []ledger.Kind{kind})
}

// save writes a cash document's head and whatever else the kind names
// (fill) over the document, its amount apart, and reads it back.
func save(ctx context.Context, q *gen.Queries, companyID, id int64, kind ledger.Kind, h head, toTotal pgtype.Numeric, fill func(p *gen.UpdateTransactionParams)) (Document, error) {
	p := gen.UpdateTransactionParams{DocAt: h.at, BankAccountID: &h.account.ID, CurrencyID: h.account.CurrencyID, CurrencyRateID: h.rateID, Note: h.note, ID: id, CompanyID: companyID}
	if fill != nil {
		fill(&p)
	}
	if _, err := q.UpdateTransaction(ctx, p); err != nil {
		return Document{}, err
	}
	if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{Total: h.amount, ToTotal: toTotal, ID: id}); err != nil {
		return Document{}, err
	}
	return getDocument(ctx, q, companyID, id, []ledger.Kind{kind})
}
