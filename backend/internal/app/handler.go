// Package app serves the /app API of the user app.
package app

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/task"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// Services is what the /app API runs on.
type Services struct {
	Auth      *auth.UserAuth
	Profiles  *user.Profiles
	Companies *company.Service
	Customers *customer.Service
	Tasks     *task.Service
	Catalog   *catalog.Service
}

// Handler serves /app.
type Handler struct {
	auth          *auth.UserAuth
	profiles      *user.Profiles
	companies     *company.Service
	customers     *customer.Service
	tasks         *task.Service
	catalog       *catalog.Service
	cookieSecure  bool
	sendLimiter   *httpx.RateLimiter
	verifyLimiter *httpx.RateLimiter
}

// NewHandler wires the /app API. The limiters cap code requests and code
// attempts per IP.
func NewHandler(s Services, cookieSecure bool, sendLimiter, verifyLimiter *httpx.RateLimiter) *Handler {
	return &Handler{
		auth: s.Auth, profiles: s.Profiles, companies: s.Companies, customers: s.Customers, tasks: s.Tasks, catalog: s.Catalog,
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
			// The roles are the owner's alone to make and to give
			// (logic/roles.md, section 5).
			r.Group(func(r chi.Router) {
				r.Use(h.requireOwner)
				r.Get("/roles", h.listRoles)
				r.Post("/roles", h.createRole)
				r.Put("/roles/{id}", h.updateRole)
				r.Delete("/roles/{id}", h.deleteRole)
				r.Put("/employees/{phone}/role", h.setEmployeeRole)
				// So is an employee's restriction to some locations
				// (logic/locations.md, section 5).
				r.Put("/employees/{phone}/locations", h.setEmployeeLocations)
			})
			// Everything else is done inside a company, by what the member
			// may do there (logic/roles.md, section 4).
			r.Group(func(r chi.Router) {
				r.Use(h.requireCompany)
				// The member's own order of the menu (logic/roles.md, section 8).
				r.Put("/me/nav", h.setNavOrder)
				// What every member reads: the lists the forms are built from.
				r.Get("/members", h.listMembers)
				r.Get("/customer-dropdowns", h.listCustomerDropdowns)
				r.Get("/customer-types", h.listCustomerTypes)
				r.Get("/task-stages", h.listTaskStages)
				r.Get("/task-types", h.listTaskTypes)

				allowed := func(p access.Permission) chi.Router { return r.With(h.requirePermission(p)) }

				allowed(access.EmployeesView).Get("/employees", h.listEmployees)
				allowed(access.EmployeesCreate).Post("/employees", h.addEmployee)
				allowed(access.EmployeesEdit).Patch("/employees/{phone}", h.renameEmployee)
				allowed(access.EmployeesDelete).Delete("/employees/{phone}", h.removeEmployee)

				// The settings: what the customers and the tasks are asked,
				// and the stages the tasks go through.
				r.Group(func(r chi.Router) {
					r.Use(h.requirePermission(access.SettingsCreate))
					r.Post("/customer-dropdowns", h.createCustomerDropdown)
					r.Post("/customer-dropdowns/{id}/options", h.addCustomerDropdownOption)
					r.Post("/customer-types", h.createCustomerType)
					r.Post("/customer-types/{id}/fields", h.addCustomerField)
					r.Post("/task-stages", h.createTaskStage)
					r.Post("/task-types", h.createTaskType)
					r.Post("/task-types/{id}/fields", h.addTaskField)
				})
				r.Group(func(r chi.Router) {
					r.Use(h.requirePermission(access.SettingsEdit))
					r.Patch("/customer-dropdowns/{id}", h.renameCustomerDropdown)
					r.Patch("/customer-dropdowns/{id}/options/{optionId}", h.updateCustomerDropdownOption)
					r.Put("/customer-dropdowns/{id}/options/order", h.orderCustomerDropdownOptions)
					r.Put("/customer-types/order", h.orderCustomerTypes)
					r.Patch("/customer-types/{id}", h.renameCustomerType)
					r.Patch("/customer-types/{id}/fields/{fieldId}", h.updateCustomerField)
					r.Put("/customer-types/{id}/fields/order", h.orderCustomerFields)
					r.Put("/task-stages/order", h.orderTaskStages)
					r.Patch("/task-stages/{id}", h.updateTaskStage)
					r.Put("/task-types/order", h.orderTaskTypes)
					r.Patch("/task-types/{id}", h.renameTaskType)
					r.Patch("/task-types/{id}/fields/{fieldId}", h.updateTaskField)
					r.Put("/task-types/{id}/fields/order", h.orderTaskFields)
				})
				r.Group(func(r chi.Router) {
					r.Use(h.requirePermission(access.SettingsDelete))
					r.Delete("/customer-dropdowns/{id}", h.deleteCustomerDropdown)
					r.Delete("/customer-dropdowns/{id}/options/{optionId}", h.deleteCustomerDropdownOption)
					r.Delete("/customer-types/{id}", h.deleteCustomerType)
					r.Delete("/customer-types/{id}/fields/{fieldId}", h.deleteCustomerField)
					r.Delete("/task-stages/{id}", h.deleteTaskStage)
					r.Delete("/task-types/{id}", h.deleteTaskType)
					r.Delete("/task-types/{id}/fields/{fieldId}", h.deleteTaskField)
				})

				allowed(access.CustomersView).Get("/customers", h.listCustomers)
				allowed(access.CustomersCreate).Post("/customers", h.createCustomer)
				allowed(access.CustomersView).Get("/customers/{id}", h.getCustomer)
				allowed(access.CustomersEdit).Put("/customers/{id}", h.updateCustomer)
				allowed(access.CustomersDelete).Delete("/customers/{id}", h.deleteCustomer)
				allowed(access.CustomersHistory).Get("/customers/{id}/history", h.customerHistory)

				allowed(access.TasksView).Get("/tasks", h.listTasks)
				allowed(access.TasksCreate).Post("/tasks", h.createTask)
				allowed(access.TasksView).Get("/tasks/{id}", h.getTask)
				allowed(access.TasksEdit).Put("/tasks/{id}", h.updateTask)
				allowed(access.TasksDelete).Delete("/tasks/{id}", h.deleteTask)
				allowed(access.TasksEdit).Patch("/tasks/{id}/stage", h.moveTask)
				allowed(access.TasksHistory).Get("/tasks/{id}/history", h.taskHistory)

				// The catalog: the products the company buys into its stock
				// and the services it offers (logic/products.md).
				allowed(access.ProductsView).Get("/products", h.listProducts)
				allowed(access.ProductsCreate).Post("/products", h.createProduct)
				allowed(access.ProductsView).Get("/products/{id}", h.getProduct)
				allowed(access.ProductsEdit).Put("/products/{id}", h.updateProduct)
				allowed(access.ProductsEdit).Patch("/products/{id}", h.setProductActive)
				allowed(access.ProductsDelete).Delete("/products/{id}", h.deleteProduct)
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
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
	// RoleName is the company role the user holds there, null for the
	// owner and for a user without one.
	RoleName *string `json:"role_name"`
	EndDate  string  `json:"end_date"`
	DaysLeft int     `json:"days_left"`
	IsActive bool    `json:"is_active"`
}

type meJSON struct {
	User userJSON `json:"user"`
	// Company is the one the access token is for, null before a choice.
	Company   *companyJSON  `json:"company"`
	Companies []companyJSON `json:"companies"`
	// Permissions is what the user may do in that company, as it is now;
	// empty before a choice.
	Permissions []string `json:"permissions"`
	// Locations is the locations the user may work in there, as they are
	// now (logic/locations.md, section 4); empty before a choice.
	Locations []locationJSON `json:"locations"`
	// NavOrder is the user's own order of the menu there, by section key
	// (logic/roles.md, section 8); null for the default, and before a choice.
	NavOrder *[]string `json:"nav_order"`
}

// me is the signed-in user, the company they work in now, what they may do
// there, the locations they may work in, their order of the menu and all of
// their companies.
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	body, err := h.meBody(r.Context(), currentUser(r.Context()), currentAccess(r.Context()))
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, body)
}

// meBody is what /app/me answers: the user, the company the token is for,
// what they may do, the locations they may work in and their order of the
// menu there (from standing, as requireAccess read it, or as read anew after
// a change), and all of their companies. The user's name is the one they go
// by in that company; before a choice of company, or when the membership
// has no name, it is the user's own.
func (h *Handler) meBody(ctx context.Context, claims auth.AccessClaims, standing user.Access) (meJSON, error) {
	profile, err := h.profiles.Get(ctx, claims.Phone)
	if err != nil {
		return meJSON{}, err
	}
	body := meJSON{User: userJSON{Phone: profile.Phone, FullName: profile.FullName}, Companies: []companyJSON{}, Permissions: []string{}, Locations: []locationJSON{}}
	for _, p := range standing.Permissions.List() {
		body.Permissions = append(body.Permissions, string(p))
	}
	if claims.CompanyID != nil {
		locations, err := h.companies.MemberLocations(ctx, *claims.CompanyID, claims.Phone)
		if err != nil {
			return meJSON{}, err
		}
		body.Locations = toLocationsJSON(locations)
		if standing.NavOrder != nil {
			order := standing.NavOrder
			body.NavOrder = &order
		}
	}
	for _, m := range profile.Companies {
		c := companyJSON{
			ID: m.CompanyID, Name: m.Name, Role: m.Role, RoleName: m.RoleName,
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
	return body, nil
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
