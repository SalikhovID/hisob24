package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// categoryNames is the names of the product categories, in order.
func categoryNames(rows []gen.ProductCategory) []string {
	names := []string{}
	for _, c := range rows {
		names = append(names, c.Name)
	}
	return names
}

func TestProductCategories(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	add := func(companyID int64, name string) gen.ProductCategory {
		c, err := q.CreateProductCategory(ctx, gen.CreateProductCategoryParams{CompanyID: companyID, Name: name})
		require.NoError(t, err)
		return c
	}

	drinks := add(olma.ID, "Ichimliklar")
	sweets := add(olma.ID, "Shirinliklar")
	add(nok.ID, "Ichimliklar")
	assert.Equal(t, []int32{1, 2}, []int32{drinks.Position, sweets.Position}, "a new category goes last")
	_, err := q.CreateProductCategory(ctx, gen.CreateProductCategoryParams{CompanyID: olma.ID, Name: "ichimliklar"})
	assert.Equal(t, "23505", sqlState(err), "a name is one category's in the company, whatever the case")

	list, err := q.ListProductCategories(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"Ichimliklar", "Shirinliklar"}, categoryNames(list), "the company's own, in their order")

	got, err := q.GetProductCategory(ctx, gen.GetProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Ichimliklar", got.Name)
	_, err = q.GetProductCategory(ctx, gen.GetProductCategoryParams{ID: drinks.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")

	renamed, err := q.RenameProductCategory(ctx, gen.RenameProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID, Name: "Suvlar"})
	require.NoError(t, err)
	assert.Equal(t, "Suvlar", renamed.Name)
	_, err = q.RenameProductCategory(ctx, gen.RenameProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID, Name: "shirinliklar"})
	assert.Equal(t, "23505", sqlState(err), "the name is another's")
	_, err = q.RenameProductCategory(ctx, gen.RenameProductCategoryParams{ID: drinks.ID, CompanyID: nok.ID, Name: "Suv"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")

	require.NoError(t, q.OrderProductCategories(ctx, gen.OrderProductCategoriesParams{CompanyID: olma.ID, Ids: []int64{sweets.ID, drinks.ID}}))
	list, err = q.ListProductCategories(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"Shirinliklar", "Suvlar"}, categoryNames(list), "in the order given")

	createUser(t, q, "998901111111", "Ali")
	file := func(name string, active, deleted bool) {
		_, err := pool.Exec(ctx, `INSERT INTO products (company_id, kind, name, unit, is_active, category_id, created_by, deleted_at)
			VALUES ($1, 'product', $2, 'dona', $3, $4, '998901111111', CASE WHEN $5 THEN now() END)`, olma.ID, name, active, sweets.ID, deleted)
		require.NoError(t, err)
	}
	file("Pishiriq", true, false)
	file("Konfet", false, false)
	file("Eski", true, true)
	n, err := q.CountCategoryProducts(ctx, sweets.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(2), n, "the live products, the inactive one too, and not the deleted one")

	gone, err := q.DeleteProductCategory(ctx, gen.DeleteProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, drinks.ID, gone)
	_, err = q.DeleteProductCategory(ctx, gen.DeleteProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.GetProductCategory(ctx, gen.GetProductCategoryParams{ID: drinks.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted category is not found")
	list, err = q.ListProductCategories(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"Shirinliklar"}, categoryNames(list), "nor listed")
	again := add(olma.ID, "Suvlar")
	assert.Equal(t, int32(2), again.Position, "a deleted category's name is free, and the new one goes after the live ones")
}
