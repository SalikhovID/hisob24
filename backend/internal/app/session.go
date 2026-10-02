package app

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// refreshCookie carries the refresh token; the access token travels in the
// body and lives only in the app's memory.
const refreshCookie = "refresh_token"

type tokensJSON struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	// CompanyID is null until the user chooses one of several companies.
	CompanyID *int64 `json:"company_id"`
}

// signedIn answers a sign-in, refresh or switch: the access token in the
// body, the refresh token in an httpOnly cookie.
func (h *Handler) signedIn(w http.ResponseWriter, t auth.Tokens) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    t.RefreshToken,
		Path:     "/",
		Expires:  t.RefreshExpiresAt,
		MaxAge:   int(time.Until(t.RefreshExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	httpx.JSON(w, http.StatusOK, tokensJSON{
		AccessToken: t.AccessToken,
		ExpiresIn:   int(auth.AccessTokenTTL.Seconds()),
		CompanyID:   t.CompanyID,
	})
}

// sessionEnded answers a refresh token that is missing or no longer live:
// the cookie is dropped and the app signs in again.
func (h *Handler) sessionEnded(w http.ResponseWriter) {
	h.clearRefreshCookie(w)
	httpx.Error(w, http.StatusUnauthorized, "invalid_refresh_token", "Sessiya tugagan. Qayta kiring")
}

func (h *Handler) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

type claimsKey struct{}

// requireUser lets a request through only with a valid access token
// (Authorization: Bearer) and puts its claims into the context. Admin
// sessions are cookies and never count here.
func (h *Handler) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			unauthorized(w)
			return
		}
		claims, err := h.auth.Authenticate(token)
		if err != nil {
			unauthorized(w)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey{}, claims)))
	})
}

// currentUser is the access token's claims requireUser let through.
func currentUser(ctx context.Context) auth.AccessClaims {
	claims, _ := ctx.Value(claimsKey{}).(auth.AccessClaims)
	return claims
}

func unauthorized(w http.ResponseWriter) {
	httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Avval tizimga kiring")
}
