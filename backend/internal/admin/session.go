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

// setSessionCookie writes the session cookie. A Mini App session must also
// work inside Telegram Web, which opens the panel in a cross-site iframe:
// there the cookie is SameSite=None and Partitioned (CHIPS), so it lives in
// Telegram Web's own cookie jar. Over local http (cookieSecure off) it stays
// Lax: browsers drop SameSite=None without Secure, and Telegram opens only
// https Mini Apps anyway.
func (h *Handler) setSessionCookie(w http.ResponseWriter, s auth.Session, miniApp bool) {
	c := &http.Cookie{
		Name:     sessionCookie,
		Value:    s.ID.String(),
		Path:     "/",
		Expires:  s.ExpiresAt,
		MaxAge:   int(time.Until(s.ExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
	if miniApp && h.cookieSecure {
		c.SameSite = http.SameSiteNoneMode
		c.Partitioned = true
	}
	http.SetCookie(w, c)
}

// clearSessionCookie drops the browser login's cookie and, where it can
// exist, the Mini App's partitioned one: a partitioned cookie is removed
// only by a Set-Cookie that is partitioned too.
func (h *Handler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	if h.cookieSecure {
		http.SetCookie(w, &http.Cookie{
			Name:        sessionCookie,
			Value:       "",
			Path:        "/",
			MaxAge:      -1,
			HttpOnly:    true,
			Secure:      true,
			SameSite:    http.SameSiteNoneMode,
			Partitioned: true,
		})
	}
}
