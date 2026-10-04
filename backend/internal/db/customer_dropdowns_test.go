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
