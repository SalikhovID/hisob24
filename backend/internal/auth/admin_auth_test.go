package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/telegramtest"
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

func TestIssueLoginCodeDrawsAgainOnACollision(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	a.newCode = codes("111111")
	_, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)

	a.newCode = codes("111111", "222222")
	issued, err := a.IssueLoginCode(t.Context(), ownerID)

	require.NoError(t, err)
	assert.Equal(t, "222222", issued.Code)
}

func TestIssueLoginCodeGivesUpAfterFiveCollisions(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	a.newCode = codes("111111")
	_, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)

	a.newCode = codes("111111", "111111", "111111", "111111", "111111", "222222")
	_, err = a.IssueLoginCode(t.Context(), ownerID)

	assert.ErrorContains(t, err, "no free login code after 5 draws")
}

func TestLoginWithCode(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	issued, err := a.IssueLoginCode(ctx, ownerID)
	require.NoError(t, err)

	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)
	assert.Equal(t, ownerID, s.Admin.TelegramID)
	assert.WithinDuration(t, time.Now().Add(12*time.Hour), s.ExpiresAt, 5*time.Second)
	var source string
	require.NoError(t, pool.QueryRow(ctx, "SELECT source FROM admin_sessions WHERE id = $1", s.ID).Scan(&source))
	assert.Equal(t, "otp", source)

	_, err = a.LoginWithCode(ctx, issued.Code)
	assert.ErrorIs(t, err, ErrInvalidCode, "a code works once")
	_, err = a.LoginWithCode(ctx, "000000")
	assert.ErrorIs(t, err, ErrInvalidCode, "a wrong code")

	mustExec(t, pool, "INSERT INTO admin_login_codes (admin_id, code_hash, expires_at) VALUES ($1, $2, now() - interval '1 second')",
		ownerID, HashCode([]byte(testOTPSecret), "654321"))
	_, err = a.LoginWithCode(ctx, "654321")
	assert.ErrorIs(t, err, ErrInvalidCode, "an expired code")
}

func TestLoginWithCodeOfADeactivatedAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	issued, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")

	_, err = a.LoginWithCode(t.Context(), issued.Code)

	assert.ErrorIs(t, err, ErrInvalidCode)
}

func TestDiscardLoginCode(t *testing.T) {
	a, _ := newAdminAuth(t)
	issued, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	require.NoError(t, a.DiscardLoginCode(t.Context(), issued.ID))

	_, err = a.LoginWithCode(t.Context(), issued.Code)
	assert.ErrorIs(t, err, ErrInvalidCode)
}

func TestLoginWithInitData(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()

	s, err := a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, ownerID, time.Now()))
	require.NoError(t, err)
	assert.Equal(t, ownerID, s.Admin.TelegramID)
	var source string
	require.NoError(t, pool.QueryRow(ctx, "SELECT source FROM admin_sessions WHERE id = $1", s.ID).Scan(&source))
	assert.Equal(t, "miniapp", source)

	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, 42, time.Now()))
	assert.ErrorIs(t, err, ErrNotAdmin, "a Telegram user who is not an admin")
	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData("999:other-bot", ownerID, time.Now()))
	assert.ErrorIs(t, err, ErrInvalidInitData, "signed by another bot")
	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, ownerID, time.Now().Add(-25*time.Hour)))
	assert.ErrorIs(t, err, ErrInvalidInitData, "older than a day")
}

func TestAuthenticate(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	issued, err := a.IssueLoginCode(ctx, ownerID)
	require.NoError(t, err)
	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)

	admin, err := a.Authenticate(ctx, s.ID.String())
	require.NoError(t, err)
	assert.Equal(t, ownerID, admin.TelegramID)

	for name, id := range map[string]string{"malformed": "not-a-uuid", "unknown": uuid.NewString()} {
		_, err := a.Authenticate(ctx, id)
		assert.ErrorIs(t, err, ErrUnauthenticated, name)
	}
	mustExec(t, pool, "UPDATE admin_sessions SET expires_at = now() - interval '1 second' WHERE id = $1", s.ID)
	_, err = a.Authenticate(ctx, s.ID.String())
	assert.ErrorIs(t, err, ErrUnauthenticated, "expired")
}
