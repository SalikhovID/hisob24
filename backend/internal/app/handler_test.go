package app

import (
	"context"
	"encoding/json"
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

func (api testAPI) addCompany(t *testing.T, name string, daysLeft int) int64 {
	t.Helper()
	var id int64
	require.NoError(t, api.pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE + $2::int) RETURNING id", name, daysLeft).Scan(&id))
	return id
}

func (api testAPI) addMember(t *testing.T, phone string, companyID int64, role string) {
	t.Helper()
	api.exec(t, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ($1, $2, $3)", phone, companyID, role)
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &m), rec.Body.String())
	return m
}

func refreshCookieOf(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == "refresh_token" {
			return c
		}
	}
	t.Fatalf("no refresh_token cookie in %v", rec.Result().Header["Set-Cookie"])
	return nil
}

func TestVerify(t *testing.T) {
	api := newTestAPI(t)
	api.addUser(t, alisPhone)
	companyID := api.addCompany(t, "Olma", 30)
	api.addMember(t, alisPhone, companyID, "owner")
	api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+alisPhone+`"}`)

	rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"`+alisPhone+`","code":"000000"}`)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"invalid_code","message":"Kod noto'g'ri yoki muddati o'tgan"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"+998 90 123 45 67","code":"`+api.sms.code(t, alisPhone)+`"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.NotEmpty(t, body["access_token"])
	assert.EqualValues(t, 900, body["expires_in"])
	assert.EqualValues(t, companyID, body["company_id"])
	c := refreshCookieOf(t, rec)
	assert.NotEmpty(t, c.Value)
	assert.True(t, c.HttpOnly)
	assert.True(t, c.Secure)
	assert.Equal(t, http.SameSiteLaxMode, c.SameSite)
	assert.Equal(t, "/", c.Path)
	assert.InDelta(t, 30*24*60*60, c.MaxAge, 5)
}

func TestVerifyIsLimitedPerIPApartFromSend(t *testing.T) {
	api := newTestAPI(t)
	for i := range 5 {
		api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"99890000000`+string(rune('0'+i))+`"}`)
	}

	for i := range 5 {
		rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"998900000000","code":"000000"}`)
		require.Equal(t, http.StatusUnauthorized, rec.Code, "attempt %d: sends are counted apart", i+1)
	}
	rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"998900000000","code":"000000"}`)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "a sixth attempt from the same IP within a minute")
}

// signIn makes phone a user of the companies (id → role) and signs in through
// the API: the access token and the refresh token's cookie.
func (api testAPI) signIn(t *testing.T, phone string, roles map[int64]string) (string, *http.Cookie) {
	t.Helper()
	api.addUser(t, phone)
	for companyID, role := range roles {
		api.addMember(t, phone, companyID, role)
	}
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+phone+`"}`).Code)
	rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"`+phone+`","code":"`+api.sms.code(t, phone)+`"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	access, _ := decode(t, rec)["access_token"].(string)
	return access, refreshCookieOf(t, rec)
}

func TestRefresh(t *testing.T) {
	api := newTestAPI(t)
	companyID := api.addCompany(t, "Olma", 30)
	_, first := api.signIn(t, alisPhone, map[int64]string{companyID: "owner"})

	rec := api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(first))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.NotEmpty(t, body["access_token"])
	assert.EqualValues(t, companyID, body["company_id"], "the company is kept")
	assert.NotEqual(t, first.Value, refreshCookieOf(t, rec).Value, "the refresh token is rotated")

	rec = api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(first))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the old token is used up")
	assert.JSONEq(t, `{"error":"invalid_refresh_token","message":"Sessiya tugagan. Qayta kiring"}`, rec.Body.String())
	assert.Equal(t, -1, refreshCookieOf(t, rec).MaxAge, "and its cookie is dropped")

	rec = api.do(t, http.MethodPost, "/app/auth/refresh", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "no cookie")
}

func TestLogout(t *testing.T) {
	api := newTestAPI(t)
	_, refresh := api.signIn(t, alisPhone, nil)

	rec := api.do(t, http.MethodPost, "/app/auth/logout", "", cookie(refresh))

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, -1, refreshCookieOf(t, rec).MaxAge, "the cookie is dropped")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(refresh)).Code,
		"the refresh token is revoked")
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodPost, "/app/auth/logout", "").Code, "no cookie is fine")
}
