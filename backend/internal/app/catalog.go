package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type productJSON struct {
	ID   int64  `json:"id"`
	Kind string `json:"kind"`
	Name string `json:"name"`
	// Unit is a product's; a service has none, and no SKU.
	Unit *string `json:"unit"`
	SKU  *string `json:"sku"`
	// Price is the sale price of a product, the price of a service, as text
	// with two decimals ("150000.50"); null when there is none.
	Price    *string `json:"price"`
	Note     *string `json:"note"`
	IsActive bool    `json:"is_active"`
	// Quantity is the product's stock in the member's locations, or in the
	// one asked for, as text with three decimals ("12.500"); null for a
	// service. LastPrice is the price of its newest live purchase line,
	// whatever the location; null when it was never bought.
	Quantity      *string   `json:"quantity"`
	LastPrice     *string   `json:"last_price"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toProductJSON(p catalog.Product) productJSON {
	return productJSON{
		ID: p.ID, Kind: p.Kind, Name: p.Name, Unit: p.Unit, SKU: p.SKU, Price: p.Price, Note: p.Note, IsActive: p.Active,
		Quantity: p.Quantity, LastPrice: p.LastPrice,
		CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

type stockLineJSON struct {
	LocationID   int64  `json:"location_id"`
	LocationName string `json:"location_name"`
	Quantity     string `json:"quantity"`
}

// productDetailJSON is a product on its own page: with its stock in each of
// the member's locations (a service has none).
type productDetailJSON struct {
	productJSON
	Stock []stockLineJSON `json:"stock"`
}

type productPurchaseJSON struct {
	PurchaseID   int64   `json:"purchase_id"`
	Number       int32   `json:"number"`
	PurchasedOn  string  `json:"purchased_on"`
	Supplier     refJSON `json:"supplier"`
	LocationID   int64   `json:"location_id"`
	LocationName string  `json:"location_name"`
	Quantity     string  `json:"quantity"`
	Price        string  `json:"price"`
	Amount       string  `json:"amount"`
}

type productPageJSON struct {
	Items    []productJSON `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

// productInputJSON is a product or a service as the client sends it; the
// kind is read on entry alone.
type productInputJSON struct {
	Kind  string  `json:"kind"`
	Name  string  `json:"name"`
	Unit  *string `json:"unit"`
	SKU   *string `json:"sku"`
	Price *string `json:"price"`
	Note  *string `json:"note"`
}

func (in productInputJSON) input() catalog.Input {
	return catalog.Input{Kind: in.Kind, Name: in.Name, Unit: in.Unit, SKU: in.SKU, Price: in.Price, Note: in.Note}
}

// listProducts is a page of the products (?kind=product, the default) or
// the services (?kind=service) of the company the session works in, the
// active ones unless ?status=inactive, by name: ?search= looks in the
// names and the SKUs, ?page= starts at 1. The stock shown is the member's
// locations', or that of ?location_id= (one they may not work in: 403).
func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	locationID, ok := locationParam(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	in := catalog.ListInput{Kind: query.Get("kind"), Status: query.Get("status"), Search: query.Get("search"), Page: 1, LocationID: locationID}
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		in.Page = n
	}
	page, err := h.catalog.List(r.Context(), catalogScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]productJSON, 0, len(page.Items))
	for _, p := range page.Items {
		items = append(items, toProductJSON(p))
	}
	httpx.JSON(w, http.StatusOK, productPageJSON{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize})
}

// createProduct enters a product or a service into the company the session
// works in, as the member the session is of.
func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var body productInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.catalog.Create(r.Context(), catalogScope(r), currentUser(r.Context()).Phone, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toProductJSON(p))
}

// getProduct is a product or a service of the company the session works
// in, with its stock in each of the member's locations.
func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	d, err := h.catalog.Detail(r.Context(), catalogScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	stock := make([]stockLineJSON, 0, len(d.Stock))
	for _, line := range d.Stock {
		stock = append(stock, stockLineJSON{LocationID: line.LocationID, LocationName: line.LocationName, Quantity: line.Quantity})
	}
	httpx.JSON(w, http.StatusOK, productDetailJSON{productJSON: toProductJSON(d.Product), Stock: stock})
}

// listProductPurchases is a page of the live purchase lines of a product of
// the company the session works in, in the member's locations, the newest
// purchase first; ?page= starts at 1.
func (h *Handler) listProductPurchases(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.catalog.Purchases(r.Context(), catalogScope(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]productPurchaseJSON, 0, len(result.Items))
	for _, l := range result.Items {
		items = append(items, productPurchaseJSON{
			PurchaseID: l.PurchaseID, Number: l.Number, PurchasedOn: l.PurchasedOn.Format(time.DateOnly), Supplier: refJSON{ID: l.SupplierID, Name: l.SupplierName},
			LocationID: l.LocationID, LocationName: l.LocationName, Quantity: l.Quantity, Price: l.Price, Amount: l.Amount,
		})
	}
	httpx.JSON(w, http.StatusOK, pageJSON[productPurchaseJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// updateProduct saves a product or a service of the company the session
// works in with other fields; its kind stays.
func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	var body productInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.catalog.Update(r.Context(), catalogScope(r), pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
}

// setProductActive turns a product or a service of the company the session
// works in off, or on again.
func (h *Handler) setProductActive(w http.ResponseWriter, r *http.Request) {
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
	p, err := h.catalog.SetActive(r.Context(), catalogScope(r), pathID(r, "id"), *body.IsActive)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
}

// deleteProduct hides a product or a service of the company the session
// works in.
func (h *Handler) deleteProduct(w http.ResponseWriter, r *http.Request) {
	if err := h.catalog.Delete(r.Context(), catalogScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
