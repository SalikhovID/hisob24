package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ownerID       int64 = 461603558
	testOTPSecret       = "test-otp-secret"
	testBotToken        = "123456:test-bot-token"
)

type testAPI struct {
	router http.Handler
	auth   *auth.AdminAuth
	pool   *pgxpool.Pool
}

func newTestAPI(t *testing.T, cookieSecure bool) testAPI {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	a := auth.NewAdminAuth(pool, testOTPSecret, testBotToken)
	h := NewHandler(a, cookieSecure, httpx.NewRateLimiter(5, time.Minute))
	return testAPI{router: httpx.NewRouter(h.Routes), auth: a, pool: pool}
}

func (api testAPI) do(t *testing.T, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	api.router.ServeHTTP(rec, req)
	return rec
}

func (api testAPI) code(t *testing.T) string {
	t.Helper()
	issued, err := api.auth.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)
	return issued.Code
}

func sessionCookieOf(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			return c
		}
	}
	t.Fatalf("no admin_session cookie in %v", rec.Result().Header["Set-Cookie"])
	return nil
}

func TestLoginWithCodeSetsTheSessionCookie(t *testing.T) {
	api := newTestAPI(t, true)

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"telegram_id":461603558,"full_name":"Owner"}`, rec.Body.String())
	c := sessionCookieOf(t, rec)
	assert.True(t, c.HttpOnly)
	assert.True(t, c.Secure)
	assert.Equal(t, http.SameSiteLaxMode, c.SameSite)
	assert.Equal(t, "/", c.Path)
	assert.InDelta(t, 12*60*60, c.MaxAge, 5, "the session lasts 12 hours")
}

func TestLoginWithCodeErrors(t *testing.T) {
	api := newTestAPI(t, true)

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"000000"}`)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"invalid_code","message":"Kod noto'g'ri yoki muddati o'tgan"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLoginWithCodeIsRateLimitedPerIP(t *testing.T) {
	api := newTestAPI(t, true)
	for range 5 {
		api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"000000"}`)
	}

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "even a right code waits once the budget is spent")
}
