package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// uzs is the so'm as /app/me lists it: always on, at 1.
func uzs() map[string]any {
	return map[string]any{"id": 1.0, "code": "UZS", "name": "O'zbek so'mi", "symbol": "so'm", "rate": "1.0000"}
}

// /app/me tells the currencies the company has turned on, each with the
// rate in force now (logic/currencies.md, section 4); none before a
// company is chosen.
func TestMeTellsTheCompanysCurrencies(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	currencies := func(token string) []any {
		rec := api.do(t, http.MethodGet, "/app/me", "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		list, _ := decode(t, rec)["currencies"].([]any)
		return list
	}

	assert.Equal(t, []any{uzs()}, currencies(owner), "the so'm alone, at 1")
	assert.Equal(t, []any{}, currencies(undecided), "nothing before a choice of company")

	api.turnOn(t, olma, 2)
	got := currencies(owner)
	require.Len(t, got, 2)
	assert.Equal(t, map[string]any{"id": 2.0, "code": "USD", "name": "AQSH dollari", "symbol": "$", "rate": nil}, got[1], "no rate set yet")

	api.exec(t, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, $2)", olma, alisPhone)
	got = currencies(owner)
	require.Len(t, got, 2)
	assert.Equal(t, "12800.0000", got[1].(map[string]any)["rate"], "the rate in force now")
}

func TestCurrencyRates(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	viewer, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user"})
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "settings.view")
	api.giveRole(t, sardorsPhone, olma, &kuzatuvchi)
	api.exec(t, "UPDATE user_companies SET full_name = 'Ali aka' WHERE user_phone = $1 AND company_id = $2", alisPhone, olma)

	rec := api.do(t, http.MethodGet, "/app/currency-rates", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `{"items":[],"total":0,"page":1,"page_size":20}`, rec.Body.String(), "no rate yet")
	rec = api.do(t, http.MethodGet, "/app/currency-rates", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the settings are not an employee's by default")
	assert.JSONEq(t, noPermission, rec.Body.String())
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/currency-rates", "", bearer(viewer)).Code, "settings.view sees the rates")

	rec = api.do(t, http.MethodPost, "/app/currency-rates", `{"usd":"12800"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"currency_not_allowed","message":"Bu valyuta kompaniyada yoqilmagan"}`, rec.Body.String(), "the dollar is off")

	api.turnOn(t, olma, 2)
	rec = api.do(t, http.MethodPost, "/app/currency-rates", `{"usd":"12800"}`, bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	rates := decode(t, rec)
	assert.NotEmpty(t, rates["id"])
	assert.Equal(t, "12800.0000", rates["usd"])
	assert.Equal(t, "0.0000", rates["eur"], "a currency that is off stays 0")
	assert.Equal(t, "0.0000", rates["rub"])
	assert.Equal(t, "Ali aka", rates["set_by_name"], "who set it, by the name they go by in the company")
	assert.NotEmpty(t, rates["set_at"])

	rec = api.do(t, http.MethodGet, "/app/currency-rates", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 1, page["total"])
	items, _ := page["items"].([]any)
	require.Len(t, items, 1)
	assert.Equal(t, "12800.0000", items[0].(map[string]any)["usd"])

	for name, tc := range map[string]struct{ body, want string }{
		"a bad rate":                       {`{"usd":"abc"}`, `{"error":"validation_error","message":"Kurs noto'g'ri"}`},
		"nothing":                          {`{}`, `{"error":"validation_error","message":"Kursni kiriting"}`},
		"a rate of a currency that is off": {`{"rub":"150"}`, `{"error":"currency_not_allowed","message":"Bu valyuta kompaniyada yoqilmagan"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/currency-rates", tc.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodGet, "/app/currency-rates?page=abc", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Sahifa raqami noto'g'ri"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/currency-rates", `{"usd":"12900"}`, bearer(viewer))
	assert.Equal(t, http.StatusForbidden, rec.Code, "settings.view alone does not set the rates")
	assert.JSONEq(t, noPermission, rec.Body.String())
}
