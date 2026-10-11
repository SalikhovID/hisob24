package admin

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/finance"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// accountID reads {accountId}; anything but a positive number is a missing
// account.
func accountID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "accountId"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusNotFound, "not_found", "Akkaunt topilmadi")
		return 0, false
	}
	return id, true
}

// addAccount adds an account (cash, a bank account, a card) to the company
// (logic/finance.md, section 3).
func (h *Handler) addAccount(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	var body struct {
		Name       string `json:"name"`
		CurrencyID int64  `json:"currency_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	a, err := h.finance.AddAccount(r.Context(), id, currentAdmin(r.Context()).TelegramID, finance.AccountInput{Name: body.Name, CurrencyID: body.CurrencyID})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toBankAccountJSON(a))
}

// patchAccount changes an account's name, currency or active flag.
func (h *Handler) patchAccount(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	aid, ok := accountID(w, r)
	if !ok {
		return
	}
	var body struct {
		Name       *string `json:"name"`
		CurrencyID *int64  `json:"currency_id"`
		IsActive   *bool   `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	a, err := h.finance.UpdateAccount(r.Context(), id, aid, finance.AccountPatch{Name: body.Name, CurrencyID: body.CurrencyID, Active: body.IsActive})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toBankAccountJSON(a))
}

// deleteAccount hides an account of the company: not the last active one,
// nor one a document names.
func (h *Handler) deleteAccount(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	aid, ok := accountID(w, r)
	if !ok {
		return
	}
	if err := h.finance.DeleteAccount(r.Context(), id, aid); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
