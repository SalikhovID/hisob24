package warehouse

import (
	"context"
	"math/big"

	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// LocationQuantity is a product's stock in one location.
type LocationQuantity struct {
	LocationID int64
	Quantity   string
}

// Money is a sum in a currency.
type Money struct {
	Amount     string
	CurrencyID int64
}

// StockSummaryRow is a product of the «Qoldiq» table.
type StockSummaryRow struct {
	ProductID int64
	Name      string
	SKU       *string
	Unit      string
	Active    bool
	Locations []LocationQuantity
	Total     string
	LastPrice *Money
	Value     *string
}

// StockSummaryPage is one page of the «Qoldiq» table.
type StockSummaryPage struct {
	Items    []StockSummaryRow
	Total    int64
	Page     int
	PageSize int
}

// StockSummary is a page of the warehouse's «Qoldiq» table
// (logic/warehouse.md, section 5): the company's live products (no service;
// the turned off ones too) by name, those whose name or SKU holds search
// when one is given, twenty to a page; each with its stock in every
// location of the scope (in the scope's order, nothing as 0), the sum, its
// last purchase price and the sum's value at it. A member with no location
// sees an empty page.
func (s *Service) StockSummary(ctx context.Context, scope Scope, search string, page int) (StockSummaryPage, error) {
	if err := pageOf(page); err != nil {
		return StockSummaryPage{}, err
	}
	out := StockSummaryPage{Items: []StockSummaryRow{}, Page: page, PageSize: PageSize}
	if len(scope.LocationIDs) == 0 {
		return out, nil
	}
	text, _ := customer.SearchOf(search)
	total, err := s.q.CountStockSummary(ctx, gen.CountStockSummaryParams{CompanyID: scope.CompanyID, Search: text})
	if err != nil {
		return StockSummaryPage{}, err
	}
	rows, err := s.q.ListStockSummary(ctx, gen.ListStockSummaryParams{
		CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs, Search: text, Limit: PageSize, Offset: int32((page - 1) * PageSize),
	})
	if err != nil {
		return StockSummaryPage{}, err
	}
	products := make([]int64, 0, len(rows))
	for _, row := range rows {
		products = append(products, row.ID)
	}
	moved, err := s.q.ListStockByLocation(ctx, gen.ListStockByLocationParams{CompanyID: scope.CompanyID, ProductIds: products, LocationIds: scope.LocationIDs})
	if err != nil {
		return StockSummaryPage{}, err
	}
	held := make(map[[2]int64]string, len(moved))
	for _, m := range moved {
		held[[2]int64{m.ProductID, m.LocationID}] = quantity(m.Quantity)
	}
	out.Total = total
	for _, row := range rows {
		item := StockSummaryRow{ProductID: row.ID, Name: row.Name, SKU: row.Sku, Active: row.IsActive, Total: quantity(row.Total)}
		if row.Unit != nil {
			item.Unit = *row.Unit
		}
		item.Locations = make([]LocationQuantity, 0, len(scope.LocationIDs))
		for _, location := range scope.LocationIDs {
			q, ok := held[[2]int64{row.ID, location}]
			if !ok {
				q = "0.000"
			}
			item.Locations = append(item.Locations, LocationQuantity{LocationID: location, Quantity: q})
		}
		if row.LastPrice.Valid {
			price := amount(row.LastPrice)
			item.LastPrice = &Money{Amount: price, CurrencyID: row.LastPriceCurrencyID}
			value := times(item.Total, price)
			item.Value = &value
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

// times is a quantity times a price, as money: two decimals.
func times(quantity, price string) string {
	q, _ := new(big.Rat).SetString(quantity)
	p, _ := new(big.Rat).SetString(price)
	if q == nil || p == nil {
		return "0.00"
	}
	return new(big.Rat).Mul(q, p).FloatString(2)
}
