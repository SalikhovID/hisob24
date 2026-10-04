// Package app serves the /app API of the user app.
package app

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// Services is what the /app API runs on.
type Services struct {
	Auth      *auth.UserAuth
	Profiles  *user.Profiles
	Companies *company.Service
	Customers *customer.Service
}

// Handler serves /app.
type Handler struct {
	auth          *auth.UserAuth
	profiles      *user.Profiles
	companies     *company.Service
	customers     *customer.Service
	cookieSecure  bool
	sendLimiter   *httpx.RateLimiter
	verifyLimiter *httpx.RateLimiter
}

// NewHandler wires the /app API. The limiters cap code requests and code
// attempts per IP.
func NewHandler(s Services, cookieSecure bool, sendLimiter, verifyLimiter *httpx.RateLimiter) *Handler {
	return &Handler{
		auth: s.Auth, profiles: s.Profiles, companies: s.Companies, customers: s.Customers,
		cookieSecure: cookieSecure, sendLimiter: sendLimiter, verifyLimiter: verifyLimiter,
	}
}

// Routes mounts /app.
func (h *Handler) Routes(r chi.Router) {
	r.Route("/app", func(r chi.Router) {
		r.With(httpx.RateLimit(h.sendLimiter)).Post("/auth/sms/send", h.sendCode)
		r.With(httpx.RateLimit(h.verifyLimiter)).Post("/auth/sms/verify", h.verify)
		r.Post("/auth/telegram", h.telegramLogin)
		r.Post("/auth/refresh", h.refresh)
		r.Post("/auth/logout", h.logout)
		r.With(h.requireUser).Post("/auth/switch-company", h.switchCompany)
		r.Group(func(r chi.Router) {
			r.Use(h.requireUser, h.requireAccess)
			r.Get("/me", h.me)
			r.Group(func(r chi.Router) {
				r.Use(h.requireOwner)
				r.Get("/employees", h.listEmployees)
				r.Post("/employees", h.addEmployee)
				r.Patch("/employees/{phone}", h.renameEmployee)
				r.Delete("/employees/{phone}", h.removeEmployee)
				r.Post("/customer-dropdowns", h.createCustomerDropdown)
				r.Patch("/customer-dropdowns/{id}", h.renameCustomerDropdown)
				r.Delete("/customer-dropdowns/{id}", h.deleteCustomerDropdown)
				r.Post("/customer-dropdowns/{id}/options", h.addCustomerDropdownOption)
				r.Patch("/customer-dropdowns/{id}/options/{optionId}", h.updateCustomerDropdownOption)
				r.Delete("/customer-dropdowns/{id}/options/{optionId}", h.deleteCustomerDropdownOption)
				r.Put("/customer-dropdowns/{id}/options/order", h.orderCustomerDropdownOptions)
				r.Post("/customer-types", h.createCustomerType)
				r.Put("/customer-types/order", h.orderCustomerTypes)
				r.Patch("/customer-types/{id}", h.renameCustomerType)
				r.Delete("/customer-types/{id}", h.deleteCustomerType)
				r.Post("/customer-types/{id}/fields", h.addCustomerField)
				r.Patch("/customer-types/{id}/fields/{fieldId}", h.updateCustomerField)
				r.Delete("/customer-types/{id}/fields/{fieldId}", h.deleteCustomerField)
				r.Put("/customer-types/{id}/fields/order", h.orderCustomerFields)
			})
			// The customers and what they are set up with are for every
			// member of the company the session works in; changing the
			// setup is the owner's.
			r.Group(func(r chi.Router) {
				r.Use(h.requireCompany)
				r.Get("/customer-dropdowns", h.listCustomerDropdowns)
				r.Get("/customer-types", h.listCustomerTypes)
				r.Get("/customers", h.listCustomers)
				r.Post("/customers", h.createCustomer)
				r.Get("/customers/{id}", h.getCustomer)
				r.Put("/customers/{id}", h.updateCustomer)
				r.Delete("/customers/{id}", h.deleteCustomer)
			})
		})
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

// telegramLogin signs in the user who opened the Mini App, with no code: the
// user bot signed initData, and the account shared a user's phone with it.
func (h *Handler) telegramLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		InitData string `json:"initData"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	tokens, err := h.auth.LoginWithTelegram(r.Context(), body.InitData)
	var noAccess auth.NoAccessError
	switch {
	case errors.Is(err, auth.ErrInvalidInitData):
		httpx.Error(w, http.StatusUnauthorized, "invalid_init_data", "Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching")
	case errors.Is(err, auth.ErrPhoneNotShared):
		httpx.Error(w, http.StatusForbidden, "phone_not_shared", "Telefon raqamingiz botga ulanmagan")
	case errors.As(err, &noAccess):
		httpx.Error(w, http.StatusForbidden, "no_access",
			"Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: "+user.FormatPhone(noAccess.Phone)+". Kompaniyangiz administratoriga murojaat qiling.")
	case err != nil:
		httpx.WriteError(w, r, err)
	default:
		h.signedIn(w, tokens)
	}
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(refreshCookie)
	if err != nil {
		h.sessionEnded(w)
		return
	}
	tokens, err := h.auth.Refresh(r.Context(), c.Value)
	if errors.Is(err, auth.ErrInvalidRefresh) {
		h.sessionEnded(w)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	h.signedIn(w, tokens)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookie); err == nil {
		if err := h.auth.Logout(r.Context(), c.Value); err != nil {
			httpx.InternalError(w, r, err)
			return
		}
	}
	h.clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

type userJSON struct {
	Phone    string  `json:"phone"`
	FullName *string `json:"full_name"`
}

type companyJSON struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	EndDate  string `json:"end_date"`
	DaysLeft int    `json:"days_left"`
	IsActive bool   `json:"is_active"`
}

type meJSON struct {
	User userJSON `json:"user"`
	// Company is the one the access token is for, null before a choice.
	Company   *companyJSON  `json:"company"`
	Companies []companyJSON `json:"companies"`
}

// me is the signed-in user, the company they work in now and all of theirs.
// The user's name is the one they go by in that company; before a choice of
// company, or when the membership has no name, it is the user's own.
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	claims := currentUser(r.Context())
	profile, err := h.profiles.Get(r.Context(), claims.Phone)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	body := meJSON{User: userJSON{Phone: profile.Phone, FullName: profile.FullName}, Companies: []companyJSON{}}
	for _, m := range profile.Companies {
		c := companyJSON{
			ID: m.CompanyID, Name: m.Name, Role: m.Role,
			EndDate: m.EndDate.Format(time.DateOnly), DaysLeft: m.DaysLeft, IsActive: m.IsActive,
		}
		body.Companies = append(body.Companies, c)
		if claims.CompanyID != nil && *claims.CompanyID == m.CompanyID {
			body.Company = &c
			// Each company names its own members: in the company they
			// work in the user goes by that name.
			if m.FullName != nil {
				body.User.FullName = m.FullName
			}
		}
	}
	httpx.JSON(w, http.StatusOK, body)
}

// switchCompany chooses one of the user's companies. It is not behind the
// 402 check: the way out of an expired company is choosing another.
func (h *Handler) switchCompany(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CompanyID *int64 `json:"company_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := r.Cookie(refreshCookie)
	if err != nil {
		h.sessionEnded(w)
		return
	}
	tokens, err := h.auth.SwitchCompany(r.Context(), currentUser(r.Context()).Phone, c.Value, body.CompanyID)
	switch {
	case errors.Is(err, auth.ErrNotMember):
		httpx.Error(w, http.StatusForbidden, "not_member", "Siz bu kompaniyaga a'zo emassiz")
	case errors.Is(err, auth.ErrInvalidRefresh):
		h.sessionEnded(w)
	case err != nil:
		httpx.WriteError(w, r, err)
	default:
		h.signedIn(w, tokens)
	}
}
