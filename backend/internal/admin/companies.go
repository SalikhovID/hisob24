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
	locations := make([]adminLocationJSON, 0, len(d.Locations))
	for _, l := range d.Locations {
		locations = append(locations, toAdminLocationJSON(l))
	}
	httpx.JSON(w, http.StatusOK, detailJSON{companyJSON: toCompanyJSON(d.Company), Users: users, Locations: locations})
}

// locationID reads {locationId}; anything but a positive number is a
// missing location.
func locationID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "locationId"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusNotFound, "not_found", "Lokatsiya topilmadi")
		return 0, false
	}
	return id, true
}

// addLocation adds a location to the company.
func (h *Handler) addLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	l, err := h.companies.AddLocation(r.Context(), id, body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toAdminLocationJSON(l))
}

// renameLocation renames a location of the company.
func (h *Handler) renameLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	lid, ok := locationID(w, r)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	l, err := h.companies.RenameLocation(r.Context(), id, lid, body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toAdminLocationJSON(l))
}

// deleteLocation hides a location of the company: neither its last one nor
// one a task stands in.
func (h *Handler) deleteLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	lid, ok := locationID(w, r)
	if !ok {
		return
	}
	if err := h.companies.DeleteLocation(r.Context(), id, lid); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
