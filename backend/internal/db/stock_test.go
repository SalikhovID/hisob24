package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestGoodsDocumentsAreReadByKindInTheLocationsGiven(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	qoyliq := addLocation(t, pool, w.company, "Qo'yliq")
	transfer := addDocument(t, pool, w.company, doc{kind: "transfer", number: 1, at: "2026-10-05 09:00+05", location: &w.asosiy, toLocation: &w.chilonzor})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, position) VALUES ($1, $2, 2, 1)", transfer, w.olma)
	inventory := addDocument(t, pool, w.company, doc{kind: "inventory", number: 1, at: "2026-10-06 09:00+05", location: &w.chilonzor})
	opening := addDocument(t, pool, w.company, doc{kind: "opening_stock", number: 1, at: "2026-10-01 09:00+05", location: &w.asosiy, total: "500"})
	addDocument(t, pool, w.company, doc{kind: "transfer", number: 2, at: "2026-10-07 09:00+05", location: &w.asosiy, toLocation: &w.chilonzor, deleted: true})
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)

	got, err := q.GetGoodsDocument(ctx, gen.GetGoodsDocumentParams{ID: transfer, CompanyID: w.company, Kind: "transfer", LocationIds: []int64{w.chilonzor}})
	require.NoError(t, err, "a transfer is seen from its other end too")
	assert.Equal(t, "transfer", got.Kind)
	assert.EqualValues(t, 1, got.Number)
	assert.Equal(t, w.asosiy, got.LocationID)
	assert.Equal(t, "Asosiy", got.LocationName)
	assert.Equal(t, &w.chilonzor, got.ToLocationID)
	assert.Equal(t, ptr("Chilonzor"), got.ToLocationName)
	assert.Equal(t, at(t, "2026-10-05 09:00+05"), got.DocAt.UTC())
	assert.EqualValues(t, 1, got.ItemsCount)
	assert.Equal(t, "1.0000", numericText(t, got.Rate))
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	got, err = q.GetGoodsDocument(ctx, gen.GetGoodsDocumentParams{ID: opening, CompanyID: w.company, Kind: "opening_stock", LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.Nil(t, got.ToLocationID)
	assert.Nil(t, got.ToLocationName)
	assert.Equal(t, "500.00", numericText(t, got.Total))
	assert.Equal(t, "500.00", numericText(t, got.TotalUzs))
	_, err = q.GetGoodsDocument(ctx, gen.GetGoodsDocumentParams{ID: inventory, CompanyID: w.company, Kind: "inventory", LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "outside the locations given")
	_, err = q.GetGoodsDocument(ctx, gen.GetGoodsDocumentParams{ID: inventory, CompanyID: w.company, Kind: "transfer", LocationIds: []int64{w.chilonzor}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another kind")

	numbers := func(kind string, locations ...int64) []int32 {
		rows, err := q.ListGoodsDocuments(ctx, gen.ListGoodsDocumentsParams{CompanyID: w.company, Kind: kind, LocationIds: locations, Limit: 20})
		require.NoError(t, err)
		out := make([]int32, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Number)
		}
		return out
	}
	assert.Equal(t, []int32{1}, numbers("transfer", w.asosiy), "the live transfer alone")
	assert.Equal(t, []int32{1}, numbers("transfer", w.chilonzor), "seen from either end")
	assert.Empty(t, numbers("transfer", qoyliq))
	assert.Equal(t, []int32{1}, numbers("inventory", w.chilonzor))
	assert.Equal(t, []int32{1}, numbers("opening_stock", w.asosiy, w.chilonzor))
	count, err := q.CountGoodsDocuments(ctx, gen.CountGoodsDocumentsParams{CompanyID: w.company, Kind: "transfer", LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
}

func TestStockAtAMomentAndTheProductsInStock(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	first := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", first, at(t, "2026-10-01 09:00+05"))
	second := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.nok, 2, "3", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", second, at(t, "2026-10-05 09:00+05"))
	sale := addDocument(t, pool, w.company, doc{kind: "sale", number: 1, at: "2026-10-03 09:00+05", location: &w.asosiy})
	mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, -4)", sale, w.company, w.asosiy, w.olma)
	inventory := addDocument(t, pool, w.company, doc{kind: "inventory", number: 1, at: "2026-10-04 09:00+05", location: &w.asosiy})
	mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, 1)", inventory, w.company, w.asosiy, w.olma)
	stockAt := func(moment string, exclude int64) map[int64]string {
		rows, err := q.ListStockAt(ctx, gen.ListStockAtParams{LocationID: w.asosiy, At: at(t, moment), ExcludeID: exclude})
		require.NoError(t, err)
		out := map[int64]string{}
		for _, r := range rows {
			out[r.ProductID] = numericText(t, r.Quantity)
		}
		return out
	}

	assert.Equal(t, map[int64]string{w.olma: "10.000"}, stockAt("2026-10-02 00:00+05", 0), "before the sale")
	assert.Equal(t, map[int64]string{w.olma: "6.000"}, stockAt("2026-10-03 09:00+05", 0), "at the sale's moment it counts")
	assert.Equal(t, map[int64]string{w.olma: "6.000"}, stockAt("2026-10-04 09:00+05", inventory), "the inventory's own move left out")
	assert.Equal(t, map[int64]string{w.olma: "7.000", w.nok: "3.000"}, stockAt("2026-10-09 00:00+05", 0), "everything so far")
	assert.Empty(t, stockAt("2026-09-01 00:00+05", 0), "nothing yet")

	rows, err := q.ListLocationStock(ctx, gen.ListLocationStockParams{LocationID: w.asosiy, At: at(t, "2026-10-09 00:00+05")})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "Nok", rows[0].Name, "by name")
	assert.Equal(t, ptr("dona"), rows[0].Unit)
	assert.Equal(t, "3.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, w.olma, rows[1].ProductID)
	assert.Equal(t, "7.000", numericText(t, rows[1].Quantity))
	mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, -3)", sale, w.company, w.asosiy, w.nok)
	rows, err = q.ListLocationStock(ctx, gen.ListLocationStockParams{LocationID: w.asosiy, At: at(t, "2026-10-09 00:00+05")})
	require.NoError(t, err)
	assert.Len(t, rows, 1, "a product whose stock comes to 0 is left out")
	rows, err = q.ListLocationStock(ctx, gen.ListLocationStockParams{LocationID: w.chilonzor, At: at(t, "2026-10-09 00:00+05")})
	require.NoError(t, err)
	assert.Empty(t, rows, "another location")
}

func TestAProductsMoves(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", purchase, at(t, "2026-10-01 09:00+05"))
	transfer := addDocument(t, pool, w.company, doc{kind: "transfer", number: 1, at: "2026-10-05 09:00+05", location: &w.asosiy, toLocation: &w.chilonzor})
	mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $5, -2), ($1, $2, $4, $5, 2)", transfer, w.company, w.asosiy, w.chilonzor, w.olma)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.nok, 2, "1", "1", false)
	gone := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "5", "1", false)
	mustExec(t, pool, "UPDATE transactions SET deleted_at = now() WHERE id = $1", gone)
	mustExec(t, pool, "DELETE FROM stock_moves WHERE transaction_id = $1", gone)

	rows, err := q.ListProductMoves(ctx, gen.ListProductMovesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	assert.Equal(t, "transfer", rows[0].Kind, "the newest document first")
	assert.Equal(t, w.chilonzor, rows[0].LocationID, "its later move first")
	assert.Equal(t, "Chilonzor", rows[0].LocationName)
	assert.Equal(t, "2.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, "Asosiy", rows[0].Counterpart, "where it came from")
	assert.Equal(t, w.asosiy, rows[1].LocationID)
	assert.Equal(t, "-2.000", numericText(t, rows[1].Quantity))
	assert.Equal(t, "Chilonzor", rows[1].Counterpart, "where it went")
	assert.Equal(t, "purchase", rows[2].Kind)
	assert.EqualValues(t, 1, rows[2].Number)
	assert.Equal(t, at(t, "2026-10-01 09:00+05"), rows[2].DocAt.UTC())
	assert.Equal(t, "10.000", numericText(t, rows[2].Quantity))
	assert.Equal(t, "Bozor", rows[2].Counterpart, "the supplier")
	rows, err = q.ListProductMoves(ctx, gen.ListProductMovesParams{ProductID: w.olma, LocationIds: []int64{w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	assert.Len(t, rows, 1, "the locations given alone")
	count, err := q.CountProductMoves(ctx, gen.CountProductMovesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	assert.EqualValues(t, 3, count)
}

func TestOpeningBalancesOfASupplier(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	debt := addDocument(t, pool, w.company, doc{kind: "supplier_debt", number: 1, at: "2026-10-02 09:00+05", supplier: &w.bozor, total: "1000000"})
	prepay := addDocument(t, pool, w.company, doc{kind: "supplier_prepay", number: 1, at: "2026-10-03 09:00+05", supplier: &w.bozor, currency: 2, rate: rate, total: "10"})
	addDocument(t, pool, w.company, doc{kind: "supplier_debt", number: 2, at: "2026-10-04 09:00+05", supplier: &w.bozor, total: "5", deleted: true})
	addPayment(t, pool, w.company, w.bozor, nil, "1", false)

	got, err := q.GetOpening(ctx, gen.GetOpeningParams{ID: prepay, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "supplier_prepay", got.Kind)
	assert.Equal(t, w.bozor, got.SupplierID)
	assert.Equal(t, "10.00", numericText(t, got.Amount))
	assert.EqualValues(t, 2, got.CurrencyID)
	assert.Equal(t, "12800.0000", numericText(t, got.Rate))
	assert.Equal(t, "128000.00", numericText(t, got.AmountUzs))
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	_, err = q.GetOpening(ctx, gen.GetOpeningParams{ID: debt, SupplierID: w.bozor + 1, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another supplier's")

	rows, err := q.ListOpenings(ctx, gen.ListOpeningsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2, "the live ones, not the payments")
	assert.Equal(t, []int64{prepay, debt}, []int64{rows[0].ID, rows[1].ID}, "the newest first")
	count, err := q.CountOpenings(ctx, gen.CountOpeningsParams{SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
}
