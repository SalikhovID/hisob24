package admin

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/billing"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

func (h *Handler) createBilling(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		Days   int    `json:"days"`
		Amount string `json:"amount"`
		Note   string `json:"note"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	b, err := h.billing.Extend(r.Context(), id, billing.ExtendInput{Days: body.Days, Amount: body.Amount, Note: body.Note},
		currentAdmin(r.Context()).TelegramID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toBillingJSON(b))
}
