package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// PageSize is how many rows a page of the list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// ListInput narrows the list: Kind is product (the default) or service,
// Status active (the default) or inactive, Search is looked for in the
// names and the SKUs. Page starts at 1.
type ListInput struct {
	Kind   string
	Status string
	Search string
	Page   int
	// LocationID keeps the stock to one of the scope's locations (the one
	// asked for); 0 is every location of the scope.
	LocationID int64
}

// Page is one page of the list and how many rows there are on all of them.
type Page struct {
	Items    []Product
	Total    int64
	Page     int
	PageSize int
}

// List is a page of the company's products or services, by name.
func (s *Service) List(ctx context.Context, scope Scope, in ListInput) (Page, error) {
	companyID := scope.CompanyID
	if in.Page < 1 || in.Page > maxPage {
		return Page{}, invalid("Sahifa raqami noto'g'ri")
	}
	kind := in.Kind
	if kind == "" {
		kind = KindProduct
	}
	if kind != KindProduct && kind != KindService {
		return Page{}, invalid("Tur noto'g'ri")
	}
	var active bool
	switch in.Status {
	case "", "active":
		active = true
	case "inactive":
		active = false
	default:
		return Page{}, invalid("Holat noto'g'ri")
	}
	search, _ := customer.SearchOf(in.Search)
	// The stock shown is the scope's locations', or the one asked for; one
	// outside the scope counts as none (the handler refuses it before).
	locations := scope.LocationIDs
	if in.LocationID != 0 {
		locations = []int64{}
		if scope.has(in.LocationID) {
			locations = []int64{in.LocationID}
		}
	}
	total, err := s.q.CountProducts(ctx, gen.CountProductsParams{CompanyID: companyID, Kind: kind, IsActive: active, Search: search})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListProducts(ctx, gen.ListProductsParams{
		CompanyID: companyID, Kind: kind, IsActive: active, Search: search, LocationIds: locations,
		Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	items := make([]Product, 0, len(rows))
	for _, r := range rows {
		items = append(items, toProduct(gen.GetProductRow(r)))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// Get is the company's product or service.
func (s *Service) Get(ctx context.Context, scope Scope, id int64) (Product, error) {
	return get(ctx, s.q, scope, id)
}

func get(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Product, error) {
	r, err := q.GetProduct(ctx, gen.GetProductParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, errProductNotFound
	}
	if err != nil {
		return Product{}, err
	}
	return toProduct(r), nil
}

// Create enters a product or a service (in.Kind) into the company, as the
// member with phone by. What is wrong is told in the order of check, then
// a name or a SKU another row has (409).
func (s *Service) Create(ctx context.Context, scope Scope, by string, in Input) (Product, error) {
	companyID := scope.CompanyID
	c, err := check(in.Kind, in)
	if err != nil {
		return Product{}, err
	}
	var p Product
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreateProduct(ctx, gen.CreateProductParams{
			CompanyID: companyID, Kind: in.Kind, Name: c.Name, Unit: c.Unit, Sku: c.SKU, Price: c.Price, Note: c.Note,
			CreatedBy: by, CreatedByName: name,
		})
		if fields.Taken(err) {
			return takenError(err, in.Kind)
		}
		if err != nil {
			return err
		}
		p, err = get(ctx, q, scope, row.ID)
		return err
	})
	return p, err
}

// Update saves the company's product or service with other fields; its kind
// stays, whatever in.Kind says, and the fields are checked as that kind's.
// The record itself comes first: one that is not there is not found.
func (s *Service) Update(ctx context.Context, scope Scope, id int64, in Input) (Product, error) {
	companyID := scope.CompanyID
	var p Product
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := get(ctx, q, scope, id)
		if err != nil {
			return err
		}
		c, err := check(was.Kind, in)
		if err != nil {
			return err
		}
		_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{
			ID: id, CompanyID: companyID, Name: c.Name, Unit: c.Unit, Sku: c.SKU, Price: c.Price, Note: c.Note,
		})
		if fields.Taken(err) {
			return takenError(err, was.Kind)
		}
		if err != nil {
			return err
		}
		p, err = get(ctx, q, scope, id)
		return err
	})
	return p, err
}

// SetActive turns the company's product or service off (no longer offered)
// or on again.
func (s *Service) SetActive(ctx context.Context, scope Scope, id int64, active bool) (Product, error) {
	companyID := scope.CompanyID
	var p Product
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: id, CompanyID: companyID, IsActive: active})
		if errors.Is(err, pgx.ErrNoRows) {
			return errProductNotFound
		}
		if err != nil {
			return err
		}
		p, err = get(ctx, q, scope, id)
		return err
	})
	return p, err
}

// Delete hides the company's product or service; its name and SKU are free
// again. A product a live purchase holds is refused (409): it may be turned
// off instead (logic/products.md, section 4).
func (s *Service) Delete(ctx context.Context, scope Scope, id int64) error {
	companyID := scope.CompanyID
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := get(ctx, q, scope, id); err != nil {
			return err
		}
		held, err := q.CountProductPurchases(ctx, id)
		if err != nil {
			return err
		}
		if held > 0 {
			return apperr.New(apperr.Conflict, "product_in_use", fmt.Sprintf("Bu mahsulot %d ta xaridda bor", held))
		}
		_, err = q.DeleteProduct(ctx, gen.DeleteProductParams{ID: id, CompanyID: companyID})
		return err
	})
}
