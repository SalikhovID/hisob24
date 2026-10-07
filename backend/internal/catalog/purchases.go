package catalog

import (
	"context"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// StockLine is the product's stock in one location.
type StockLine struct {
	LocationID   int64
	LocationName string
	Quantity     string
}

// Detail is a product with its stock in each of the scope's locations (a
// service has none).
type Detail struct {
	Product
	Stock []StockLine
}

// ProductPurchase is one live purchase line of a product: the purchase, its
// supplier and location, the quantity, the price and what the line came to.
type ProductPurchase struct {
	PurchaseID   int64
	Number       int32
	PurchasedOn  time.Time
	SupplierID   int64
	SupplierName string
	LocationID   int64
	LocationName string
	Quantity     string
	Price        string
	Amount       string
}

// PurchasePage is one page of a product's purchase lines.
type PurchasePage struct {
	Items    []ProductPurchase
	Total    int64
	Page     int
	PageSize int
}

// Detail is the company's product or service with its stock in the scope's
// locations, each listed (0 too), in the order the locations were added; a
// service has none.
func (s *Service) Detail(ctx context.Context, scope Scope, id int64) (Detail, error) {
	p, err := get(ctx, s.q, scope, id)
	if err != nil {
		return Detail{}, err
	}
	d := Detail{Product: p, Stock: []StockLine{}}
	if p.Kind != KindProduct {
		return d, nil
	}
	rows, err := s.q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: scope.CompanyID, ProductID: id, LocationIds: scope.LocationIDs})
	if err != nil {
		return Detail{}, err
	}
	for _, r := range rows {
		d.Stock = append(d.Stock, StockLine{LocationID: r.LocationID, LocationName: r.LocationName, Quantity: *QuantityText(r.Quantity)})
	}
	return d, nil
}

// Purchases is a page of the live purchase lines of the product, in the
// scope's locations, the newest purchase first. The product comes first:
// one that is not there is not found.
func (s *Service) Purchases(ctx context.Context, scope Scope, id int64, page int) (PurchasePage, error) {
	if page < 1 || page > maxPage {
		return PurchasePage{}, invalid("Sahifa raqami noto'g'ri")
	}
	if _, err := get(ctx, s.q, scope, id); err != nil {
		return PurchasePage{}, err
	}
	total, err := s.q.CountProductPurchaseLines(ctx, gen.CountProductPurchaseLinesParams{ProductID: id, LocationIds: scope.LocationIDs})
	if err != nil {
		return PurchasePage{}, err
	}
	rows, err := s.q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{
		ProductID: id, LocationIds: scope.LocationIDs, Limit: PageSize, Offset: int32((page - 1) * PageSize),
	})
	if err != nil {
		return PurchasePage{}, err
	}
	items := make([]ProductPurchase, 0, len(rows))
	for _, r := range rows {
		items = append(items, ProductPurchase{
			PurchaseID: r.PurchaseID, Number: r.Number, PurchasedOn: r.PurchasedOn, SupplierID: r.SupplierID, SupplierName: r.SupplierName,
			LocationID: r.LocationID, LocationName: r.LocationName,
			Quantity: *QuantityText(r.Quantity), Price: *Amount(r.Price), Amount: *Amount(r.Amount),
		})
	}
	return PurchasePage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}
