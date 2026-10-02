package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/admin"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// The spec: admin and user tokens never stand in for each other.
func TestAdminAndUserTokensDoNotCross(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	box := &smsBox{last: map[string]string{}}
	adminAuth := auth.NewAdminAuth(pool, testOTPSecret, "123456:test-bot-token")
	adminAPI := admin.NewHandler(admin.Services{Auth: adminAuth}, true, httpx.NewRateLimiter(5, time.Minute))
	appAPI := NewHandler(
		Services{Auth: auth.NewUserAuth(pool, testOTPSecret, testJWTSecret, box), Profiles: user.NewProfiles(pool)},
		true, httpx.NewRateLimiter(5, time.Minute), httpx.NewRateLimiter(5, time.Minute),
	)
	api := testAPI{router: httpx.NewRouter(adminAPI.Routes, appAPI.Routes), pool: pool, sms: box}

	issued, err := adminAuth.IssueLoginCode(t.Context(), 461603558)
	require.NoError(t, err)
	login := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+issued.Code+`"}`)
	require.Equal(t, http.StatusOK, login.Code, login.Body.String())
	adminSession := sessionCookie(t, login)
	access, _ := api.signIn(t, alisPhone, nil)

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/me", "", cookie(adminSession)).Code,
		"the admin session cookie opens no user app endpoint")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/admin/me", "", bearer(access)).Code,
		"the user's access token opens no admin endpoint")
}

func sessionCookie(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			return c
		}
	}
	t.Fatal("no admin_session cookie")
	return nil
}
