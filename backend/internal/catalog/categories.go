package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

var (
	errCategoryNotFound  = apperr.New(apperr.NotFound, "not_found", "Kategoriya topilmadi")
	errCategoryNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor")
	errWrongCategory     = invalid("Kategoriya noto'g'ri")
)

// Category is a category of the company's products (logic/products.md,
// 3.4): one level, a product under one or none.
type Category struct {
	ID   int64
	Name string
}

func toCategory(c gen.ProductCategory) Category {
	return Category{ID: c.ID, Name: c.Name}
}

// Categories is the company's live categories, in their order.
func (s *Service) Categories(ctx context.Context, companyID int64) ([]Category, error) {
	rows, err := s.q.ListProductCategories(ctx, companyID)
	if err != nil {
		return nil, err
	}
	list := make([]Category, 0, len(rows))
	for _, r := range rows {
		list = append(list, toCategory(r))
	}
	return list, nil
}

// CreateCategory adds a category at the end of the company's: the name
// trimmed, 1–60 characters, one category's in the company (whatever the
// case; a deleted category's name is free).
func (s *Service) CreateCategory(ctx context.Context, companyID int64, name string) (Category, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Category{}, err
	}
	var added Category
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		c, err := q.CreateProductCategory(ctx, gen.CreateProductCategoryParams{CompanyID: companyID, Name: name})
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

// RenameCategory gives the company's category another name, under the
// rules of a new one; its products show it.
func (s *Service) RenameCategory(ctx context.Context, companyID, id int64, name string) (Category, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Category{}, err
	}
	var renamed Category
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		c, err := q.RenameProductCategory(ctx, gen.RenameProductCategoryParams{ID: id, CompanyID: companyID, Name: name})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errCategoryNotFound
		case fields.Taken(err):
			return errCategoryNameTaken
		case err != nil:
			return err
		}
		renamed = toCategory(c)
		return nil
	})
	return renamed, err
}

// DeleteCategory hides the company's category; its name is free again. One
// that live products (the inactive ones too) are filed under stays (409
// category_in_use, with how many): they go into another category, or into
// none, first.
func (s *Service) DeleteCategory(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := q.GetProductCategory(ctx, gen.GetProductCategoryParams{ID: id, CompanyID: companyID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errCategoryNotFound
			}
			return err
		}
		n, err := q.CountCategoryProducts(ctx, id)
		if err != nil {
			return err
		}
		if n > 0 {
			return apperr.New(apperr.Conflict, "category_in_use", fmt.Sprintf("Bu kategoriyada %d ta mahsulot bor", n))
		}
		_, err = q.DeleteProductCategory(ctx, gen.DeleteProductCategoryParams{ID: id, CompanyID: companyID})
		return err
	})
}

// OrderCategories puts the company's categories in the order of ids, which
// has to name each of them once and nothing else.
func (s *Service) OrderCategories(ctx context.Context, companyID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		rows, err := q.ListProductCategories(ctx, companyID)
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
		return q.OrderProductCategories(ctx, gen.OrderProductCategoriesParams{CompanyID: companyID, Ids: ids})
	})
}

// categoryAllowed says whether a product may be filed under the category:
// under none (nil), or under a live category of the company (400
// otherwise: another company's, a deleted one, none such).
func categoryAllowed(ctx context.Context, q *gen.Queries, companyID int64, id *int64) error {
	if id == nil {
		return nil
	}
	if _, err := q.GetProductCategory(ctx, gen.GetProductCategoryParams{ID: *id, CompanyID: companyID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errWrongCategory
		}
		return err
	}
	return nil
}

// CategoryFilter narrows a list of products to those of a category (ID)
// or to those with none (None); the zero value keeps them all.
type CategoryFilter struct {
	ID   int64
	None bool
}

// Query is the filter as the queries take it: the category asked for (nil
// with none asked), and whether the products with none are.
func (f CategoryFilter) Query() (id *int64, none bool) {
	if f.ID != 0 {
		return &f.ID, false
	}
	return nil, f.None
}
