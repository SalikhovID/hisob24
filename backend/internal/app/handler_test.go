package app

import (
	"context"
	"encoding/json"
	"fmt"
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

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/task"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

const (
	alisPhone        = "998901234567"
	testOTPSecret    = "test-otp-secret"
	testJWTSecret    = "test-jwt-secret"
	testUserBotToken = "4242:test-user-bot-token"
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

// forget drops what phone got so far, so a test can tell a new SMS.
func (b *smsBox) forget(phone string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.last, phone)
}

// The code is the only six-digit number in the SMS text.
var codeInText = regexp.MustCompile(`\b\d{6}\b`)

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
	return newTestAPIWith(t, true)
}

// newTestAPIWith serves /app with cookies Secure or not (COOKIE_SECURE).
func newTestAPIWith(t *testing.T, cookieSecure bool) testAPI {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	box := &smsBox{last: map[string]string{}}
	h := NewHandler(
		Services{
			Auth:      auth.NewUserAuth(pool, testOTPSecret, testJWTSecret, testUserBotToken, box),
			Profiles:  user.NewProfiles(pool),
			Companies: company.NewService(pool),
			Customers: customer.NewService(pool),
			Tasks:     task.NewService(pool, customer.NewService(pool)),
			Catalog:   catalog.NewService(pool),
		},
		cookieSecure,
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

// addOwner makes phone a user who may sign in: the owner of a company.
func (api testAPI) addOwner(t *testing.T, phone string) int64 {
	t.Helper()
	api.addUser(t, phone)
	companyID := api.addCompany(t, "Olma", 30)
	api.addMember(t, phone, companyID, "owner")
	return companyID
}

func TestSendCode(t *testing.T) {
	api := newTestAPI(t)
	api.addOwner(t, alisPhone)

	rec := api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"+998 90 123 45 67"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `{"retry_after":60}`, rec.Body.String())
	assert.Regexp(t, `^Hisob24 dasturiga kirish uchun tasdiqlash kodi: \d{6} Uni hech kimga bermang\.$`, api.sms.text(alisPhone))

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

// refreshCookieOf is the refresh_token cookie a response leaves: the one
// with a value (a secure response drops the other variant first), or the
// last when every line drops it.
func refreshCookieOf(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	var last *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name != "refresh_token" {
			continue
		}
		if c.Value != "" {
			return c
		}
		last = c
	}
	if last == nil {
		t.Fatalf("no refresh_token cookie in %v", rec.Result().Header["Set-Cookie"])
	}
	return last
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
	_, refresh := api.signIn(t, alisPhone, map[int64]string{api.addCompany(t, "Olma", 30): "owner"})

	rec := api.do(t, http.MethodPost, "/app/auth/logout", "", cookie(refresh))

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, -1, refreshCookieOf(t, rec).MaxAge, "the cookie is dropped")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(refresh)).Code,
		"the refresh token is revoked")
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodPost, "/app/auth/logout", "").Code, "no cookie is fine")
}

func TestMe(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	token, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.addMember(t, alisPhone, nok, "user")

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(token))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, map[string]any{"phone": alisPhone, "full_name": "Ali Valiyev"}, body["user"])
	company, _ := body["company"].(map[string]any)
	assert.EqualValues(t, olma, company["id"], "the company the token is for")
	assert.Equal(t, "Olma", company["name"])
	assert.Equal(t, "owner", company["role"])
	assert.Contains(t, company, "role_name")
	assert.Nil(t, company["role_name"], "the owner holds no company role")
	assert.Equal(t, true, company["is_active"])
	assert.Regexp(t, `^\d{4}-\d{2}-\d{2}$`, company["end_date"])
	assert.Len(t, body["companies"], 2, "all of the user's companies")
	all := make([]string, 0, len(access.All))
	for _, p := range access.All {
		all = append(all, string(p))
	}
	assert.Equal(t, all, permissionsOf(t, body), "the owner may do everything")
	assert.Equal(t, []any{location(asosiy, "Asosiy")}, body["locations"], "the locations the member may work in")
	assert.Contains(t, body, "nav_order")
	assert.Nil(t, body["nav_order"], "the default order of the menu")
}

// /app/me tells the locations the member may work in (logic/locations.md,
// section 4): every live one of the company's, or the live ones of a
// restriction; none before a company is chosen.
func TestMeTellsTheMembersLocations(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	gone := api.addLocation(t, olma, "Yopilgan")
	api.exec(t, "UPDATE locations SET deleted_at = now() WHERE id = $1", gone)
	api.addLocation(t, nok, "Begona")
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	restricted, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user"})
	api.restrictTo(t, sardorsPhone, olma, chilonzor, gone)
	undecided, _ := api.signIn(t, "998904445566", map[int64]string{olma: "user", nok: "user"})
	locationsOf := func(token string) any {
		rec := api.do(t, http.MethodGet, "/app/me", "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode(t, rec)["locations"]
	}

	assert.Equal(t, []any{location(asosiy, "Asosiy"), location(chilonzor, "Chilonzor")}, locationsOf(owner), "the owner: every live location")
	assert.Equal(t, []any{location(asosiy, "Asosiy"), location(chilonzor, "Chilonzor")}, locationsOf(employee), "an employee without a restriction: the same")
	assert.Equal(t, []any{location(chilonzor, "Chilonzor")}, locationsOf(restricted), "a restricted employee: the live ones of the restriction")
	assert.Equal(t, []any{}, locationsOf(undecided), "none before a company is chosen")
}

func TestMeNamesTheUserAsTheChosenCompanyDoes(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	access, refresh := api.signIn(t, alisPhone, map[int64]string{olma: "owner", nok: "user"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Ali (hisobchi)' WHERE company_id = $1", nok)
	name := func() any {
		rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		user, _ := decode(t, rec)["user"].(map[string]any)
		return user["full_name"]
	}
	choose := func(companyID int64) {
		rec := api.do(t, http.MethodPost, "/app/auth/switch-company", fmt.Sprintf(`{"company_id":%d}`, companyID), bearer(access), cookie(refresh))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		access, _ = decode(t, rec)["access_token"].(string)
		refresh = refreshCookieOf(t, rec)
	}

	assert.Equal(t, "Ali Valiyev", name(), "before a company is chosen: the user's own name")
	choose(nok)
	assert.Equal(t, "Ali (hisobchi)", name(), "the name the user goes by in the company they work in")
	choose(olma)
	assert.Equal(t, "Ali Valiyev", name(), "a membership without a name falls back to the user's own")
}

func TestMeSaysHowManyDaysEachCompanyHasLeft(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	anor := api.addCompany(t, "Anor", -5)
	access, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.addMember(t, alisPhone, anor, "user")

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	company, _ := body["company"].(map[string]any)
	assert.EqualValues(t, 30, company["days_left"])
	companies, _ := body["companies"].([]any)
	require.Len(t, companies, 2)
	anorJSON, _ := companies[0].(map[string]any)
	assert.Equal(t, "Anor", anorJSON["name"])
	assert.EqualValues(t, -5, anorJSON["days_left"], "an expired company counts below zero")
}

func TestMeNeedsAValidAccessToken(t *testing.T) {
	api := newTestAPI(t)
	access, _ := api.signIn(t, alisPhone, map[int64]string{api.addCompany(t, "Olma", 30): "owner"})

	for name, options := range map[string][]option{
		"no token":         nil,
		"not a token":      {bearer("abc.def.ghi")},
		"no Bearer scheme": {func(r *http.Request) { r.Header.Set("Authorization", access) }},
	} {
		rec := api.do(t, http.MethodGet, "/app/me", "", options...)
		assert.Equal(t, http.StatusUnauthorized, rec.Code, name)
		assert.JSONEq(t, `{"error":"unauthorized","message":"Avval tizimga kiring"}`, rec.Body.String(), name)
	}
}

func TestAnExpiredOrBlockedCompanyAnswers402(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	access, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	expired := `{"error":"subscription_expired","message":"Kompaniya obunasi tugagan"}`

	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE - 1 WHERE id = $1", olma)
	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))
	assert.Equal(t, http.StatusPaymentRequired, rec.Code, "expired")
	assert.JSONEq(t, expired, rec.Body.String())

	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE + 30, is_active = false WHERE id = $1", olma)
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(access))
	assert.Equal(t, http.StatusPaymentRequired, rec.Code, "blocked")
	assert.JSONEq(t, expired, rec.Body.String())

	api.exec(t, "UPDATE companies SET is_active = true WHERE id = $1", olma)
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code, "paid up again")
}

func TestAMemberTakenOutOfTheCompanyIsTurnedAwayAtOnce(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	access, _ := api.signIn(t, alisPhone, map[int64]string{olma: "user"})
	require.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code)

	api.exec(t, "DELETE FROM user_companies WHERE company_id = $1", olma)
	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))

	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the access token has minutes left, the membership none")
	assert.JSONEq(t, `{"error":"unauthorized","message":"Avval tizimga kiring"}`, rec.Body.String(),
		"the app refreshes the session, which drops the company or ends")
}

func TestATokenBeforeAChoiceOfCompanyIsNotChecked(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", -5)
	nok := api.addCompany(t, "Nok", 30)
	access, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner", nok: "user"})

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))

	assert.Equal(t, http.StatusOK, rec.Code, "the user picks a company first")
}

func TestSwitchCompany(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", -3)
	nok := api.addCompany(t, "Nok", 30)
	other := api.addCompany(t, "Begona", 30)
	access, refresh := api.signIn(t, alisPhone, map[int64]string{olma: "owner", nok: "user"})
	switchTo := func(companyID int64, options ...option) *httptest.ResponseRecorder {
		return api.do(t, http.MethodPost, "/app/auth/switch-company", fmt.Sprintf(`{"company_id":%d}`, companyID), options...)
	}

	rec := switchTo(olma, bearer(access), cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code, "even to an expired company: the pages tell it, not the switch")
	assert.EqualValues(t, olma, decode(t, rec)["company_id"])
	access, _ = decode(t, rec)["access_token"].(string)
	refresh = refreshCookieOf(t, rec)
	assert.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code)

	rec = switchTo(nok, bearer(access), cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code, "away from the expired one")
	access, _ = decode(t, rec)["access_token"].(string)
	refresh = refreshCookieOf(t, rec)
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code)

	rec = switchTo(other, bearer(access), cookie(refresh))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, `{"error":"not_member","message":"Siz bu kompaniyaga a'zo emassiz"}`, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, switchTo(nok, cookie(refresh)).Code, "no access token")
	rec = switchTo(nok, bearer(access))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "no refresh cookie")
	assert.JSONEq(t, `{"error":"invalid_refresh_token","message":"Sessiya tugagan. Qayta kiring"}`, rec.Body.String())
}

func TestSwitchCompanyToNoneLeadsBackToTheList(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", -3)
	nok := api.addCompany(t, "Nok", 30)
	access, refresh := api.signIn(t, alisPhone, map[int64]string{olma: "owner", nok: "user"})
	rec := api.do(t, http.MethodPost, "/app/auth/switch-company", fmt.Sprintf(`{"company_id":%d}`, olma), bearer(access), cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code)
	access, _ = decode(t, rec)["access_token"].(string)
	refresh = refreshCookieOf(t, rec)
	require.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code)

	rec = api.do(t, http.MethodPost, "/app/auth/switch-company", `{"company_id":null}`, bearer(access), cookie(refresh))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Nil(t, body["company_id"])
	access, _ = body["access_token"].(string)
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(access))
	require.Equal(t, http.StatusOK, rec.Code, "out of the expired company")
	assert.Len(t, decode(t, rec)["companies"], 2)
}

// addLocation makes a location of the company and returns its id.
func (api testAPI) addLocation(t *testing.T, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, api.pool.QueryRow(t.Context(),
		"INSERT INTO locations (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id))
	return id
}

// restrictTo restricts the member to the locations: they may work in these
// alone (logic/locations.md, section 5).
func (api testAPI) restrictTo(t *testing.T, phone string, companyID int64, locationIDs ...int64) {
	t.Helper()
	api.exec(t, "UPDATE user_companies SET all_locations = false WHERE user_phone = $1 AND company_id = $2", phone, companyID)
	for _, id := range locationIDs {
		api.exec(t, "INSERT INTO member_locations (user_phone, company_id, location_id) VALUES ($1, $2, $3)", phone, companyID, id)
	}
}

// location is a location as /app/me and the members tell it.
func location(id int64, name string) map[string]any {
	return map[string]any{"id": float64(id), "name": name}
}
