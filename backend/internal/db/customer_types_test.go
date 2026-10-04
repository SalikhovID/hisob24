package db_test

import (
	"testing"

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
