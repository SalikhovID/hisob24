package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const testJWTSecret = "test-jwt-secret"

type sentSMS struct{ phone, text string }

// fakeSender records the SMS it is asked to send and fails with err.
type fakeSender struct {
	mu   sync.Mutex
	sent []sentSMS
	err  error
}

func (f *fakeSender) Send(_ context.Context, phone, text string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentSMS{phone, text})
	return f.err
}

func (f *fakeSender) messages() []sentSMS {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]sentSMS(nil), f.sent...)
}

func newUserAuth(t *testing.T) (*UserAuth, *pgxpool.Pool, *fakeSender) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	sender := &fakeSender{}
	a := NewUserAuth(pool, testOTPSecret, testJWTSecret, sender)
	a.newCode = codes("123456", "654321", "111111", "222222")
	return a, pool, sender
}

func addUser(t *testing.T, pool *pgxpool.Pool, phone string) {
	t.Helper()
	mustExec(t, pool, "INSERT INTO users (phone, full_name) VALUES ($1, 'Ali')", phone)
}

func TestSendCodeTextsAUserTheirCode(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")

	require.NoError(t, a.SendCode(t.Context(), "+998 90 123 45 67"))

	assert.Equal(t, []sentSMS{{"998901234567", "Hisob24 kirish kodi: 123456"}}, sender.messages())
	var hash string
	var expiresAt time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT code_hash, expires_at FROM sms_codes WHERE phone = '998901234567'").
		Scan(&hash, &expiresAt))
	assert.Equal(t, HashCode([]byte(testOTPSecret), "123456"), hash, "only the code's HMAC is stored")
	assert.WithinDuration(t, time.Now().Add(2*time.Minute), expiresAt, 5*time.Second)
}

func TestSendCodeToAStrangerSendsNothingButKeepsACode(t *testing.T) {
	a, pool, sender := newUserAuth(t)

	require.NoError(t, a.SendCode(t.Context(), "998909999999"))

	assert.Empty(t, sender.messages(), "no SMS to a phone that is not a user")
	var codes int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM sms_codes WHERE phone = '998909999999'").Scan(&codes))
	assert.Equal(t, 1, codes, "a code is kept all the same, so a second request within a minute is refused alike")
}

func TestSendCodeAgainWithinAMinuteIsRefusedForEveryPhone(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))
	require.NoError(t, a.SendCode(t.Context(), "998909999999"))

	assert.ErrorIs(t, a.SendCode(t.Context(), "998901234567"), ErrTooSoon, "a user")
	assert.ErrorIs(t, a.SendCode(t.Context(), "998909999999"), ErrTooSoon, "a stranger alike")
	assert.Len(t, sender.messages(), 1, "no second SMS")
}

func TestSendCodeRefusesABadPhone(t *testing.T) {
	a, _, sender := newUserAuth(t)

	err := a.SendCode(t.Context(), "12ab")

	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Invalid, e.Kind)
	assert.Equal(t, "Telefon raqami noto'g'ri", e.Message)
	assert.Empty(t, sender.messages())
}

func TestSendCodeThatCouldNotBeSentCanBeAskedForAgainAtOnce(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")
	sender.err = errors.New("eskiz is down")

	err := a.SendCode(t.Context(), "998901234567")

	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrTooSoon)
	sender.err = nil
	assert.NoError(t, a.SendCode(t.Context(), "998901234567"), "no minute to wait for an SMS that never left")
}
