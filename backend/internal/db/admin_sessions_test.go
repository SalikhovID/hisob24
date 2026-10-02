package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateAdminSession(t *testing.T) {
	q, _ := setup(t)
	expires := time.Now().Add(12 * time.Hour)

	s := createSession(t, q, ownerID, expires)

	assert.NotEqual(t, uuid.Nil, s.ID)
	assert.Equal(t, ownerID, s.AdminID)
	assert.Equal(t, "otp", s.Source)
	assert.WithinDuration(t, expires, s.ExpiresAt, time.Millisecond)

	_, err := q.CreateAdminSession(t.Context(), gen.CreateAdminSessionParams{AdminID: ownerID, Source: "web", ExpiresAt: expires})
	assert.Equal(t, "23514", sqlState(err), "source is otp or miniapp") // check_violation
}

func createSession(t *testing.T, q *gen.Queries, adminID int64, expiresAt time.Time) gen.AdminSession {
	t.Helper()
	s, err := q.CreateAdminSession(context.Background(), gen.CreateAdminSessionParams{AdminID: adminID, Source: "otp", ExpiresAt: expiresAt})
	require.NoError(t, err)
	return s
}

func TestGetAdminBySession(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")
	live := createSession(t, q, ownerID, time.Now().Add(time.Hour))
	expired := createSession(t, q, ownerID, time.Now().Add(-time.Second))
	ofInactive := createSession(t, q, 42, time.Now().Add(time.Hour))

	admin, err := q.GetAdminBySession(ctx, live.ID)
	require.NoError(t, err)
	assert.Equal(t, ownerID, admin.TelegramID)

	for name, id := range map[string]uuid.UUID{"expired": expired.ID, "inactive admin": ofInactive.ID, "unknown": uuid.New()} {
		_, err := q.GetAdminBySession(ctx, id)
		assert.ErrorIs(t, err, pgx.ErrNoRows, name)
	}
}

func TestDeleteAdminSession(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	gone := createSession(t, q, ownerID, time.Now().Add(time.Hour))
	kept := createSession(t, q, ownerID, time.Now().Add(time.Hour))

	require.NoError(t, q.DeleteAdminSession(ctx, gone.ID))

	_, err := q.GetAdminBySession(ctx, gone.ID)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
	_, err = q.GetAdminBySession(ctx, kept.ID)
	assert.NoError(t, err)
}
