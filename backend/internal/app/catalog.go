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
	Price         *string   `json:"price"`
	Note          *string   `json:"note"`
	IsActive      bool      `json:"is_active"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toProductJSON(p catalog.Product) productJSON {
	return productJSON{
		ID: p.ID, Kind: p.Kind, Name: p.Name, Unit: p.Unit, SKU: p.SKU, Price: p.Price, Note: p.Note, IsActive: p.Active,
		CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
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
// names and the SKUs, ?page= starts at 1.
func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	in := catalog.ListInput{Kind: query.Get("kind"), Status: query.Get("status"), Search: query.Get("search"), Page: 1}
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

// getProduct is a product or a service of the company the session works in.
func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	p, err := h.catalog.Get(r.Context(), catalogScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
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
