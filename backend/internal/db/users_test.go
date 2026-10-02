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
