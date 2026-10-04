package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type customerJSON struct {
	ID     int64  `json:"id"`
	TypeID int64  `json:"type_id"`
	Phone  string `json:"phone"`
	// Values are the answers by the id of the field: a text, a whole
	// number, the id of an option, or the ids of several.
	Values        customer.Values `json:"values"`
	CreatedByName *string         `json:"created_by_name"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

func toCustomerJSON(c customer.Customer) customerJSON {
	return customerJSON{
		ID: c.ID, TypeID: c.TypeID, Phone: c.Phone, Values: c.Values,
		CreatedByName: c.CreatedByName, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	}
}

// takenJSON is the API error format with the customer who has the phone or
// the answer already: the form leads to them.
type takenJSON struct {
	Error      string `json:"error"`
	Message    string `json:"message"`
	CustomerID int64  `json:"customer_id"`
}

// writeCustomerError answers a refusal to save a customer; one that is about
// another customer names them.
func writeCustomerError(w http.ResponseWriter, r *http.Request, err error) {
	var taken *customer.TakenError
	if errors.As(err, &taken) {
		httpx.JSON(w, http.StatusConflict, takenJSON{
			Error: taken.Refusal.Code, Message: taken.Refusal.Message, CustomerID: taken.CustomerID,
		})
		return
	}
	httpx.WriteError(w, r, err)
}

// createCustomer enters a customer into the company the session works in,
// as the member the session is of.
func (h *Handler) createCustomer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TypeID int64                      `json:"type_id"`
		Phone  string                     `json:"phone"`
		Values map[string]json.RawMessage `json:"values"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.customers.Create(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, body.TypeID,
		customer.Input{Phone: body.Phone, Values: body.Values})
	if err != nil {
		writeCustomerError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCustomerJSON(c))
}

// getCustomer is a customer of the company the session works in.
func (h *Handler) getCustomer(w http.ResponseWriter, r *http.Request) {
	c, err := h.customers.Get(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCustomerJSON(c))
}

type customerPageJSON struct {
	Items    []customerJSON `json:"items"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
}

// listCustomers is a page of the customers of the company the session
// works in, the newest first: ?search= looks in the phones and in the text
// and number answers, ?type_id= keeps one type, ?page= starts at 1.
func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	in := customer.ListInput{Search: query.Get("search"), Page: 1}
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		in.Page = n
	}
	if raw := query.Get("type_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Mijoz turi noto'g'ri")
			return
		}
		in.TypeID = id
	}
	page, err := h.customers.List(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]customerJSON, 0, len(page.Items))
	for _, c := range page.Items {
		items = append(items, toCustomerJSON(c))
	}
	httpx.JSON(w, http.StatusOK, customerPageJSON{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize})
}

// updateCustomer saves a customer of the company the session works in with
// another phone and other answers, as the member the session is of.
func (h *Handler) updateCustomer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone  string                     `json:"phone"`
		Values map[string]json.RawMessage `json:"values"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.customers.Update(r.Context(), sessionCompany(r), pathID(r, "id"), currentUser(r.Context()).Phone,
		customer.Input{Phone: body.Phone, Values: body.Values})
	if err != nil {
		writeCustomerError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCustomerJSON(c))
}

// deleteCustomer hides a customer of the company the session works in, as
// the member the session is of.
func (h *Handler) deleteCustomer(w http.ResponseWriter, r *http.Request) {
	err := h.customers.Delete(r.Context(), sessionCompany(r), pathID(r, "id"), currentUser(r.Context()).Phone)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type changeJSON struct {
	Label string `json:"label"`
	Old   string `json:"old"`
	New   string `json:"new"`
}

type historyEntryJSON struct {
	ID        int64        `json:"id"`
	Action    string       `json:"action"`
	ActorName *string      `json:"actor_name"`
	CreatedAt time.Time    `json:"created_at"`
	Changes   []changeJSON `json:"changes"`
}

// customerHistory is what happened to a customer of the owner's company,
// the latest first.
func (h *Handler) customerHistory(w http.ResponseWriter, r *http.Request) {
	history, err := h.customers.History(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]historyEntryJSON, 0, len(history))
	for _, e := range history {
		changes := make([]changeJSON, 0, len(e.Changes))
		for _, c := range e.Changes {
			changes = append(changes, changeJSON{Label: c.Label, Old: c.Old, New: c.New})
		}
		body = append(body, historyEntryJSON{ID: e.ID, Action: e.Action, ActorName: e.ActorName, CreatedAt: e.CreatedAt, Changes: changes})
	}
	httpx.JSON(w, http.StatusOK, body)
}
