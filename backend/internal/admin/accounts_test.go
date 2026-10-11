package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// accountsOf is the accounts the company detail lists, as JSON.
func (api testAPI) accountsOf(t *testing.T, cookie *http.Cookie, id string) []map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct {
		Accounts []map[string]any `json:"accounts"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body.Accounts
}

func TestCompanyAccounts(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))
	path := "/admin/companies/" + id + "/accounts"

	accounts := api.accountsOf(t, cookie, id)
	require.Len(t, accounts, 1, "a new company has its cash")
	cash := accounts[0]
	assert.Equal(t, "Naqd", cash["name"])
	assert.EqualValues(t, 1, cash["currency_id"])
	assert.Equal(t, true, cash["is_active"])
	assert.NotEmpty(t, cash["created_at"])

	rec := api.do(t, http.MethodPost, path, `{"name":" Karta ","currency_id":2}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"currency_not_allowed","message":"Bu valyuta kompaniyada yoqilmagan"}`, rec.Body.String(), "the dollar is off")
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2]}`, cookie).Code)
	rec = api.do(t, http.MethodPost, path, `{"name":" Karta ","currency_id":2}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	card := decode(t, rec)
	assert.NotEmpty(t, card["id"])
	assert.Equal(t, "Karta", card["name"], "trimmed")
	assert.EqualValues(t, 2, card["currency_id"])
	assert.Equal(t, true, card["is_active"])
	cardPath := fmt.Sprintf("%s/%v", path, card["id"])

	for name, tc := range map[string]struct{ body, want string }{
		"no name":        {`{"name":" ","currency_id":1}`, `{"error":"validation_error","message":"Nomni kiriting"}`},
		"a long name":    {fmt.Sprintf(`{"name":"%s","currency_id":1}`, strings.Repeat("a", 61)), `{"error":"validation_error","message":"Nom 60 belgidan oshmasin"}`},
		"no currency":    {`{"name":"Bank"}`, `{"error":"validation_error","message":"Valyutani tanlang"}`},
		"not a currency": {`{"name":"Bank","currency_id":9}`, `{"error":"validation_error","message":"Valyuta noto'g'ri"}`},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, cookie)
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, path, `{"name":"karta","currency_id":1}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli akkaunt allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/admin/companies/999999/accounts", `{"name":"Bank","currency_id":1}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPatch, cardPath, `{"name":"Humo","is_active":false}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	humo := decode(t, rec)
	assert.Equal(t, "Humo", humo["name"])
	assert.Equal(t, false, humo["is_active"])
	assert.EqualValues(t, 2, humo["currency_id"], "what is not given stays")
	rec = api.do(t, http.MethodPatch, fmt.Sprintf("%s/%v", path, cash["id"]), `{"is_active":false}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"last_account","message":"Kompaniyada kamida bitta faol akkaunt qolsin"}`, rec.Body.String(), "the last active account stays on")
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("%s/%v", path, cash["id"]), "", cookie)
	assert.Equal(t, http.StatusConflict, rec.Code, "nor is it deleted")
	rec = api.do(t, http.MethodPatch, path+"/999999", `{"name":"Bank"}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Akkaunt topilmadi"}`, rec.Body.String())

	accounts = api.accountsOf(t, cookie, id)
	require.Len(t, accounts, 2)
	assert.Equal(t, "Humo", accounts[1]["name"])

	rec = api.do(t, http.MethodDelete, cardPath, "", cookie)
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, cardPath, "", cookie).Code, "deleted already")
	assert.Len(t, api.accountsOf(t, cookie, id), 1)

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, path, `{"name":"Bank","currency_id":1}`).Code, "needs a session")
}
