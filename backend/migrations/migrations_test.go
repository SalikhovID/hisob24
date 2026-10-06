package migrations_test

import (
	"errors"
	"testing"

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
