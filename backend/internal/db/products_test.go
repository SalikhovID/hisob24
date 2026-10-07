package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// numeric is an amount as a query takes it.
func numeric(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	var n pgtype.Numeric
	require.NoError(t, n.Scan(s))
	return n
}

// numericText is a stored amount as pgx writes it: with the column's
// decimals ("1200.50"), but a zero without them ("0": pgx decodes a zero
// numeric without its scale; the services pad it on the way out).
func numericText(t *testing.T, n pgtype.Numeric) string {
	t.Helper()
	require.True(t, n.Valid, "an amount is there")
	v, err := n.Value()
	require.NoError(t, err)
	s, ok := v.(string)
	require.True(t, ok)
	return s
}

// createProduct enters a product (or, with no unit, a service) of the
// company, as enteredBy, who has to be a user.
func createProduct(t *testing.T, q *gen.Queries, companyID int64, kind, name string, unit *string) gen.Product {
	t.Helper()
	p, err := q.CreateProduct(t.Context(), gen.CreateProductParams{CompanyID: companyID, Kind: kind, Name: name, Unit: unit, CreatedBy: enteredBy})
	require.NoError(t, err)
	return p
}

func TestCreateProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")

	p, err := q.CreateProduct(ctx, gen.CreateProductParams{
		CompanyID: olma.ID, Kind: "product", Name: "Olma", Unit: ptr("kg"), Sku: ptr("A-1"), Price: numeric(t, "1200.5"), Note: ptr("Qizil"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})

	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, olma.ID, p.CompanyID)
	assert.Equal(t, "product", p.Kind)
	assert.Equal(t, "Olma", p.Name)
	assert.Equal(t, ptr("kg"), p.Unit)
	assert.Equal(t, ptr("A-1"), p.Sku)
	assert.Equal(t, "1200.50", numericText(t, p.Price), "two decimals, as the column keeps it")
	assert.Equal(t, ptr("Qizil"), p.Note)
	assert.True(t, p.IsActive)
	assert.Equal(t, enteredBy, p.CreatedBy)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName, "the name the member went by then")
	assert.Equal(t, p.CreatedAt, p.UpdatedAt, "not edited yet")
	assert.Nil(t, p.DeletedAt)
	service := createProduct(t, q, olma.ID, "service", "Yetkazish", nil)
	assert.Nil(t, service.Unit)
	assert.False(t, service.Price.Valid, "no price")
	_, err = q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "olma", Unit: ptr("dona"), CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the name is taken among the products") // unique_violation
	_, err = q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "Nok", Unit: ptr("dona"), Sku: ptr("a-1"), CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the SKU is taken")
}

func TestGetProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	addMember(t, q, olma.ID, enteredBy, "Ali aka", "owner")
	p, err := q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "Olma", Unit: ptr("kg"), CreatedBy: enteredBy, CreatedByName: ptr("Ali")})
	require.NoError(t, err)
	gone := createProduct(t, q, olma.ID, "service", "Eski", nil)
	mustExec(t, pool, "UPDATE products SET deleted_at = now() WHERE id = $1", gone.ID)

	got, err := q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Olma", got.Name)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName, "the name the member goes by in the company now")

	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", enteredBy)
	got, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Ali"), got.CreatedByName, "once they have left, the name of then")

	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's product")
	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: gone.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted one")
}

func TestListProducts(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	nokP := createProduct(t, q, olma.ID, "product", "Nok", ptr("dona"))
	mustExec(t, pool, "UPDATE products SET sku = 'N-1' WHERE id = $1", nokP.ID)
	anor := createProduct(t, q, olma.ID, "product", "anor", ptr("kg"))
	olmaP := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	mustExec(t, pool, "UPDATE products SET is_active = false WHERE id = $1", olmaP.ID)
	createProduct(t, q, olma.ID, "service", "Yetkazish", nil)
	gone := createProduct(t, q, olma.ID, "product", "Eski", ptr("dona"))
	mustExec(t, pool, "UPDATE products SET deleted_at = now() WHERE id = $1", gone.ID)
	createProduct(t, q, nok.ID, "product", "Olma", ptr("kg"))
	ids := func(rows []gen.ListProductsRow) []int64 {
		out := make([]int64, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.ID)
		}
		return out
	}
	list := func(kind string, active bool, search *string) []gen.ListProductsRow {
		rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: olma.ID, Kind: kind, IsActive: active, Search: search, Limit: 20, Offset: 0})
		require.NoError(t, err)
		return rows
	}

	assert.Equal(t, []int64{anor.ID, nokP.ID}, ids(list("product", true, nil)), "the live active products, by name whatever the case; not the deleted, not the inactive, not another company's")
	assert.Equal(t, []int64{olmaP.ID}, ids(list("product", false, nil)), "the inactive ones apart")
	assert.Len(t, list("service", true, nil), 1, "the services apart")
	assert.Equal(t, []int64{nokP.ID}, ids(list("product", true, ptr("n-1"))), "a search looks in the SKU too, whatever the case")
	assert.Equal(t, []int64{anor.ID}, ids(list("product", true, ptr("ANO"))), "and in the name, inside a word")
	assert.Empty(t, list("product", true, ptr(`\%`)), "the search is taken literally (escaped by the caller)")
	rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true, Limit: 1, Offset: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{nokP.ID}, ids(rows), "a page")
	count, err := q.CountProducts(ctx, gen.CountProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	count, err = q.CountProducts(ctx, gen.CountProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true, Search: ptr("nok")})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "under the same filter")
}

func TestUpdateProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	createProduct(t, q, olma.ID, "product", "Nok", ptr("dona"))

	updated, err := q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "Qizil olma", Unit: ptr("dona"), Sku: ptr("A-2"), Price: numeric(t, "100"), Note: ptr("Yangi")})
	require.NoError(t, err)
	assert.Equal(t, "Qizil olma", updated.Name)
	assert.Equal(t, ptr("dona"), updated.Unit)
	assert.Equal(t, ptr("A-2"), updated.Sku)
	assert.Equal(t, "100.00", numericText(t, updated.Price))
	assert.Equal(t, ptr("Yangi"), updated.Note)
	assert.False(t, updated.UpdatedAt.Before(p.UpdatedAt), "the moment of the edit")

	cleared, err := q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "Olma", Unit: ptr("kg")})
	require.NoError(t, err)
	assert.Nil(t, cleared.Sku, "what is not sent is cleared")
	assert.False(t, cleared.Price.Valid)
	assert.Nil(t, cleared.Note)

	_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "nok", Unit: ptr("kg")})
	assert.Equal(t, "23505", sqlState(err), "the name is another product's")
	_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: nok.ID, Name: "Olma", Unit: ptr("kg")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's product")
}

func TestSetProductActive(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	off, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID, CompanyID: olma.ID, IsActive: false})
	require.NoError(t, err)
	assert.False(t, off.IsActive)
	on, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID, CompanyID: olma.ID, IsActive: true})
	require.NoError(t, err)
	assert.True(t, on.IsActive)
	_, err = q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID + 1, CompanyID: olma.ID, IsActive: false})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func TestDeleteProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	_, err := q.DeleteProduct(ctx, gen.DeleteProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "hidden")
	_, err = q.DeleteProduct(ctx, gen.DeleteProductParams{ID: p.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	assert.Equal(t, "Olma", createProduct(t, q, olma.ID, "product", "Olma", ptr("kg")).Name, "its name is free again")
}

func TestAProductTellsItsStockInTheLocationsGivenAndItsLastPrice(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	service := createProduct(t, q, w.company, "service", "Yetkazish", nil)
	mustExec(t, pool, "INSERT INTO stock (company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, 12.5), ($1, $4, $3, 2)", w.company, w.asosiy, w.olma, w.chilonzor)
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE id = $1", one)
	two := addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 2, "2", "1200.5", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE id = $1", two)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "9999", true)
	get := func(id int64, locations ...int64) gen.GetProductRow {
		p, err := q.GetProduct(ctx, gen.GetProductParams{ID: id, CompanyID: w.company, LocationIds: locations})
		require.NoError(t, err)
		return p
	}

	p := get(w.olma, w.asosiy, w.chilonzor)
	assert.Equal(t, "14.500", numericText(t, p.Quantity), "the stock of every location given")
	assert.Equal(t, "1200.50", numericText(t, p.LastPrice), "the newest live purchase's price, whatever the location")
	assert.Equal(t, "12.500", numericText(t, get(w.olma, w.asosiy).Quantity), "one location")
	assert.Equal(t, "0", numericText(t, get(w.nok, w.asosiy).Quantity), "nothing in stock")
	assert.False(t, get(w.nok, w.asosiy).LastPrice.Valid, "never bought")
	assert.False(t, get(service.ID, w.asosiy).Quantity.Valid, "a service has no stock")
	assert.Equal(t, "0", numericText(t, get(w.olma).Quantity), "a member with no location sees 0")

	rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: w.company, Kind: "product", IsActive: true, LocationIds: []int64{w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "0", numericText(t, rows[0].Quantity), "Nok")
	assert.Equal(t, "2.000", numericText(t, rows[1].Quantity), "Olma in Chilonzor")
	assert.Equal(t, "1200.50", numericText(t, rows[1].LastPrice))

	lines, err := q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: w.company, ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	require.Len(t, lines, 2)
	assert.Equal(t, "Asosiy", lines[0].LocationName, "in the order the locations were added")
	assert.Equal(t, "12.500", numericText(t, lines[0].Quantity))
	assert.Equal(t, "Chilonzor", lines[1].LocationName)
	lines, err = q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: w.company, ProductID: w.nok, LocationIds: []int64{w.chilonzor}})
	require.NoError(t, err)
	require.Len(t, lines, 1)
	assert.Equal(t, "0", numericText(t, lines[0].Quantity), "a location with none is listed with 0")
}

func TestAProductsPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE id = $1", one)
	two := addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 2, "2", "1200.5", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE id = $1", two)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "9999", true)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.nok, 4, "1", "1", false)

	count, err := q.CountProductPurchases(ctx, w.olma)
	require.NoError(t, err)
	assert.EqualValues(t, 2, count, "the live purchases the product is in, whatever the location")
	count, err = q.CountProductPurchases(ctx, createProduct(t, q, w.company, "product", "Anor", ptr("kg")).ID)
	require.NoError(t, err)
	assert.Zero(t, count)

	rows, err := q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.EqualValues(t, 2, rows[0].Number, "the newest first")
	assert.Equal(t, "Bozor", rows[0].SupplierName)
	assert.Equal(t, "Chilonzor", rows[0].LocationName)
	assert.Equal(t, "2.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, "1200.50", numericText(t, rows[0].Price))
	assert.Equal(t, "2401.00", numericText(t, rows[0].Amount))
	assert.EqualValues(t, 1, rows[1].Number)
	rows, err = q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1, "the member's locations alone")
	lines, err := q.CountProductPurchaseLines(ctx, gen.CountProductPurchaseLinesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, lines)

	standing, err := q.ProductStanding(ctx, gen.ProductStandingParams{ID: w.olma, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "product", standing.Kind)
	assert.Equal(t, "Olma", standing.Name)
	assert.True(t, standing.IsActive)
	_, err = q.ProductStanding(ctx, gen.ProductStandingParams{ID: 999999, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
