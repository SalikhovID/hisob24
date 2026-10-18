package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

// The sales section (logic/sales.md): the sales, the customers' payments
// and opening balances, and their statements.

type saleJSON struct {
	ID            int64     `json:"id"`
	Number        int32     `json:"number"`
	LocationID    int64     `json:"location_id"`
	LocationName  string    `json:"location_name"`
	Customer      *refJSON  `json:"customer"`
	At            time.Time `json:"at"`
	CurrencyID    int64     `json:"currency_id"`
	Rate          string    `json:"rate"`
	Note          *string   `json:"note"`
	Total         string    `json:"total"`
	TotalUZS      string    `json:"total_uzs"`
	Paid          string    `json:"paid"`
	ItemsCount    int64     `json:"items_count"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Items are the lines and Payments the payments entered with it, on the
	// sale's own page; a list carries neither (null).
	Items    []itemJSON          `json:"items,omitempty"`
	Payments []linkedPaymentJSON `json:"payments"`
}

func toSaleJSON(s warehouse.Sale) saleJSON {
	out := saleJSON{
		ID: s.ID, Number: s.Number, LocationID: s.LocationID, LocationName: s.LocationName, At: s.At, CurrencyID: s.CurrencyID, Rate: s.Rate, Note: s.Note,
		Total: s.Total, TotalUZS: s.TotalUZS, Paid: s.Paid, ItemsCount: s.ItemsCount, CreatedByName: s.CreatedByName, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
	}
	if s.CustomerID != nil {
		name := ""
		if s.CustomerName != nil {
			name = *s.CustomerName
		}
		out.Customer = &refJSON{ID: *s.CustomerID, Name: name}
	}
	for _, it := range s.Items {
		out.Items = append(out.Items, itemJSON{ProductID: it.ProductID, Name: it.Name, Unit: it.Unit, Quantity: it.Quantity, Price: it.Price, Amount: it.Amount})
	}
	if s.Payments != nil {
		out.Payments = make([]linkedPaymentJSON, 0, len(s.Payments))
		for _, l := range s.Payments {
			out.Payments = append(out.Payments, linkedPaymentJSON{ID: l.ID, BankAccountID: l.BankAccountID, AccountName: l.AccountName, Amount: l.Amount, CurrencyID: l.CurrencyID})
		}
	}
	return out
}

type saleInputJSON struct {
	CustomerID *int64            `json:"customer_id"`
	At         string            `json:"at"`
	CurrencyID *int64            `json:"currency_id"`
	Rate       *string           `json:"rate"`
	Note       *string           `json:"note"`
	Items      []itemInputJSON   `json:"items"`
	Payments   []paymentLineJSON `json:"payments"`
}

func (in saleInputJSON) input() warehouse.SaleInput {
	items := make([]warehouse.ItemInput, 0, len(in.Items))
	for _, it := range in.Items {
		items = append(items, warehouse.ItemInput{ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price})
	}
	payments := make([]ledger.PaymentLine, 0, len(in.Payments))
	for _, l := range in.Payments {
		payments = append(payments, ledger.PaymentLine{BankAccountID: l.BankAccountID, Amount: l.Amount})
	}
	return warehouse.SaleInput{CustomerID: in.CustomerID, At: in.At, CurrencyID: in.CurrencyID, Rate: in.Rate, Note: in.Note, Items: items, Payments: payments}
}

// saleCreateJSON is a sale as it is entered: with the location it comes out of.
type saleCreateJSON struct {
	saleInputJSON
	LocationID int64 `json:"location_id"`
}

type customerPaymentJSON struct {
	ID            int64     `json:"id"`
	CustomerID    int64     `json:"customer_id"`
	SaleID        *int64    `json:"sale_id"`
	SaleNumber    *int32    `json:"sale_number"`
	OrderID       *int64    `json:"order_id"`
	BankAccountID int64     `json:"bank_account_id"`
	AccountName   string    `json:"account_name"`
	Amount        string    `json:"amount"`
	CurrencyID    int64     `json:"currency_id"`
	Rate          string    `json:"rate"`
	AmountUZS     string    `json:"amount_uzs"`
	At            time.Time `json:"at"`
	Note          *string   `json:"note"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toCustomerPaymentJSON(p warehouse.CustomerPayment) customerPaymentJSON {
	return customerPaymentJSON{
		ID: p.ID, CustomerID: p.CustomerID, SaleID: p.SaleID, SaleNumber: p.SaleNumber, OrderID: p.OrderID, BankAccountID: p.BankAccountID, AccountName: p.AccountName,
		Amount: p.Amount, CurrencyID: p.CurrencyID, Rate: p.Rate, AmountUZS: p.AmountUZS, At: p.At, Note: p.Note, CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

type customerOpeningJSON struct {
	ID            int64     `json:"id"`
	Kind          string    `json:"kind"`
	CustomerID    int64     `json:"customer_id"`
	Amount        string    `json:"amount"`
	CurrencyID    int64     `json:"currency_id"`
	Rate          string    `json:"rate"`
	AmountUZS     string    `json:"amount_uzs"`
	At            time.Time `json:"at"`
	Note          *string   `json:"note"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toCustomerOpeningJSON(o warehouse.CustomerOpening) customerOpeningJSON {
	return customerOpeningJSON{
		ID: o.ID, Kind: o.Kind, CustomerID: o.CustomerID, Amount: o.Amount, CurrencyID: o.CurrencyID, Rate: o.Rate, AmountUZS: o.AmountUZS, At: o.At, Note: o.Note,
		CreatedByName: o.CreatedByName, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt,
	}
}

// listSales is a page of the sales in the member's locations, or in the one
// ?location_id= names (one they may not work in: 403), the newest first;
// ?customer_id= keeps one customer's, ?page= starts at 1.
func (h *Handler) listSales(w http.ResponseWriter, r *http.Request) {
	locationID, ok := locationParam(w, r)
	if !ok {
		return
	}
	in := warehouse.SaleListInput{LocationID: locationID, Page: 1}
	if raw := r.URL.Query().Get("customer_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Mijoz noto'g'ri")
			return
		}
		in.CustomerID = id
	}
	if in.Page, ok = pageParam(w, r); !ok {
		return
	}
	result, err := h.warehouse.ListSales(r.Context(), warehouseScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]saleJSON, 0, len(result.Items))
	for _, s := range result.Items {
		items = append(items, toSaleJSON(s))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[saleJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createSale enters a sale out of a location the member works in (no
// location: 400; one they may not work in: 403), as the member the session
// is of.
func (h *Handler) createSale(w http.ResponseWriter, r *http.Request) {
	var body saleCreateJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if !entryLocation(w, r, body.LocationID) {
		return
	}
	s, err := h.warehouse.CreateSale(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, body.LocationID, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toSaleJSON(s))
}

// getSale is a sale in the member's locations, with its lines and the
// payments entered with it.
func (h *Handler) getSale(w http.ResponseWriter, r *http.Request) {
	s, err := h.warehouse.GetSale(r.Context(), warehouseScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toSaleJSON(s))
}

// updateSale saves a sale in the member's locations with other fields,
// lines and payments; its number and location stay.
func (h *Handler) updateSale(w http.ResponseWriter, r *http.Request) {
	var body saleInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.warehouse.UpdateSale(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toSaleJSON(s))
}

// deleteSale hides a sale in the member's locations, gives its products
// back to the stock and hides the payments entered with it.
func (h *Handler) deleteSale(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteSale(r.Context(), warehouseScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listCustomerPayments is a page of a customer's payments, the newest first.
func (h *Handler) listCustomerPayments(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListCustomerPayments(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]customerPaymentJSON, 0, len(result.Items))
	for _, p := range result.Items {
		items = append(items, toCustomerPaymentJSON(p))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[customerPaymentJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// addCustomerPayment enters a payment from a customer of the company the
// session works in, as the member the session is of.
func (h *Handler) addCustomerPayment(w http.ResponseWriter, r *http.Request) {
	var body paymentInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.warehouse.AddCustomerPayment(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCustomerPaymentJSON(p))
}

// updateCustomerPayment saves a payment entered on its own with other fields.
func (h *Handler) updateCustomerPayment(w http.ResponseWriter, r *http.Request) {
	var body paymentInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.warehouse.UpdateCustomerPayment(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), pathID(r, "paymentId"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCustomerPaymentJSON(p))
}

// deleteCustomerPayment hides a payment entered on its own.
func (h *Handler) deleteCustomerPayment(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteCustomerPayment(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "paymentId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listCustomerOpenings is a page of a customer's opening balances, the
// newest first.
func (h *Handler) listCustomerOpenings(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListCustomerOpenings(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]customerOpeningJSON, 0, len(result.Items))
	for _, o := range result.Items {
		items = append(items, toCustomerOpeningJSON(o))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[customerOpeningJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// addCustomerOpening enters an opening debt or advance of a customer.
func (h *Handler) addCustomerOpening(w http.ResponseWriter, r *http.Request) {
	var body openingInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.warehouse.AddCustomerOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCustomerOpeningJSON(o))
}

// updateCustomerOpening saves an opening balance with other fields; its
// kind stays.
func (h *Handler) updateCustomerOpening(w http.ResponseWriter, r *http.Request) {
	var body openingInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.warehouse.UpdateCustomerOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), pathID(r, "openingId"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCustomerOpeningJSON(o))
}

// deleteCustomerOpening hides an opening balance.
func (h *Handler) deleteCustomerOpening(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteCustomerOpening(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "openingId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// getCustomerStatement is a page of a customer's statement: their live
// documents in time, the newest first, each with what they owed after it.
func (h *Handler) getCustomerStatement(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.CustomerStatement(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, pageJSON[statementRowJSON]{Items: toStatementRowsJSON(result.Items), Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}
