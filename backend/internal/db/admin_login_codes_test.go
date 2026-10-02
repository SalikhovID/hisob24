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

func TestCreateAdminLoginCode(t *testing.T) {
	q, pool := setup(t)
	expires := time.Now().Add(time.Minute)

	id := createCode(t, q, ownerID, "hash-1", expires)

	var adminID int64
	var usedAt *time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT admin_id, used_at FROM admin_login_codes WHERE id = $1", id).Scan(&adminID, &usedAt))
	assert.Equal(t, ownerID, adminID)
	assert.Nil(t, usedAt)

	_, err := q.CreateAdminLoginCode(t.Context(), gen.CreateAdminLoginCodeParams{AdminID: ownerID, CodeHash: "hash-1", ExpiresAt: expires})
	assert.Equal(t, "23505", sqlState(err), "an unused code hash is unique") // unique_violation
}

func createCode(t *testing.T, q *gen.Queries, adminID int64, hash string, expiresAt time.Time) int64 {
	t.Helper()
	id, err := q.CreateAdminLoginCode(context.Background(), gen.CreateAdminLoginCodeParams{AdminID: adminID, CodeHash: hash, ExpiresAt: expiresAt})
	require.NoError(t, err)
	return id
}

func TestConsumeAdminLoginCode(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createCode(t, q, ownerID, "fresh", time.Now().Add(time.Minute))
	createCode(t, q, ownerID, "stale", time.Now().Add(-time.Second))

	adminID, err := q.ConsumeAdminLoginCode(ctx, "fresh")
	require.NoError(t, err)
	assert.Equal(t, ownerID, adminID)

	_, err = q.ConsumeAdminLoginCode(ctx, "fresh")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a code works once")
	_, err = q.ConsumeAdminLoginCode(ctx, "stale")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired code does not work")
	_, err = q.ConsumeAdminLoginCode(ctx, "unknown")
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
