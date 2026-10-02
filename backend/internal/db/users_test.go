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
