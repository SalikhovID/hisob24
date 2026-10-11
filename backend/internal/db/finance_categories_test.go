package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// namesOf is the names of the categories, in order.
func namesOf(rows []gen.FinanceCategory) []string {
	names := []string{}
	for _, c := range rows {
		names = append(names, c.Name)
	}
	return names
}

func TestFinanceCategories(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	add := func(companyID int64, name, kind string) gen.FinanceCategory {
		c, err := q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: companyID, Name: name, Kind: kind})
		require.NoError(t, err)
		return c
	}

	ijara := add(olma.ID, "Ijara", "expense")
	kommunal := add(olma.ID, "Kommunal", "expense")
	boshqa := add(olma.ID, "Boshqa kirim", "income")
	add(nok.ID, "Ijara", "expense")
	assert.Equal(t, []int32{1, 2, 1}, []int32{ijara.Position, kommunal.Position, boshqa.Position}, "each kind counts its own positions")
	assert.True(t, ijara.IsActive)
	_, err := q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: olma.ID, Name: "ijara", Kind: "expense"})
	assert.Equal(t, "23505", sqlState(err), "a name is one category's among the kind, whatever the case")
	_, err = q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: olma.ID, Name: "Ijara", Kind: "income"})
	require.NoError(t, err, "the other kind may have the name")

	all, err := q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, []string{"Ijara", "Kommunal", "Boshqa kirim", "Ijara"}, namesOf(all), "the expenses first, each kind in its order")
	expenses, err := q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: olma.ID, Kind: ptr("expense")})
	require.NoError(t, err)
	assert.Equal(t, []string{"Ijara", "Kommunal"}, namesOf(expenses))

	got, err := q.GetFinanceCategory(ctx, gen.GetFinanceCategoryParams{ID: ijara.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "expense", got.Kind)
	_, err = q.GetFinanceCategory(ctx, gen.GetFinanceCategoryParams{ID: ijara.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")

	off, err := q.UpdateFinanceCategory(ctx, gen.UpdateFinanceCategoryParams{ID: ijara.ID, CompanyID: olma.ID, IsActive: ptr(false)})
	require.NoError(t, err)
	assert.False(t, off.IsActive)
	assert.Equal(t, "Ijara", off.Name, "what is not given stays")
	renamed, err := q.UpdateFinanceCategory(ctx, gen.UpdateFinanceCategoryParams{ID: ijara.ID, CompanyID: olma.ID, Name: ptr("Ofis ijarasi")})
	require.NoError(t, err)
	assert.Equal(t, "Ofis ijarasi", renamed.Name)
	assert.False(t, renamed.IsActive)
	_, err = q.UpdateFinanceCategory(ctx, gen.UpdateFinanceCategoryParams{ID: ijara.ID, CompanyID: olma.ID, Name: ptr("KOMMUNAL")})
	assert.Equal(t, "23505", sqlState(err))

	require.NoError(t, q.OrderFinanceCategories(ctx, gen.OrderFinanceCategoriesParams{CompanyID: olma.ID, Kind: "expense", Ids: []int64{kommunal.ID, ijara.ID, boshqa.ID}}))
	expenses, err = q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: olma.ID, Kind: ptr("expense")})
	require.NoError(t, err)
	assert.Equal(t, []string{"Kommunal", "Ofis ijarasi"}, namesOf(expenses), "in the new order; the income category is passed over")
	income, err := q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: olma.ID, Kind: ptr("income")})
	require.NoError(t, err)
	assert.EqualValues(t, 1, income[0].Position, "untouched")

	_, err = q.DeleteFinanceCategory(ctx, gen.DeleteFinanceCategoryParams{ID: kommunal.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.DeleteFinanceCategory(ctx, gen.DeleteFinanceCategoryParams{ID: kommunal.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	expenses, err = q.ListFinanceCategories(ctx, gen.ListFinanceCategoriesParams{CompanyID: olma.ID, Kind: ptr("expense")})
	require.NoError(t, err)
	assert.Equal(t, []string{"Ofis ijarasi"}, namesOf(expenses))
	_, err = q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: olma.ID, Name: "Kommunal", Kind: "expense"})
	require.NoError(t, err, "a deleted category's name is free again")
}
