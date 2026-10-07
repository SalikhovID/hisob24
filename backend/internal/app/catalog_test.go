package app

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// enterProduct enters a product (or a service) as the session and returns
// the API's answer.
func (api testAPI) enterProduct(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/products", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func TestCreateProduct(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)

	rec := api.do(t, http.MethodPost, "/app/products",
		`{"kind":"product","name":" Olma ","unit":"kg","sku":"A-1","price":"12000.5","note":"Qizil"}`, bearer(employee))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	p := decode(t, rec)
	assert.NotEmpty(t, p["id"])
	assert.Equal(t, "product", p["kind"])
	assert.Equal(t, "Olma", p["name"], "an employee without a role enters products, trimmed")
	assert.Equal(t, "kg", p["unit"])
	assert.Equal(t, "A-1", p["sku"])
	assert.Equal(t, "12000.50", p["price"], "two decimals, as text")
	assert.Equal(t, "Qizil", p["note"])
	assert.Equal(t, true, p["is_active"])
	assert.Equal(t, "Vali Aliyev", p["created_by_name"])
	assert.NotEmpty(t, p["created_at"])
	assert.Equal(t, p["created_at"], p["updated_at"])

	service := api.enterProduct(t, owner, `{"kind":"service","name":"Yetkazish","price":"50000"}`)
	assert.Equal(t, "service", service["kind"])
	assert.Nil(t, service["unit"])
	assert.Nil(t, service["sku"])
	assert.Equal(t, "50000.00", service["price"])
	assert.Nil(t, service["note"])
	assert.Nil(t, service["created_by_name"], "the owner goes by no name here")

	for name, tc := range map[string]struct{ body, message string }{
		"no kind":                  {`{"name":"Nok"}`, "Turni tanlang"},
		"no name":                  {`{"kind":"product","name":" ","unit":"kg"}`, "Nomni kiriting"},
		"a long name":              {fmt.Sprintf(`{"kind":"product","name":"%s","unit":"kg"}`, strings.Repeat("a", 121)), "Nom 120 belgidan oshmasin"},
		"a product without a unit": {`{"kind":"product","name":"Nok"}`, "Birlikni tanlang"},
		"a unit not in the list":   {`{"kind":"product","name":"Nok","unit":"tonna"}`, "Birlikni tanlang"},
		"a service with a unit":    {`{"kind":"service","name":"Ta'mirlash","unit":"dona"}`, "Xizmatga birlik berilmaydi"},
		"a service with a SKU":     {`{"kind":"service","name":"Ta'mirlash","sku":"S-1"}`, "Xizmatga artikul berilmaydi"},
		"a long SKU":               {fmt.Sprintf(`{"kind":"product","name":"Nok","unit":"kg","sku":"%s"}`, strings.Repeat("1", 61)), "Artikul 60 belgidan oshmasin"},
		"a bad price":              {`{"kind":"product","name":"Nok","unit":"kg","price":"1,5"}`, "Narx noto'g'ri"},
		"a long note":              {fmt.Sprintf(`{"kind":"product","name":"Nok","unit":"kg","note":"%s"}`, strings.Repeat("x", 501)), "Izoh 500 belgidan oshmasin"},
	} {
		rec := api.do(t, http.MethodPost, "/app/products", tc.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}

	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"OLMA","unit":"dona"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli mahsulot allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"service","name":"yetkazish"}`, bearer(owner))
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli xizmat allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona","sku":"a-1"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"sku_taken","message":"Bu artikulli mahsulot allaqachon bor"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona"}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}

func TestListProducts(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	other, _ := api.signIn(t, valisPhone, map[int64]string{nok: "owner"})
	api.enterProduct(t, owner, `{"kind":"product","name":"Nok","unit":"dona","sku":"N-1"}`)
	api.enterProduct(t, owner, `{"kind":"product","name":"anor","unit":"kg"}`)
	off := api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	api.enterProduct(t, owner, `{"kind":"service","name":"Yetkazish"}`)
	api.enterProduct(t, other, `{"kind":"product","name":"Olma","unit":"kg"}`)
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPatch, fmt.Sprintf("/app/products/%v", off["id"]), `{"is_active":false}`, bearer(owner)).Code)
	names := func(query string) []any {
		rec := api.do(t, http.MethodGet, "/app/products"+query, "", bearer(owner))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		items, _ := decode(t, rec)["items"].([]any)
		out := make([]any, 0, len(items))
		for _, item := range items {
			out = append(out, item.(map[string]any)["name"])
		}
		return out
	}

	assert.Equal(t, []any{"anor", "Nok"}, names(""), "the active products by name; not the inactive, not the services, not another company's")
	assert.Equal(t, []any{"Olma"}, names("?status=inactive"))
	assert.Equal(t, []any{"Yetkazish"}, names("?kind=service"))
	assert.Equal(t, []any{"Nok"}, names("?search=n-1"), "a search looks in the SKU too")
	assert.Equal(t, []any{"anor"}, names("?search=ANO"), "and inside a name")
	rec := api.do(t, http.MethodGet, "/app/products?page=2", "", bearer(owner))
	body := decode(t, rec)
	assert.Empty(t, body["items"], "past the last page")
	assert.EqualValues(t, 2, body["total"])
	assert.EqualValues(t, 2, body["page"])
	assert.EqualValues(t, 20, body["page_size"])

	for name, tc := range map[string]struct{ query, message string }{
		"a page that is no number": {"?page=abc", "Sahifa raqami noto'g'ri"},
		"a kind not of the two":    {"?kind=thing", "Tur noto'g'ri"},
		"a status not of the two":  {"?status=gone", "Holat noto'g'ri"},
	} {
		rec := api.do(t, http.MethodGet, "/app/products"+tc.query, "", bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
}

func TestProductByID(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	other, _ := api.signIn(t, valisPhone, map[int64]string{nok: "owner"})
	p := api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg","sku":"A-1","price":"100","note":"Qizil"}`)
	path := fmt.Sprintf("/app/products/%v", p["id"])
	notFound := `{"error":"not_found","message":"Mahsulot topilmadi"}`

	rec := api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, p, decode(t, rec), "the product as it was entered")
	rec = api.do(t, http.MethodGet, path, "", bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's product")
	assert.JSONEq(t, notFound, rec.Body.String())

	rec = api.do(t, http.MethodPut, path, `{"name":"Qizil olma","unit":"dona"}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "Qizil olma", edited["name"])
	assert.Equal(t, "dona", edited["unit"])
	assert.Nil(t, edited["sku"], "what is not sent is cleared")
	assert.Nil(t, edited["price"])
	assert.Nil(t, edited["note"])
	assert.Equal(t, "product", edited["kind"], "the kind stays")
	rec = api.do(t, http.MethodPut, path, `{"name":"Qizil olma"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Birlikni tanlang"}`, rec.Body.String(), "checked as a product")
	rec = api.do(t, http.MethodPut, path, `{"name":"Olma","unit":"kg"}`, bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodPatch, path, `{"is_active":false}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, false, decode(t, rec)["is_active"])
	rec = api.do(t, http.MethodPatch, path, `{}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Holat noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"is_active":true}`, bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodDelete, path, "", bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "hidden")
	assert.JSONEq(t, notFound, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg","sku":"A-1"}`)
}
