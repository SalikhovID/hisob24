package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// decodeList reads a JSON array answer.
func decodeList(t *testing.T, rec *httptest.ResponseRecorder) []any {
	t.Helper()
	var list []any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list), rec.Body.String())
	return list
}

// addAccount gives the company an account, as the admin does, and returns its id.
func (api testAPI) addAccount(t *testing.T, companyID int64, name string, currencyID int64, active bool) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO bank_accounts (company_id, name, currency_id, is_active) VALUES ($1, $2, $3, $4) RETURNING id", companyID, name, currencyID, active)
}

// /app/me tells the company's live accounts, where a payment may go
// (logic/finance.md, section 3); none before a company is chosen.
func TestMeTellsTheCompanysAccounts(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	cash := api.addAccount(t, olma, "Naqd", 1, true)
	card := api.addAccount(t, olma, "Karta", 2, false)
	gone := api.addAccount(t, olma, "Eski", 1, true)
	api.exec(t, "UPDATE bank_accounts SET deleted_at = now() WHERE id = $1", gone)
	api.addAccount(t, nok, "Naqd", 1, true)

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{
		map[string]any{"id": float64(cash), "name": "Naqd", "currency_id": 1.0, "is_active": true},
		map[string]any{"id": float64(card), "name": "Karta", "currency_id": 2.0, "is_active": false},
	}, decode(t, rec)["accounts"], "the live accounts in the order added, the inactive too")
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(undecided))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, []any{}, decode(t, rec)["accounts"], "nothing before a choice of company")
}

func TestFinanceCategories(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	path := "/app/finance-categories"
	add := func(body string) map[string]any {
		rec := api.do(t, http.MethodPost, path, body, bearer(owner))
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return decode(t, rec)
	}
	names := func(token, query string) []any {
		rec := api.do(t, http.MethodGet, path+query, "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out []any
		for _, item := range decodeList(t, rec) {
			out = append(out, item.(map[string]any)["name"])
		}
		return out
	}

	ijara := add(`{"name":" Ijara ","kind":"expense"}`)
	assert.NotEmpty(t, ijara["id"])
	assert.Equal(t, "Ijara", ijara["name"], "trimmed")
	assert.Equal(t, "expense", ijara["kind"])
	assert.Equal(t, true, ijara["is_active"])
	kommunal := add(`{"name":"Kommunal","kind":"expense"}`)
	add(`{"name":"Boshqa kirim","kind":"income"}`)

	assert.Equal(t, []any{"Ijara", "Kommunal", "Boshqa kirim"}, names(employee, ""), "every member reads them, the expenses first")
	assert.Equal(t, []any{"Boshqa kirim"}, names(owner, "?kind=income"))
	rec := api.do(t, http.MethodGet, path+"?kind=transfer", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tur noto'g'ri"}`, rec.Body.String())

	for name, tc := range map[string]struct{ body, want string }{
		"no kind":     {`{"name":"Soliq"}`, `{"error":"validation_error","message":"Turni tanlang"}`},
		"no name":     {`{"name":" ","kind":"expense"}`, `{"error":"validation_error","message":"Nomni kiriting"}`},
		"a long name": {fmt.Sprintf(`{"name":"%s","kind":"expense"}`, strings.Repeat("a", 61)), `{"error":"validation_error","message":"Nom 60 belgidan oshmasin"}`},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, path, `{"name":"ijara","kind":"expense"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli kategoriya allaqachon bor"}`, rec.Body.String())

	ijaraPath := fmt.Sprintf("%s/%v", path, ijara["id"])
	rec = api.do(t, http.MethodPatch, ijaraPath, `{"name":"Ofis ijarasi","is_active":false}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "Ofis ijarasi", edited["name"])
	assert.Equal(t, false, edited["is_active"])
	assert.Equal(t, "expense", edited["kind"], "the kind stays")
	rec = api.do(t, http.MethodPatch, path+"/999999", `{"name":"Soliq"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kategoriya topilmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"kind":"expense","ids":[%v,%v]}`, kommunal["id"], ijara["id"]), bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, []any{"Kommunal", "Ofis ijarasi"}, names(owner, "?kind=expense"), "in the new order")
	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"kind":"expense","ids":[%v]}`, kommunal["id"]), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"order_changed","message":"Ro'yxat o'zgargan. Sahifani yangilang"}`, rec.Body.String())

	rec = api.do(t, http.MethodDelete, ijaraPath, "", bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, ijaraPath, "", bearer(owner)).Code, "deleted already")
	assert.Equal(t, []any{"Kommunal"}, names(owner, "?kind=expense"))

	// The settings are the owner's (and settings.* roles'), not an employee's.
	for name, req := range map[string]struct{ method, path, body string }{
		"adding":   {http.MethodPost, path, `{"name":"Soliq","kind":"expense"}`},
		"changing": {http.MethodPatch, fmt.Sprintf("%s/%v", path, kommunal["id"]), `{"name":"Soliq"}`},
		"ordering": {http.MethodPut, path + "/order", fmt.Sprintf(`{"kind":"expense","ids":[%v]}`, kommunal["id"])},
		"deleting": {http.MethodDelete, fmt.Sprintf("%s/%v", path, kommunal["id"]), ""},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, name)
		assert.JSONEq(t, noPermission, rec.Body.String(), name)
	}
}
