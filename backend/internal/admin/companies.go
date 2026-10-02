package admin

import (
	"net/http"
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
