// Package app serves the /app API of the user app.
package app

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// Services is what the /app API runs on.
type Services struct {
	Auth     *auth.UserAuth
	Profiles *user.Profiles
}

// Handler serves /app.
type Handler struct {
	auth          *auth.UserAuth
	profiles      *user.Profiles
	cookieSecure  bool
	sendLimiter   *httpx.RateLimiter
	verifyLimiter *httpx.RateLimiter
}

// NewHandler wires the /app API. The limiters cap code requests and code
// attempts per IP.
func NewHandler(s Services, cookieSecure bool, sendLimiter, verifyLimiter *httpx.RateLimiter) *Handler {
	return &Handler{auth: s.Auth, profiles: s.Profiles, cookieSecure: cookieSecure, sendLimiter: sendLimiter, verifyLimiter: verifyLimiter}
}

// Routes mounts /app.
func (h *Handler) Routes(r chi.Router) {
	r.Route("/app", func(r chi.Router) {
		r.With(httpx.RateLimit(h.sendLimiter)).Post("/auth/sms/send", h.sendCode)
		r.With(httpx.RateLimit(h.verifyLimiter)).Post("/auth/sms/verify", h.verify)
	})
}

// sendCode texts a login code. A phone that is not a user gets the same
// answer (and no SMS), so the answers tell nothing about who signs up.
func (h *Handler) sendCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	err := h.auth.SendCode(r.Context(), body.Phone)
	if errors.Is(err, auth.ErrTooSoon) {
		httpx.Error(w, http.StatusTooManyRequests, "too_many_requests", "Kodni qayta olish uchun bir daqiqa kuting")
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int{"retry_after": 60})
}

func (h *Handler) verify(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	tokens, err := h.auth.Verify(r.Context(), body.Phone, body.Code)
	if errors.Is(err, auth.ErrInvalidCode) {
		httpx.Error(w, http.StatusUnauthorized, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	h.signedIn(w, tokens)
}
