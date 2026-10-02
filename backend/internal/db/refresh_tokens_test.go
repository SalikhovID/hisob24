package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateRefreshToken(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")

	id, err := q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{UserPhone: "998901234567", TokenHash: "hash", ExpiresAt: time.Now().Add(30 * 24 * time.Hour)})
	require.NoError(t, err)
	var revokedAt *time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT revoked_at FROM refresh_tokens WHERE id = $1", id).Scan(&revokedAt))
	assert.Nil(t, revokedAt)

	_, err = q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{UserPhone: "998900000000", TokenHash: "x", ExpiresAt: time.Now().Add(time.Hour)})
	assert.Equal(t, "23503", sqlState(err), "the user must exist") // foreign_key_violation
}

func createRefreshToken(t *testing.T, q *gen.Queries, phone, hash string, expiresAt time.Time) {
	t.Helper()
	_, err := q.CreateRefreshToken(context.Background(), gen.CreateRefreshTokenParams{UserPhone: phone, TokenHash: hash, ExpiresAt: expiresAt})
	require.NoError(t, err)
}
