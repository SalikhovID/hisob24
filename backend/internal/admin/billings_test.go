package admin

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateBilling(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	d := dbToday(t, api.pool)
	path := "/admin/companies/" + api.createCompany(t, cookie, "Olma", d.AddDate(0, 0, 5)) + "/billings"

	rec := api.do(t, http.MethodPost, path, `{"days":30,"amount":"150000.50","note":"Naqd"}`, cookie)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.EqualValues(t, 30, body["days"])
	assert.Equal(t, d.AddDate(0, 0, 5).Format(time.DateOnly), body["prev_end_date"])
	assert.Equal(t, d.AddDate(0, 0, 35).Format(time.DateOnly), body["new_end_date"])
	assert.Equal(t, "150000.50", body["amount"])
	assert.Equal(t, "Naqd", body["note"])
	assert.EqualValues(t, ownerID, body["created_by"])

	rec = api.do(t, http.MethodPost, path, `{"days":7}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.Nil(t, body["amount"], "no amount is null")
	assert.Nil(t, body["note"])

	rec = api.do(t, http.MethodPost, path, `{"days":0}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Kunlar soni 1 dan 3650 gacha bo'lishi kerak"}`, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPost, "/admin/companies/999999/billings", `{"days":1}`, cookie).Code)
}

func TestListBillings(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	d := dbToday(t, api.pool)
	path := "/admin/companies/" + api.createCompany(t, cookie, "Olma", d) + "/billings"

	rec := api.do(t, http.MethodGet, path, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `[]`, rec.Body.String(), "no payments yet is [], not null")

	api.do(t, http.MethodPost, path, `{"days":30}`, cookie)
	api.do(t, http.MethodPost, path, `{"days":7}`, cookie)
	rec = api.do(t, http.MethodGet, path, "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var items []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &items))
	require.Len(t, items, 2)
	assert.EqualValues(t, 7, items[0]["days"], "newest first")
	assert.Equal(t, d.AddDate(0, 0, 37).Format(time.DateOnly), items[0]["new_end_date"])
	assert.EqualValues(t, 30, items[1]["days"])
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/admin/companies/999999/billings", "", cookie).Code)
}
