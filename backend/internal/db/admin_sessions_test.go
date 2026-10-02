package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
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
