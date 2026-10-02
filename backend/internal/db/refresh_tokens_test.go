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

func TestRevokeRefreshToken(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")
	createRefreshToken(t, q, "998901234567", "live", time.Now().Add(time.Hour))
	createRefreshToken(t, q, "998901234567", "old", time.Now().Add(-time.Second))

	revoked, err := q.RevokeRefreshToken(ctx, "live")
	require.NoError(t, err)
	assert.Equal(t, "998901234567", revoked.UserPhone)
	_, err = q.RevokeRefreshToken(ctx, "live")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a token is used once")
	_, err = q.RevokeRefreshToken(ctx, "old")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired token")
}

func TestRefreshTokenRemembersTheCompany(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")
	c, err := q.CreateCompany(ctx, gen.CreateCompanyParams{Name: "Olma", EndDate: time.Now()})
	require.NoError(t, err)
	_, err = q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{
		UserPhone: "998901234567", TokenHash: "with", ExpiresAt: time.Now().Add(time.Hour), CompanyID: &c.ID,
	})
	require.NoError(t, err)
	createRefreshToken(t, q, "998901234567", "without", time.Now().Add(time.Hour))

	revoked, err := q.RevokeRefreshToken(ctx, "with")
	require.NoError(t, err)
	if assert.NotNil(t, revoked.CompanyID, "the company the token was issued for") {
		assert.Equal(t, c.ID, *revoked.CompanyID)
	}
	revoked, err = q.RevokeRefreshToken(ctx, "without")
	require.NoError(t, err)
	assert.Nil(t, revoked.CompanyID, "no company chosen")
}
