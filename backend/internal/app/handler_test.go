package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

const (
	alisPhone     = "998901234567"
	testOTPSecret = "test-otp-secret"
	testJWTSecret = "test-jwt-secret"
)

// smsBox keeps the last SMS each phone got.
type smsBox struct {
	mu   sync.Mutex
	last map[string]string
}

func (b *smsBox) Send(_ context.Context, phone, text string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.last[phone] = text
	return nil
}

func (b *smsBox) text(phone string) string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.last[phone]
}

var codeInText = regexp.MustCompile(`\d{6}$`)

// code is the login code in the last SMS phone got.
func (b *smsBox) code(t *testing.T, phone string) string {
	t.Helper()
	code := codeInText.FindString(b.text(phone))
	require.NotEmpty(t, code, "no code was texted to %s", phone)
	return code
}

type testAPI struct {
	router http.Handler
	pool   *pgxpool.Pool
	sms    *smsBox
}

func newTestAPI(t *testing.T) testAPI {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	box := &smsBox{last: map[string]string{}}
	h := NewHandler(
		Services{Auth: auth.NewUserAuth(pool, testOTPSecret, testJWTSecret, box), Profiles: user.NewProfiles(pool)},
		true,
		httpx.NewRateLimiter(5, time.Minute),
		httpx.NewRateLimiter(5, time.Minute),
	)
	return testAPI{router: httpx.NewRouter(h.Routes), pool: pool, sms: box}
}

type option func(*http.Request)

func bearer(token string) option {
	return func(r *http.Request) { r.Header.Set("Authorization", "Bearer "+token) }
}

func cookie(c *http.Cookie) option {
	return func(r *http.Request) { r.AddCookie(c) }
}

func (api testAPI) do(t *testing.T, method, path, body string, options ...option) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, o := range options {
		o(req)
	}
	rec := httptest.NewRecorder()
	api.router.ServeHTTP(rec, req)
	return rec
}

func (api testAPI) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	_, err := api.pool.Exec(t.Context(), sql, args...)
	require.NoError(t, err)
}

func (api testAPI) addUser(t *testing.T, phone string) {
	t.Helper()
	api.exec(t, "INSERT INTO users (phone, full_name) VALUES ($1, 'Ali Valiyev')", phone)
}

func TestSendCode(t *testing.T) {
	api := newTestAPI(t)
	api.addUser(t, alisPhone)

	rec := api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"+998 90 123 45 67"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `{"retry_after":60}`, rec.Body.String())
	assert.Regexp(t, `^Hisob24 kirish kodi: \d{6}$`, api.sms.text(alisPhone))

	rec = api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"998909999999"}`)
	assert.Equal(t, http.StatusOK, rec.Code, "a stranger gets the same answer")
	assert.JSONEq(t, `{"retry_after":60}`, rec.Body.String())
	assert.Empty(t, api.sms.text("998909999999"))

	for _, phone := range []string{alisPhone, "998909999999"} {
		rec = api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+phone+`"}`)
		assert.Equal(t, http.StatusTooManyRequests, rec.Code, phone)
		assert.JSONEq(t, `{"error":"too_many_requests","message":"Kodni qayta olish uchun bir daqiqa kuting"}`, rec.Body.String(), phone)
	}

	rec = api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"12ab"}`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Telefon raqami noto'g'ri"}`, rec.Body.String())
}

func TestSendCodeIsLimitedPerIP(t *testing.T) {
	api := newTestAPI(t)

	for i := range 5 {
		rec := api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"99890000000`+string(rune('0'+i))+`"}`)
		require.Equal(t, http.StatusOK, rec.Code, "request %d", i+1)
	}
	rec := api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"998900000009"}`)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "a sixth phone from the same IP within a minute")
}
