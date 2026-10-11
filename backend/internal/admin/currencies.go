package admin

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// listCurrencies is the catalog: every currency a company may turn on.
func (h *Handler) listCurrencies(w http.ResponseWriter, r *http.Request) {
	list, err := h.currencies.Catalog(r.Context())
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCurrenciesJSON(list))
}

// setCompanyCurrencies turns on the currencies named and off the rest; the
// so'm is always on (logic/currencies.md, section 3).
func (h *Handler) setCompanyCurrencies(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		CurrencyIDs []int64 `json:"currency_ids"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	list, err := h.currencies.SetOfCompany(r.Context(), id, body.CurrencyIDs, currentAdmin(r.Context()).TelegramID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCompanyCurrenciesJSON(list))
}
