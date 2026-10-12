package finance

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// ExpenseInput is an expense or other income as the client sent it
// (logic/finance.md, section 5): the kind, the account, the category (of
// the kind), the amount in the account's currency, the moment, a note.
type ExpenseInput struct {
	Kind          string
	BankAccountID int64
	CategoryID    int64
	Amount        *string
	At            string
	Note          *string
}

// kindOfExpense reads the kind of an expense document: one is needed
// («Turni tanlang»), an expense or an income («Tur noto'g'ri»).
func kindOfExpense(raw string) (ledger.Kind, error) {
	switch raw {
	case "":
		return "", errNoKind
	case KindExpense:
		return ledger.Expense, nil
	case KindIncome:
		return ledger.Income, nil
	}
	return "", errWrongKind
}

// categoryFor reads the category a document is filed under: one of the
// company's («Kategoriyani tanlang» otherwise), of the kind («Kategoriya
// turi mos emas»), active unless it is the one the document already has,
// keep («Kategoriya nofaol»).
func categoryFor(ctx context.Context, q *gen.Queries, companyID, id int64, kind string, keep int64) (gen.FinanceCategory, error) {
	if id == 0 {
		return gen.FinanceCategory{}, invalid("Kategoriyani tanlang")
	}
	c, err := q.GetFinanceCategory(ctx, gen.GetFinanceCategoryParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.FinanceCategory{}, invalid("Kategoriyani tanlang")
	}
	if err != nil {
		return gen.FinanceCategory{}, err
	}
	if c.Kind != kind {
		return gen.FinanceCategory{}, invalid("Kategoriya turi mos emas")
	}
	if !c.IsActive && c.ID != keep {
		return gen.FinanceCategory{}, invalid("Kategoriya nofaol")
	}
	return c, nil
}

// checkExpense reads an expense or an income: the kind, then the head with
// the category between the account and the moment. kept and keep are what
// the document already names (the account, the category) on an edit.
func checkExpense(ctx context.Context, q *gen.Queries, companyID int64, by string, in ExpenseInput, keptAccount []int64, keepCategory int64) (ledger.Kind, head, int64, error) {
	kind, err := kindOfExpense(in.Kind)
	if err != nil {
		return "", head{}, 0, err
	}
	var categoryID int64
	h, err := checkHead(ctx, q, companyID, by, in.BankAccountID, keptAccount, in.At, in.Amount, in.Note, func(gen.BankAccount) error {
		c, err := categoryFor(ctx, q, companyID, in.CategoryID, in.Kind, keepCategory)
		if err != nil {
			return err
		}
		categoryID = c.ID
		return nil
	}, nil)
	if err != nil {
		return "", head{}, 0, err
	}
	return kind, h, categoryID, nil
}

// AddExpense enters an expense out of an account or other income into one,
// as the member with phone by. What is wrong is told in this order: the
// kind, the account, the category, the moment, the amount, the note.
func (s *Service) AddExpense(ctx context.Context, companyID int64, by string, in ExpenseInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		kind, h, categoryID, err := checkExpense(ctx, q, companyID, by, in, nil, 0)
		if err != nil {
			return err
		}
		d, err = enter(ctx, q, companyID, by, kind, h, func(p *gen.CreateTransactionParams) { p.CategoryID = &categoryID })
		return err
	})
	return d, err
}

// UpdateExpense saves an expense or an income with other fields, as the
// member with phone by; its kind («Tur o'zgartirilmaydi» when another is
// sent) and number stay. The document comes first: one that is not there
// is not found.
func (s *Service) UpdateExpense(ctx context.Context, companyID int64, by string, id int64, in ExpenseInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getDocument(ctx, q, companyID, id, []ledger.Kind{ledger.Expense, ledger.Income})
		if err != nil {
			return err
		}
		kind, err := kindOfExpense(in.Kind)
		if err != nil {
			return err
		}
		if kind != was.Kind {
			return invalid("Tur o'zgartirilmaydi")
		}
		var keepCategory int64
		if was.CategoryID != nil {
			keepCategory = *was.CategoryID
		}
		_, h, categoryID, err := checkExpense(ctx, q, companyID, by, in, []int64{was.BankAccountID}, keepCategory)
		if err != nil {
			return err
		}
		d, err = save(ctx, q, companyID, id, kind, h, pgtype.Numeric{}, func(p *gen.UpdateTransactionParams) { p.CategoryID = &categoryID })
		return err
	})
	return d, err
}
