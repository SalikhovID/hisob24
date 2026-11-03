package warehouse

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The warehouse's «Qoldiq» table (logic/warehouse.md, section 5): the
// products by name, each with its stock in every location of the member's,
// the sum, the last purchase price and the stock's value at it.
func TestStockSummary(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	// Olma 10 at 1 000 and Nok 5 at 2 000 into Asosiy; 4 Olma on to Chilonzor.
	stocked(t, s, m)
	_, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{move(m.olma, "4")}})
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE products SET sku = 'N-1' WHERE id = $1", m.nok)
	require.NoError(t, err)
	// Anor never moved; Behi is turned off; a service, a deleted product and
	// another company's are out.
	anor := addProduct(t, pool, m.company, "Anor", ptr("dona"), true)
	behi := addProduct(t, pool, m.company, "behi", ptr("kg"), false)
	_, err = pool.Exec(ctx, "INSERT INTO products (company_id, kind, name, created_by) VALUES ($1, 'service', 'Montaj', $2)", m.company, ali)
	require.NoError(t, err)
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), true)
	_, err = pool.Exec(ctx, "UPDATE products SET deleted_at = now() WHERE id = $1", eski)
	require.NoError(t, err)
	nok := newShop(t, pool, "Nok")
	addProduct(t, pool, nok.company, "Begona", ptr("dona"), true)

	page, err := s.StockSummary(ctx, m.scope(), "", 1)

	require.NoError(t, err)
	zero := []LocationQuantity{{LocationID: m.asosiy, Quantity: "0.000"}, {LocationID: m.chilonzor, Quantity: "0.000"}}
	assert.Equal(t, StockSummaryPage{
		Items: []StockSummaryRow{
			{ProductID: anor, Name: "Anor", Unit: "dona", Active: true, Locations: zero, Total: "0.000"},
			{ProductID: behi, Name: "behi", Unit: "kg", Active: false, Locations: zero, Total: "0.000"},
			{
				ProductID: m.nok, Name: "Nok", SKU: ptr("N-1"), Unit: "dona", Active: true,
				Locations: []LocationQuantity{{LocationID: m.asosiy, Quantity: "5.000"}, {LocationID: m.chilonzor, Quantity: "0.000"}},
				Total:     "5.000", LastPrice: &Money{Amount: "2000.00", CurrencyID: 1}, Value: ptr("10000.00"),
			},
			{
				ProductID: m.olma, Name: "Olma", Unit: "kg", Active: true,
				Locations: []LocationQuantity{{LocationID: m.asosiy, Quantity: "6.000"}, {LocationID: m.chilonzor, Quantity: "4.000"}},
				Total:     "10.000", LastPrice: &Money{Amount: "1000.00", CurrencyID: 1}, Value: ptr("10000.00"),
			},
		},
		Total: 4, Page: 1, PageSize: PageSize,
	}, page, "by name whatever the case; the never moved and the turned off with zeros; the service, the deleted and another company's out")

	found, err := s.StockSummary(ctx, m.scope(), " n-1 ", 1)
	require.NoError(t, err)
	assert.Equal(t, []int64{m.nok}, ids(found), "by the SKU too")

	one, err := s.StockSummary(ctx, m.scope(m.chilonzor), "olma", 1)
	require.NoError(t, err)
	require.Len(t, one.Items, 1)
	assert.Equal(t, []LocationQuantity{{LocationID: m.chilonzor, Quantity: "4.000"}}, one.Items[0].Locations, "the member's locations alone")
	assert.Equal(t, "4.000", one.Items[0].Total)
	assert.Equal(t, ptr("4000.00"), one.Items[0].Value)

	none, err := s.StockSummary(ctx, m.nowhere(), "", 1)
	require.NoError(t, err)
	assert.Equal(t, StockSummaryPage{Items: []StockSummaryRow{}, Total: 0, Page: 1, PageSize: PageSize}, none, "a member with no location sees nothing")

	_, err = s.StockSummary(ctx, m.scope(), "", 0)
	assert.Error(t, err, "a page is 1 or more")
}

// ids is the products of a page.
func ids(page StockSummaryPage) []int64 {
	out := make([]int64, 0, len(page.Items))
	for _, row := range page.Items {
		out = append(out, row.ProductID)
	}
	return out
}
