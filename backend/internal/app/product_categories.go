package app

import (
	"net/http"
	"strconv"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// productCategoryJSON is a category of the company's products
// (logic/products.md, 3.4).
type productCategoryJSON struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func toProductCategoryJSON(c catalog.Category) productCategoryJSON {
	return productCategoryJSON{ID: c.ID, Name: c.Name}
}

// listProductCategories is the company's product categories, in their
// order: what the product form and the filters are built from, so every
// member reads them.
func (h *Handler) listProductCategories(w http.ResponseWriter, r *http.Request) {
	list, err := h.catalog.Categories(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out := make([]productCategoryJSON, 0, len(list))
	for _, c := range list {
		out = append(out, toProductCategoryJSON(c))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// createProductCategory adds a category at the end of the company's.
func (h *Handler) createProductCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.catalog.CreateCategory(r.Context(), sessionCompany(r), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toProductCategoryJSON(c))
}

// renameProductCategory gives a category another name.
func (h *Handler) renameProductCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	c, err := h.catalog.RenameCategory(r.Context(), sessionCompany(r), pathID(r, "id"), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductCategoryJSON(c))
}

// deleteProductCategory hides a category no live product is filed under.
func (h *Handler) deleteProductCategory(w http.ResponseWriter, r *http.Request) {
	if err := h.catalog.DeleteCategory(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderProductCategories puts the company's categories in the order given.
func (h *Handler) orderProductCategories(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.catalog.OrderCategories(r.Context(), sessionCompany(r), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// categoryParam reads ?category_id=: a category's id, or none (the
// products with no category); with nothing every product is kept. Any other
// value is refused (400), and false is returned.
func categoryParam(w http.ResponseWriter, r *http.Request) (catalog.CategoryFilter, bool) {
	raw := r.URL.Query().Get("category_id")
	switch raw {
	case "":
		return catalog.CategoryFilter{}, true
	case "none":
		return catalog.CategoryFilter{None: true}, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Kategoriya noto'g'ri")
		return catalog.CategoryFilter{}, false
	}
	return catalog.CategoryFilter{ID: id}, true
}
