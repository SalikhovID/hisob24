package app

import (
	"net/http"
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
