package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// enteredBy is the user who enters the customers of these tests.
const enteredBy = "998901111111"

// createCustomer enters a customer of the company's type, as enteredBy, who
// has to be a user.
func createCustomer(t *testing.T, q *gen.Queries, companyID, typeID int64, phone string) gen.Customer {
	t.Helper()
	c, err := q.CreateCustomer(t.Context(), gen.CreateCustomerParams{
		CompanyID: companyID, TypeID: typeID, Phone: phone, CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	return c
}

func TestCreateCustomer(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createUser(t, q, enteredBy, "Ali Valiyev")

	c, err := q.CreateCustomer(ctx, gen.CreateCustomerParams{
		CompanyID: olma.ID, TypeID: jismoniy.ID, Phone: "998901234567", CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})

	require.NoError(t, err)
	assert.Positive(t, c.ID)
	assert.Equal(t, olma.ID, c.CompanyID)
	assert.Equal(t, jismoniy.ID, c.TypeID)
	assert.Equal(t, "998901234567", c.Phone)
	assert.Equal(t, enteredBy, c.CreatedBy)
	assert.Equal(t, ptr("Ali aka"), c.CreatedByName, "the name the member went by then")
	assert.Equal(t, c.CreatedAt, c.UpdatedAt, "not edited yet")
	assert.Nil(t, c.DeletedAt)
	assert.Nil(t, createCustomer(t, q, olma.ID, jismoniy.ID, "998907654321").CreatedByName, "a member without a name")
	_, err = q.CreateCustomer(ctx, gen.CreateCustomerParams{CompanyID: olma.ID, TypeID: jismoniy.ID, Phone: "998901234567", CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the number is a customer of the company already") // unique_violation
}
