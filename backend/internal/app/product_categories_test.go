package app

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The product categories (logic/products.md, 3.4): every member reads them,
// in their order; the owner (and a settings.* role) adds, renames, orders
// and deletes them.
func TestProductCategories(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	path := "/app/product-categories"
	add := func(body string) map[string]any {
		rec := api.do(t, http.MethodPost, path, body, bearer(owner))
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return decode(t, rec)
	}
	names := func(token string) []any {
		rec := api.do(t, http.MethodGet, path, "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		out := []any{}
		for _, item := range decodeList(t, rec) {
			out = append(out, item.(map[string]any)["name"])
		}
		return out
	}

	drinks := add(`{"name":" Ichimliklar "}`)
	assert.NotEmpty(t, drinks["id"])
	assert.Equal(t, "Ichimliklar", drinks["name"], "trimmed")
	sweets := add(`{"name":"Shirinliklar"}`)
	assert.Equal(t, []any{"Ichimliklar", "Shirinliklar"}, names(employee), "every member reads them, in their order")

	for name, tc := range map[string]struct{ body, want string }{
		"no name":      {`{"name":" "}`, `{"error":"validation_error","message":"Nomni kiriting"}`},
		"a long name":  {fmt.Sprintf(`{"name":"%s"}`, strings.Repeat("a", 61)), `{"error":"validation_error","message":"Nom 60 belgidan oshmasin"}`},
		"a taken name": {`{"name":"ichimliklar"}`, `{"error":"name_taken","message":"Bu nomli kategoriya allaqachon bor"}`},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(owner))
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}

	drinksPath := fmt.Sprintf("%s/%v", path, drinks["id"])
	rec := api.do(t, http.MethodPatch, drinksPath, `{"name":"Suvlar"}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, map[string]any{"id": drinks["id"], "name": "Suvlar"}, decode(t, rec))
	rec = api.do(t, http.MethodPatch, path+"/999999", `{"name":"Suv"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kategoriya topilmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"ids":[%v,%v]}`, sweets["id"], drinks["id"]), bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, []any{"Shirinliklar", "Suvlar"}, names(owner), "in the new order")
	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"ids":[%v]}`, sweets["id"]), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"order_changed","message":"Ro'yxat o'zgargan. Sahifani yangilang"}`, rec.Body.String())

	api.exec(t, "INSERT INTO products (company_id, kind, name, unit, category_id, created_by) VALUES ($1, 'product', 'Kola', 'dona', $2, $3)", olma, drinks["id"], alisPhone)
	rec = api.do(t, http.MethodDelete, drinksPath, "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"category_in_use","message":"Bu kategoriyada 1 ta mahsulot bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("%s/%v", path, sweets["id"]), "", bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, []any{"Suvlar"}, names(owner))

	// The settings are the owner's (and settings.* roles'), not an employee's.
	for name, req := range map[string]struct{ method, path, body string }{
		"adding":   {http.MethodPost, path, `{"name":"Non"}`},
		"renaming": {http.MethodPatch, drinksPath, `{"name":"Suv"}`},
		"ordering": {http.MethodPut, path + "/order", fmt.Sprintf(`{"ids":[%v]}`, drinks["id"])},
		"deleting": {http.MethodDelete, drinksPath, ""},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, name)
		assert.JSONEq(t, noPermission, rec.Body.String(), name)
	}
}
