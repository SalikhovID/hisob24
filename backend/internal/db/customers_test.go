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

// answer stores a text answer of the customer's.
func answer(t *testing.T, q *gen.Queries, customerID, fieldID int64, text string) {
	t.Helper()
	require.NoError(t, q.AddCustomerValue(t.Context(), gen.AddCustomerValueParams{CustomerID: customerID, FieldID: fieldID, TextValue: &text}))
}

// answerNumber stores a whole number answer of the customer's.
func answerNumber(t *testing.T, q *gen.Queries, customerID, fieldID, number int64) {
	t.Helper()
	require.NoError(t, q.AddCustomerValue(t.Context(), gen.AddCustomerValueParams{CustomerID: customerID, FieldID: fieldID, IntValue: &number}))
}

// choose stores an option the customer chose in a field.
func choose(t *testing.T, q *gen.Queries, customerID, fieldID, optionID int64) {
	t.Helper()
	require.NoError(t, q.AddCustomerValue(t.Context(), gen.AddCustomerValueParams{CustomerID: customerID, FieldID: fieldID, OptionID: &optionID}))
}

func TestDeleteCustomerValues(t *testing.T) {
	q, pool := setup(t)
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	vali := s.customer(t, q, "998905555555")
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	choose(t, q, ali.ID, s.manba.ID, s.instagram.ID)
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")

	require.NoError(t, q.DeleteCustomerValues(t.Context(), ali.ID))

	assert.Empty(t, storedValues(t, pool, ali.ID), "an edit writes the answers anew")
	assert.Equal(t, []string{"F.I.Sh.: Vali Aliyev"}, storedValues(t, pool, vali.ID), "the other customers' answers stay")
}

func TestListCustomerValues(t *testing.T) {
	q, pool := setup(t)
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	vali := s.customer(t, q, "998905555555")
	other := s.customer(t, q, "998907777777")
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	answerNumber(t, q, ali.ID, s.yosh.ID, 30)
	choose(t, q, ali.ID, s.manba.ID, s.instagram.ID)
	choose(t, q, ali.ID, s.manba.ID, s.linkedin.ID)
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")
	answer(t, q, other.ID, s.fish.ID, "Boshqa")
	// The owner has put the number before the name, and LinkedIn first.
	mustExec(t, pool, "UPDATE customer_fields SET position = 0 WHERE id = $1", s.yosh.ID)
	mustExec(t, pool, "UPDATE customer_dropdown_options SET position = 0 WHERE id = $1", s.linkedin.ID)

	rows, err := q.ListCustomerValues(t.Context(), []int64{vali.ID, ali.ID})

	require.NoError(t, err)
	assert.Equal(t, []gen.ListCustomerValuesRow{
		{CustomerID: ali.ID, FieldID: s.yosh.ID, Kind: "int", IntValue: ptr(int64(30))},
		{CustomerID: ali.ID, FieldID: s.fish.ID, Kind: "string", TextValue: ptr("Ali Valiyev")},
		{CustomerID: ali.ID, FieldID: s.manba.ID, Kind: "checkbox", OptionID: &s.linkedin.ID},
		{CustomerID: ali.ID, FieldID: s.manba.ID, Kind: "checkbox", OptionID: &s.instagram.ID},
		{CustomerID: vali.ID, FieldID: s.fish.ID, Kind: "string", TextValue: ptr("Vali Aliyev")},
	}, rows, "the customers named, each one's answers in the order of the fields and of the options")
	rows, err = q.ListCustomerValues(t.Context(), []int64{})
	require.NoError(t, err)
	assert.Empty(t, rows, "no customers, no answers")
}

// The customers of seedCustomers, by their numbers.
const (
	aliPhone   = "998901234567" // Jismoniy: Ali Valiyev, 30, from Instagram
	valiPhone  = "998905555555" // Jismoniy: Vali Aliyev, 45
	firmaPhone = "998907777777" // Yuridik: Olma 100% MChJ, INN 301234567
)

// seedCustomers enters Ali, Vali and a firm into the shop, in that order,
// and what a list has to leave out: a deleted customer and another
// company's. It returns the firm's type.
func seedCustomers(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, s shop) (yuridik gen.CustomerType) {
	t.Helper()
	yuridik = createType(t, q, s.company.ID, "Yuridik")
	nomi := addField(t, q, s.company.ID, yuridik.ID, "Nomi", "string", nil)
	inn := addField(t, q, s.company.ID, yuridik.ID, "INN", "int", nil)

	ali := s.customer(t, q, aliPhone)
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	answerNumber(t, q, ali.ID, s.yosh.ID, 30)
	choose(t, q, ali.ID, s.manba.ID, s.instagram.ID)
	vali := s.customer(t, q, valiPhone)
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")
	answerNumber(t, q, vali.ID, s.yosh.ID, 45)
	firma := createCustomer(t, q, s.company.ID, yuridik.ID, firmaPhone)
	answer(t, q, firma.ID, nomi.ID, "Olma 100% MChJ")
	answerNumber(t, q, firma.ID, inn.ID, 301234567)

	gone := s.customer(t, q, "998909999999")
	answer(t, q, gone.ID, s.fish.ID, "Ali O'chirilgan")
	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", gone.ID)
	nok := newShop(t, q, pool, "Nok")
	answer(t, q, nok.customer(t, q, aliPhone).ID, nok.fish.ID, "Ali Begona")
	return yuridik
}

func TestListCustomers(t *testing.T) {
	q, pool := setup(t)
	s := newShop(t, q, pool, "Olma")
	yuridik := seedCustomers(t, q, pool, s)

	tests := []struct {
		name           string
		typeID         *int64
		search, digits *string
		limit, offset  int32
		want           []string
	}{
		{name: "everything, the newest first", limit: 20, want: []string{firmaPhone, valiPhone, aliPhone}},
		{name: "one type", typeID: &yuridik.ID, limit: 20, want: []string{firmaPhone}},
		{name: "a text answer, in any case", search: ptr("ALI"), limit: 20, want: []string{valiPhone, aliPhone}},
		{name: "the search is literal", search: ptr(`100\%`), limit: 20, want: []string{firmaPhone}},
		{name: "a wildcard matches nothing by itself", search: ptr(`\_`), limit: 20, want: []string{}},
		{name: "the digits of a phone", search: ptr("90 555"), digits: ptr("90555"), limit: 20, want: []string{valiPhone}},
		{name: "the digits of a whole number", search: ptr("3012"), digits: ptr("3012"), limit: 20, want: []string{firmaPhone}},
		{name: "digits inside a text", search: ptr("100"), digits: ptr("100"), limit: 20, want: []string{firmaPhone}},
		{name: "an option's name is not searched", search: ptr("Instagram"), limit: 20, want: []string{}},
		{name: "search within a type", search: ptr("ali"), typeID: &s.jismoniy.ID, limit: 20, want: []string{valiPhone, aliPhone}},
		{name: "search in another type", search: ptr("ali"), typeID: &yuridik.ID, limit: 20, want: []string{}},
		{name: "a page", limit: 2, offset: 1, want: []string{valiPhone, aliPhone}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows, err := q.ListCustomers(t.Context(), gen.ListCustomersParams{
				CompanyID: s.company.ID, TypeID: tt.typeID, Search: tt.search, Digits: tt.digits, Limit: tt.limit, Offset: tt.offset,
			})
			require.NoError(t, err)
			phones := make([]string, 0, len(rows))
			for _, c := range rows {
				phones = append(phones, c.Phone)
			}
			assert.Equal(t, tt.want, phones)
		})
	}
}

func TestCountCustomers(t *testing.T) {
	q, pool := setup(t)
	s := newShop(t, q, pool, "Olma")
	yuridik := seedCustomers(t, q, pool, s)

	tests := []struct {
		name           string
		typeID         *int64
		search, digits *string
		want           int64
	}{
		{name: "everything, without the deleted and the other company's", want: 3},
		{name: "one type", typeID: &s.jismoniy.ID, want: 2},
		{name: "a text answer, in any case", search: ptr("ALI"), want: 2},
		{name: "the digits of a phone", search: ptr("90 555"), digits: ptr("90555"), want: 1},
		{name: "the digits of a whole number", search: ptr("3012"), digits: ptr("3012"), want: 1},
		{name: "search within a type", search: ptr("ali"), typeID: &yuridik.ID, want: 0},
		{name: "an option's name is not searched", search: ptr("Instagram"), want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			total, err := q.CountCustomers(t.Context(), gen.CountCustomersParams{
				CompanyID: s.company.ID, TypeID: tt.typeID, Search: tt.search, Digits: tt.digits,
			})
			require.NoError(t, err)
			assert.Equal(t, tt.want, total)
		})
	}
}

func TestFindCustomerByValue(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	answerNumber(t, q, ali.ID, s.yosh.ID, 30)
	vali := s.customer(t, q, "998905555555")
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")
	answerNumber(t, q, vali.ID, s.yosh.ID, 30)
	// find looks for a customer other than except with the value in the field.
	find := func(fieldID int64, text *string, number *int64, except int64) (int64, error) {
		return q.FindCustomerByValue(ctx, gen.FindCustomerByValueParams{
			FieldID: fieldID, TextValue: text, IntValue: number, ExceptID: except,
		})
	}

	id, err := find(s.fish.ID, ptr("ALI valiyev"), nil, 0)
	require.NoError(t, err)
	assert.Equal(t, ali.ID, id, "a text, in any case")
	id, err = find(s.yosh.ID, nil, ptr(int64(30)), 0)
	require.NoError(t, err)
	assert.Equal(t, ali.ID, id, "a whole number; of several customers, the first")
	id, err = find(s.yosh.ID, nil, ptr(int64(30)), ali.ID)
	require.NoError(t, err)
	assert.Equal(t, vali.ID, id, "the customer being edited does not count")

	_, err = find(s.fish.ID, ptr("Ali"), nil, 0)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a part of a text is another text")
	_, err = find(s.fish.ID, ptr("Ali Valiyev"), nil, ali.ID)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "the customer's own value")
	_, err = find(s.fish.ID, nil, ptr(int64(30)), 0)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "the value is in another field")
	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali.ID)
	_, err = find(s.fish.ID, ptr("Ali Valiyev"), nil, 0)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted customer's value is free")
}

func TestCustomerFieldHasDuplicates(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	answerNumber(t, q, ali.ID, s.yosh.ID, 30)
	vali := s.customer(t, q, "998905555555")
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")
	answerNumber(t, q, vali.ID, s.yosh.ID, 30)
	// 30 as a text is no 30 as a number.
	answer(t, q, s.customer(t, q, "998907777777").ID, s.fish.ID, "30")

	repeats, err := q.CustomerFieldHasDuplicates(ctx, s.yosh.ID)
	require.NoError(t, err)
	assert.True(t, repeats, "two customers of the same age")
	repeats, err = q.CustomerFieldHasDuplicates(ctx, s.fish.ID)
	require.NoError(t, err)
	assert.False(t, repeats, "every name is another")

	answer(t, q, s.customer(t, q, "998908888888").ID, s.fish.ID, "ALI VALIYEV")
	repeats, err = q.CustomerFieldHasDuplicates(ctx, s.fish.ID)
	require.NoError(t, err)
	assert.True(t, repeats, "the same text in another case")

	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali.ID)
	repeats, err = q.CustomerFieldHasDuplicates(ctx, s.yosh.ID)
	require.NoError(t, err)
	assert.False(t, repeats, "a deleted customer does not count")
	repeats, err = q.CustomerFieldHasDuplicates(ctx, s.fish.ID)
	require.NoError(t, err)
	assert.False(t, repeats, "nor does its name")
}

func TestCountTypeCustomers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	yuridik := seedCustomers(t, q, pool, s)
	empty := createType(t, q, s.company.ID, "Hamkor")

	n, err := q.CountTypeCustomers(ctx, s.jismoniy.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, n, "Ali and Vali; the deleted customer does not count")
	n, err = q.CountTypeCustomers(ctx, yuridik.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n)
	n, err = q.CountTypeCustomers(ctx, empty.ID)
	require.NoError(t, err)
	assert.Zero(t, n, "a type with no customers")
}

func TestCountFieldCustomers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	answer(t, q, ali.ID, s.fish.ID, "Ali Valiyev")
	choose(t, q, ali.ID, s.manba.ID, s.instagram.ID)
	choose(t, q, ali.ID, s.manba.ID, s.linkedin.ID)
	vali := s.customer(t, q, "998905555555")
	answer(t, q, vali.ID, s.fish.ID, "Vali Aliyev")
	choose(t, q, vali.ID, s.manba.ID, s.instagram.ID)

	n, err := q.CountFieldCustomers(ctx, s.manba.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, n, "a customer who chose two options counts once")
	n, err = q.CountFieldCustomers(ctx, s.yosh.ID)
	require.NoError(t, err)
	assert.Zero(t, n, "a field nobody filled in")

	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", vali.ID)
	n, err = q.CountFieldCustomers(ctx, s.fish.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "a deleted customer does not count")
}

func TestCountOptionCustomers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	// A second field takes its options from the same dropdown.
	yana := addField(t, q, s.company.ID, s.jismoniy.ID, "Yana manba", "dropdown", s.manba.DropdownID)
	ali := s.customer(t, q, "998901234567")
	choose(t, q, ali.ID, s.manba.ID, s.instagram.ID)
	choose(t, q, ali.ID, yana.ID, s.instagram.ID)
	vali := s.customer(t, q, "998905555555")
	choose(t, q, vali.ID, s.manba.ID, s.instagram.ID)

	n, err := q.CountOptionCustomers(ctx, &s.instagram.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, n, "a customer who chose the option in two fields counts once")
	n, err = q.CountOptionCustomers(ctx, &s.linkedin.ID)
	require.NoError(t, err)
	assert.Zero(t, n, "an option nobody chose")

	mustExec(t, pool, "UPDATE customers SET deleted_at = now() WHERE id = $1", vali.ID)
	n, err = q.CountOptionCustomers(ctx, &s.instagram.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "a deleted customer does not count")
}

func TestAddCustomerHistory(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	changes := `[{"label": "INN", "old": "301234567", "new": "301234568"}]`

	err := q.AddCustomerHistory(ctx, gen.AddCustomerHistoryParams{
		CustomerID: ali.ID, Action: "updated", ActorPhone: enteredBy, ActorName: ptr("Ali aka"), Changes: []byte(changes),
	})

	require.NoError(t, err)
	var action, actor, stored string
	var name *string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT action, actor_phone, actor_name, changes::text FROM customer_history WHERE customer_id = $1", ali.ID).
		Scan(&action, &actor, &name, &stored))
	assert.Equal(t, "updated", action)
	assert.Equal(t, enteredBy, actor)
	assert.Equal(t, ptr("Ali aka"), name, "the name the member went by then")
	assert.JSONEq(t, changes, stored)
}

func TestListCustomerHistory(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newShop(t, q, pool, "Olma")
	ali := s.customer(t, q, "998901234567")
	vali := s.customer(t, q, "998905555555")
	// The one who entered Ali has left the company; the one who edited is in
	// it, under another name than then.
	createUser(t, q, "998902222222", "Vali")
	addMember(t, q, s.company.ID, "998902222222", "Vali Aliyev", "user")
	record := func(customerID int64, action, actor, name, changes string) {
		t.Helper()
		require.NoError(t, q.AddCustomerHistory(ctx, gen.AddCustomerHistoryParams{
			CustomerID: customerID, Action: action, ActorPhone: actor, ActorName: &name, Changes: []byte(changes),
		}))
	}
	record(ali.ID, "created", enteredBy, "Ali aka", `[]`)
	record(vali.ID, "created", enteredBy, "Ali aka", `[]`)
	record(ali.ID, "updated", "998902222222", "Vali", `[{"label": "Yoshi", "old": "30", "new": "31"}]`)

	history, err := q.ListCustomerHistory(ctx, ali.ID)

	require.NoError(t, err)
	require.Len(t, history, 2, "the customer's own history")
	assert.Equal(t, "updated", history[0].Action, "the latest first")
	assert.Equal(t, ptr("Vali Aliyev"), history[0].ActorName, "the name the member goes by in the company now")
	assert.JSONEq(t, `[{"label": "Yoshi", "old": "30", "new": "31"}]`, string(history[0].Changes))
	assert.WithinDuration(t, time.Now(), history[0].CreatedAt, time.Minute)
	assert.Equal(t, "created", history[1].Action)
	assert.Equal(t, ptr("Ali aka"), history[1].ActorName, "a member who has left: the name of then")
	assert.JSONEq(t, `[]`, string(history[1].Changes))
	assert.Greater(t, history[0].ID, history[1].ID)
}
