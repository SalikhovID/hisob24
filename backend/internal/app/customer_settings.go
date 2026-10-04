package app

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

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

// createCustomerDropdown adds an empty dropdown to the owner's company.
func (h *Handler) createCustomerDropdown(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.customers.CreateDropdown(r.Context(), sessionCompany(r), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toDropdownJSON(d))
}

// pathID is a numeric parameter of the path. What is no number is 0, the id
// of no record: the service then answers that there is no such record.
func pathID(r *http.Request, name string) int64 {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	if err != nil {
		return 0
	}
	return id
}

// renameCustomerDropdown gives a dropdown of the owner's company another
// name.
func (h *Handler) renameCustomerDropdown(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.customers.RenameDropdown(r.Context(), sessionCompany(r), pathID(r, "id"), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toDropdownJSON(d))
}

// deleteCustomerDropdown hides a dropdown of the owner's company; one that
// a field takes its options from is refused.
func (h *Handler) deleteCustomerDropdown(w http.ResponseWriter, r *http.Request) {
	if err := h.customers.DeleteDropdown(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// addCustomerDropdownOption adds an option at the end of a dropdown of the
// owner's company.
func (h *Handler) addCustomerDropdownOption(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label string `json:"label"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.customers.AddOption(r.Context(), sessionCompany(r), pathID(r, "id"), body.Label)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOptionJSON(o))
}

// updateCustomerDropdownOption renames an option of a dropdown of the
// owner's company, or turns it off or on; what the body leaves out stays.
func (h *Handler) updateCustomerDropdownOption(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label    *string `json:"label"`
		IsActive *bool   `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.customers.UpdateOption(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "optionId"),
		customer.OptionPatch{Label: body.Label, Active: body.IsActive})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOptionJSON(o))
}

// deleteCustomerDropdownOption hides an option of a dropdown of the owner's
// company.
func (h *Handler) deleteCustomerDropdownOption(w http.ResponseWriter, r *http.Request) {
	err := h.customers.DeleteOption(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "optionId"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderBody is a new order: the ids of every record of a list, each once.
type orderBody struct {
	IDs []int64 `json:"ids"`
}

// orderCustomerDropdownOptions puts the options of a dropdown of the owner's
// company in a new order.
func (h *Handler) orderCustomerDropdownOptions(w http.ResponseWriter, r *http.Request) {
	var body orderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.customers.OrderOptions(r.Context(), sessionCompany(r), pathID(r, "id"), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
