package admin

import (
	"net/http"
	"strconv"
	"time"

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
