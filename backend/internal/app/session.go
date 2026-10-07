package app

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/task"
	"github.com/SalikhovID/hisob24/backend/internal/user"
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

type accessKey struct{}

// requireAccess checks the access token's company against the database on
// every request, so a change counts at once, not when the token expires:
//   - the user is no longer its member: 401 unauthorized, and the app
//     refreshes the session, which drops the company or ends;
//   - the company has expired or been blocked: 402;
//   - otherwise their standing there as it is now, the role and the
//     permissions (logic/roles.md, section 7), goes into the context.
//
// A token before the choice of a company passes with no standing, and
// /app/auth/* is outside it, so the user can switch to another company.
func (h *Handler) requireAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := currentUser(r.Context())
		if claims.CompanyID == nil {
			next.ServeHTTP(w, r)
			return
		}
		standing, err := h.profiles.Access(r.Context(), claims.Phone, *claims.CompanyID)
		switch {
		case errors.Is(err, user.ErrNotMember):
			unauthorized(w)
		case err != nil:
			httpx.InternalError(w, r, err)
		case !standing.Active:
			httpx.Error(w, http.StatusPaymentRequired, "subscription_expired", "Kompaniya obunasi tugagan")
		default:
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), accessKey{}, standing)))
		}
	})
}

// currentAccess is the member's standing in the access token's company as
// requireAccess read it from the database: the token's own role claim may be
// minutes old. Empty before a company is chosen.
func currentAccess(ctx context.Context) user.Access {
	standing, _ := ctx.Value(accessKey{}).(user.Access)
	return standing
}

// currentPermissions is what the member may do in the company: the owner
// everything, an employee what their role, or the default, allows.
func currentPermissions(ctx context.Context) access.Set {
	return currentAccess(ctx).Permissions
}

// taskScope is where the request's member works, for the tasks: the
// session's company and the locations of it the member may work in, as
// requireAccess read them (logic/locations.md).
func taskScope(r *http.Request) task.Scope {
	return task.Scope{CompanyID: sessionCompany(r), LocationIDs: currentAccess(r.Context()).LocationIDs}
}

// catalogScope is the request's member's reach in the company for the
// catalog: the stock they see is their locations'.
func catalogScope(r *http.Request) catalog.Scope {
	return catalog.Scope{CompanyID: sessionCompany(r), LocationIDs: currentAccess(r.Context()).LocationIDs}
}

// allowedLocation tells whether the request's member may work in the
// location: whether it is one of their scope's.
func allowedLocation(r *http.Request, locationID int64) bool {
	for _, id := range currentAccess(r.Context()).LocationIDs {
		if id == locationID {
			return true
		}
	}
	return false
}

// forbidden answers a request for something the member may not do.
func forbidden(w http.ResponseWriter) {
	httpx.Error(w, http.StatusForbidden, "forbidden", "Bu amal uchun ruxsatingiz yo'q")
}

// requirePermission lets through only a member whose permissions in the
// company, as requireAccess read them, hold p; anyone else gets 403.
// requireCompany has run before it, so there is a company.
func (h *Handler) requirePermission(p access.Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !currentPermissions(r.Context()).Has(p) {
				forbidden(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// requireOwner lets through only the owner of the company the session works
// in: the roles are theirs alone to manage. A user of the company, and a
// session with no company chosen, get 403.
func (h *Handler) requireOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if currentAccess(r.Context()).Role != "owner" {
			httpx.Error(w, http.StatusForbidden, "owner_only", "Bu bo'lim faqat kompaniya egasi uchun")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireCompany lets through only a session that works in a company: one
// that has not chosen yet (a user of several, right after signing in) gets
// 403. requireAccess has checked the company the token names.
func (h *Handler) requireCompany(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if currentUser(r.Context()).CompanyID == nil {
			httpx.Error(w, http.StatusForbidden, "company_required", "Avval kompaniyani tanlang")
			return
		}
		next.ServeHTTP(w, r)
	})
}
