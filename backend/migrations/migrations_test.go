package migrations_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/migrations"
)

func TestInitSeedsTheOwnerAdmin(t *testing.T) {
	pool := pgtest.New(t)

	var fullName string
	var active bool
	err := pool.QueryRow(t.Context(), "SELECT full_name, is_active FROM admins WHERE telegram_id = 461603558").Scan(&fullName, &active)

	require.NoError(t, err)
	assert.Equal(t, "Owner", fullName)
	assert.True(t, active)
}

func TestInitDownRemovesTheSchema(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 0)
	require.NoError(t, err)

	rows, err := pool.Query(ctx, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'goose_db_version'")
	require.NoError(t, err)
	tables, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Empty(t, tables)
}

// addCompany inserts a company and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	return id
}

// sqlState is the SQLSTATE of a Postgres error, "" for any other error.
func sqlState(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func TestRolesAreOwnerAndUser(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222'), ('998903333333')")
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'user')", c)
	assert.NoError(t, err, "user is a role")
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998902222222', $1, 'manager')", c)
	assert.Equal(t, "23514", sqlState(err), "manager is a role no more") // check_violation
	var role string
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO user_companies (user_phone, company_id) VALUES ('998903333333', $1) RETURNING role", c).Scan(&role))
	assert.Equal(t, "user", role, "a member is a user unless made the owner")
}

func TestACompanyHasOneOwner(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'owner')", olma)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998902222222', $1, 'owner')", olma)
	assert.Equal(t, "23505", sqlState(err), "a second owner of the company") // unique_violation
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998902222222', $1, 'owner')", nok)
	assert.NoError(t, err, "the owner of another company")
}

// newProvider moves the test's database between migration versions.
func newProvider(t *testing.T, pool *pgxpool.Pool) *goose.Provider {
	t.Helper()
	db := stdlib.OpenDBFromPool(pool)
	t.Cleanup(func() { _ = db.Close() })
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS)
	require.NoError(t, err)
	return provider
}

// rolesOf is each member's role in the company, by phone.
func rolesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) map[string]string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT user_phone, role FROM user_companies WHERE company_id = $1", companyID)
	require.NoError(t, err)
	roles := map[string]string{}
	var phone, role string
	_, err = pgx.ForEachRow(rows, []any{&phone, &role}, func() error {
		roles[phone] = role
		return nil
	})
	require.NoError(t, err)
	return roles
}

func TestTheRolesMigrationKeepsEachCompanysFirstOwner(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 3)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err = pool.Exec(ctx, `INSERT INTO users (phone) VALUES
		('998901111111'), ('998902222222'), ('998903333333'), ('998904444444')`)
	require.NoError(t, err)
	// The manager joined before either owner: it is the first owner that
	// stays, not the first member.
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role, created_at) VALUES
		('998902222222', $1, 'owner', now()),
		('998901111111', $1, 'owner', now() - interval '1 day'),
		('998903333333', $1, 'manager', now() - interval '2 days'),
		('998904444444', $1, 'staff', now()),
		('998904444444', $2, 'staff', now())`, olma, nok)
	require.NoError(t, err)

	_, err = provider.UpTo(ctx, 4)
	require.NoError(t, err)

	assert.Equal(t, map[string]string{
		"998901111111": "owner",
		"998902222222": "user",
		"998903333333": "user",
		"998904444444": "user",
	}, rolesOf(t, pool, olma), "the first owner stays, everyone else is a user")
	assert.Equal(t, map[string]string{"998904444444": "user"}, rolesOf(t, pool, nok), "no owner is made up")
}

func TestTheRolesMigrationNamesEachMemberAfterTheUser(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 3)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone, full_name) VALUES ('998901111111', 'Ali Valiyev'), ('998902222222', NULL)")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role) VALUES
		('998901111111', $1, 'owner'), ('998901111111', $2, 'staff'), ('998902222222', $1, 'staff')`, olma, nok)
	require.NoError(t, err)

	_, err = provider.UpTo(ctx, 4)
	require.NoError(t, err)

	nameOf := func(phone string, companyID int64) *string {
		var name *string
		require.NoError(t, pool.QueryRow(ctx,
			"SELECT full_name FROM user_companies WHERE user_phone = $1 AND company_id = $2", phone, companyID).Scan(&name))
		return name
	}
	ali := "Ali Valiyev"
	assert.Equal(t, &ali, nameOf("998901111111", olma), "the member goes by the user's name")
	assert.Equal(t, &ali, nameOf("998901111111", nok), "in every company of theirs")
	assert.Nil(t, nameOf("998902222222", olma), "a user without a name gives none")
}

func TestTheRolesMigrationDownBringsTheOldRolesBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222'), ('998903333333')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES
		('998901111111', $1, 'owner', 'Egasi'), ('998902222222', $1, 'user', 'Xodim')`, c)
	require.NoError(t, err)

	_, err = newProvider(t, pool).DownTo(ctx, 3)
	require.NoError(t, err)

	assert.Equal(t, map[string]string{"998901111111": "owner", "998902222222": "staff"}, rolesOf(t, pool, c), "a user is staff again")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET role = 'manager' WHERE user_phone = '998902222222'")
	assert.NoError(t, err, "manager is a role again")
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998903333333', $1, 'owner')", c)
	assert.NoError(t, err, "a second owner is allowed again")
	_, err = pool.Exec(ctx, "SELECT full_name FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "the member's name is gone") // undefined_column
}

func TestCustomerDropdownsAndOptions(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addDropdown := func(companyID int64, name string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id)
		return id, err
	}

	manba, err := addDropdown(olma, "Manba")
	require.NoError(t, err)
	_, err = addDropdown(olma, "manba")
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company, in any case") // unique_violation
	_, err = addDropdown(nok, "Manba")
	assert.NoError(t, err, "another company's dropdown")

	addOption := func(label string) error {
		_, err := pool.Exec(ctx,
			"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, $2, 1)", manba, label)
		return err
	}
	require.NoError(t, addOption("Instagram"))
	assert.Equal(t, "23505", sqlState(addOption("INSTAGRAM")), "the option is in the dropdown already")
	var active bool
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT is_active FROM customer_dropdown_options WHERE dropdown_id = $1", manba).Scan(&active))
	assert.True(t, active, "an option is offered until it is turned off")

	_, err = pool.Exec(ctx, "UPDATE customer_dropdown_options SET deleted_at = now() WHERE dropdown_id = $1", manba)
	require.NoError(t, err)
	assert.NoError(t, addOption("Instagram"), "a deleted option's name is free again")
	_, err = pool.Exec(ctx, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", manba)
	require.NoError(t, err)
	_, err = addDropdown(olma, "Manba")
	assert.NoError(t, err, "a deleted dropdown's name is free again")
}

func TestCustomerTypesAndFields(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addType := func(companyID int64, name string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO customer_types (company_id, name, position) VALUES ($1, $2, 1) RETURNING id", companyID, name).Scan(&id)
		return id, err
	}
	jismoniy, err := addType(olma, "Jismoniy")
	require.NoError(t, err)
	_, err = addType(olma, "JISMONIY")
	assert.Equal(t, "23505", sqlState(err), "the type's name is taken in the company, in any case")
	begona, err := addType(nok, "Jismoniy")
	require.NoError(t, err, "another company's type")

	var manba, nokManba int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", nok).Scan(&nokManba))

	// addField adds a field of Olma's to a type.
	addField := func(typeID int64, label, kind string, dropdownID *int64, unique bool) error {
		_, err := pool.Exec(ctx, `INSERT INTO customer_fields (company_id, type_id, label, kind, dropdown_id, is_unique, position)
			VALUES ($1, $2, $3, $4, $5, $6, 1)`, olma, typeID, label, kind, dropdownID, unique)
		return err
	}
	require.NoError(t, addField(jismoniy, "F.I.Sh.", "string", nil, false))
	var required bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT required FROM customer_fields WHERE type_id = $1", jismoniy).Scan(&required))
	assert.False(t, required, "a field may stay empty unless said otherwise")
	assert.Equal(t, "23505", sqlState(addField(jismoniy, "f.i.sh.", "string", nil, false)), "the field's name is taken in the type")
	for _, kind := range []string{"int", "dropdown", "multi_dropdown", "radio", "checkbox"} {
		var dropdown *int64
		if kind != "int" {
			dropdown = &manba
		}
		assert.NoError(t, addField(jismoniy, "Maydon "+kind, kind, dropdown, false), kind)
	}
	assert.Equal(t, "23514", sqlState(addField(jismoniy, "Sana", "date", nil, false)), "a kind that is not one of the six") // check_violation
	assert.Equal(t, "23514", sqlState(addField(jismoniy, "Tanlov", "dropdown", nil, false)), "a choice field without a dropdown")
	assert.Equal(t, "23514", sqlState(addField(jismoniy, "Matn", "string", &manba, false)), "a text field with a dropdown")
	assert.NoError(t, addField(jismoniy, "Pasport", "string", nil, true), "a text field whose values may not repeat")
	assert.Equal(t, "23514", sqlState(addField(jismoniy, "Tanlov", "radio", &manba, true)), "a choice field whose values may not repeat")
	assert.Equal(t, "23503", sqlState(addField(jismoniy, "Tanlov", "dropdown", &nokManba, false)), "another company's dropdown") // foreign_key_violation
	assert.Equal(t, "23503", sqlState(addField(begona, "Ism", "string", nil, false)), "another company's type")

	_, err = pool.Exec(ctx, "UPDATE customer_fields SET deleted_at = now() WHERE type_id = $1 AND label = 'F.I.Sh.'", jismoniy)
	require.NoError(t, err)
	assert.NoError(t, addField(jismoniy, "F.I.Sh.", "string", nil, false), "a deleted field's name is free again")
	_, err = pool.Exec(ctx, "UPDATE customer_types SET deleted_at = now() WHERE id = $1", jismoniy)
	require.NoError(t, err)
	_, err = addType(olma, "Jismoniy")
	assert.NoError(t, err, "a deleted type's name is free again")
}

// customerTypesOf describes a company's customer types, in their order, each
// as "name: field kind [required] [unique], …" with the fields in theirs.
func customerTypesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT t.name || ': ' || COALESCE(string_agg(
			f.label || ' ' || f.kind || CASE WHEN f.required THEN ' required' ELSE '' END
				|| CASE WHEN f.is_unique THEN ' unique' ELSE '' END, ', ' ORDER BY f.position), '')
		FROM customer_types t LEFT JOIN customer_fields f ON f.type_id = t.id
		WHERE t.company_id = $1 GROUP BY t.id ORDER BY t.position`, companyID)
	require.NoError(t, err)
	types, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return types
}

func TestTheCustomerSettingsMigrationGivesEveryCompanyTheReadyTypes(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 4)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	_, err = provider.UpTo(ctx, 5)
	require.NoError(t, err)

	ready := []string{"Jismoniy: F.I.Sh. string required", "Yuridik: Nomi string required, INN int required unique"}
	assert.Equal(t, ready, customerTypesOf(t, pool, olma))
	assert.Equal(t, ready, customerTypesOf(t, pool, nok), "every company gets its own")
}

// addCustomerType inserts a customer type of the company and returns its id.
func addCustomerType(t *testing.T, pool *pgxpool.Pool, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO customer_types (company_id, name, position) VALUES ($1, $2, 1) RETURNING id", companyID, name).Scan(&id))
	return id
}

func TestCustomers(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	jismoniy, begona := addCustomerType(t, pool, olma, "Jismoniy"), addCustomerType(t, pool, nok, "Jismoniy")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	// addCustomer adds a customer whom the user 998901111111 enters.
	addCustomer := func(companyID, typeID int64, phone string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO customers (company_id, type_id, phone, created_by)
			VALUES ($1, $2, $3, '998901111111') RETURNING id`, companyID, typeID, phone).Scan(&id)
		return id, err
	}

	ali, err := addCustomer(olma, jismoniy, "998901234567")
	require.NoError(t, err)
	_, err = addCustomer(olma, jismoniy, "998901234567")
	assert.Equal(t, "23505", sqlState(err), "the number is a customer of the company already") // unique_violation
	_, err = addCustomer(nok, begona, "998901234567")
	assert.NoError(t, err, "another company's customer with the same number")
	for _, phone := range []string{"901234567", "+998901234567", "79001234567", "99890123456", "9989012345678", ""} {
		_, err = addCustomer(olma, jismoniy, phone)
		assert.Equal(t, "23514", sqlState(err), "a number that is not 998 and nine digits: %q", phone) // check_violation
	}
	_, err = addCustomer(olma, begona, "998907654321")
	assert.Equal(t, "23503", sqlState(err), "another company's type") // foreign_key_violation
	_, err = pool.Exec(ctx, `INSERT INTO customers (company_id, type_id, phone, created_by)
		VALUES ($1, $2, '998907654321', '998909999999')`, olma, jismoniy)
	assert.Equal(t, "23503", sqlState(err), "entered by someone who is no user")

	_, err = pool.Exec(ctx, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali)
	require.NoError(t, err)
	_, err = addCustomer(olma, jismoniy, "998901234567")
	assert.NoError(t, err, "a deleted customer's number is free again")

	_, err = pool.Exec(ctx, "UPDATE users SET phone = '998902222222' WHERE phone = '998901111111'")
	require.NoError(t, err, "a user who has entered customers gets another number")
	var by string
	require.NoError(t, pool.QueryRow(ctx, "SELECT created_by FROM customers WHERE id = $1", ali).Scan(&by))
	assert.Equal(t, "998902222222", by, "the customers stay theirs")
}

func TestCustomerValues(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	jismoniy := addCustomerType(t, pool, olma, "Jismoniy")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	var manba, instagram, linkedin, ali int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'Instagram', 1) RETURNING id", manba).Scan(&instagram))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'LinkedIn', 2) RETURNING id", manba).Scan(&linkedin))
	addField := func(label, kind string, dropdownID *int64) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO customer_fields (company_id, type_id, label, kind, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`, olma, jismoniy, label, kind, dropdownID).Scan(&id))
		return id
	}
	fish, yosh, izoh, qayerdan := addField("F.I.Sh.", "string", nil), addField("Yoshi", "int", nil),
		addField("Izoh", "string", nil), addField("Qayerdan", "checkbox", &manba)
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO customers (company_id, type_id, phone, created_by)
		VALUES ($1, $2, '998901234567', '998901111111') RETURNING id`, olma, jismoniy).Scan(&ali))
	// answer writes one row of Ali's answers.
	answer := func(fieldID int64, optionID *int64, text *string, number *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO customer_values (customer_id, field_id, option_id, text_value, int_value)
			VALUES ($1, $2, $3, $4, $5)`, ali, fieldID, optionID, text, number)
		return err
	}
	name, other, age := "Ali Valiyev", "Vali Aliyev", int64(30)

	require.NoError(t, answer(fish, nil, &name, nil), "a text")
	require.NoError(t, answer(yosh, nil, nil, &age), "a whole number")
	assert.Equal(t, "23505", sqlState(answer(fish, nil, &other, nil)), "a second text in the field") // unique_violation
	assert.Equal(t, "23505", sqlState(answer(yosh, nil, nil, &age)), "a second number in the field")
	require.NoError(t, answer(qayerdan, &instagram, nil, nil), "an option")
	assert.NoError(t, answer(qayerdan, &linkedin, nil, nil), "another option of the same field")
	assert.Equal(t, "23505", sqlState(answer(qayerdan, &instagram, nil, nil)), "the option is chosen already")

	assert.Equal(t, "23514", sqlState(answer(izoh, nil, nil, nil)), "an answer of nothing") // check_violation
	assert.Equal(t, "23514", sqlState(answer(izoh, nil, &name, &age)), "a text and a number at once")
	assert.Equal(t, "23514", sqlState(answer(izoh, &instagram, &name, nil)), "an option and a text at once")

	missing := int64(1 << 40)
	assert.Equal(t, "23503", sqlState(answer(missing, nil, &name, nil)), "a field that is not there") // foreign_key_violation
	assert.Equal(t, "23503", sqlState(answer(izoh, &missing, nil, nil)), "an option that is not there")
	_, err = pool.Exec(ctx, "INSERT INTO customer_values (customer_id, field_id, text_value) VALUES ($1, $2, 'Ali')", missing, izoh)
	assert.Equal(t, "23503", sqlState(err), "a customer that is not there")
}

func TestCustomerHistory(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	jismoniy := addCustomerType(t, pool, olma, "Jismoniy")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	var ali int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO customers (company_id, type_id, phone, created_by)
		VALUES ($1, $2, '998901234567', '998901111111') RETURNING id`, olma, jismoniy).Scan(&ali))
	// record writes down what the user did to the customer.
	record := func(customerID int64, action, actor string) error {
		_, err := pool.Exec(ctx,
			"INSERT INTO customer_history (customer_id, action, actor_phone) VALUES ($1, $2, $3)", customerID, action, actor)
		return err
	}

	for _, action := range []string{"created", "updated", "deleted"} {
		assert.NoError(t, record(ali, action, "998901111111"), action)
	}
	assert.Equal(t, "23514", sqlState(record(ali, "restored", "998901111111")), "an action that is not one of the three") // check_violation
	assert.Equal(t, "23503", sqlState(record(ali, "updated", "998909999999")), "done by someone who is no user")          // foreign_key_violation
	assert.Equal(t, "23503", sqlState(record(1<<40, "updated", "998901111111")), "a customer that is not there")
	var changes string
	require.NoError(t, pool.QueryRow(ctx, "SELECT changes::text FROM customer_history LIMIT 1").Scan(&changes))
	assert.Equal(t, "[]", changes, "nothing changed unless said otherwise")

	_, err = pool.Exec(ctx, "UPDATE users SET phone = '998902222222' WHERE phone = '998901111111'")
	require.NoError(t, err, "a user with a history gets another number")
	var actors []string
	rows, err := pool.Query(ctx, "SELECT DISTINCT actor_phone FROM customer_history")
	require.NoError(t, err)
	actors, err = pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"998902222222"}, actors, "what they did stays theirs")
}

func TestOrderStages(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addStage := func(companyID int64, name, color string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO order_stages (company_id, name, color, position) VALUES ($1, $2, $3, 1) RETURNING id", companyID, name, color).Scan(&id)
		return id, err
	}

	yangi, err := addStage(olma, "Yangi", "blue")
	require.NoError(t, err)
	_, err = addStage(olma, "YANGI", "red")
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company, in any case") // unique_violation
	_, err = addStage(nok, "Yangi", "blue")
	assert.NoError(t, err, "another company's stage")
	for _, color := range []string{"slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"} {
		_, err = addStage(nok, "Rang "+color, color)
		assert.NoError(t, err, color)
	}
	_, err = addStage(olma, "Oltin", "gold")
	assert.Equal(t, "23514", sqlState(err), "a color that is not one of the nine") // check_violation
	_, err = addStage(olma, "Rangsiz", "")
	assert.Equal(t, "23514", sqlState(err), "no color")
	var done bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_done FROM order_stages WHERE id = $1", yangi).Scan(&done))
	assert.False(t, done, "a stage holds unfinished orders unless said otherwise")

	_, err = pool.Exec(ctx, "UPDATE order_stages SET deleted_at = now() WHERE id = $1", yangi)
	require.NoError(t, err)
	_, err = addStage(olma, "Yangi", "blue")
	assert.NoError(t, err, "a deleted stage's name is free again")
}

func TestOrderTypesAndFields(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addType := func(companyID int64, name string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO order_types (company_id, name, position) VALUES ($1, $2, 1) RETURNING id", companyID, name).Scan(&id)
		return id, err
	}
	buyurtma, err := addType(olma, "Buyurtma")
	require.NoError(t, err)
	_, err = addType(olma, "BUYURTMA")
	assert.Equal(t, "23505", sqlState(err), "the type's name is taken in the company, in any case")
	begona, err := addType(nok, "Buyurtma")
	require.NoError(t, err, "another company's type")

	var manba, nokManba int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", nok).Scan(&nokManba))

	// addField adds a field of Olma's to an order type.
	addField := func(typeID int64, label, kind string, dropdownID *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO order_fields (company_id, type_id, label, kind, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, 1)`, olma, typeID, label, kind, dropdownID)
		return err
	}
	require.NoError(t, addField(buyurtma, "Izoh", "string", nil))
	var required bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT required FROM order_fields WHERE type_id = $1", buyurtma).Scan(&required))
	assert.False(t, required, "a field may stay empty unless said otherwise")
	assert.Equal(t, "23505", sqlState(addField(buyurtma, "izoh", "string", nil)), "the field's name is taken in the type")
	for _, kind := range []string{"int", "dropdown", "multi_dropdown", "radio", "checkbox"} {
		var dropdown *int64
		if kind != "int" {
			dropdown = &manba
		}
		assert.NoError(t, addField(buyurtma, "Maydon "+kind, kind, dropdown), kind)
	}
	assert.Equal(t, "23514", sqlState(addField(buyurtma, "Sana", "date", nil)), "a kind that is not one of the six") // check_violation
	assert.Equal(t, "23514", sqlState(addField(buyurtma, "Tanlov", "dropdown", nil)), "a choice field without a dropdown")
	assert.Equal(t, "23514", sqlState(addField(buyurtma, "Matn", "string", &manba)), "a text field with a dropdown")
	assert.Equal(t, "23503", sqlState(addField(buyurtma, "Tanlov", "dropdown", &nokManba)), "another company's dropdown") // foreign_key_violation
	assert.Equal(t, "23503", sqlState(addField(begona, "Izoh", "string", nil)), "another company's type")
	_, err = pool.Exec(ctx, "SELECT is_unique FROM order_fields")
	assert.Equal(t, "42703", sqlState(err), "an order field is never told not to repeat") // undefined_column

	_, err = pool.Exec(ctx, "UPDATE order_fields SET deleted_at = now() WHERE type_id = $1 AND label = 'Izoh'", buyurtma)
	require.NoError(t, err)
	assert.NoError(t, addField(buyurtma, "Izoh", "string", nil), "a deleted field's name is free again")
	_, err = pool.Exec(ctx, "UPDATE order_types SET deleted_at = now() WHERE id = $1", buyurtma)
	require.NoError(t, err)
	_, err = addType(olma, "Buyurtma")
	assert.NoError(t, err, "a deleted type's name is free again")
}

// taskStagesOf describes a company's stages in their order, each as
// "name color [done]".
func taskStagesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT name || ' ' || color || CASE WHEN is_done THEN ' done' ELSE '' END
		FROM task_stages WHERE company_id = $1 AND deleted_at IS NULL ORDER BY position`, companyID)
	require.NoError(t, err)
	stages, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return stages
}

// taskTypesOf describes a company's task types, in their order, each as
// "name: field kind [required], …" with the fields in theirs.
func taskTypesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT t.name || ': ' || COALESCE(string_agg(
			f.label || ' ' || f.kind || CASE WHEN f.required THEN ' required' ELSE '' END, ', ' ORDER BY f.position), '')
		FROM task_types t LEFT JOIN task_fields f ON f.type_id = t.id
		WHERE t.company_id = $1 GROUP BY t.id ORDER BY t.position`, companyID)
	require.NoError(t, err)
	types, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return types
}

func TestTheTaskSettingsMigrationGivesEveryCompanyTheReadySettings(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 6)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	_, err = provider.UpTo(ctx, 7)
	require.NoError(t, err)

	stages := []string{"Yangi blue", "Jarayonda amber", "Bajarildi green done"}
	assert.Equal(t, stages, taskStagesOf(t, pool, olma))
	assert.Equal(t, stages, taskStagesOf(t, pool, nok), "every company gets its own")
	assert.Equal(t, []string{"Vazifa: "}, taskTypesOf(t, pool, olma), "one type with no fields")
	assert.Equal(t, []string{"Vazifa: "}, taskTypesOf(t, pool, nok))
}

// addTaskSettings inserts a stage and a task type of the company, as the
// tables were named before the orders migration (00018), and returns their
// ids.
func addTaskSettings(t *testing.T, pool *pgxpool.Pool, companyID int64) (stage, typ int64) {
	t.Helper()
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO task_stages (company_id, name, color, position) VALUES ($1, 'Yangi', 'blue', 1) RETURNING id", companyID).Scan(&stage))
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO task_types (company_id, name, position) VALUES ($1, 'Vazifa', 1) RETURNING id", companyID).Scan(&typ))
	return stage, typ
}

// addOrderSettings inserts a stage and an order type of the company and
// returns their ids.
func addOrderSettings(t *testing.T, pool *pgxpool.Pool, companyID int64) (stage, typ int64) {
	t.Helper()
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO order_stages (company_id, name, color, position) VALUES ($1, 'Yangi', 'blue', 1) RETURNING id", companyID).Scan(&stage))
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO order_types (company_id, name, position) VALUES ($1, 'Buyurtma', 1) RETURNING id", companyID).Scan(&typ))
	return stage, typ
}

// addCustomer inserts a customer of the company's type, entered by the user
// 998901111111, and returns its id.
func addCustomer(t *testing.T, pool *pgxpool.Pool, companyID, typeID int64, phone string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO customers (company_id, type_id, phone, created_by)
		VALUES ($1, $2, $3, '998901111111') RETURNING id`, companyID, typeID, phone).Scan(&id))
	return id
}

func TestOrders(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	begona := addCustomer(t, pool, nok, addCustomerType(t, pool, nok, "Jismoniy"), "998901234567")
	stage, typ := addOrderSettings(t, pool, olma)
	nokStage, nokType := addOrderSettings(t, pool, nok)
	asosiy := addLocation(t, pool, olma, "Asosiy")
	// addOrder adds an order the user 998901111111 enters, in Olma's location.
	addOrder := func(typeID, stageID, customerID int64, deadline *string, assignee *string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, assignee_phone, created_by)
			VALUES ($1, $2, $3, $4, $7, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), $5::date, $6, '998901111111') RETURNING id`,
			olma, typeID, stageID, customerID, deadline, assignee, asosiy).Scan(&id)
		return id, err
	}
	day, staff, stranger := "2026-10-10", "998902222222", "998909999999"

	first, err := addOrder(typ, stage, ali, &day, nil)
	require.NoError(t, err)
	_, err = addOrder(typ, stage, ali, &day, &staff)
	assert.NoError(t, err, "assigned to a user")
	_, err = addOrder(typ, stage, ali, nil, nil)
	assert.Equal(t, "23502", sqlState(err), "an order has a deadline") // not_null_violation
	_, err = addOrder(nokType, stage, ali, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's type") // foreign_key_violation
	_, err = addOrder(typ, nokStage, ali, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's stage")
	_, err = addOrder(typ, stage, begona, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's customer")
	_, err = addOrder(typ, stage, ali, &day, &stranger)
	assert.Equal(t, "23503", sqlState(err), "assigned to someone who is no user")
	_, err = pool.Exec(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), '2026-10-10', '998909999999')`, olma, typ, stage, ali, asosiy)
	assert.Equal(t, "23503", sqlState(err), "entered by someone who is no user")

	_, err = pool.Exec(ctx, "UPDATE orders SET deleted_at = now() WHERE id = $1", first)
	require.NoError(t, err, "an order is hidden, never removed")
	_, err = pool.Exec(ctx, "UPDATE users SET phone = '998903333333' WHERE phone = '998902222222'")
	require.NoError(t, err, "an assignee gets another number")
	var assigned string
	require.NoError(t, pool.QueryRow(ctx, "SELECT assignee_phone FROM orders WHERE assignee_phone IS NOT NULL").Scan(&assigned))
	assert.Equal(t, "998903333333", assigned, "the order stays theirs")
}

func TestOrderValues(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addOrderSettings(t, pool, olma)
	var manba, instagram, linkedin, order int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'Instagram', 1) RETURNING id", manba).Scan(&instagram))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'LinkedIn', 2) RETURNING id", manba).Scan(&linkedin))
	addField := func(label, kind string, dropdownID *int64) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO order_fields (company_id, type_id, label, kind, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`, olma, typ, label, kind, dropdownID).Scan(&id))
		return id
	}
	izoh, summa, manzil, kanal := addField("Izoh", "string", nil), addField("Summa", "int", nil),
		addField("Manzil", "string", nil), addField("Kanal", "checkbox", &manba)
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), '2026-10-10', '998901111111') RETURNING id`,
		olma, typ, stage, ali, addLocation(t, pool, olma, "Asosiy")).Scan(&order))
	// answer writes one row of the order's answers.
	answer := func(fieldID int64, optionID *int64, text *string, number *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO order_values (order_id, field_id, option_id, text_value, int_value)
			VALUES ($1, $2, $3, $4, $5)`, order, fieldID, optionID, text, number)
		return err
	}
	note, other, amount := "Ertalab", "Kechqurun", int64(5000)

	require.NoError(t, answer(izoh, nil, &note, nil), "a text")
	require.NoError(t, answer(summa, nil, nil, &amount), "a whole number")
	assert.Equal(t, "23505", sqlState(answer(izoh, nil, &other, nil)), "a second text in the field") // unique_violation
	require.NoError(t, answer(kanal, &instagram, nil, nil), "an option")
	assert.NoError(t, answer(kanal, &linkedin, nil, nil), "another option of the same field")
	assert.Equal(t, "23505", sqlState(answer(kanal, &instagram, nil, nil)), "the option is chosen already")
	assert.Equal(t, "23514", sqlState(answer(manzil, nil, nil, nil)), "an answer of nothing") // check_violation
	assert.Equal(t, "23514", sqlState(answer(manzil, nil, &note, &amount)), "a text and a number at once")
	missing := int64(1 << 40)
	assert.Equal(t, "23503", sqlState(answer(missing, nil, &note, nil)), "a field that is not there") // foreign_key_violation
	assert.Equal(t, "23503", sqlState(answer(manzil, &missing, nil, nil)), "an option that is not there")
	_, err = pool.Exec(ctx, "INSERT INTO order_values (order_id, field_id, text_value) VALUES ($1, $2, 'X')", missing, manzil)
	assert.Equal(t, "23503", sqlState(err), "an order that is not there")
}

func TestOrderHistory(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addOrderSettings(t, pool, olma)
	var order int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), '2026-10-10', '998901111111') RETURNING id`,
		olma, typ, stage, ali, addLocation(t, pool, olma, "Asosiy")).Scan(&order))
	// record writes down what the user did to the order.
	record := func(orderID int64, action, actor string) error {
		_, err := pool.Exec(ctx, "INSERT INTO order_history (order_id, action, actor_phone) VALUES ($1, $2, $3)", orderID, action, actor)
		return err
	}

	for _, action := range []string{"created", "updated", "deleted"} {
		assert.NoError(t, record(order, action, "998901111111"), action)
	}
	assert.Equal(t, "23514", sqlState(record(order, "moved", "998901111111")), "an action that is not one of the three") // check_violation
	assert.Equal(t, "23503", sqlState(record(order, "updated", "998909999999")), "done by someone who is no user")       // foreign_key_violation
	assert.Equal(t, "23503", sqlState(record(1<<40, "updated", "998901111111")), "an order that is not there")
	var changes string
	require.NoError(t, pool.QueryRow(ctx, "SELECT changes::text FROM order_history LIMIT 1").Scan(&changes))
	assert.Equal(t, "[]", changes, "nothing changed unless said otherwise")
}

func TestRolesAreACompanysAndItsUsersOnly(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222'), ('998903333333')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role) VALUES
		('998901111111', $1, 'owner'), ('998902222222', $1, 'user'), ('998903333333', $2, 'user')`, olma, nok)
	require.NoError(t, err)

	var role int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'Sotuvchi', '{customers.view}') RETURNING id", olma).Scan(&role))
	var perms []string
	require.NoError(t, pool.QueryRow(ctx, "SELECT permissions FROM roles WHERE id = $1", role).Scan(&perms))
	assert.Equal(t, []string{"customers.view"}, perms)

	_, err = pool.Exec(ctx, "UPDATE user_companies SET role_id = $1 WHERE user_phone = '998902222222'", role)
	assert.NoError(t, err, "a user of the company takes its role")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET role_id = $1 WHERE user_phone = '998901111111'", role)
	assert.Equal(t, "23514", sqlState(err), "the owner has no role") // check_violation
	_, err = pool.Exec(ctx, "UPDATE user_companies SET role_id = $1 WHERE user_phone = '998903333333'", role)
	assert.Equal(t, "23503", sqlState(err), "another company's user cannot take it") // foreign_key_violation
	_, err = pool.Exec(ctx, "INSERT INTO roles (company_id, name) VALUES ($1, 'sotuvchi')", olma)
	assert.Equal(t, "23505", sqlState(err), "a name is one role's in a company, whatever the case") // unique_violation
	_, err = pool.Exec(ctx, "INSERT INTO roles (company_id, name) VALUES ($1, 'Sotuvchi')", nok)
	assert.NoError(t, err, "another company may use the name")
	require.NoError(t, pool.QueryRow(ctx, "SELECT permissions FROM roles WHERE company_id = $1", nok).Scan(&perms))
	assert.Equal(t, []string{}, perms, "a role starts with no permissions")
	_, err = pool.Exec(ctx, "DELETE FROM roles WHERE id = $1", role)
	assert.Equal(t, "23503", sqlState(err), "a role someone holds is not deleted")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET role_id = NULL WHERE user_phone = '998902222222'")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "DELETE FROM roles WHERE id = $1", role)
	assert.NoError(t, err, "a role nobody holds")
}

// addLocation inserts a location of the company and returns its id.
func addLocation(t *testing.T, pool *pgxpool.Pool, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO locations (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id))
	return id
}

// locationsOf is the company's live locations by name, in the order they
// were added.
func locationsOf(t *testing.T, pool *pgxpool.Pool, companyID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT name FROM locations WHERE company_id = $1 AND deleted_at IS NULL ORDER BY id", companyID)
	require.NoError(t, err)
	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return names
}

func TestTheLocationsMigrationGivesEveryCompanyAReadyLocationAndMovesItsTasksThere(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 9)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addTaskSettings(t, pool, olma)
	var task int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, 'Qo''ng''iroq', '2026-10-10', '998901111111') RETURNING id`, olma, typ, stage, ali).Scan(&task))

	_, err = provider.UpTo(ctx, 10)
	require.NoError(t, err)

	assert.Equal(t, []string{"Asosiy"}, locationsOf(t, pool, olma), "the ready location")
	assert.Equal(t, []string{"Asosiy"}, locationsOf(t, pool, nok), "every company gets its own")
	var location, olmasAsosiy, noksAsosiy int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT location_id FROM tasks WHERE id = $1", task).Scan(&location))
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM locations WHERE company_id = $1", olma).Scan(&olmasAsosiy))
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM locations WHERE company_id = $1", nok).Scan(&noksAsosiy))
	assert.Equal(t, olmasAsosiy, location, "the tasks there were stand in their company's ready location")
	assert.NotEqual(t, olmasAsosiy, noksAsosiy)
}

func TestLocations(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addOrderSettings(t, pool, olma)
	asosiy := addLocation(t, pool, olma, "Asosiy")

	_, err = pool.Exec(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'asosiy')", olma)
	assert.Equal(t, "23505", sqlState(err), "a name is one location's in a company, whatever the case") // unique_violation
	noksAsosiy := addLocation(t, pool, nok, "Asosiy")
	var created time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT created_at FROM locations WHERE id = $1", noksAsosiy).Scan(&created))
	assert.False(t, created.IsZero(), "another company may use the name")

	// addOrder adds an order of Olma's in the location, entered by the user.
	addOrder := func(locationID *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by)
			VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), '2026-10-10', '998901111111')`, olma, typ, stage, ali, locationID)
		return err
	}
	assert.NoError(t, addOrder(&asosiy), "an order stands in a location of its company")
	assert.Equal(t, "23502", sqlState(addOrder(nil)), "an order stands in a location")             // not_null_violation
	assert.Equal(t, "23503", sqlState(addOrder(&noksAsosiy)), "not in another company's location") // foreign_key_violation

	_, err = pool.Exec(ctx, "UPDATE locations SET deleted_at = now() WHERE id = $1", asosiy)
	require.NoError(t, err, "a location is hidden, never removed")
	_, err = pool.Exec(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy')", olma)
	assert.NoError(t, err, "a deleted location's name is free again")
	assert.NoError(t, addOrder(&asosiy), "the orders of a deleted location keep standing in it")
}

func TestAMemberHasEveryLocationUnlessRestricted(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role) VALUES
		('998901111111', $1, 'owner'), ('998902222222', $1, 'user')`, olma)
	require.NoError(t, err)
	asosiy, noksAsosiy := addLocation(t, pool, olma, "Asosiy"), addLocation(t, pool, nok, "Asosiy")

	var all bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT all_locations FROM user_companies WHERE user_phone = '998902222222'").Scan(&all))
	assert.True(t, all, "a member may work in every location unless restricted")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET all_locations = false WHERE user_phone = '998901111111'")
	assert.Equal(t, "23514", sqlState(err), "the owner is never restricted") // check_violation
	_, err = pool.Exec(ctx, "UPDATE user_companies SET all_locations = false WHERE user_phone = '998902222222'")
	assert.NoError(t, err, "a user may be")

	// restrict adds a location to the user's restriction.
	restrict := func(locationID int64) error {
		_, err := pool.Exec(ctx, "INSERT INTO member_locations (user_phone, company_id, location_id) VALUES ('998902222222', $1, $2)", olma, locationID)
		return err
	}
	assert.NoError(t, restrict(asosiy))
	assert.Equal(t, "23505", sqlState(restrict(asosiy)), "a location is in the restriction once") // unique_violation
	assert.Equal(t, "23503", sqlState(restrict(noksAsosiy)), "not another company's location")    // foreign_key_violation
	_, err = pool.Exec(ctx, "INSERT INTO member_locations (user_phone, company_id, location_id) VALUES ('998909999999', $1, $2)", olma, asosiy)
	assert.Equal(t, "23503", sqlState(err), "the restriction is a member's")

	_, err = pool.Exec(ctx, "DELETE FROM user_companies WHERE user_phone = '998902222222'")
	require.NoError(t, err)
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations").Scan(&rows))
	assert.Zero(t, rows, "the restriction goes with the membership")
}

func TestTheLocationsMigrationDownRemovesTheLocations(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	addLocation(t, pool, olma, "Asosiy")

	_, err := newProvider(t, pool).DownTo(ctx, 9)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT id FROM locations")
	assert.Equal(t, "42P01", sqlState(err), "the locations are gone") // undefined_table
	_, err = pool.Exec(ctx, "SELECT user_phone FROM member_locations")
	assert.Equal(t, "42P01", sqlState(err), "and so are the restrictions")
	_, err = pool.Exec(ctx, "SELECT location_id FROM tasks")
	assert.Equal(t, "42703", sqlState(err), "a task stands in no location") // undefined_column
	_, err = pool.Exec(ctx, "SELECT all_locations FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "a member is not restricted")
}

// The products and the services of a company (logic/products.md): a product
// has a unit and may have a SKU, a service has neither; the names are one
// row's among the company's rows of the kind, the SKUs one product's.
func TestProductsAreOfTwoKindsWithTheirOwnRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	str := func(s string) *string { return &s }
	insert := func(companyID int64, kind, name string, unit, sku, price *string) error {
		_, err := pool.Exec(ctx, `INSERT INTO products (company_id, kind, name, unit, sku, price, created_by)
			VALUES ($1, $2, $3, $4, $5, $6::numeric, '998901111111')`, companyID, kind, name, unit, sku, price)
		return err
	}

	require.NoError(t, insert(olma, "product", "Olma", str("kg"), str("A-1"), str("1200.50")), "a product has a unit")
	require.NoError(t, insert(olma, "service", "Yetkazish", nil, nil, nil), "a service has no unit")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", nil, nil, nil)), "a product without a unit") // check_violation
	assert.Equal(t, "23514", sqlState(insert(olma, "service", "Ta'mirlash", str("dona"), nil, nil)), "a service with a unit")
	assert.Equal(t, "23514", sqlState(insert(olma, "service", "Ta'mirlash", nil, str("S-1"), nil)), "a service with a SKU")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", str("tonna"), nil, nil)), "a unit not in the list")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", str("dona"), nil, str("-1"))), "a price below zero")
	assert.Equal(t, "23514", sqlState(insert(olma, "thing", "Nok", nil, nil, nil)), "a kind not of the two")
	assert.Equal(t, "23505", sqlState(insert(olma, "product", "OLMA", str("dona"), nil, nil)), "the name is taken among the products, whatever the case") // unique_violation
	assert.Equal(t, "23505", sqlState(insert(olma, "product", "Nok", str("dona"), str("a-1"), nil)), "the SKU is taken, whatever the case")
	require.NoError(t, insert(olma, "service", "Olma", nil, nil, nil), "a service may have a product's name")
	require.NoError(t, insert(nok, "product", "Olma", str("dona"), str("A-1"), nil), "another company has its own names and SKUs")
	_, err = pool.Exec(ctx, "UPDATE products SET deleted_at = now() WHERE company_id = $1 AND kind = 'product' AND name = 'Olma'", olma)
	require.NoError(t, err)
	require.NoError(t, insert(olma, "product", "Olma", str("dona"), str("A-1"), nil), "a deleted product's name and SKU are free")
	assert.Equal(t, "23503", sqlState(insert(999999, "product", "Begona", str("dona"), nil, nil)), "a product is a company's") // foreign_key_violation
	var active bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_active FROM products WHERE company_id = $1 AND name = 'Yetkazish'", olma).Scan(&active))
	assert.True(t, active, "a product starts active")
}

func TestTheCatalogMigrationDownRemovesTheProducts(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 10)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT 1 FROM products")
	assert.Equal(t, "42P01", sqlState(err), "undefined_table")
}

// A membership keeps the member's own order of the menu in the company
// (logic/roles.md, section 8): NULL until they set one. The tab bar took
// its place (00017).
func TestAMembershipKeepsTheMembersOrderOfTheMenu(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	_, err := newProvider(t, pool).DownTo(ctx, 16)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'owner')", olma)
	require.NoError(t, err)

	var order []string
	require.NoError(t, pool.QueryRow(ctx, "SELECT nav_order FROM user_companies WHERE user_phone = '998901111111'").Scan(&order))
	assert.Nil(t, order, "the default order until the member sets one")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET nav_order = '{tasks,home}' WHERE user_phone = '998901111111'")
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "SELECT nav_order FROM user_companies WHERE user_phone = '998901111111'").Scan(&order))
	assert.Equal(t, []string{"tasks", "home"}, order)
}

func TestTheNavOrderMigrationDownRemovesTheColumn(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 11)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT nav_order FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "undefined_column")
}

// warehouseFixture is a company with a user, a location, a supplier and a
// product: what a purchase needs.
type warehouseFixture struct {
	company, location, supplier, product int64
}

func addWarehouseFixture(t *testing.T, pool *pgxpool.Pool, company string) warehouseFixture {
	t.Helper()
	ctx := t.Context()
	f := warehouseFixture{company: addCompany(t, pool, company)}
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111') ON CONFLICT DO NOTHING")
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", f.company).Scan(&f.location))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', '998901111111') RETURNING id", f.company).Scan(&f.supplier))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', '998901111111') RETURNING id", f.company).Scan(&f.product))
	return f
}

func TestSuppliersAreACompanysWithTheirOwnNames(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addWarehouseFixture(t, pool, "Olma")
	nok := addWarehouseFixture(t, pool, "Nok")
	insert := func(companyID int64, name string, phone *string) error {
		_, err := pool.Exec(ctx, "INSERT INTO suppliers (company_id, name, phone, created_by) VALUES ($1, $2, $3, '998901111111')", companyID, name, phone)
		return err
	}
	str := func(s string) *string { return &s }

	// Both fixtures hold a Bozor already: a new name tells the rules apart.
	require.NoError(t, insert(olma.company, "Do'kon", nil))
	assert.Equal(t, "23505", sqlState(insert(olma.company, "DO'KON", nil)), "the name is taken, whatever the case")
	require.NoError(t, insert(nok.company, "Do'kon", str("998901234567")), "another company has its own names")
	assert.Equal(t, "23514", sqlState(insert(olma.company, "Rasta", str("+998901234567"))), "a phone is 998 and nine digits")
	_, err := pool.Exec(ctx, "UPDATE suppliers SET deleted_at = now() WHERE id = $1", olma.supplier)
	require.NoError(t, err)
	require.NoError(t, insert(olma.company, "Bozor", nil), "a deleted supplier's name is free")
	var active bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_active FROM suppliers WHERE id = $1", nok.supplier).Scan(&active))
	assert.True(t, active, "a supplier starts active")
}

// ledgerFixture is a warehouse fixture with what a document needs besides:
// an owner, a currency rate row, a cash account and a second product.
type ledgerFixture struct {
	warehouseFixture
	rate, cash, nok int64
}

func addLedgerFixture(t *testing.T, pool *pgxpool.Pool, company string) ledgerFixture {
	t.Helper()
	ctx := t.Context()
	f := ledgerFixture{warehouseFixture: addWarehouseFixture(t, pool, company)}
	_, err := pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'owner')", f.company)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, set_by) VALUES ($1, '998901111111') RETURNING id", f.company).Scan(&f.rate))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", f.company).Scan(&f.cash))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Nok', 'dona', '998901111111') RETURNING id", f.company).Scan(&f.nok))
	return f
}

// document is a row of transactions as a test enters it: the kind, the
// number and whichever of the references the kind needs.
type document struct {
	kind                                 string
	number                               int
	location, toLocation, supplier, cash *int64
	// total is the amount, "" for none (a goods document starts with 0).
	total string
}

func addDocument(t *testing.T, pool *pgxpool.Pool, f ledgerFixture, d document) (int64, error) {
	t.Helper()
	var id int64
	err := pool.QueryRow(t.Context(), `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, to_location_id, supplier_id, bank_account_id, currency_rate_id, total, created_by)
		VALUES ($1, $2, $3, '2026-10-07 09:00+05', $4, $5, $6, $7, $8, COALESCE(NULLIF($9, ''), '0')::numeric, '998901111111') RETURNING id`,
		f.company, d.kind, d.number, d.location, d.toLocation, d.supplier, d.cash, f.rate, d.total).Scan(&id)
	return id, err
}

func TestTransactionsKeepTheirRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addLedgerFixture(t, pool, "Olma")
	nok := addLedgerFixture(t, pool, "Nok")
	purchase := func(f ledgerFixture, number int, locationID, supplierID int64) (int64, error) {
		return addDocument(t, pool, f, document{kind: "purchase", number: number, location: &locationID, supplier: &supplierID})
	}

	first, err := purchase(olma, 1, olma.location, olma.supplier)
	require.NoError(t, err)
	_, err = purchase(olma, 1, olma.location, olma.supplier)
	assert.Equal(t, "23505", sqlState(err), "a number is one document's in the company and the kind")
	_, err = addDocument(t, pool, olma, document{kind: "supplier_payment", number: 1, supplier: &olma.supplier, cash: &olma.cash, total: "1"})
	require.NoError(t, err, "another kind counts its own numbers")
	_, err = purchase(nok, 1, nok.location, nok.supplier)
	require.NoError(t, err, "another company counts its own")
	_, err = purchase(olma, 2, nok.location, olma.supplier)
	assert.Equal(t, "23503", sqlState(err), "the location is the company's")
	_, err = purchase(olma, 2, olma.location, nok.supplier)
	assert.Equal(t, "23503", sqlState(err), "the supplier is the company's")
	_, err = addDocument(t, pool, olma, document{kind: "refund", number: 1, location: &olma.location})
	assert.Equal(t, "23514", sqlState(err), "a kind of the catalog")
	_, err = addDocument(t, pool, olma, document{kind: "purchase", number: 2, location: &olma.location})
	assert.Equal(t, "23514", sqlState(err), "a purchase names its supplier")
	_, err = addDocument(t, pool, olma, document{kind: "transfer", number: 1, location: &olma.location, toLocation: &olma.location})
	assert.Equal(t, "23514", sqlState(err), "a transfer goes to another location")
	_, err = addDocument(t, pool, olma, document{kind: "supplier_payment", number: 2, supplier: &olma.supplier, total: "1"})
	assert.Equal(t, "23514", sqlState(err), "a payment comes out of an account")
	_, err = addDocument(t, pool, olma, document{kind: "supplier_payment", number: 2, supplier: &olma.supplier, cash: &olma.cash})
	assert.Equal(t, "23514", sqlState(err), "a payment is of something")
	_, err = addDocument(t, pool, olma, document{kind: "supplier_payment", number: 2, supplier: &olma.supplier, cash: &nok.cash, total: "1"})
	assert.Equal(t, "23503", sqlState(err), "the account is the company's")
	var total, currency string
	require.NoError(t, pool.QueryRow(ctx, "SELECT total::text, currency_id::text FROM transactions WHERE id = $1", first).Scan(&total, &currency))
	assert.Equal(t, "0.00", total, "a document starts with no total")
	assert.Equal(t, "1", currency, "in so'm unless told")

	item := func(txID, productID int64, quantity, price string) error {
		_, err := pool.Exec(ctx, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", txID, productID, quantity, price)
		return err
	}
	require.NoError(t, item(first, olma.product, "12.5", "1000"))
	assert.Equal(t, "23505", sqlState(item(first, olma.product, "1", "1000")), "a product once in a document")
	assert.Equal(t, "23514", sqlState(item(first, olma.nok, "-1", "1000")), "a quantity not below zero (an inventory may count none)")
	assert.Equal(t, "23514", sqlState(item(first, olma.nok, "1", "-1")), "a price not below zero")
	var quantity string
	require.NoError(t, pool.QueryRow(ctx, "SELECT quantity::text FROM transaction_items WHERE transaction_id = $1", first).Scan(&quantity))
	assert.Equal(t, "12.500", quantity, "three decimals, as the column keeps it")
}

func TestStockMovesAreAJournal(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addLedgerFixture(t, pool, "Olma")
	nok := addLedgerFixture(t, pool, "Nok")
	tx, err := addDocument(t, pool, olma, document{kind: "purchase", number: 1, location: &olma.location, supplier: &olma.supplier})
	require.NoError(t, err)
	move := func(txID, companyID, locationID, productID int64, quantity string) error {
		_, err := pool.Exec(ctx, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5::numeric)", txID, companyID, locationID, productID, quantity)
		return err
	}

	require.NoError(t, move(tx, olma.company, olma.location, olma.product, "12.5"))
	require.NoError(t, move(tx, olma.company, olma.location, olma.product, "-2.5"), "a document may move a product more than once")
	assert.Equal(t, "23514", sqlState(move(tx, olma.company, olma.location, olma.product, "0")), "a move of nothing is not written")
	assert.Equal(t, "23503", sqlState(move(tx, olma.company, nok.location, olma.product, "1")), "the location is the company's")
	assert.Equal(t, "23503", sqlState(move(tx, olma.company, olma.location, nok.product, "1")), "the product is the company's")
	assert.Equal(t, "23503", sqlState(move(999999, olma.company, olma.location, olma.product, "1")), "a move is a document's")
	var stock string
	require.NoError(t, pool.QueryRow(ctx, "SELECT sum(quantity)::text FROM stock_moves WHERE location_id = $1 AND product_id = $2", olma.location, olma.product).Scan(&stock))
	assert.Equal(t, "10.000", stock, "the stock is the sum of the moves")
}

func TestTheWarehouseMigrationDownRemovesItsTables(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 12)
	require.NoError(t, err)

	for _, table := range []string{"supplier_payments", "stock", "purchase_items", "purchases", "suppliers"} {
		_, err = pool.Exec(ctx, "SELECT 1 FROM "+table)
		assert.Equal(t, "42P01", sqlState(err), table)
	}
}

func TestCurrenciesAreSeeded(t *testing.T) {
	pool := pgtest.New(t)
	rows, err := pool.Query(t.Context(), "SELECT id, code, name, symbol FROM currencies ORDER BY position, id")
	require.NoError(t, err)
	type currency struct {
		ID                 int64
		Code, Name, Symbol string
	}
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[currency])
	require.NoError(t, err)
	assert.Equal(t, []currency{
		{1, "UZS", "O'zbek so'mi", "so'm"}, {2, "USD", "AQSH dollari", "$"}, {3, "EUR", "Yevro", "€"}, {4, "RUB", "Rossiya rubli", "₽"},
	}, got)
	var next int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO currencies (code, name, symbol, position) VALUES ('KZT', 'Tenge', 'T', 5) RETURNING id").Scan(&next))
	assert.EqualValues(t, 5, next, "the sequence continues after the seed")
}

func TestTheCurrenciesMigrationGivesEveryCompanyUZS(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 13)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	_, err = provider.UpTo(ctx, 14)
	require.NoError(t, err)

	rows, err := pool.Query(ctx, "SELECT company_id, currency_id FROM company_currencies ORDER BY company_id")
	require.NoError(t, err)
	type row struct{ CompanyID, CurrencyID int64 }
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[row])
	require.NoError(t, err)
	assert.Equal(t, []row{{olma, 1}, {nok, 1}}, got)
}

func TestCurrencyRatesKeepTheirRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)

	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, '998901111111') RETURNING id", c).Scan(&id))
	var uzs, eur string
	var status int16
	require.NoError(t, pool.QueryRow(ctx, "SELECT uzs::text, eur::text, status FROM currency_rates WHERE id = $1", id).Scan(&uzs, &eur, &status))
	assert.Equal(t, "1.0000", uzs, "the so'm is the base")
	assert.Equal(t, "0.0000", eur, "a currency not set is 0")
	assert.EqualValues(t, 1, status, "standard by default")

	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, uzs, set_by) VALUES ($1, 2, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "the so'm rate is always 1")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, -1, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "no negative rate")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, status, set_by) VALUES ($1, 3, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "a status is 1 or 2")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, set_by) VALUES ($1, '998909999999')", c)
	assert.Equal(t, "23503", sqlState(err), "set by a user")
}

func TestConvertAmount(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, usd, eur, set_by) VALUES ($1, 12800.5, 13900, '998901111111')", c)
	require.NoError(t, err)
	for name, tc := range map[string]struct {
		amount   string
		from, to int64
		want     *string
	}{
		"usd to uzs":                 {"100", 2, 1, ptr("1280050.00")},
		"uzs to usd":                 {"1280050", 1, 2, ptr("100.00")},
		"uzs to uzs":                 {"15.5", 1, 1, ptr("15.50")},
		"eur to usd":                 {"100", 3, 2, ptr("108.59")},
		"to a currency with no rate": {"100", 1, 4, nil},
	} {
		var got *string
		require.NoError(t, pool.QueryRow(ctx, "SELECT convert_amount($1::numeric, $2, $3, r)::text FROM currency_rates r WHERE r.company_id = $4", tc.amount, tc.from, tc.to, c).Scan(&got), name)
		assert.Equal(t, tc.want, got, name)
	}
}

func TestProductsAndUsersGetTheirCurrencyColumns(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	var currency int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', '998901111111') RETURNING currency_id", c).Scan(&currency))
	assert.EqualValues(t, 1, currency, "a price is in so'm unless said otherwise")
	_, err = pool.Exec(ctx, "INSERT INTO products (company_id, kind, name, unit, currency_id, created_by) VALUES ($1, 'product', 'Nok', 'kg', 9, '998901111111')", c)
	assert.Equal(t, "23503", sqlState(err), "a currency of the catalog")
	var timezone string
	require.NoError(t, pool.QueryRow(ctx, "SELECT timezone FROM users WHERE phone = '998901111111'").Scan(&timezone))
	assert.Equal(t, "Asia/Tashkent", timezone)
}

func ptr[T any](v T) *T { return &v }

func TestTheFinanceMigrationGivesEveryCompanyACashAccount(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 14)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	_, err = provider.UpTo(ctx, 15)
	require.NoError(t, err)

	rows, err := pool.Query(ctx, "SELECT company_id, name, currency_id, is_active FROM bank_accounts ORDER BY company_id")
	require.NoError(t, err)
	type row struct {
		CompanyID  int64
		Name       string
		CurrencyID int64
		Active     bool
	}
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[row])
	require.NoError(t, err)
	assert.Equal(t, []row{{olma, "Naqd", 1, true}, {nok, "Naqd", 1, true}}, got, "cash in so'm, active")
}

func TestBankAccountsKeepTheirRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 2) RETURNING id", c).Scan(&id))

	_, err := pool.Exec(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'karta', 1)", c)
	assert.Equal(t, "23505", sqlState(err), "a name is one account's in the company, whatever the case")
	_, err = pool.Exec(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Bank', 9)", c)
	assert.Equal(t, "23503", sqlState(err), "a currency of the catalog")
	_, err = pool.Exec(ctx, "UPDATE bank_accounts SET deleted_at = now() WHERE id = $1", id)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 1)", c)
	assert.NoError(t, err, "a deleted account's name is free again")
}

func TestFinanceCategoriesKeepTheirRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO finance_categories (company_id, name, kind, position) VALUES ($1, 'Ijara', 'expense', 1)", c)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "INSERT INTO finance_categories (company_id, name, kind, position) VALUES ($1, 'ijara', 'expense', 2)", c)
	assert.Equal(t, "23505", sqlState(err), "a name is one category's among the kind, whatever the case")
	_, err = pool.Exec(ctx, "INSERT INTO finance_categories (company_id, name, kind, position) VALUES ($1, 'Ijara', 'income', 1)", c)
	assert.NoError(t, err, "the other kind may have the name")
	_, err = pool.Exec(ctx, "INSERT INTO finance_categories (company_id, name, kind, position) VALUES ($1, 'Boshqa', 'transfer', 1)", c)
	assert.Equal(t, "23514", sqlState(err), "a kind is expense or income")
}

// The ledger migration carries the purchases, their lines, the stock and
// the payments into the journal and drops the old tables.
func TestTheLedgerMigrationMovesThePurchasesAndPaymentsIntoTheJournal(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 15)
	require.NoError(t, err)
	olma := addWarehouseFixture(t, pool, "Olma")
	var nok, cash int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Nok', 'dona', '998901111111') RETURNING id", olma.company).Scan(&nok))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", olma.company).Scan(&cash))
	purchase := func(f warehouseFixture, number int, day string, deleted bool) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, note, created_by, created_by_name, deleted_at)
			VALUES ($1, $2, $3, $4, $5, 'Izoh', '998901111111', 'Ali aka', CASE WHEN $6 THEN now() END) RETURNING id`, f.company, number, f.location, f.supplier, day, deleted).Scan(&id))
		return id
	}
	item := func(purchaseID, productID int64, quantity, price string, position int) {
		_, err := pool.Exec(ctx, "INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, $5)", purchaseID, productID, quantity, price, position)
		require.NoError(t, err)
	}
	payment := func(f warehouseFixture, purchaseID *int64, amount, day string, deleted bool) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, created_by, deleted_at)
			VALUES ($1, $2, $3, $4::numeric, $5, '998901111111', CASE WHEN $6 THEN now() END) RETURNING id`, f.company, f.supplier, purchaseID, amount, day, deleted).Scan(&id))
		return id
	}
	first := purchase(olma, 1, "2026-10-07", false)
	item(first, olma.product, "12.5", "1000", 1)
	item(first, nok, "3", "2500.5", 2)
	gone := purchase(olma, 2, "2026-10-08", true)
	item(gone, olma.product, "5", "900", 1)
	third := purchase(olma, 3, "2026-10-09", false)
	item(third, olma.product, "1", "950", 1)
	_, err = pool.Exec(ctx, "UPDATE purchases SET total = (SELECT sum(quantity * price) FROM purchase_items WHERE purchase_id = purchases.id)")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO stock (company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, 13.5), ($1, $2, $4, 3)", olma.company, olma.location, olma.product, nok)
	require.NoError(t, err)
	linked := payment(olma, &first, "5000", "2026-10-07", false)
	own := payment(olma, nil, "1000", "2026-10-05", false)
	hidden := payment(olma, nil, "7", "2026-10-06", true)
	// Nok has set its rates already: its purchase takes that standard row.
	theirs := addWarehouseFixture(t, pool, "Nok")
	var standard int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, '998901111111') RETURNING id", theirs.company).Scan(&standard))
	theirPurchase := purchase(theirs, 1, "2026-10-01", false)
	item(theirPurchase, theirs.product, "2", "100", 1)

	_, err = provider.UpTo(ctx, 16)
	require.NoError(t, err)

	type head struct {
		ID         int64
		Kind       string
		Number     int32
		DocAt      string
		Location   *int64
		Supplier   int64
		Account    *int64
		Linked     *int64
		Currency   int64
		Total      string
		Note       *string
		ByName     *string
		Deleted    bool
		RateStatus int16
		RateUSD    string
	}
	rows, err := pool.Query(ctx, `SELECT t.id, t.kind, t.number, to_char(t.doc_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'), t.location_id, t.supplier_id, t.bank_account_id, t.linked_id,
			t.currency_id, t.total::text, t.note, t.created_by_name, t.deleted_at IS NOT NULL, r.status, r.usd::text
		FROM transactions t JOIN currency_rates r ON r.id = t.currency_rate_id WHERE t.company_id = $1 ORDER BY t.kind DESC, t.number`, olma.company)
	require.NoError(t, err)
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[head])
	require.NoError(t, err)
	require.Len(t, got, 6)
	izoh, ali := "Izoh", "Ali aka"
	assert.Equal(t, head{first, "purchase", 1, "2026-10-06 19:00", &olma.location, olma.supplier, nil, nil, 1, "20001.50", &izoh, &ali, false, 2, "0.0000"}, got[3], "the purchase keeps its id, number, day (midnight in Tashkent), total, note and author; its rate row is the company's zero row")
	assert.Equal(t, head{gone, "purchase", 2, "2026-10-07 19:00", &olma.location, olma.supplier, nil, nil, 1, "4500.00", &izoh, &ali, true, 2, "0.0000"}, got[4], "a deleted purchase stays deleted")
	assert.Equal(t, third, got[5].ID)
	payments := got[:3]
	assert.Equal(t, []int32{1, 2, 3}, []int32{payments[0].Number, payments[1].Number, payments[2].Number}, "the payments are numbered by day, the hidden one too")
	assert.Equal(t, "2026-10-04 19:00", payments[0].DocAt)
	assert.Equal(t, "1000.00", payments[0].Total)
	assert.Equal(t, &cash, payments[0].Account, "paid out of the company's cash")
	assert.Nil(t, payments[0].Linked)
	assert.True(t, payments[1].Deleted, "the hidden payment stays hidden")
	assert.Equal(t, "7.00", payments[1].Total)
	assert.Equal(t, &first, payments[2].Linked, "the payment entered with the purchase is linked to it")
	assert.Equal(t, "5000.00", payments[2].Total)
	for _, p := range payments {
		assert.Greater(t, p.ID, third, "a payment takes a new id past the purchases'")
		assert.Equal(t, "supplier_payment", p.Kind)
	}
	_ = linked
	_ = own
	_ = hidden

	var zeroRows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM currency_rates WHERE company_id = $1", olma.company).Scan(&zeroRows))
	assert.Equal(t, 1, zeroRows, "one zero row for the company, hidden from the history (status 2)")
	var theirRate int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT currency_rate_id FROM transactions WHERE id = $1", theirPurchase).Scan(&theirRate))
	assert.Equal(t, standard, theirRate, "a company with rates uses its first standard row")

	type line struct {
		Transaction, Product int64
		Quantity, Price      string
		Position             int32
	}
	rows, err = pool.Query(ctx, "SELECT transaction_id, product_id, quantity::text, price::text, position FROM transaction_items WHERE transaction_id IN ($1, $2, $3) ORDER BY transaction_id, position", first, gone, third)
	require.NoError(t, err)
	lines, err := pgx.CollectRows(rows, pgx.RowToStructByPos[line])
	require.NoError(t, err)
	assert.Equal(t, []line{{first, olma.product, "12.500", "1000.00", 1}, {first, nok, "3.000", "2500.50", 2}, {gone, olma.product, "5.000", "900.00", 1}, {third, olma.product, "1.000", "950.00", 1}}, lines, "every line, the deleted purchase's too")

	type stock struct {
		Product  int64
		Quantity string
		Moves    int64
	}
	rows, err = pool.Query(ctx, "SELECT product_id, sum(quantity)::text, count(*) FROM stock_moves WHERE location_id = $1 GROUP BY product_id ORDER BY product_id", olma.location)
	require.NoError(t, err)
	stocks, err := pgx.CollectRows(rows, pgx.RowToStructByPos[stock])
	require.NoError(t, err)
	assert.Equal(t, []stock{{olma.product, "13.500", 2}, {nok, "3.000", 1}}, stocks, "the live purchases' lines are the moves; the stock is as it was")

	var next int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT nextval('transactions_id_seq')").Scan(&next))
	assert.Greater(t, next, payments[2].ID, "the sequence is past every id")
	for _, table := range []string{"supplier_payments", "stock", "purchase_items", "purchases"} {
		_, err = pool.Exec(ctx, "SELECT 1 FROM "+table)
		assert.Equal(t, "42P01", sqlState(err), table+" is gone")
	}
}

func TestTheLedgerMigrationDownBringsTheOldTablesBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 15)
	require.NoError(t, err)

	for _, table := range []string{"stock_moves", "transaction_items", "transactions"} {
		_, err = pool.Exec(ctx, "SELECT 1 FROM "+table)
		assert.Equal(t, "42P01", sqlState(err), table)
	}
	for _, table := range []string{"purchases", "purchase_items", "stock", "supplier_payments"} {
		var count int
		require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count), table+" is back")
		assert.Zero(t, count, table+" is empty")
	}
}

// A membership keeps the member's own pages of the tab bar in the company
// (logic/roles.md, section 8): NULL until they choose them.
func TestAMembershipKeepsTheMembersTabBar(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'owner')", olma)
	require.NoError(t, err)

	var pages []string
	require.NoError(t, pool.QueryRow(ctx, "SELECT tab_bar FROM user_companies WHERE user_phone = '998901111111'").Scan(&pages))
	assert.Nil(t, pages, "the default bar until the member chooses one")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET tab_bar = '{sales,home}' WHERE user_phone = '998901111111'")
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "SELECT tab_bar FROM user_companies WHERE user_phone = '998901111111'").Scan(&pages))
	assert.Equal(t, []string{"sales", "home"}, pages)
}

// The tab bar takes the place of the order of the menu: the sidebar keeps
// the default order, and the orders kept so far go.
func TestTheTabBarMigrationTakesTheMenuOrderAway(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 16)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, nav_order) VALUES ('998901111111', $1, 'owner', '{tasks,home}')", olma)
	require.NoError(t, err)

	_, err = provider.UpTo(ctx, 17)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT nav_order FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "undefined_column")
	var pages []string
	require.NoError(t, pool.QueryRow(ctx, "SELECT tab_bar FROM user_companies WHERE user_phone = '998901111111'").Scan(&pages))
	assert.Nil(t, pages, "the member starts from the default bar")
}

func TestTheTabBarMigrationDownBringsTheMenuOrderBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 16)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT tab_bar FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "undefined_column")
	_, err = pool.Exec(ctx, "SELECT nav_order FROM user_companies")
	assert.NoError(t, err, "the order of the menu is back")
}

// namedAfter is what the schema names with the word in it: its tables,
// indexes and sequences, its constraints and its columns (as table.column),
// sorted.
func namedAfter(t *testing.T, pool *pgxpool.Pool, word string) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `
		SELECT relname::text FROM pg_class
		WHERE relnamespace = 'public'::regnamespace AND relname LIKE '%' || $1 || '%'
		UNION ALL
		SELECT conname::text FROM pg_constraint
		WHERE connamespace = 'public'::regnamespace AND conname LIKE '%' || $1 || '%'
		UNION ALL
		SELECT (table_name || '.' || column_name)::text FROM information_schema.columns
		WHERE table_schema = 'public' AND column_name LIKE '%' || $1 || '%'`, word)
	require.NoError(t, err)
	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	slices.Sort(names)
	return names
}

// renamed is the names with one word put for another, sorted.
func renamed(names []string, from, to string) []string {
	out := make([]string, len(names))
	for i, name := range names {
		out[i] = strings.ReplaceAll(name, from, to)
	}
	slices.Sort(out)
	return out
}

// The tasks are the orders now («Buyurtmalar», logic/orders.md): their
// tables, columns, indexes, constraints and sequences take the orders'
// names, and what they held stays.
func TestTheOrdersMigrationRenamesTheTasksTables(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 17)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addTaskSettings(t, pool, olma)
	var field, task int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO task_fields (company_id, type_id, label, kind, position)
		VALUES ($1, $2, 'Izoh', 'string', 1) RETURNING id`, olma, typ).Scan(&field))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, 'Qo''ng''iroq', '2026-10-10', '998901111111') RETURNING id`,
		olma, typ, stage, ali, addLocation(t, pool, olma, "Asosiy")).Scan(&task))
	_, err = pool.Exec(ctx, "INSERT INTO task_values (task_id, field_id, text_value) VALUES ($1, $2, 'Ertalab')", task, field)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO task_history (task_id, action, actor_phone) VALUES ($1, 'created', '998901111111')", task)
	require.NoError(t, err)
	before := namedAfter(t, pool, "task")

	_, err = provider.UpTo(ctx, 18)
	require.NoError(t, err)

	assert.Empty(t, namedAfter(t, pool, "task"), "nothing is named after the tasks")
	assert.Equal(t, renamed(before, "task", "order"), namedAfter(t, pool, "order"), "each name of the tasks is the orders' now")
	var title, answer, action string
	require.NoError(t, pool.QueryRow(ctx, "SELECT title FROM orders WHERE id = $1 AND type_id = $2 AND stage_id = $3", task, typ, stage).Scan(&title))
	assert.Equal(t, "Qo'ng'iroq", title, "the task is an order of its type and stage")
	require.NoError(t, pool.QueryRow(ctx, "SELECT text_value FROM order_values WHERE order_id = $1 AND field_id = $2", task, field).Scan(&answer))
	assert.Equal(t, "Ertalab", answer, "its answers are the order's")
	require.NoError(t, pool.QueryRow(ctx, "SELECT action FROM order_history WHERE order_id = $1", task).Scan(&action))
	assert.Equal(t, "created", action, "so is its history")
	var next int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		SELECT company_id, type_id, stage_id, customer_id, location_id, 'Yetkazish', deadline, created_by FROM orders WHERE id = $1
		RETURNING id`, task).Scan(&next))
	assert.Greater(t, next, task, "a new order's number follows the tasks'")
}

func TestTheOrdersMigrationDownBringsTheTasksTablesBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	// The names as they are at 18: the later migrations name things after
	// the orders too (00021's order documents).
	_, err := provider.DownTo(ctx, 18)
	require.NoError(t, err)
	before := namedAfter(t, pool, "order")

	_, err = provider.DownTo(ctx, 17)
	require.NoError(t, err)

	assert.Empty(t, namedAfter(t, pool, "order"), "nothing is named after the orders")
	assert.Equal(t, renamed(before, "order", "task"), namedAfter(t, pool, "task"), "each name is the tasks' again")
}

// permissionsOf is the role's permissions as they are kept, in their order.
func permissionsOf(t *testing.T, pool *pgxpool.Pool, roleID int64) []string {
	t.Helper()
	var permissions []string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT permissions FROM roles WHERE id = $1", roleID).Scan(&permissions))
	return permissions
}

// The permissions on the orders are named after them (orders.view and the
// rest, internal/access): a role made before allows what it allowed.
func TestTheOrderKeysMigrationRenamesTheRolesPermissions(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 18)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	var sotuvchi, kassir int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO roles (company_id, name, permissions)
		VALUES ($1, 'Sotuvchi', '{customers.view,tasks.view,tasks.create,tasks.edit,tasks.delete,tasks.history}') RETURNING id`, olma).Scan(&sotuvchi))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'Kassir', '{finance.view}') RETURNING id", olma).Scan(&kassir))

	_, err = provider.UpTo(ctx, 19)
	require.NoError(t, err)

	assert.Equal(t, []string{"customers.view", "orders.view", "orders.create", "orders.edit", "orders.delete", "orders.history"},
		permissionsOf(t, pool, sotuvchi), "each in its place")
	assert.Equal(t, []string{"finance.view"}, permissionsOf(t, pool, kassir), "a role that allows nothing of the orders stays as it was")
}

func TestTheOrderKeysMigrationDownBringsTheTasksPermissionsBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.UpTo(ctx, 19)
	require.NoError(t, err)
	var sotuvchi int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO roles (company_id, name, permissions)
		VALUES ($1, 'Sotuvchi', '{customers.view,orders.view,orders.history}') RETURNING id`, addCompany(t, pool, "Olma")).Scan(&sotuvchi))

	_, err = provider.DownTo(ctx, 18)
	require.NoError(t, err)

	assert.Equal(t, []string{"customers.view", "tasks.view", "tasks.history"}, permissionsOf(t, pool, sotuvchi))
}

// tabBarsOf is each member's tab bar in the company, by phone; nil is the
// default bar.
func tabBarsOf(t *testing.T, pool *pgxpool.Pool, companyID int64) map[string][]string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT user_phone, tab_bar FROM user_companies WHERE company_id = $1", companyID)
	require.NoError(t, err)
	bars := map[string][]string{}
	var phone string
	var pages []string
	_, err = pgx.ForEachRow(rows, []any{&phone, &pages}, func() error {
		bars[phone] = pages
		return nil
	})
	require.NoError(t, err)
	return bars
}

// So is the orders' page in a member's tab bar: a bar chosen before keeps
// its pages in their order.
func TestTheOrderKeysMigrationRenamesTheTabBarsPage(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 18)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222'), ('998903333333')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role, tab_bar) VALUES
		('998901111111', $1, 'owner', '{home,tasks,sales}'), ('998902222222', $1, 'user', '{customers}'), ('998903333333', $1, 'user', NULL)`, olma)
	require.NoError(t, err)

	_, err = provider.UpTo(ctx, 19)
	require.NoError(t, err)

	assert.Equal(t, map[string][]string{
		"998901111111": {"home", "orders", "sales"},
		"998902222222": {"customers"},
		"998903333333": nil,
	}, tabBarsOf(t, pool, olma), "a bar without the orders and the default one stay as they were")
}

func TestTheOrderKeysMigrationDownBringsTheTasksPageBack(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.UpTo(ctx, 19)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, tab_bar) VALUES ('998901111111', $1, 'owner', '{orders,home}')", olma)
	require.NoError(t, err)

	_, err = provider.DownTo(ctx, 18)
	require.NoError(t, err)

	assert.Equal(t, map[string][]string{"998901111111": {"tasks", "home"}}, tabBarsOf(t, pool, olma))
}

// orderTypesOf is the company's order types in their order, a deleted one
// marked so.
func orderTypesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT name || CASE WHEN deleted_at IS NOT NULL THEN ' (deleted)' ELSE '' END
		FROM order_types WHERE company_id = $1 ORDER BY position, id`, companyID)
	require.NoError(t, err)
	types, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return types
}

// The ready type every company got is «Buyurtma», as the section is: a live
// «Vazifa» takes the name unless the company has a «Buyurtma» already, in
// any case; a deleted one stays as it was.
func TestTheOrderTypeMigrationRenamesTheReadyType(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 19)
	require.NoError(t, err)
	olma, nok, anor := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok"), addCompany(t, pool, "Anor")
	addType := func(companyID int64, name string, position int, deleted bool) {
		_, err := pool.Exec(ctx, `INSERT INTO order_types (company_id, name, position, deleted_at)
			VALUES ($1, $2, $3, CASE WHEN $4::bool THEN now() END)`, companyID, name, position, deleted)
		require.NoError(t, err)
	}
	addType(olma, "Vazifa", 1, false)
	addType(olma, "Shikoyat", 2, false)
	addType(nok, "Vazifa", 1, false)
	addType(nok, "BUYURTMA", 2, false)
	addType(anor, "Vazifa", 1, true)
	addType(anor, "Vazifa", 2, false)

	_, err = provider.UpTo(ctx, 20)
	require.NoError(t, err)

	assert.Equal(t, []string{"Buyurtma", "Shikoyat"}, orderTypesOf(t, pool, olma))
	assert.Equal(t, []string{"Vazifa", "BUYURTMA"}, orderTypesOf(t, pool, nok), "the name is the company's other type's")
	assert.Equal(t, []string{"Vazifa (deleted)", "Buyurtma"}, orderTypesOf(t, pool, anor))
}

// Which «Buyurtma» was a «Vazifa» is not kept, so nothing goes back.
func TestTheOrderTypeMigrationDownKeepsTheNames(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.UpTo(ctx, 20)
	require.NoError(t, err)
	olma := addCompany(t, pool, "Olma")
	_, err = pool.Exec(ctx, "INSERT INTO order_types (company_id, name, position) VALUES ($1, 'Buyurtma', 1)", olma)
	require.NoError(t, err)

	_, err = provider.DownTo(ctx, 19)
	require.NoError(t, err)

	assert.Equal(t, []string{"Buyurtma"}, orderTypesOf(t, pool, olma))
}

// addOrder inserts an order of the company for the customer in the location
// and returns its id.
// addOrder enters an order as the orders are now (00022): numbered in
// its company, with no name.
func addOrder(t *testing.T, pool *pgxpool.Pool, companyID, typeID, stageID, customerID, locationID int64) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), '2026-10-20', '998901111111') RETURNING id`, companyID, typeID, stageID, customerID, locationID).Scan(&id))
	return id
}

// orderOf sets a company up for an order document: a customer, the order
// settings and an order in the ledger fixture's location.
func orderOf(t *testing.T, pool *pgxpool.Pool, f ledgerFixture, phone string) (customer, order int64) {
	t.Helper()
	customer = addCustomer(t, pool, f.company, addCustomerType(t, pool, f.company, "Jismoniy"), phone)
	stage, typ := addOrderSettings(t, pool, f.company)
	return customer, addOrder(t, pool, f.company, typ, stage, customer, f.location)
}

// An order's money and goods are a document of the journal (logic/orders.md,
// 4.3): of the kind order, naming its order (one live document per order),
// its customer and its location.
func TestTheOrderDocumentsMigrationAddsTheOrderKind(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addLedgerFixture(t, pool, "Olma")
	nok := addLedgerFixture(t, pool, "Nok")
	customer, order := orderOf(t, pool, olma, "998901234567")
	orderDoc := func(number int, orderID, customerID, locationID *int64) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, order_id, customer_id, location_id, currency_rate_id, total, created_by)
			VALUES ($1, 'order', $2, '2026-10-07 09:00+05', $3, $4, $5, $6, 5000, '998901111111') RETURNING id`,
			olma.company, number, orderID, customerID, locationID, olma.rate).Scan(&id)
		return id, err
	}

	first, err := orderDoc(1, &order, &customer, &olma.location)
	require.NoError(t, err, "an order document names its order, its customer and its location")
	_, err = orderDoc(2, nil, &customer, &olma.location)
	assert.Equal(t, "23514", sqlState(err), "its order")
	_, err = orderDoc(2, &order, nil, &olma.location)
	assert.Equal(t, "23514", sqlState(err), "its customer")
	_, err = orderDoc(2, &order, &customer, nil)
	assert.Equal(t, "23514", sqlState(err), "its location")
	_, err = orderDoc(2, &order, &customer, &olma.location)
	assert.Equal(t, "23505", sqlState(err), "one live document per order")
	_, err = pool.Exec(ctx, "UPDATE transactions SET deleted_at = now() WHERE id = $1", first)
	require.NoError(t, err)
	_, err = orderDoc(2, &order, &customer, &olma.location)
	require.NoError(t, err, "a hidden one makes way for another")
	_, nokOrder := orderOf(t, pool, nok, "998907654321")
	_, err = orderDoc(3, &nokOrder, &customer, &olma.location)
	assert.Equal(t, "23503", sqlState(err), "the order is the company's")
	_, err = addDocument(t, pool, olma, document{kind: "purchase", number: 1, location: &olma.location, supplier: &olma.supplier})
	require.NoError(t, err, "the other kinds keep their rules")
	_, err = addDocument(t, pool, olma, document{kind: "purchase", number: 2, location: &olma.location})
	assert.Equal(t, "23514", sqlState(err), "a purchase still names its supplier")
}

func TestTheOrderDocumentsMigrationDownRemovesTheOrderDocuments(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	olma := addLedgerFixture(t, pool, "Olma")
	customer, order := orderOf(t, pool, olma, "998901234567")
	var doc, purchase int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, order_id, customer_id, location_id, currency_rate_id, total, created_by)
		VALUES ($1, 'order', 1, '2026-10-07 09:00+05', $2, $3, $4, $5, 5000, '998901111111') RETURNING id`, olma.company, order, customer, olma.location, olma.rate).Scan(&doc))
	purchase, err := addDocument(t, pool, olma, document{kind: "purchase", number: 1, location: &olma.location, supplier: &olma.supplier})
	require.NoError(t, err)
	for _, id := range []int64{doc, purchase} {
		_, err = pool.Exec(ctx, "INSERT INTO transaction_items (transaction_id, product_id, quantity, position) VALUES ($1, $2, 1, 1)", id, olma.product)
		require.NoError(t, err)
		_, err = pool.Exec(ctx, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, 1)", id, olma.company, olma.location, olma.product)
		require.NoError(t, err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, customer_id, bank_account_id, linked_id, currency_rate_id, total, created_by)
		VALUES ($1, 'customer_payment', 1, '2026-10-07 09:00+05', $2, $3, $4, $5, 400, '998901111111')`, olma.company, customer, olma.cash, doc, olma.rate)
	require.NoError(t, err)

	_, err = provider.DownTo(ctx, 20)
	require.NoError(t, err)

	var has bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'order_id')").Scan(&has))
	assert.False(t, has, "the column is gone")
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_company_id_id_key')").Scan(&has))
	assert.False(t, has, "so is the orders' key")
	var documents, items, moves int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions").Scan(&documents))
	assert.Equal(t, 1, documents, "the order document and the payment linked to it are gone, the purchase stays")
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transaction_items").Scan(&items))
	assert.Equal(t, 1, items, "its lines went with it")
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM stock_moves").Scan(&moves))
	assert.Equal(t, 1, moves, "its moves too")
	_, err = pool.Exec(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, customer_id, location_id, currency_rate_id, total, created_by)
		VALUES ($1, 'order', 9, '2026-10-07 09:00+05', $2, $3, $4, 1, '998901111111')`, olma.company, customer, olma.location, olma.rate)
	assert.Equal(t, "23514", sqlState(err), "the kind is refused again")
}

// An order is numbered in its company, not named (logic/orders.md, 3.3):
// the migration numbers the orders there are in the order they were
// entered, the deleted among them, and drops their names.
func TestTheOrderNumbersMigrationNumbersTheOrders(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 21)
	require.NoError(t, err)
	olma := addLedgerFixture(t, pool, "Olma")
	nok := addLedgerFixture(t, pool, "Nok")
	// named enters an order as the orders were before: with a title.
	named := func(f ledgerFixture, customer int64, title string) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
			SELECT $1, (SELECT id FROM order_types WHERE company_id = $1), (SELECT id FROM order_stages WHERE company_id = $1), $2, $3, $4, '2026-10-20', '998901111111' RETURNING id`,
			f.company, customer, f.location, title).Scan(&id))
		return id
	}
	karim := addCustomer(t, pool, olma.company, addCustomerType(t, pool, olma.company, "Jismoniy"), "998901234567")
	addOrderSettings(t, pool, olma.company)
	first := named(olma, karim, "Montaj")
	second := named(olma, karim, "Ta'mir")
	_, err = pool.Exec(ctx, "UPDATE orders SET deleted_at = now() WHERE id = $1", second)
	require.NoError(t, err)
	third := named(olma, karim, "Yetkazish")
	vali := addCustomer(t, pool, nok.company, addCustomerType(t, pool, nok.company, "Jismoniy"), "998907654321")
	addOrderSettings(t, pool, nok.company)
	other := named(nok, vali, "Nok buyurtmasi")

	_, err = provider.Up(ctx)
	require.NoError(t, err)

	var has bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'number')").Scan(&has))
	require.True(t, has, "the orders are numbered")
	numbers := map[int64]int{}
	rows, err := pool.Query(ctx, "SELECT id, number FROM orders")
	require.NoError(t, err)
	for rows.Next() {
		var id int64
		var n int
		require.NoError(t, rows.Scan(&id, &n))
		numbers[id] = n
	}
	rows.Close()
	assert.Equal(t, map[int64]int{first: 1, second: 2, third: 3, other: 1}, numbers, "numbered in the order entered, in each company, the deleted counted")
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'title')").Scan(&has))
	assert.False(t, has, "the names are gone")
	_, err = pool.Exec(ctx, "INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by) SELECT company_id, type_id, stage_id, customer_id, location_id, 1, deadline, created_by FROM orders WHERE id = $1", first)
	assert.Equal(t, "23505", sqlState(err), "a number is given once in a company")

	_, err = provider.DownTo(ctx, 21)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'title')").Scan(&has))
	assert.True(t, has, "down brings the name column back")
	require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'number')").Scan(&has))
	assert.False(t, has, "and takes the numbers away")
}
