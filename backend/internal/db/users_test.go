package db_test

import (
	"context"
	"testing"

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

func TestUpsertCompanyUser(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, "998901234567", "Ali")

	m, err := q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "staff"})
	require.NoError(t, err)
	assert.Equal(t, "staff", m.Role)

	m, err = q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "manager"})
	require.NoError(t, err)
	assert.Equal(t, "manager", m.Role, "a member gets the new role")
	var members int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM user_companies WHERE company_id = $1", c.ID).Scan(&members))
	assert.Equal(t, 1, members)

	_, err = q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "boss"})
	assert.Equal(t, "23514", sqlState(err), "role is owner, manager or staff") // check_violation
}

func TestListCompanyUsers(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	other := createCompany(t, q, "Nok", d)
	addMember(t, q, c.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, c.ID, "998902222222", "Xodim", "staff")
	addMember(t, q, other.ID, "998903333333", "Begona", "owner")

	users, err := q.ListCompanyUsers(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, users, 2)
	assert.Equal(t, "998901111111", users[0].Phone)
	assert.Equal(t, "Egasi", *users[0].FullName)
	assert.Equal(t, "owner", users[0].Role)
	assert.Equal(t, "998902222222", users[1].Phone)
	assert.Equal(t, "staff", users[1].Role)
}

func addMember(t *testing.T, q *gen.Queries, companyID int64, phone, name, role string) {
	t.Helper()
	createUser(t, q, phone, name)
	_, err := q.UpsertCompanyUser(context.Background(), gen.UpsertCompanyUserParams{UserPhone: phone, CompanyID: companyID, Role: role})
	require.NoError(t, err)
}

func TestListUserCompanies(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	olma := createCompany(t, q, "Olma", d)
	behi := createCompany(t, q, "Behi", d.AddDate(0, 0, -1))
	nok := createCompany(t, q, "Nok", d)
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	addMember(t, q, behi.ID, "998901234567", "Ali", "staff")
	addMember(t, q, nok.ID, "998909999999", "Vali", "owner")

	got, err := q.ListUserCompanies(t.Context(), "998901234567")

	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "Behi", got[0].Name, "ordered by name")
	assert.Equal(t, "staff", got[0].Role)
	assert.True(t, got[0].EndDate.Equal(d.AddDate(0, 0, -1)))
	assert.Equal(t, "Olma", got[1].Name)
	assert.Equal(t, "owner", got[1].Role)
	assert.True(t, got[1].IsActive)
}

func TestGetUserCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, c.ID, "998901234567", "Ali", "manager")
	createUser(t, q, "998909999999", "Vali")

	m, err := q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998901234567", CompanyID: c.ID})
	require.NoError(t, err)
	assert.Equal(t, "Olma", m.Name)
	assert.Equal(t, "manager", m.Role)

	_, err = q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998909999999", CompanyID: c.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "not a member")
}
