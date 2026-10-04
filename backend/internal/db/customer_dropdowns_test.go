package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateCustomerDropdown(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))

	d, err := q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: c.ID, Name: "Manba"})

	require.NoError(t, err)
	assert.NotZero(t, d.ID)
	assert.Equal(t, c.ID, d.CompanyID)
	assert.Equal(t, "Manba", d.Name)
	assert.False(t, d.CreatedAt.IsZero())
	assert.Nil(t, d.DeletedAt)
	_, err = q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: c.ID, Name: "MANBA"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func createDropdown(t *testing.T, q *gen.Queries, companyID int64, name string) gen.CustomerDropdown {
	t.Helper()
	d, err := q.CreateCustomerDropdown(t.Context(), gen.CreateCustomerDropdownParams{CompanyID: companyID, Name: name})
	require.NoError(t, err)
	return d
}

func TestListCustomerDropdowns(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")
	holat := createDropdown(t, q, olma.ID, "Holat")
	eski := createDropdown(t, q, olma.ID, "Eski")
	createDropdown(t, q, nok.ID, "Begona")
	mustExec(t, pool, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerDropdowns(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{manba.ID, holat.ID}, []int64{list[0].ID, list[1].ID}, "in the order they were made")
}
