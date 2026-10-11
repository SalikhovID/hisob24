package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

var errProductNotFound = apperr.New(apperr.NotFound, "not_found", "Mahsulot topilmadi")

// StockRow is a product in stock in a location: its name, unit and stock.
type StockRow struct {
	ProductID int64
	Name      string
	Unit      *string
	Quantity  string
}

// StockAt is the products in stock in the location (one of the scope's)
// at the moment (now when none is given): what an inventory starts from
// (logic/warehouse.md, section 5).
func (s *Service) StockAt(ctx context.Context, scope Scope, locationID int64, at *time.Time) ([]StockRow, error) {
	if locationID == 0 || !scope.has(locationID) {
		return nil, errNoLocation
	}
	moment := time.Now()
	if at != nil {
		moment = *at
	}
	rows, err := s.q.ListLocationStock(ctx, gen.ListLocationStockParams{LocationID: locationID, At: moment})
	if err != nil {
		return nil, err
	}
	out := make([]StockRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, StockRow{ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Quantity: quantity(r.Quantity)})
	}
	return out, nil
}

// ProductMove is one move of a product in the stock journal: the document
// it came with, the location, the quantity (in above zero, out below) and
// the counterpart (the supplier, or a transfer's other location; nil for
// none).
type ProductMove struct {
	ID            int64
	TransactionID int64
	Kind          string
	Number        int32
	At            time.Time
	LocationID    int64
	LocationName  string
	Quantity      string
	Counterpart   *string
}

// ProductMovePage is one page of a product's moves.
type ProductMovePage struct {
	Items    []ProductMove
	Total    int64
	Page     int
	PageSize int
}

// ProductMoves is a page of the product's moves in the scope's locations,
// or in the one asked for, the newest document first (logic/products.md,
// section 6). The product comes first: one that is not there is not found.
func (s *Service) ProductMoves(ctx context.Context, scope Scope, productID, locationID int64, page int) (ProductMovePage, error) {
	if err := pageOf(page); err != nil {
		return ProductMovePage{}, err
	}
	if _, err := s.q.ProductStanding(ctx, gen.ProductStandingParams{ID: productID, CompanyID: scope.CompanyID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProductMovePage{}, errProductNotFound
		}
		return ProductMovePage{}, err
	}
	locations := locationsOf(scope, locationID)
	total, err := s.q.CountProductMoves(ctx, gen.CountProductMovesParams{ProductID: productID, LocationIds: locations})
	if err != nil {
		return ProductMovePage{}, err
	}
	rows, err := s.q.ListProductMoves(ctx, gen.ListProductMovesParams{ProductID: productID, LocationIds: locations, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return ProductMovePage{}, err
	}
	items := make([]ProductMove, 0, len(rows))
	for _, r := range rows {
		m := ProductMove{ID: r.ID, TransactionID: r.TransactionID, Kind: r.Kind, Number: r.Number, At: r.DocAt.UTC(), LocationID: r.LocationID, LocationName: r.LocationName, Quantity: quantity(r.Quantity)}
		if r.Counterpart != "" {
			counterpart := r.Counterpart
			m.Counterpart = &counterpart
		}
		items = append(items, m)
	}
	return ProductMovePage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}
