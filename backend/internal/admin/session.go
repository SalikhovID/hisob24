package admin

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// sessionCookie carries the admin session id; the admin panel's proxy.ts
// checks for it too.
const sessionCookie = "admin_session"

type adminKey struct{}

// requireSession lets a request through only with a live admin session and
// puts the admin into its context.
func (h *Handler) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			unauthorized(w)
			return
		}
		admin, err := h.auth.Authenticate(r.Context(), c.Value)
		if errors.Is(err, auth.ErrUnauthenticated) {
			unauthorized(w)
			return
		}
		if err != nil {
			httpx.InternalError(w, r, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminKey{}, admin)))
	})
}

// currentAdmin is the admin requireSession let through.
func currentAdmin(ctx context.Context) gen.Admin {
	admin, _ := ctx.Value(adminKey{}).(gen.Admin)
	return admin
}

func unauthorized(w http.ResponseWriter) {
	httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Avval tizimga kiring")
}

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

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}
