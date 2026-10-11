package admin

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	uzsJSON = `{"id":1,"code":"UZS","name":"O'zbek so'mi","symbol":"so'm"}`
	usdJSON = `{"id":2,"code":"USD","name":"AQSH dollari","symbol":"$"}`
	eurJSON = `{"id":3,"code":"EUR","name":"Yevro","symbol":"€"}`
	rubJSON = `{"id":4,"code":"RUB","name":"Rossiya rubli","symbol":"₽"}`
)

func TestListCurrencies(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)

	rec := api.do(t, http.MethodGet, "/admin/currencies", "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+","+rubJSON+"]", rec.Body.String(), "the catalog, the so'm first")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/admin/currencies", "").Code, "needs a session")
}

// currenciesOf is the currencies the company detail lists, as JSON.
func (api testAPI) currenciesOf(t *testing.T, cookie *http.Cookie, id string) string {
	t.Helper()
	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct {
		Currencies json.RawMessage `json:"currencies"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return string(body.Currencies)
}

func TestSetCompanyCurrencies(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))

	assert.JSONEq(t, "["+uzsJSON+"]", api.currenciesOf(t, cookie, id), "a new company has the so'm")

	rec := api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[3,2]}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", rec.Body.String(), "the so'm stays, the rest in the catalog's order")
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", api.currenciesOf(t, cookie, id))

	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2,9]}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Valyuta noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/admin/companies/999999/currencies", `{"currency_ids":[2]}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())

	_, err := api.pool.Exec(t.Context(), "INSERT INTO products (company_id, kind, name, unit, price, currency_id, created_by) VALUES ($1, 'product', 'Olma', 'kg', 10, 3, '998901234567')", id)
	require.NoError(t, err)
	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2]}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"currency_in_use","message":"Bu valyutada 1 ta mahsulot bor"}`, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", api.currenciesOf(t, cookie, id), "nothing changed")

	_, err = api.pool.Exec(t.Context(), "UPDATE products SET deleted_at = now()")
	require.NoError(t, err)
	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[]}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+"]", rec.Body.String(), "a deleted product holds nothing")

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2]}`).Code)
}
