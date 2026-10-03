package admin

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

func (h *Handler) createCompany(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string `json:"name"`
		EndDate       string `json:"end_date"`
		OwnerPhone    string `json:"owner_phone"`
		OwnerFullName string `json:"owner_full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	end, err := time.Parse(time.DateOnly, body.EndDate)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak")
		return
	}
	c, err := h.companies.Create(r.Context(), company.CreateInput{
		Name:          body.Name,
		EndDate:       end,
		OwnerPhone:    body.OwnerPhone,
		OwnerFullName: body.OwnerFullName,
	}, currentAdmin(r.Context()).TelegramID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCompanyJSON(c))
}

func (h *Handler) listCompanies(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := 1
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		page = n
	}
	res, err := h.companies.List(r.Context(), company.ListInput{Search: query.Get("search"), Status: query.Get("status"), Page: page})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]companyJSON, 0, len(res.Items))
	for _, c := range res.Items {
		items = append(items, toCompanyJSON(c))
	}
	httpx.JSON(w, http.StatusOK, pageJSON{Items: items, Total: res.Total, Page: res.Page, PageSize: res.PageSize})
}

// companyID reads {id}; anything but a positive number is a missing company.
func companyID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusNotFound, "not_found", "Kompaniya topilmadi")
		return 0, false
	}
	return id, true
}

func (h *Handler) getCompany(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	d, err := h.companies.Get(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	users := make([]memberJSON, 0, len(d.Users))
	for _, m := range d.Users {
		users = append(users, toMemberJSON(m))
	}
	httpx.JSON(w, http.StatusOK, detailJSON{companyJSON: toCompanyJSON(d.Company), Users: users})
}

func (h *Handler) patchCompany(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		Name     *string `json:"name"`
		IsActive *bool   `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.companies.Update(r.Context(), id, body.Name, body.IsActive)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCompanyJSON(c))
}

// replaceCompanyOwner makes the phone given the company's owner; the owner
// before stays in the company as a user.
func (h *Handler) replaceCompanyOwner(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		Phone    string `json:"phone"`
		FullName string `json:"full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	m, err := h.companies.ReplaceOwner(r.Context(), id, body.Phone, body.FullName)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMemberJSON(m))
}
