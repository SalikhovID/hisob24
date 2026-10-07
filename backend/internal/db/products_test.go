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
