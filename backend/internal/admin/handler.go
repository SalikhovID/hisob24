// Package admin serves the /admin API of the platform admin panel.
package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// Handler serves /admin.
type Handler struct {
	auth         *auth.AdminAuth
	cookieSecure bool
	otpLimiter   *httpx.RateLimiter
}

// NewHandler wires the /admin API. otpLimiter caps code attempts per IP.
func NewHandler(a *auth.AdminAuth, cookieSecure bool, otpLimiter *httpx.RateLimiter) *Handler {
	return &Handler{auth: a, cookieSecure: cookieSecure, otpLimiter: otpLimiter}
}

// Routes mounts /admin.
func (h *Handler) Routes(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.Post("/auth/otp", h.loginWithCode)
	})
}

type adminJSON struct {
	TelegramID int64   `json:"telegram_id"`
	FullName   *string `json:"full_name"`
}

func toAdminJSON(a gen.Admin) adminJSON {
	return adminJSON{TelegramID: a.TelegramID, FullName: a.FullName}
}

func (h *Handler) loginWithCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.auth.LoginWithCode(r.Context(), body.Code)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	setSessionCookie(w, s)
	httpx.JSON(w, http.StatusOK, toAdminJSON(s.Admin))
}
