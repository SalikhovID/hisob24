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
	"github.com/SalikhovID/hisob24/backend/internal/billing"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/telegramtest"
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
	h := NewHandler(Services{Auth: a, Companies: company.NewService(pool), Billing: billing.NewService(pool)},
		cookieSecure, httpx.NewRateLimiter(5, time.Minute))
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

func TestMe(t *testing.T) {
	api := newTestAPI(t, true)
	login := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	rec := api.do(t, http.MethodGet, "/admin/me", "", sessionCookieOf(t, login))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"telegram_id":461603558,"full_name":"Owner"}`, rec.Body.String())

	rec = api.do(t, http.MethodGet, "/admin/me", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"unauthorized","message":"Avval tizimga kiring"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/admin/me", "", &http.Cookie{Name: "admin_session", Value: "forged"})
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestLoginWithInitData(t *testing.T) {
	api := newTestAPI(t, true)
	body := func(initData string) string { return `{"initData":"` + initData + `"}` }

	rec := api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData(testBotToken, ownerID, time.Now())))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"telegram_id":461603558,"full_name":"Owner"}`, rec.Body.String())
	sessionCookieOf(t, rec)

	rec = api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData("999:other-bot", ownerID, time.Now())))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"invalid_init_data","message":"Telegram ma'lumotlari tasdiqlanmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData(testBotToken, 42, time.Now())))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, `{"error":"not_admin","message":"Sizda ruxsat yo'q"}`, rec.Body.String())
}

func TestLogout(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := sessionCookieOf(t, api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`))

	rec := api.do(t, http.MethodPost, "/admin/auth/logout", "", cookie)

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, -1, sessionCookieOf(t, rec).MaxAge, "the browser drops the cookie")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/admin/me", "", cookie).Code)
}

func TestSessionCookieWithoutSecureForLocalHTTP(t *testing.T) {
	api := newTestAPI(t, false)
	login := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.False(t, sessionCookieOf(t, login).Secure, "login")
	logout := api.do(t, http.MethodPost, "/admin/auth/logout", "", sessionCookieOf(t, login))
	assert.False(t, sessionCookieOf(t, logout).Secure, "logout writes the same attributes")
}
