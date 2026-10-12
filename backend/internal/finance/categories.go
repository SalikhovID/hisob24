package finance

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// The kinds of a category: what an expense is filed under, what other
// income is.
const (
	KindExpense = "expense"
	KindIncome  = "income"
)

var (
	errCategoryNotFound  = apperr.New(apperr.NotFound, "not_found", "Kategoriya topilmadi")
	errCategoryNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor")
	errNoKind            = invalid("Turni tanlang")
	errWrongKind         = invalid("Tur noto'g'ri")
)

// Category is a category of the company's expenses or its other income
// (logic/finance.md, section 6); off (not Active) it is offered to no new
// document.
type Category struct {
	ID     int64
	Name   string
	Kind   string
	Active bool
}

// CategoryInput is a new category as the owner sent it.
type CategoryInput struct {
	Name string
	Kind string
}

// CategoryPatch is a change of a category: each field given replaces the
// category's, one left out (nil) stays. The kind never changes.
type CategoryPatch struct {
	Name   *string
	Active *bool
}

func toCategory(c gen.FinanceCategory) Category {
	return Category{ID: c.ID, Name: c.Name, Kind: c.Kind, Active: c.IsActive}
}

func kindKnown(kind string) bool {
	return kind == KindExpense || kind == KindIncome
}

// Categories is the company's live categories of the kind, in their order;
// with no kind, every kind, the expenses first.
func (s *Service) Categories(ctx context.Context, companyID int64, kind string) ([]Category, error) {
	var of *string
	if kind != "" {
		if !kindKnown(kind) {
			return nil, errWrongKind
		}
		of = &kind
	}
	rows, err := s.q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: companyID, Kind: of})
	if err != nil {
		return nil, err
	}
	list := make([]Category, 0, len(rows))
	for _, r := range rows {
		list = append(list, toCategory(r))
	}
	return list, nil
}

// CreateCategory adds a category at the end of the company's of the kind:
// the name trimmed, 1–60 characters, one category's among the kind
// (whatever the case; a deleted category's name is free).
func (s *Service) CreateCategory(ctx context.Context, companyID int64, in CategoryInput) (Category, error) {
	if !kindKnown(in.Kind) {
		return Category{}, errNoKind
	}
	name, err := fields.CleanName(in.Name)
	if err != nil {
		return Category{}, err
	}
	var added Category
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		c, err := q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: companyID, Name: name, Kind: in.Kind})
		if fields.Taken(err) {
			return errCategoryNameTaken
		}
		if err != nil {
			return err
		}
		added = toCategory(c)
		return nil
	})
	return added, err
}

// UpdateCategory changes the company's category as the patch says.
func (s *Service) UpdateCategory(ctx context.Context, companyID, id int64, patch CategoryPatch) (Category, error) {
	var name *string
	if patch.Name != nil {
		cleaned, err := fields.CleanName(*patch.Name)
		if err != nil {
			return Category{}, err
		}
		name = &cleaned
	}
	var updated Category
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		c, err := q.UpdateFinanceCategory(ctx, gen.UpdateFinanceCategoryParams{ID: id, CompanyID: companyID, Name: name, IsActive: patch.Active})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errCategoryNotFound
		case fields.Taken(err):
			return errCategoryNameTaken
		case err != nil:
			return err
		}
		updated = toCategory(c)
		return nil
	})
	return updated, err
}

// DeleteCategory hides the company's category; its name is free again. One
// that live documents are filed under stays (409 category_in_use, with
// how many): it may be turned off instead.
func (s *Service) DeleteCategory(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := q.GetFinanceCategory(ctx, gen.GetFinanceCategoryParams{ID: id, CompanyID: companyID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errCategoryNotFound
			}
			return err
		}
		n, err := q.CountCategoryDocuments(ctx, id)
		if err != nil {
			return err
		}
		if n > 0 {
			return apperr.New(apperr.Conflict, "category_in_use", fmt.Sprintf("Bu kategoriyada %d ta hujjat bor", n))
		}
		_, err = q.DeleteFinanceCategory(ctx, gen.DeleteFinanceCategoryParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errCategoryNotFound
		}
		return err
	})
}

// OrderCategories puts the company's categories of the kind in the order
// of ids, which has to name each of them once and nothing else.
func (s *Service) OrderCategories(ctx context.Context, companyID int64, kind string, ids []int64) error {
	if !kindKnown(kind) {
		return errWrongKind
	}
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		rows, err := q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: companyID, Kind: &kind})
		if err != nil {
			return err
		}
		live := make([]int64, 0, len(rows))
		for _, c := range rows {
			live = append(live, c.ID)
		}
		if !fields.SameIDs(ids, live) {
			return fields.ErrOrderChanged
		}
		return q.OrderFinanceCategories(ctx, gen.OrderFinanceCategoriesParams{CompanyID: companyID, Kind: kind, Ids: ids})
	})
}
