package app

import (
	"encoding/json"
	"errors"
	"net/http"
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
