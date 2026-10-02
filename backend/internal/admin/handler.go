// Package admin serves the /admin API of the platform admin panel.
package admin

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/billing"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// Handler serves /admin.
type Handler struct {
	auth         *auth.AdminAuth
	companies    *company.Service
	cookieSecure bool
	otpLimiter   *httpx.RateLimiter
}

// Services is what the /admin API runs on.
type Services struct {
	Auth      *auth.AdminAuth
	Companies *company.Service
	Billing   *billing.Service
}

// NewHandler wires the /admin API. otpLimiter caps code attempts per IP.
func NewHandler(s Services, cookieSecure bool, otpLimiter *httpx.RateLimiter) *Handler {
	return &Handler{auth: s.Auth, companies: s.Companies, cookieSecure: cookieSecure, otpLimiter: otpLimiter}
}

// Routes mounts /admin.
func (h *Handler) Routes(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.With(httpx.RateLimit(h.otpLimiter)).Post("/auth/otp", h.loginWithCode)
		r.Post("/auth/telegram", h.loginWithInitData)
		r.Post("/auth/logout", h.logout)
		r.Group(func(r chi.Router) {
			r.Use(h.requireSession)
			r.Get("/me", h.me)
			r.Post("/companies", h.createCompany)
		})
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
	if errors.Is(err, auth.ErrInvalidCode) {
		httpx.Error(w, http.StatusUnauthorized, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")
		return
	}
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	h.setSessionCookie(w, s)
	httpx.JSON(w, http.StatusOK, toAdminJSON(s.Admin))
}

func (h *Handler) loginWithInitData(w http.ResponseWriter, r *http.Request) {
	var body struct {
		InitData string `json:"initData"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.auth.LoginWithInitData(r.Context(), body.InitData)
	switch {
	case errors.Is(err, auth.ErrInvalidInitData):
		httpx.Error(w, http.StatusUnauthorized, "invalid_init_data", "Telegram ma'lumotlari tasdiqlanmadi")
		return
	case errors.Is(err, auth.ErrNotAdmin):
		httpx.Error(w, http.StatusForbidden, "not_admin", "Sizda ruxsat yo'q")
		return
	case err != nil:
		httpx.InternalError(w, r, err)
		return
	}
	h.setSessionCookie(w, s)
	httpx.JSON(w, http.StatusOK, toAdminJSON(s.Admin))
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if err := h.auth.Logout(r.Context(), c.Value); err != nil {
			httpx.InternalError(w, r, err)
			return
		}
	}
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, toAdminJSON(currentAdmin(r.Context())))
}
