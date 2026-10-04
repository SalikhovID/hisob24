package app

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type optionJSON struct {
	ID       int64  `json:"id"`
	Label    string `json:"label"`
	IsActive bool   `json:"is_active"`
}

type dropdownJSON struct {
	ID      int64        `json:"id"`
	Name    string       `json:"name"`
	Options []optionJSON `json:"options"`
}

func toOptionJSON(o customer.Option) optionJSON {
	return optionJSON{ID: o.ID, Label: o.Label, IsActive: o.Active}
}

func toDropdownJSON(d customer.Dropdown) dropdownJSON {
	options := make([]optionJSON, 0, len(d.Options))
	for _, o := range d.Options {
		options = append(options, toOptionJSON(o))
	}
	return dropdownJSON{ID: d.ID, Name: d.Name, Options: options}
}

// listCustomerDropdowns is the dropdowns of the company the session works
// in, each with its options: the forms and the lists of customers need them.
func (h *Handler) listCustomerDropdowns(w http.ResponseWriter, r *http.Request) {
	dropdowns, err := h.customers.Dropdowns(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]dropdownJSON, 0, len(dropdowns))
	for _, d := range dropdowns {
		body = append(body, toDropdownJSON(d))
	}
	httpx.JSON(w, http.StatusOK, body)
}

type fieldJSON struct {
	ID         int64  `json:"id"`
	Label      string `json:"label"`
	Kind       string `json:"kind"`
	Required   bool   `json:"required"`
	IsUnique   bool   `json:"is_unique"`
	DropdownID *int64 `json:"dropdown_id"`
}

type customerTypeJSON struct {
	ID     int64       `json:"id"`
	Name   string      `json:"name"`
	Fields []fieldJSON `json:"fields"`
}

func toFieldJSON(f customer.Field) fieldJSON {
	return fieldJSON{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, IsUnique: f.Unique, DropdownID: f.DropdownID}
}

func toCustomerTypeJSON(t customer.Type) customerTypeJSON {
	fields := make([]fieldJSON, 0, len(t.Fields))
	for _, f := range t.Fields {
		fields = append(fields, toFieldJSON(f))
	}
	return customerTypeJSON{ID: t.ID, Name: t.Name, Fields: fields}
}

// listCustomerTypes is the customer types of the company the session works
// in, each with its fields: what a customer's form asks, and in what order.
func (h *Handler) listCustomerTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.customers.Types(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]customerTypeJSON, 0, len(types))
	for _, t := range types {
		body = append(body, toCustomerTypeJSON(t))
	}
	httpx.JSON(w, http.StatusOK, body)
}
