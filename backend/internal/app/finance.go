package app

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/finance"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// accountJSON is an account of the company as the user app lists it: where
// a payment may go (logic/finance.md, section 3).
type accountJSON struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	CurrencyID int64  `json:"currency_id"`
	IsActive   bool   `json:"is_active"`
}

func toAccountsJSON(list []finance.Account) []accountJSON {
	out := make([]accountJSON, 0, len(list))
	for _, a := range list {
		out = append(out, accountJSON{ID: a.ID, Name: a.Name, CurrencyID: a.CurrencyID, IsActive: a.Active})
	}
	return out
}

// categoryJSON is a category of the company's expenses or its other
// income (logic/finance.md, section 6).
type categoryJSON struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	IsActive bool   `json:"is_active"`
}

func toCategoryJSON(c finance.Category) categoryJSON {
	return categoryJSON{ID: c.ID, Name: c.Name, Kind: c.Kind, IsActive: c.Active}
}

// listFinanceCategories is the company's categories (?kind=expense or
// income; every kind without it), in their order: what the expense and
// income forms are built from, so every member reads them.
func (h *Handler) listFinanceCategories(w http.ResponseWriter, r *http.Request) {
	list, err := h.finance.Categories(r.Context(), sessionCompany(r), r.URL.Query().Get("kind"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out := make([]categoryJSON, 0, len(list))
	for _, c := range list {
		out = append(out, toCategoryJSON(c))
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) createFinanceCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Kind string `json:"kind"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.finance.CreateCategory(r.Context(), sessionCompany(r), finance.CategoryInput{Name: body.Name, Kind: body.Kind})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCategoryJSON(c))
}

// updateFinanceCategory renames a category, turns it off or on.
func (h *Handler) updateFinanceCategory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	var body struct {
		Name     *string `json:"name"`
		IsActive *bool   `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.finance.UpdateCategory(r.Context(), sessionCompany(r), id, finance.CategoryPatch{Name: body.Name, Active: body.IsActive})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCategoryJSON(c))
}

func (h *Handler) deleteFinanceCategory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r, "id")
	if err := h.finance.DeleteCategory(r.Context(), sessionCompany(r), id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderFinanceCategories puts the categories of a kind in the order given.
func (h *Handler) orderFinanceCategories(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Kind string  `json:"kind"`
		IDs  []int64 `json:"ids"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.finance.OrderCategories(r.Context(), sessionCompany(r), body.Kind, body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
