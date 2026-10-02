package admin

import (
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
)

// sessionCookie carries the admin session id; the admin panel's proxy.ts
// checks for it too.
const sessionCookie = "admin_session"

func setSessionCookie(w http.ResponseWriter, s auth.Session) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    s.ID.String(),
		Path:     "/",
		Expires:  s.ExpiresAt,
		MaxAge:   int(time.Until(s.ExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}
