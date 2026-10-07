package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

// refJSON names a record another one points to.
type refJSON struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type supplierJSON struct {
	ID       int64   `json:"id"`
	Name     string  `json:"name"`
	Phone    *string `json:"phone"`
	Note     *string `json:"note"`
	IsActive bool    `json:"is_active"`
	// Balance is what is owed the supplier (above zero) or paid in advance
	// (below), PurchasesTotal and PaymentsTotal what the live purchases and
	// payments come to: shown to whoever may see the purchases, null
	// otherwise. Amounts are text with two decimals.
	Balance        *string   `json:"balance"`
	PurchasesTotal *string   `json:"purchases_total"`
	PaymentsTotal  *string   `json:"payments_total"`
	CreatedByName  *string   `json:"created_by_name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func toSupplierJSON(s warehouse.Supplier, withBalance bool) supplierJSON {
	out := supplierJSON{
		ID: s.ID, Name: s.Name, Phone: s.Phone, Note: s.Note, IsActive: s.Active,
		CreatedByName: s.CreatedByName, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
	}
	if withBalance {
		out.Balance, out.PurchasesTotal, out.PaymentsTotal = &s.Balance, &s.PurchasesTotal, &s.PaymentsTotal
	}
	return out
}

// seesBalance tells whether the request's member may see what is owed the
// suppliers: whoever may see the purchases.
func seesBalance(r *http.Request) bool {
	return currentPermissions(r.Context()).Has(access.PurchasesView)
}

type supplierInputJSON struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Note  *string `json:"note"`
}

func (in supplierInputJSON) input() warehouse.SupplierInput {
	return warehouse.SupplierInput{Name: in.Name, Phone: in.Phone, Note: in.Note}
}

type paymentJSON struct {
	ID             int64     `json:"id"`
	SupplierID     int64     `json:"supplier_id"`
	PurchaseID     *int64    `json:"purchase_id"`
	PurchaseNumber *int32    `json:"purchase_number"`
	Amount         string    `json:"amount"`
	PaidOn         string    `json:"paid_on"`
	Note           *string   `json:"note"`
	CreatedByName  *string   `json:"created_by_name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func toPaymentJSON(p warehouse.Payment) paymentJSON {
	return paymentJSON{
		ID: p.ID, SupplierID: p.SupplierID, PurchaseID: p.PurchaseID, PurchaseNumber: p.PurchaseNumber,
		Amount: p.Amount, PaidOn: p.PaidOn.Format(time.DateOnly), Note: p.Note,
		CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

type paymentInputJSON struct {
	Amount *string `json:"amount"`
	PaidOn string  `json:"paid_on"`
	Note   *string `json:"note"`
}

func (in paymentInputJSON) input() warehouse.PaymentInput {
	return warehouse.PaymentInput{Amount: in.Amount, PaidOn: in.PaidOn, Note: in.Note}
}

type itemJSON struct {
	ProductID int64   `json:"product_id"`
	Name      string  `json:"name"`
	Unit      *string `json:"unit"`
	Quantity  string  `json:"quantity"`
	Price     string  `json:"price"`
	Amount    string  `json:"amount"`
}

type purchaseJSON struct {
	ID            int64     `json:"id"`
	Number        int32     `json:"number"`
	LocationID    int64     `json:"location_id"`
	LocationName  string    `json:"location_name"`
	Supplier      refJSON   `json:"supplier"`
	PurchasedOn   string    `json:"purchased_on"`
	Note          *string   `json:"note"`
	Total         string    `json:"total"`
	Paid          string    `json:"paid"`
	ItemsCount    int64     `json:"items_count"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Items are the lines, on the purchase's own page; a list carries none.
	Items []itemJSON `json:"items,omitempty"`
}

func toPurchaseJSON(p warehouse.Purchase) purchaseJSON {
	out := purchaseJSON{
		ID: p.ID, Number: p.Number, LocationID: p.LocationID, LocationName: p.LocationName,
		Supplier: refJSON{ID: p.SupplierID, Name: p.SupplierName}, PurchasedOn: p.PurchasedOn.Format(time.DateOnly), Note: p.Note,
		Total: p.Total, Paid: p.Paid, ItemsCount: p.ItemsCount,
		CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
	for _, it := range p.Items {
		out.Items = append(out.Items, itemJSON{ProductID: it.ProductID, Name: it.Name, Unit: it.Unit, Quantity: it.Quantity, Price: it.Price, Amount: it.Amount})
	}
	return out
}

type itemInputJSON struct {
	ProductID int64   `json:"product_id"`
	Quantity  *string `json:"quantity"`
	Price     *string `json:"price"`
}

type purchaseInputJSON struct {
	SupplierID  int64           `json:"supplier_id"`
	PurchasedOn string          `json:"purchased_on"`
	Note        *string         `json:"note"`
	Items       []itemInputJSON `json:"items"`
	Paid        *string         `json:"paid"`
}

func (in purchaseInputJSON) input() warehouse.PurchaseInput {
	items := make([]warehouse.ItemInput, 0, len(in.Items))
	for _, it := range in.Items {
		items = append(items, warehouse.ItemInput{ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price})
	}
	return warehouse.PurchaseInput{SupplierID: in.SupplierID, PurchasedOn: in.PurchasedOn, Note: in.Note, Items: items, Paid: in.Paid}
}

// purchaseCreateJSON is a purchase as it is entered: with the location it
// lands in.
type purchaseCreateJSON struct {
	purchaseInputJSON
	LocationID int64 `json:"location_id"`
}

type pageJSON[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

// pageParam reads ?page= (1 unless given); a page that is not a number is
// refused, and false is returned.
func pageParam(w http.ResponseWriter, r *http.Request) (int, bool) {
	p := r.URL.Query().Get("page")
	if p == "" {
		return 1, true
	}
	n, err := strconv.Atoi(p)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
		return 0, false
	}
	return n, true
}

// locationParam reads ?location_id= (0 unless given): one that is not a
// number is refused (400), one the member may not work in too (403), and
// false is returned.
func locationParam(w http.ResponseWriter, r *http.Request) (int64, bool) {
	raw := r.URL.Query().Get("location_id")
	if raw == "" {
		return 0, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiya noto'g'ri")
		return 0, false
	}
	if !allowedLocation(r, id) {
		forbidden(w)
		return 0, false
	}
	return id, true
}

// listSuppliers is a page of the suppliers of the company the session works
// in, the active ones unless ?status=inactive, by name: ?search= looks in
// the names (or, as digits, in the phones), ?page= starts at 1. The
// balances are shown to whoever may see the purchases.
func (h *Handler) listSuppliers(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	result, err := h.warehouse.ListSuppliers(r.Context(), sessionCompany(r), warehouse.SupplierListInput{Status: query.Get("status"), Search: query.Get("search"), Page: page})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	withBalance := seesBalance(r)
	items := make([]supplierJSON, 0, len(result.Items))
	for _, s := range result.Items {
		items = append(items, toSupplierJSON(s, withBalance))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[supplierJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createSupplier enters a supplier into the company the session works in.
func (h *Handler) createSupplier(w http.ResponseWriter, r *http.Request) {
	var body supplierInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.warehouse.CreateSupplier(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toSupplierJSON(s, seesBalance(r)))
}

// getSupplier is a supplier of the company the session works in, with its
// balance for whoever may see the purchases.
func (h *Handler) getSupplier(w http.ResponseWriter, r *http.Request) {
	s, err := h.warehouse.GetSupplier(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toSupplierJSON(s, seesBalance(r)))
}

// updateSupplier saves a supplier of the company the session works in with
// other fields.
func (h *Handler) updateSupplier(w http.ResponseWriter, r *http.Request) {
	var body supplierInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.warehouse.UpdateSupplier(r.Context(), sessionCompany(r), pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toSupplierJSON(s, seesBalance(r)))
}

// setSupplierActive turns a supplier of the company the session works in
// off, or on again.
func (h *Handler) setSupplierActive(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IsActive *bool `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if body.IsActive == nil {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Holat noto'g'ri")
		return
	}
	s, err := h.warehouse.SetSupplierActive(r.Context(), sessionCompany(r), pathID(r, "id"), *body.IsActive)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toSupplierJSON(s, seesBalance(r)))
}

// deleteSupplier hides a supplier of the company the session works in.
func (h *Handler) deleteSupplier(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteSupplier(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listPayments is a page of the payments to a supplier of the company the
// session works in, the newest first; ?page= starts at 1.
func (h *Handler) listPayments(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListPayments(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]paymentJSON, 0, len(result.Items))
	for _, p := range result.Items {
		items = append(items, toPaymentJSON(p))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[paymentJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// addPayment enters a payment to a supplier of the company the session
// works in.
func (h *Handler) addPayment(w http.ResponseWriter, r *http.Request) {
	var body paymentInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.warehouse.AddPayment(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toPaymentJSON(p))
}

// updatePayment saves a payment entered on its own with other fields.
func (h *Handler) updatePayment(w http.ResponseWriter, r *http.Request) {
	var body paymentInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.warehouse.UpdatePayment(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "paymentId"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toPaymentJSON(p))
}

// deletePayment hides a payment entered on its own.
func (h *Handler) deletePayment(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeletePayment(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "paymentId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listPurchases is a page of the purchases in the member's locations, or in
// the one ?location_id= names (one they may not work in: 403), the newest
// first; ?supplier_id= keeps one supplier's, ?page= starts at 1.
func (h *Handler) listPurchases(w http.ResponseWriter, r *http.Request) {
	locationID, ok := locationParam(w, r)
	if !ok {
		return
	}
	in := warehouse.PurchaseListInput{LocationID: locationID, Page: 1}
	if raw := r.URL.Query().Get("supplier_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Ta'minotchi noto'g'ri")
			return
		}
		in.SupplierID = id
	}
	if in.Page, ok = pageParam(w, r); !ok {
		return
	}
	result, err := h.warehouse.ListPurchases(r.Context(), warehouseScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]purchaseJSON, 0, len(result.Items))
	for _, p := range result.Items {
		items = append(items, toPurchaseJSON(p))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[purchaseJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createPurchase enters a purchase into a location the member works in (no
// location: 400; one they may not work in: 403), as the member the session
// is of.
func (h *Handler) createPurchase(w http.ResponseWriter, r *http.Request) {
	var body purchaseCreateJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if body.LocationID == 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiyani tanlang")
		return
	}
	if !allowedLocation(r, body.LocationID) {
		forbidden(w)
		return
	}
	p, err := h.warehouse.CreatePurchase(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, body.LocationID, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toPurchaseJSON(p))
}

// getPurchase is a purchase in the member's locations, with its lines.
func (h *Handler) getPurchase(w http.ResponseWriter, r *http.Request) {
	p, err := h.warehouse.GetPurchase(r.Context(), warehouseScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toPurchaseJSON(p))
}

// updatePurchase saves a purchase in the member's locations with other
// fields and lines; its number and location stay.
func (h *Handler) updatePurchase(w http.ResponseWriter, r *http.Request) {
	var body purchaseInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.warehouse.UpdatePurchase(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toPurchaseJSON(p))
}

// deletePurchase hides a purchase in the member's locations and takes its
// lines out of the stock.
func (h *Handler) deletePurchase(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeletePurchase(r.Context(), warehouseScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
