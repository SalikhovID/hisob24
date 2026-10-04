package db_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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

func TestDeleteCustomer(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createUser(t, q, enteredBy, "Ali")
	ali := createCustomer(t, q, olma.ID, jismoniy.ID, "998901234567")
	vali := createCustomer(t, q, olma.ID, jismoniy.ID, "998905555555")

	_, err := q.DeleteCustomer(ctx, gen.DeleteCustomerParams{ID: ali.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's customer")

	id, err := q.DeleteCustomer(ctx, gen.DeleteCustomerParams{ID: ali.ID, CompanyID: olma.ID})

	require.NoError(t, err)
	assert.Equal(t, ali.ID, id)
	_, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: ali.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "the customer is hidden")
	var kept int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customers WHERE id = $1 AND deleted_at IS NOT NULL", ali.ID).Scan(&kept))
	assert.Equal(t, 1, kept, "but not removed")
	_, err = q.GetCustomer(ctx, gen.GetCustomerParams{ID: vali.ID, CompanyID: olma.ID})
	assert.NoError(t, err, "the other customers stay")
	_, err = q.DeleteCustomer(ctx, gen.DeleteCustomerParams{ID: ali.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

// shop is a company set up for customers: the type Jismoniy with a text, a
// whole number and a checkbox field, the dropdown the checkboxes come from,
// and enteredBy as a user.
type shop struct {
	company             gen.Company
	jismoniy            gen.CustomerType
	fish, yosh, manba   gen.CustomerField
	instagram, linkedin gen.CustomerDropdownOption
}

func newShop(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	s := shop{company: createCompany(t, q, name, today(t, pool))}
	s.jismoniy = createType(t, q, s.company.ID, "Jismoniy")
	dropdown := createDropdown(t, q, s.company.ID, "Manba")
	s.instagram = addOption(t, q, s.company.ID, dropdown.ID, "Instagram")
	s.linkedin = addOption(t, q, s.company.ID, dropdown.ID, "LinkedIn")
	s.fish = addField(t, q, s.company.ID, s.jismoniy.ID, "F.I.Sh.", "string", nil)
	s.yosh = addField(t, q, s.company.ID, s.jismoniy.ID, "Yoshi", "int", nil)
	s.manba = addField(t, q, s.company.ID, s.jismoniy.ID, "Manba", "checkbox", &dropdown.ID)
	require.NoError(t, q.UpsertUser(t.Context(), gen.UpsertUserParams{Phone: enteredBy}))
	return s
}

// customer enters a customer of the shop's type.
func (s shop) customer(t *testing.T, q *gen.Queries, phone string) gen.Customer {
	t.Helper()
	return createCustomer(t, q, s.company.ID, s.jismoniy.ID, phone)
}

// storedValues is the customer's answers as they are stored, each row as
// "field: value" (an option as #id), in the order of the fields.
func storedValues(t *testing.T, pool *pgxpool.Pool, customerID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT f.label || ': ' || COALESCE(v.text_value, v.int_value::text, '#' || v.option_id)
		FROM customer_values v JOIN customer_fields f ON f.id = v.field_id
		WHERE v.customer_id = $1 ORDER BY f.position, v.option_id`, customerID)
	require.NoError(t, err)
	values, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return values
}

func TestAddCustomerValue(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	vali := s.customer(t, q, "998905555555")

	require.NoError(t, q.AddCustomerValue(ctx, gen.AddCustomerValueParams{CustomerID: ali.ID, FieldID: s.fish.ID, TextValue: ptr("Ali Valiyev")}))
	require.NoError(t, q.AddCustomerValue(ctx, gen.AddCustomerValueParams{CustomerID: ali.ID, FieldID: s.yosh.ID, IntValue: ptr(int64(30))}))
	require.NoError(t, q.AddCustomerValue(ctx, gen.AddCustomerValueParams{CustomerID: ali.ID, FieldID: s.manba.ID, OptionID: &s.instagram.ID}))
	require.NoError(t, q.AddCustomerValue(ctx, gen.AddCustomerValueParams{CustomerID: ali.ID, FieldID: s.manba.ID, OptionID: &s.linkedin.ID}))

	assert.Equal(t, []string{
		"F.I.Sh.: Ali Valiyev", "Yoshi: 30",
		fmt.Sprintf("Manba: #%d", s.instagram.ID), fmt.Sprintf("Manba: #%d", s.linkedin.ID),
	}, storedValues(t, pool, ali.ID))
	assert.Empty(t, storedValues(t, pool, vali.ID), "the other customers' answers stay as they are")
	err := q.AddCustomerValue(ctx, gen.AddCustomerValueParams{CustomerID: ali.ID, FieldID: s.fish.ID, TextValue: ptr("Vali")})
	assert.Equal(t, "23505", sqlState(err), "a second text in the field") // unique_violation
}
