package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ownerID       int64 = 461603558
	testOTPSecret       = "test-otp-secret"
	testBotToken        = "123456:test-bot-token"
)

func newAdminAuth(t *testing.T) (*AdminAuth, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewAdminAuth(pool, testOTPSecret, testBotToken), pool
}

// codes makes newCode hand out the given codes in order.
func codes(list ...string) func() (string, error) {
	next := 0
	return func() (string, error) {
		if next == len(list) {
			return "", errors.New("the test ran out of codes")
		}
		next++
		return list[next-1], nil
	}
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	_, err := pool.Exec(context.Background(), sql, args...)
	require.NoError(t, err)
}

func TestIsActiveAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")

	for id, want := range map[int64]bool{ownerID: true, 42: false, 999: false} {
		got, err := a.IsActiveAdmin(t.Context(), id)
		require.NoError(t, err)
		assert.Equal(t, want, got, "admin %d", id)
	}
}
