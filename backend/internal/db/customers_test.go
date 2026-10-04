package db_test

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
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

func TestGetCustomer(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createUser(t, q, enteredBy, "Ali")
	addMember(t, q, olma.ID, enteredBy, "Ali Valiyev", "user")
	c, err := q.CreateCustomer(ctx, gen.CreateCustomerParams{
		CompanyID: olma.ID, TypeID: jismoniy.ID, Phone: "998901234567", CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)

	got, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: c.ID, CompanyID: olma.ID})

	require.NoError(t, err)
	assert.Equal(t, c.ID, got.ID)
	assert.Equal(t, jismoniy.ID, got.TypeID)
	assert.Equal(t, "998901234567", got.Phone)
	assert.Equal(t, c.CreatedAt, got.CreatedAt)
	assert.Equal(t, c.UpdatedAt, got.UpdatedAt)
	assert.Equal(t, ptr("Ali Valiyev"), got.CreatedByName, "the name the member goes by in the company now")

	mustExec(t, pool, "UPDATE user_companies SET full_name = NULL WHERE user_phone = $1", enteredBy)
	got, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: c.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName, "a member with no name now: the name of then")
	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", enteredBy)
	got, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: c.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName, "a member who has left: the name of then")
	nameless := createCustomer(t, q, olma.ID, jismoniy.ID, "998907654321")
	got, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: nameless.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Nil(t, got.CreatedByName, "no name then and none now")

	_, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: c.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's customer")
	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", c.ID)
	_, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: c.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted customer")
}

func TestGetCustomerByPhone(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createUser(t, q, enteredBy, "Ali")
	ali := createCustomer(t, q, olma.ID, jismoniy.ID, "998901234567")
	createCustomer(t, q, olma.ID, jismoniy.ID, "998907654321")

	id, err := q.GetCustomerByPhone(ctx, gen.GetCustomerByPhoneParams{CompanyID: olma.ID, Phone: "998901234567"})

	require.NoError(t, err)
	assert.Equal(t, ali.ID, id)
	_, err = q.GetCustomerByPhone(ctx, gen.GetCustomerByPhoneParams{CompanyID: olma.ID, Phone: "998900000000"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a number no customer has")
	_, err = q.GetCustomerByPhone(ctx, gen.GetCustomerByPhoneParams{CompanyID: nok.ID, Phone: "998901234567"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's customer")
	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali.ID)
	_, err = q.GetCustomerByPhone(ctx, gen.GetCustomerByPhoneParams{CompanyID: olma.ID, Phone: "998901234567"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted customer's number is free")
}

func TestUpdateCustomer(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createUser(t, q, enteredBy, "Ali")
	ali := createCustomer(t, q, olma.ID, jismoniy.ID, "998901234567")
	vali := createCustomer(t, q, olma.ID, jismoniy.ID, "998905555555")
	mustExec(t, pool, "UPDATE customers SET created_at = now() - interval '1 day', updated_at = now() - interval '1 day'")

	updatedAt, err := q.UpdateCustomer(ctx, gen.UpdateCustomerParams{ID: ali.ID, CompanyID: olma.ID, Phone: "998907654321"})

	require.NoError(t, err)
	got, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: ali.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "998907654321", got.Phone)
	assert.Equal(t, updatedAt, got.UpdatedAt)
	assert.WithinDuration(t, time.Now(), updatedAt, time.Minute, "edited now")
	assert.WithinDuration(t, time.Now().Add(-24*time.Hour), got.CreatedAt, time.Minute, "entered when it was")
	untouched, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: vali.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "998905555555", untouched.Phone, "the other customers stay as they are")
	assert.Equal(t, untouched.CreatedAt, untouched.UpdatedAt)

	_, err = q.UpdateCustomer(ctx, gen.UpdateCustomerParams{ID: ali.ID, CompanyID: olma.ID, Phone: "998905555555"})
	assert.Equal(t, "23505", sqlState(err), "another customer's number") // unique_violation
	_, err = q.UpdateCustomer(ctx, gen.UpdateCustomerParams{ID: ali.ID, CompanyID: nok.ID, Phone: "998900000000"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's customer")
	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali.ID)
	_, err = q.UpdateCustomer(ctx, gen.UpdateCustomerParams{ID: ali.ID, CompanyID: olma.ID, Phone: "998900000000"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted customer")
}
