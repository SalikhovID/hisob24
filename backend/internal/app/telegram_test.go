package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/telegramtest"
)

// linkContact stands for the user bot: the Telegram account shared phone.
func (api testAPI) linkContact(t *testing.T, telegramID int64, phone string) {
	t.Helper()
	api.exec(t, "INSERT INTO telegram_contacts (chat_id, phone) VALUES ($1, $2)", telegramID, phone)
}

func telegramBody(telegramID int64) string {
	return `{"initData":"` + telegramtest.SignInitData(testUserBotToken, telegramID, time.Now()) + `"}`
}

func TestTelegramSignInFromTheMiniApp(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	api.addUser(t, alisPhone)
	api.addMember(t, alisPhone, olma, "owner")
	api.linkContact(t, 1001, alisPhone)

	rec := api.do(t, http.MethodPost, "/app/auth/telegram", telegramBody(1001))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.NotEmpty(t, body["access_token"])
	assert.EqualValues(t, olma, body["company_id"])
	// Telegram Web opens the Mini App in an iframe: the cookie has to be
	// SameSite=None and Partitioned there. The Lax variant goes first, so a
	// browser without CHIPS, which sees one cookie, keeps the new value.
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 2, rec.Result().Header["Set-Cookie"])
	assert.Equal(t, "refresh_token", cookies[0].Name)
	assert.Equal(t, -1, cookies[0].MaxAge, "the Lax variant is dropped")
	assert.Equal(t, http.SameSiteLaxMode, cookies[0].SameSite)
	assert.NotEmpty(t, cookies[1].Value)
	assert.Equal(t, http.SameSiteNoneMode, cookies[1].SameSite)
	assert.True(t, cookies[1].Secure)
	assert.True(t, cookies[1].HttpOnly)
	assert.True(t, cookies[1].Partitioned)
	assert.Equal(t, "/", cookies[1].Path)
}

func TestTelegramSignInRefusals(t *testing.T) {
	api := newTestAPI(t)
	api.linkContact(t, 1003, "998905556677")
	another := `{"initData":"` + telegramtest.SignInitData("4243:another-bot", 1003, time.Now()) + `"}`

	for name, tc := range map[string]struct {
		body          string
		status        int
		code, message string
	}{
		"signed by another bot": {another, http.StatusUnauthorized, "invalid_init_data", "Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching"},
		"phone never shared":    {telegramBody(1004), http.StatusForbidden, "phone_not_shared", "Telefon raqamingiz botga ulanmagan"},
		"phone is no user's": {telegramBody(1003), http.StatusForbidden, "no_access",
			"Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: +998 90 555 66 77. Kompaniyangiz administratoriga murojaat qiling."},
	} {
		rec := api.do(t, http.MethodPost, "/app/auth/telegram", tc.body)

		assert.Equal(t, tc.status, rec.Code, name)
		assert.Equal(t, map[string]any{"error": tc.code, "message": tc.message}, decode(t, rec), name)
		assert.Empty(t, rec.Result().Cookies(), name)
	}
}

func TestRefreshKeepsTheMiniAppsCookieVariant(t *testing.T) {
	api := newTestAPI(t)
	api.addOwner(t, alisPhone)
	api.linkContact(t, 1001, alisPhone)
	signedIn := api.do(t, http.MethodPost, "/app/auth/telegram", telegramBody(1001))
	require.Equal(t, http.StatusOK, signedIn.Code)

	rec := api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(signedIn.Result().Cookies()[1]))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 2)
	assert.Equal(t, -1, cookies[0].MaxAge)
	assert.Equal(t, http.SameSiteLaxMode, cookies[0].SameSite)
	assert.Equal(t, http.SameSiteNoneMode, cookies[1].SameSite)
	assert.True(t, cookies[1].Partitioned)
}

func TestAnSMSSignInDropsTheMiniAppsCookieVariant(t *testing.T) {
	api := newTestAPI(t)
	api.addOwner(t, alisPhone)
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+alisPhone+`"}`).Code)

	rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"`+alisPhone+`","code":"`+api.sms.code(t, alisPhone)+`"}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	// A Mini App session in the same WebView left a partitioned cookie;
	// two cookies of one name would leave the server guessing.
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 2, rec.Result().Header["Set-Cookie"])
	assert.Equal(t, -1, cookies[0].MaxAge)
	assert.Equal(t, http.SameSiteNoneMode, cookies[0].SameSite)
	assert.True(t, cookies[0].Partitioned)
	assert.NotEmpty(t, cookies[1].Value)
	assert.Equal(t, http.SameSiteLaxMode, cookies[1].SameSite)
	assert.False(t, cookies[1].Partitioned)
}

func TestLogoutAndAnEndedSessionDropBothCookieVariants(t *testing.T) {
	api := newTestAPI(t)

	for _, path := range []string{"/app/auth/logout", "/app/auth/refresh"} {
		cookies := api.do(t, http.MethodPost, path, "").Result().Cookies()

		require.Len(t, cookies, 2, path)
		for _, c := range cookies {
			assert.Equal(t, -1, c.MaxAge, path)
		}
		assert.Equal(t, http.SameSiteLaxMode, cookies[0].SameSite, path)
		assert.Equal(t, http.SameSiteNoneMode, cookies[1].SameSite, path)
		assert.True(t, cookies[1].Partitioned, path)
	}
}

// Over plain http (start.sh) SameSite=None cannot be set: a Mini App session
// gets the one Lax cookie there.
func TestOverHTTPTheMiniAppGetsOneLaxCookie(t *testing.T) {
	api := newTestAPIWith(t, false)
	api.addOwner(t, alisPhone)
	api.linkContact(t, 1001, alisPhone)

	rec := api.do(t, http.MethodPost, "/app/auth/telegram", telegramBody(1001))

	require.Equal(t, http.StatusOK, rec.Code)
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	assert.Equal(t, http.SameSiteLaxMode, cookies[0].SameSite)
	assert.False(t, cookies[0].Secure)
	assert.Len(t, api.do(t, http.MethodPost, "/app/auth/logout", "").Result().Cookies(), 1)
}
