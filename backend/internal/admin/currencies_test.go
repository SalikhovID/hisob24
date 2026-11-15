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

	rec := api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[3,1,2]}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", rec.Body.String(), "the catalog's order")
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", api.currenciesOf(t, cookie, id))

	// The so'm is never taken out (logic/currencies.md, section 3).
	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2]}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"UZS olib tashlanmaydi"}`, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", api.currenciesOf(t, cookie, id), "nothing changed")

	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[1,2,9]}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Valyuta noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/admin/companies/999999/currencies", `{"currency_ids":[1,2]}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())

	_, err := api.pool.Exec(t.Context(), "INSERT INTO products (company_id, kind, name, unit, price, currency_id, created_by) VALUES ($1, 'product', 'Olma', 'kg', 10, 3, '998901234567')", id)
	require.NoError(t, err)
	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[1,2]}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"currency_in_use","message":"Bu valyutada 1 ta mahsulot bor"}`, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+","+usdJSON+","+eurJSON+"]", api.currenciesOf(t, cookie, id), "nothing changed")

	_, err = api.pool.Exec(t.Context(), "UPDATE products SET deleted_at = now()")
	require.NoError(t, err)
	rec = api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[1]}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, "["+uzsJSON+"]", rec.Body.String(), "a deleted product holds nothing")

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, "/admin/companies/"+id+"/currencies", `{"currency_ids":[2]}`).Code)
}

// The company's detail says where it takes its rates and the step: the
// central bank and 100 for a new one (logic/currencies.md, section 4).
func TestGetCompanyTellsItsRateSource(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))

	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "cbu", body["rate_source"])
	assert.EqualValues(t, 100, body["rate_rounding"])
}

// The admin sets where the company takes its rates and the step: a bank or
// manual, 1, 10, 100 or 1000 (logic/currencies.md, section 4).
func TestSetCompanyRateSource(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))
	path := "/admin/companies/" + id + "/rate-source"

	rec := api.do(t, http.MethodPut, path, `{"source":"kapitalbank","rounding":1000}`, cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `{"source":"kapitalbank","rounding":1000}`, rec.Body.String())
	body := decode(t, api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie))
	assert.Equal(t, "kapitalbank", body["rate_source"])
	assert.EqualValues(t, 1000, body["rate_rounding"])

	for name, tc := range map[string]struct{ body, want string }{
		"not a source": {`{"source":"nbu","rounding":100}`, `{"error":"validation_error","message":"Manba noto'g'ri"}`},
		"no source":    {`{"rounding":100}`, `{"error":"validation_error","message":"Manba noto'g'ri"}`},
		"not a step":   {`{"source":"cbu","rounding":50}`, `{"error":"validation_error","message":"Yaxlitlash noto'g'ri"}`},
	} {
		rec := api.do(t, http.MethodPut, path, tc.body, cookie)
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPut, "/admin/companies/999999/rate-source", `{"source":"cbu","rounding":100}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, `{"source":"cbu","rounding":100}`).Code, "needs a session")
}
