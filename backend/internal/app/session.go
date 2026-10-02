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
//
// A Mini App session's cookie must live inside Telegram Web's iframe:
// SameSite=None and Partitioned (CHIPS), which needs Secure; any other
// session's is Lax. Over https the other variant is dropped first: one
// WebView may hold both, and a browser without CHIPS, which takes both lines
// for one cookie, still ends with the new value.
func (h *Handler) signedIn(w http.ResponseWriter, t auth.Tokens) {
	cookie := &http.Cookie{
		Name:     refreshCookie,
		Value:    t.RefreshToken,
		Path:     "/",
		Expires:  t.RefreshExpiresAt,
		MaxAge:   int(time.Until(t.RefreshExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
	if h.cookieSecure {
		miniApp := t.Source == "telegram"
		http.SetCookie(w, refreshCookieVariant(!miniApp, ""))
		cookie = refreshCookieVariant(miniApp, t.RefreshToken)
		cookie.Expires = t.RefreshExpiresAt
		cookie.MaxAge = int(time.Until(t.RefreshExpiresAt).Seconds())
	}
	http.SetCookie(w, cookie)
	httpx.JSON(w, http.StatusOK, tokensJSON{
		AccessToken: t.AccessToken,
		ExpiresIn:   int(auth.AccessTokenTTL.Seconds()),
		CompanyID:   t.CompanyID,
	})
}

// refreshCookieVariant is the secure refresh cookie of a Mini App session
// (SameSite=None, Partitioned) or of any other (Lax); an empty value drops it.
func refreshCookieVariant(miniApp bool, value string) *http.Cookie {
	c := &http.Cookie{Name: refreshCookie, Value: value, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode}
	if miniApp {
		c.SameSite = http.SameSiteNoneMode
		c.Partitioned = true
	}
	if value == "" {
		c.MaxAge = -1
	}
	return c
}

// sessionEnded answers a refresh token that is missing or no longer live:
// the cookie is dropped and the app signs in again.
func (h *Handler) sessionEnded(w http.ResponseWriter) {
	h.clearRefreshCookie(w)
	httpx.Error(w, http.StatusUnauthorized, "invalid_refresh_token", "Sessiya tugagan. Qayta kiring")
}

// clearRefreshCookie drops the refresh cookie; over https both variants,
// since either may be the one the browser holds.
func (h *Handler) clearRefreshCookie(w http.ResponseWriter) {
	if h.cookieSecure {
		http.SetCookie(w, refreshCookieVariant(false, ""))
		http.SetCookie(w, refreshCookieVariant(true, ""))
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
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

// requireSubscription answers 402 when the access token's company has
// expired or been blocked. A token before the choice of a company passes,
// and /app/auth/* is outside it, so the user can switch to another company.
func (h *Handler) requireSubscription(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if companyID := currentUser(r.Context()).CompanyID; companyID != nil {
			active, err := h.profiles.SubscriptionActive(r.Context(), *companyID)
			if err != nil {
				httpx.InternalError(w, r, err)
				return
			}
			if !active {
				httpx.Error(w, http.StatusPaymentRequired, "subscription_expired", "Kompaniya obunasi tugagan")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
