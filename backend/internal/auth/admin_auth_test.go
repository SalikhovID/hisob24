package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
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

func TestIssueLoginCodeStoresOnlyTheHash(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")

	issued, err := a.IssueLoginCode(t.Context(), ownerID)

	require.NoError(t, err)
	assert.Regexp(t, `^\d{6}$`, issued.Code)
	var hash string
	var ttl time.Duration
	require.NoError(t, pool.QueryRow(t.Context(),
		"SELECT code_hash, expires_at - now() FROM admin_login_codes WHERE id = $1", issued.ID).Scan(&hash, &ttl))
	assert.Equal(t, HashCode([]byte(testOTPSecret), issued.Code), hash)
	assert.InDelta(t, 60, ttl.Seconds(), 2, "a code lives 60 seconds")

	for _, id := range []int64{42, 999} {
		_, err := a.IssueLoginCode(t.Context(), id)
		assert.ErrorIs(t, err, ErrNotAdmin, "telegram id %d", id)
	}
}

func TestIssueLoginCodeReplacesUnusedCodes(t *testing.T) {
	a, pool := newAdminAuth(t)
	first, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	second, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	rows, err := pool.Query(t.Context(), "SELECT id FROM admin_login_codes WHERE admin_id = $1", ownerID)
	require.NoError(t, err)
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	require.NoError(t, err)
	assert.Equal(t, []int64{second.ID}, ids)
	assert.NotEqual(t, first.ID, second.ID)
}
