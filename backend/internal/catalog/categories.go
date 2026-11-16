package catalog

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

var (
	errCategoryNotFound  = apperr.New(apperr.NotFound, "not_found", "Kategoriya topilmadi")
	errCategoryNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor")
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
