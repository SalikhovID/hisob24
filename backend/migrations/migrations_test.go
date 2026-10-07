package migrations_test

import (
	"errors"
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

func TestTaskStages(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addStage := func(companyID int64, name, color string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO task_stages (company_id, name, color, position) VALUES ($1, $2, $3, 1) RETURNING id", companyID, name, color).Scan(&id)
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
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_done FROM task_stages WHERE id = $1", yangi).Scan(&done))
	assert.False(t, done, "a stage holds unfinished tasks unless said otherwise")

	_, err = pool.Exec(ctx, "UPDATE task_stages SET deleted_at = now() WHERE id = $1", yangi)
	require.NoError(t, err)
	_, err = addStage(olma, "Yangi", "blue")
	assert.NoError(t, err, "a deleted stage's name is free again")
}

func TestTaskTypesAndFields(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	addType := func(companyID int64, name string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx,
			"INSERT INTO task_types (company_id, name, position) VALUES ($1, $2, 1) RETURNING id", companyID, name).Scan(&id)
		return id, err
	}
	vazifa, err := addType(olma, "Vazifa")
	require.NoError(t, err)
	_, err = addType(olma, "VAZIFA")
	assert.Equal(t, "23505", sqlState(err), "the type's name is taken in the company, in any case")
	begona, err := addType(nok, "Vazifa")
	require.NoError(t, err, "another company's type")

	var manba, nokManba int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", nok).Scan(&nokManba))

	// addField adds a field of Olma's to a task type.
	addField := func(typeID int64, label, kind string, dropdownID *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, 1)`, olma, typeID, label, kind, dropdownID)
		return err
	}
	require.NoError(t, addField(vazifa, "Izoh", "string", nil))
	var required bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT required FROM task_fields WHERE type_id = $1", vazifa).Scan(&required))
	assert.False(t, required, "a field may stay empty unless said otherwise")
	assert.Equal(t, "23505", sqlState(addField(vazifa, "izoh", "string", nil)), "the field's name is taken in the type")
	for _, kind := range []string{"int", "dropdown", "multi_dropdown", "radio", "checkbox"} {
		var dropdown *int64
		if kind != "int" {
			dropdown = &manba
		}
		assert.NoError(t, addField(vazifa, "Maydon "+kind, kind, dropdown), kind)
	}
	assert.Equal(t, "23514", sqlState(addField(vazifa, "Sana", "date", nil)), "a kind that is not one of the six") // check_violation
	assert.Equal(t, "23514", sqlState(addField(vazifa, "Tanlov", "dropdown", nil)), "a choice field without a dropdown")
	assert.Equal(t, "23514", sqlState(addField(vazifa, "Matn", "string", &manba)), "a text field with a dropdown")
	assert.Equal(t, "23503", sqlState(addField(vazifa, "Tanlov", "dropdown", &nokManba)), "another company's dropdown") // foreign_key_violation
	assert.Equal(t, "23503", sqlState(addField(begona, "Izoh", "string", nil)), "another company's type")
	_, err = pool.Exec(ctx, "SELECT is_unique FROM task_fields")
	assert.Equal(t, "42703", sqlState(err), "a task field is never told not to repeat") // undefined_column

	_, err = pool.Exec(ctx, "UPDATE task_fields SET deleted_at = now() WHERE type_id = $1 AND label = 'Izoh'", vazifa)
	require.NoError(t, err)
	assert.NoError(t, addField(vazifa, "Izoh", "string", nil), "a deleted field's name is free again")
	_, err = pool.Exec(ctx, "UPDATE task_types SET deleted_at = now() WHERE id = $1", vazifa)
	require.NoError(t, err)
	_, err = addType(olma, "Vazifa")
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

// addTaskSettings inserts a stage and a task type of the company and returns
// their ids.
func addTaskSettings(t *testing.T, pool *pgxpool.Pool, companyID int64) (stage, typ int64) {
	t.Helper()
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO task_stages (company_id, name, color, position) VALUES ($1, 'Yangi', 'blue', 1) RETURNING id", companyID).Scan(&stage))
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO task_types (company_id, name, position) VALUES ($1, 'Vazifa', 1) RETURNING id", companyID).Scan(&typ))
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

func TestTasks(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111'), ('998902222222')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	begona := addCustomer(t, pool, nok, addCustomerType(t, pool, nok, "Jismoniy"), "998901234567")
	stage, typ := addTaskSettings(t, pool, olma)
	nokStage, nokType := addTaskSettings(t, pool, nok)
	asosiy := addLocation(t, pool, olma, "Asosiy")
	// addTask adds a task the user 998901111111 enters, in Olma's location.
	addTask := func(typeID, stageID, customerID int64, deadline *string, assignee *string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, assignee_phone, created_by)
			VALUES ($1, $2, $3, $4, $7, 'Qo''ng''iroq qilish', $5::date, $6, '998901111111') RETURNING id`,
			olma, typeID, stageID, customerID, deadline, assignee, asosiy).Scan(&id)
		return id, err
	}
	day, staff, stranger := "2026-10-10", "998902222222", "998909999999"

	first, err := addTask(typ, stage, ali, &day, nil)
	require.NoError(t, err)
	_, err = addTask(typ, stage, ali, &day, &staff)
	assert.NoError(t, err, "assigned to a user")
	_, err = addTask(typ, stage, ali, nil, nil)
	assert.Equal(t, "23502", sqlState(err), "a task has a deadline") // not_null_violation
	_, err = addTask(nokType, stage, ali, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's type") // foreign_key_violation
	_, err = addTask(typ, nokStage, ali, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's stage")
	_, err = addTask(typ, stage, begona, &day, nil)
	assert.Equal(t, "23503", sqlState(err), "another company's customer")
	_, err = addTask(typ, stage, ali, &day, &stranger)
	assert.Equal(t, "23503", sqlState(err), "assigned to someone who is no user")
	_, err = pool.Exec(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, 'X', '2026-10-10', '998909999999')`, olma, typ, stage, ali, asosiy)
	assert.Equal(t, "23503", sqlState(err), "entered by someone who is no user")

	_, err = pool.Exec(ctx, "UPDATE tasks SET deleted_at = now() WHERE id = $1", first)
	require.NoError(t, err, "a task is hidden, never removed")
	_, err = pool.Exec(ctx, "UPDATE users SET phone = '998903333333' WHERE phone = '998902222222'")
	require.NoError(t, err, "an assignee gets another number")
	var assigned string
	require.NoError(t, pool.QueryRow(ctx, "SELECT assignee_phone FROM tasks WHERE assignee_phone IS NOT NULL").Scan(&assigned))
	assert.Equal(t, "998903333333", assigned, "the task stays theirs")
}

func TestTaskValues(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addTaskSettings(t, pool, olma)
	var manba, instagram, linkedin, task int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma).Scan(&manba))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'Instagram', 1) RETURNING id", manba).Scan(&instagram))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'LinkedIn', 2) RETURNING id", manba).Scan(&linkedin))
	addField := func(label, kind string, dropdownID *int64) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`, olma, typ, label, kind, dropdownID).Scan(&id))
		return id
	}
	izoh, summa, manzil, kanal := addField("Izoh", "string", nil), addField("Summa", "int", nil),
		addField("Manzil", "string", nil), addField("Kanal", "checkbox", &manba)
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, 'Qo''ng''iroq', '2026-10-10', '998901111111') RETURNING id`,
		olma, typ, stage, ali, addLocation(t, pool, olma, "Asosiy")).Scan(&task))
	// answer writes one row of the task's answers.
	answer := func(fieldID int64, optionID *int64, text *string, number *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO task_values (task_id, field_id, option_id, text_value, int_value)
			VALUES ($1, $2, $3, $4, $5)`, task, fieldID, optionID, text, number)
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
	_, err = pool.Exec(ctx, "INSERT INTO task_values (task_id, field_id, text_value) VALUES ($1, $2, 'X')", missing, manzil)
	assert.Equal(t, "23503", sqlState(err), "a task that is not there")
}

func TestTaskHistory(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	ali := addCustomer(t, pool, olma, addCustomerType(t, pool, olma, "Jismoniy"), "998901234567")
	stage, typ := addTaskSettings(t, pool, olma)
	var task int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, 'Qo''ng''iroq', '2026-10-10', '998901111111') RETURNING id`,
		olma, typ, stage, ali, addLocation(t, pool, olma, "Asosiy")).Scan(&task))
	// record writes down what the user did to the task.
	record := func(taskID int64, action, actor string) error {
		_, err := pool.Exec(ctx, "INSERT INTO task_history (task_id, action, actor_phone) VALUES ($1, $2, $3)", taskID, action, actor)
		return err
	}

	for _, action := range []string{"created", "updated", "deleted"} {
		assert.NoError(t, record(task, action, "998901111111"), action)
	}
	assert.Equal(t, "23514", sqlState(record(task, "moved", "998901111111")), "an action that is not one of the three") // check_violation
	assert.Equal(t, "23503", sqlState(record(task, "updated", "998909999999")), "done by someone who is no user")       // foreign_key_violation
	assert.Equal(t, "23503", sqlState(record(1<<40, "updated", "998901111111")), "a task that is not there")
	var changes string
	require.NoError(t, pool.QueryRow(ctx, "SELECT changes::text FROM task_history LIMIT 1").Scan(&changes))
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
	stage, typ := addTaskSettings(t, pool, olma)
	asosiy := addLocation(t, pool, olma, "Asosiy")

	_, err = pool.Exec(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'asosiy')", olma)
	assert.Equal(t, "23505", sqlState(err), "a name is one location's in a company, whatever the case") // unique_violation
	noksAsosiy := addLocation(t, pool, nok, "Asosiy")
	var created time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT created_at FROM locations WHERE id = $1", noksAsosiy).Scan(&created))
	assert.False(t, created.IsZero(), "another company may use the name")

	// addTask adds a task of Olma's in the location, entered by the user.
	addTask := func(locationID *int64) error {
		_, err := pool.Exec(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
			VALUES ($1, $2, $3, $4, $5, 'Qo''ng''iroq', '2026-10-10', '998901111111')`, olma, typ, stage, ali, locationID)
		return err
	}
	assert.NoError(t, addTask(&asosiy), "a task stands in a location of its company")
	assert.Equal(t, "23502", sqlState(addTask(nil)), "a task stands in a location")               // not_null_violation
	assert.Equal(t, "23503", sqlState(addTask(&noksAsosiy)), "not in another company's location") // foreign_key_violation

	_, err = pool.Exec(ctx, "UPDATE locations SET deleted_at = now() WHERE id = $1", asosiy)
	require.NoError(t, err, "a location is hidden, never removed")
	_, err = pool.Exec(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy')", olma)
	assert.NoError(t, err, "a deleted location's name is free again")
	assert.NoError(t, addTask(&asosiy), "the tasks of a deleted location keep standing in it")
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
// (logic/roles.md, section 8): NULL until they set one.
func TestAMembershipKeepsTheMembersOrderOfTheMenu(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
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
