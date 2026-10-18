package app

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/order"
)

type orderCustomerJSON struct {
	ID    int64   `json:"id"`
	Phone string  `json:"phone"`
	Name  *string `json:"name"`
}

type orderAssigneeJSON struct {
	Phone    string  `json:"phone"`
	FullName *string `json:"full_name"`
}

type orderJSON struct {
	ID      int64 `json:"id"`
	TypeID  int64 `json:"type_id"`
	StageID int64 `json:"stage_id"`
	// LocationID is the location the order stands in, for good.
	LocationID int64  `json:"location_id"`
	Title      string `json:"title"`
	// Deadline is a day, YYYY-MM-DD.
	Deadline string             `json:"deadline"`
	Customer orderCustomerJSON  `json:"customer"`
	Assignee *orderAssigneeJSON `json:"assignee"`
	// Values are the answers by the id of the field, as a customer's.
	Values        fields.Values `json:"values"`
	CreatedByName *string       `json:"created_by_name"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

func toOrderJSON(t order.Order) orderJSON {
	body := orderJSON{
		ID: t.ID, TypeID: t.TypeID, StageID: t.StageID, LocationID: t.LocationID, Title: t.Title, Deadline: t.Deadline.Format(time.DateOnly),
		Customer: orderCustomerJSON{ID: t.Customer.ID, Phone: t.Customer.Phone, Name: t.Customer.Name},
		Values:   t.Values, CreatedByName: t.CreatedByName, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
	}
	if t.Assignee != nil {
		body.Assignee = &orderAssigneeJSON{Phone: t.Assignee.Phone, FullName: t.Assignee.Name}
	}
	return body
}

// orderInputJSON is what an order is saved with, in the body of a new order and
// of an edit.
type orderInputJSON struct {
	Title         string                     `json:"title"`
	Deadline      string                     `json:"deadline"`
	StageID       int64                      `json:"stage_id"`
	AssigneePhone *string                    `json:"assignee_phone"`
	Values        map[string]json.RawMessage `json:"values"`
}

func (in orderInputJSON) input() order.Input {
	return order.Input{Title: in.Title, Deadline: in.Deadline, StageID: in.StageID, AssigneePhone: in.AssigneePhone, Values: in.Values}
}

// orderCustomerInputJSON names a new order's customer: one that is there, by
// its id, or a new one by its type, phone and answers.
type orderCustomerInputJSON struct {
	ID     *int64                     `json:"id"`
	TypeID int64                      `json:"type_id"`
	Phone  string                     `json:"phone"`
	Values map[string]json.RawMessage `json:"values"`
}

// input is the customer as the service takes it: nothing when the body
// named none, which the service refuses.
func (in *orderCustomerInputJSON) input() order.CustomerInput {
	switch {
	case in == nil:
		return order.CustomerInput{}
	case in.ID != nil:
		return order.CustomerInput{ID: in.ID}
	case in.TypeID != 0 || in.Phone != "" || len(in.Values) > 0:
		return order.CustomerInput{New: &order.NewCustomer{TypeID: in.TypeID, Phone: in.Phone, Values: in.Values}}
	}
	return order.CustomerInput{}
}

// createOrder enters an order into the company the session works in, as the
// member the session is of; a new customer is entered with it.
func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		orderInputJSON
		TypeID     int64                   `json:"type_id"`
		LocationID int64                   `json:"location_id"`
		Customer   *orderCustomerInputJSON `json:"customer"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	customer := body.Customer.input()
	// A customer entered with the order is a customer entered: that takes
	// its own permission (logic/roles.md, section 4.3).
	if customer.New != nil && !currentPermissions(r.Context()).Has(access.CustomersCreate) {
		forbidden(w)
		return
	}
	// The order is entered into a location the member works in; a location
	// they may not work in (another company's, a deleted one, one outside
	// their restriction) is refused the way a missing permission is. None
	// named is the service's to refuse (400).
	if body.LocationID != 0 && !allowedLocation(r, body.LocationID) {
		forbidden(w)
		return
	}
	t, err := h.orders.Create(r.Context(), orderScope(r), currentUser(r.Context()).Phone, body.TypeID, body.LocationID, body.input(), customer)
	if err != nil {
		// A new customer's phone or answer may be another customer's.
		writeCustomerError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOrderJSON(t))
}

// getOrder is an order of the company the session works in.
func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	t, err := h.orders.Get(r.Context(), orderScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderJSON(t))
}

type orderPageJSON struct {
	Items    []orderJSON `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// listOrders is a page of the orders of the locations the member works in
// (of the one ?location_id= names alone; one they may not work in is
// refused), the one due soonest first: ?search= looks in the titles, the
// text answers and the customers' names (as digits, in the customers'
// phones and the number answers too); ?type_id=, ?stage_id=, ?customer_id=
// and ?assignee= (a phone) each keep one; ?page= starts at 1.
func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	in := order.ListInput{Search: query.Get("search"), Assignee: query.Get("assignee"), Page: 1}
	if raw := query.Get("location_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiya noto'g'ri")
			return
		}
		if !allowedLocation(r, id) {
			forbidden(w)
			return
		}
		in.LocationID = id
	}
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		in.Page = n
	}
	for _, f := range []struct {
		name, message string
		into          *int64
	}{
		{"type_id", "Vazifa turi noto'g'ri", &in.TypeID},
		{"stage_id", "Bosqich noto'g'ri", &in.StageID},
		{"customer_id", "Mijoz noto'g'ri", &in.CustomerID},
	} {
		raw := query.Get(f.name)
		if raw == "" {
			continue
		}
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", f.message)
			return
		}
		*f.into = id
	}
	page, err := h.orders.List(r.Context(), orderScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]orderJSON, 0, len(page.Items))
	for _, t := range page.Items {
		items = append(items, toOrderJSON(t))
	}
	httpx.JSON(w, http.StatusOK, orderPageJSON{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize})
}

// updateOrder saves an order of the company the session works in with another
// title, deadline, stage, assignee and answers, as the member the session
// is of.
func (h *Handler) updateOrder(w http.ResponseWriter, r *http.Request) {
	var body orderInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.orders.Update(r.Context(), orderScope(r), pathID(r, "id"), currentUser(r.Context()).Phone, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderJSON(t))
}

// moveOrder puts an order of the company the session works in into another
// stage, as the member the session is of.
func (h *Handler) moveOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StageID int64 `json:"stage_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.orders.Move(r.Context(), orderScope(r), pathID(r, "id"), currentUser(r.Context()).Phone, body.StageID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderJSON(t))
}

// deleteOrder hides an order of the company the session works in, as the
// member the session is of.
func (h *Handler) deleteOrder(w http.ResponseWriter, r *http.Request) {
	err := h.orders.Delete(r.Context(), orderScope(r), pathID(r, "id"), currentUser(r.Context()).Phone)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderHistory is what happened to an order of the owner's company, the
// latest first.
func (h *Handler) orderHistory(w http.ResponseWriter, r *http.Request) {
	history, err := h.orders.History(r.Context(), orderScope(r), pathID(r, "id"))
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
