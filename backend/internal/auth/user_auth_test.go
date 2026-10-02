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

func addCompany(t *testing.T, pool *pgxpool.Pool, name string, daysLeft int) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE + $2::int) RETURNING id", name, daysLeft).Scan(&id))
	return id
}

func addMember(t *testing.T, pool *pgxpool.Pool, phone string, companyID int64, role string) {
	t.Helper()
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ($1, $2, $3)", phone, companyID, role)
}

func TestVerifySignsInAUserOfOneCompany(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	a.newRefreshToken = func() (string, error) { return "refresh-1", nil }
	addUser(t, pool, "998901234567")
	companyID := addCompany(t, pool, "Olma", 30)
	addMember(t, pool, "998901234567", companyID, "manager")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))

	tokens, err := a.Verify(t.Context(), "+998 90 123 45 67", "123456")

	require.NoError(t, err)
	require.NotNil(t, tokens.CompanyID)
	assert.Equal(t, companyID, *tokens.CompanyID, "the only company is chosen")
	assert.Equal(t, "manager", tokens.Role)
	claims, err := ParseAccessToken([]byte(testJWTSecret), tokens.AccessToken, time.Now())
	require.NoError(t, err)
	assert.Equal(t, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "manager"}, claims)
	assert.Equal(t, "refresh-1", tokens.RefreshToken)
	assert.WithinDuration(t, time.Now().Add(30*24*time.Hour), tokens.RefreshExpiresAt, 5*time.Second)
	var hash string
	var stored *int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT token_hash, company_id FROM refresh_tokens WHERE user_phone = '998901234567'").
		Scan(&hash, &stored))
	assert.NotEqual(t, "refresh-1", hash, "only the refresh token's hash is stored")
	require.NotNil(t, stored)
	assert.Equal(t, companyID, *stored, "the refresh token remembers the company")

	_, err = a.Verify(t.Context(), "998901234567", "123456")
	assert.ErrorIs(t, err, ErrInvalidCode, "a code signs in once")
}
