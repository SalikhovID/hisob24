package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func createType(t *testing.T, q *gen.Queries, companyID int64, name string) gen.CustomerType {
	t.Helper()
	ct, err := q.CreateCustomerType(t.Context(), gen.CreateCustomerTypeParams{CompanyID: companyID, Name: name})
	require.NoError(t, err)
	return ct
}

func TestCreateCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	first, err := q.CreateCustomerType(ctx, gen.CreateCustomerTypeParams{CompanyID: olma.ID, Name: "Jismoniy"})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, first.CompanyID)
	assert.Equal(t, "Jismoniy", first.Name)
	assert.EqualValues(t, 1, first.Position)
	assert.Nil(t, first.DeletedAt)
	assert.EqualValues(t, 2, createType(t, q, olma.ID, "Yuridik").Position, "a new type goes last")
	assert.EqualValues(t, 1, createType(t, q, nok.ID, "Jismoniy").Position, "each company orders its own")
	_, err = q.CreateCustomerType(ctx, gen.CreateCustomerTypeParams{CompanyID: olma.ID, Name: "jismoniy"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func TestListCustomerTypes(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	eski := createType(t, q, olma.ID, "Eski")
	createType(t, q, nok.ID, "Begona")
	mustExec(t, pool, "UPDATE customer_types SET position = 0 WHERE id = $1", yuridik.ID)
	mustExec(t, pool, "UPDATE customer_types SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerTypes(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{yuridik.ID, jismoniy.ID}, []int64{list[0].ID, list[1].ID}, "in their order")
}

func TestGetCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")

	ct, err := q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Jismoniy", ct.Name)

	_, err = q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
	mustExec(t, pool, "UPDATE customer_types SET deleted_at = now() WHERE id = $1", jismoniy.ID)
	_, err = q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted type")
}

func TestRenameCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createType(t, q, olma.ID, "Yuridik")

	ct, err := q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID, Name: "Shaxs"})
	require.NoError(t, err)
	assert.Equal(t, "Shaxs", ct.Name)
	assert.Equal(t, jismoniy.Position, ct.Position, "its place stays")

	_, err = q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID, Name: "yuridik"})
	assert.Equal(t, "23505", sqlState(err), "another type's name")
	_, err = q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: nok.ID, Name: "Begona"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
}
