package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestUpsertUser(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	require.NoError(t, q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "998901234567", FullName: ptr("Ali Valiyev")}))
	require.NoError(t, q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "998901234567", FullName: ptr("Boshqa Ism")}))

	var name string
	require.NoError(t, pool.QueryRow(ctx, "SELECT full_name FROM users WHERE phone = '998901234567'").Scan(&name))
	assert.Equal(t, "Ali Valiyev", name, "an existing user keeps its name")

	err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "+998901234567"})
	assert.Equal(t, "23514", sqlState(err), "the phone is digits only") // check_violation
}

func TestGetUser(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")

	u, err := q.GetUser(ctx, "998901234567")
	require.NoError(t, err)
	assert.Equal(t, "Ali", *u.FullName)

	_, err = q.GetUser(ctx, "998900000000")
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func createUser(t *testing.T, q *gen.Queries, phone, name string) {
	t.Helper()
	require.NoError(t, q.UpsertUser(context.Background(), gen.UpsertUserParams{Phone: phone, FullName: ptr(name)}))
}

func TestUserExists(t *testing.T) {
	q, _ := setup(t)
	createUser(t, q, "998901234567", "Ali")

	exists, err := q.UserExists(t.Context(), "998901234567")
	require.NoError(t, err)
	assert.True(t, exists)

	exists, err = q.UserExists(t.Context(), "998900000000")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestHasCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, c.ID, "998901234567", "Ali", "user")
	createUser(t, q, "998909999999", "Vali")

	has, err := q.HasCompany(ctx, "998901234567")
	require.NoError(t, err)
	assert.True(t, has, "a member of a company")

	has, err = q.HasCompany(ctx, "998909999999")
	require.NoError(t, err)
	assert.False(t, has, "a user of no company")

	has, err = q.HasCompany(ctx, "998900000000")
	require.NoError(t, err)
	assert.False(t, has, "a stranger")
}

func TestAddCompanyUser(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, "998901234567", "Ali Valiyev")

	m, err := q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "user", FullName: ptr("Ali (hisobchi)")})
	require.NoError(t, err)
	assert.Equal(t, "user", m.Role)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Ali (hisobchi)", *m.FullName, "the name in this company, not the user's own")

	_, err = q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "owner", FullName: ptr("Boshqa Ism")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a member already")
	var role, name string
	require.NoError(t, pool.QueryRow(ctx, "SELECT role, full_name FROM user_companies WHERE company_id = $1", c.ID).Scan(&role, &name))
	assert.Equal(t, "user", role, "the membership stays as it was")
	assert.Equal(t, "Ali (hisobchi)", name)

	createUser(t, q, "998909999999", "Vali")
	_, err = q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: "998909999999", CompanyID: c.ID, Role: "boss", FullName: ptr("Vali")})
	assert.Equal(t, "23514", sqlState(err), "role is owner or user") // check_violation
}

func TestSetCompanyOwner(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma := createCompany(t, q, "Olma", d)
	createUser(t, q, "998901111111", "Ali")

	m, err := q.SetCompanyOwner(ctx, gen.SetCompanyOwnerParams{UserPhone: "998901111111", CompanyID: olma.ID, FullName: ptr("Ali Egasi")})
	require.NoError(t, err)
	assert.Equal(t, "owner", m.Role, "someone who was no member")
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Ali Egasi", *m.FullName)

	nok := createCompany(t, q, "Nok", d)
	addMember(t, q, nok.ID, "998902222222", "Vali", "user")
	var joined time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT created_at FROM user_companies WHERE company_id = $1", nok.ID).Scan(&joined))
	m, err = q.SetCompanyOwner(ctx, gen.SetCompanyOwnerParams{UserPhone: "998902222222", CompanyID: nok.ID, FullName: ptr("Vali Egasi")})
	require.NoError(t, err)
	assert.Equal(t, "owner", m.Role, "a member is promoted")
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Vali Egasi", *m.FullName, "and renamed")
	assert.True(t, m.CreatedAt.Equal(joined), "the membership is the same one")
	var members int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM user_companies WHERE company_id = $1", nok.ID).Scan(&members))
	assert.Equal(t, 1, members)

	_, err = q.SetCompanyOwner(ctx, gen.SetCompanyOwnerParams{UserPhone: "998901111111", CompanyID: nok.ID, FullName: ptr("Ali")})
	assert.Equal(t, "23505", sqlState(err), "the owner before has to step down first") // unique_violation
}

func TestDemoteCompanyOwner(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma := createCompany(t, q, "Olma", d)
	nok := createCompany(t, q, "Nok", d)
	addMember(t, q, olma.ID, "998901111111", "Ali", "owner")
	addMember(t, q, nok.ID, "998902222222", "Vali", "owner")

	require.NoError(t, q.DemoteCompanyOwner(ctx, olma.ID))

	roleIn := func(companyID int64) string {
		var role string
		require.NoError(t, pool.QueryRow(ctx, "SELECT role FROM user_companies WHERE company_id = $1", companyID).Scan(&role))
		return role
	}
	assert.Equal(t, "user", roleIn(olma.ID), "the owner stays in the company as a user")
	assert.Equal(t, "owner", roleIn(nok.ID), "another company's owner is left alone")
	assert.NoError(t, q.DemoteCompanyOwner(ctx, olma.ID), "a company without an owner is fine")
}

func TestListCompanyUsers(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	other := createCompany(t, q, "Nok", d)
	// The owner was set last, after both employees had joined.
	addMember(t, q, c.ID, "998902222222", "Xodim", "user")
	addMember(t, q, c.ID, "998903333333", "Ikkinchi Xodim", "user")
	addMember(t, q, c.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, other.ID, "998909999999", "Begona", "owner")
	mustExec(t, pool, "UPDATE user_companies SET created_at = now() - interval '2 days' WHERE user_phone = '998903333333'")
	mustExec(t, pool, "UPDATE user_companies SET full_name = 'Xodim (hisobchi)' WHERE user_phone = '998902222222'")

	users, err := q.ListCompanyUsers(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, users, 3)
	assert.Equal(t, "998901111111", users[0].Phone, "the owner first, though set last")
	assert.Equal(t, "owner", users[0].Role)
	assert.Equal(t, "998903333333", users[1].Phone, "then by when they joined")
	assert.Equal(t, "998902222222", users[2].Phone)
	assert.Equal(t, "user", users[2].Role)
	require.NotNil(t, users[2].FullName)
	assert.Equal(t, "Xodim (hisobchi)", *users[2].FullName, "the name in the company, not the user's own")
}

func addMember(t *testing.T, q *gen.Queries, companyID int64, phone, name, role string) {
	t.Helper()
	createUser(t, q, phone, name)
	_, err := q.AddCompanyUser(context.Background(), gen.AddCompanyUserParams{UserPhone: phone, CompanyID: companyID, Role: role, FullName: ptr(name)})
	require.NoError(t, err)
}

func TestListUserCompanies(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	olma := createCompany(t, q, "Olma", d)
	behi := createCompany(t, q, "Behi", d.AddDate(0, 0, -1))
	nok := createCompany(t, q, "Nok", d)
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	addMember(t, q, behi.ID, "998901234567", "Ali", "user")
	addMember(t, q, nok.ID, "998909999999", "Vali", "owner")
	mustExec(t, pool, "UPDATE user_companies SET full_name = 'Ali (hisobchi)' WHERE company_id = $1", behi.ID)

	got, err := q.ListUserCompanies(t.Context(), "998901234567")

	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "Behi", got[0].Name, "ordered by name")
	assert.Equal(t, "user", got[0].Role)
	assert.True(t, got[0].EndDate.Equal(d.AddDate(0, 0, -1)))
	require.NotNil(t, got[0].FullName)
	assert.Equal(t, "Ali (hisobchi)", *got[0].FullName, "the name the user goes by in that company")
	assert.Equal(t, "Olma", got[1].Name)
	assert.Equal(t, "owner", got[1].Role)
	assert.True(t, got[1].IsActive)
	require.NotNil(t, got[1].FullName)
	assert.Equal(t, "Ali", *got[1].FullName)
}

func TestGetUserCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, c.ID, "998901234567", "Ali", "user")
	createUser(t, q, "998909999999", "Vali")

	m, err := q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998901234567", CompanyID: c.ID})
	require.NoError(t, err)
	assert.Equal(t, "Olma", m.Name)
	assert.Equal(t, "user", m.Role)

	_, err = q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998909999999", CompanyID: c.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "not a member")
}
