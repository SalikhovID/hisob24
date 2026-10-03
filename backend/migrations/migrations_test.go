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
