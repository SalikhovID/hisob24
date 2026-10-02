package admin

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createCompany adds a company through the API and returns its id.
func (api testAPI) createCompany(t *testing.T, cookie *http.Cookie, name string, end time.Time) string {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"`+name+`","end_date":"`+end.Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return fmt.Sprintf("%.0f", decode(t, rec)["id"])
}

func TestCreateCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	end := dbToday(t, api.pool).AddDate(0, 0, 30).Format(time.DateOnly)

	rec := api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma MChJ","end_date":"`+end+`","owner_phone":"+998 90 123 45 67","owner_full_name":"Ali"}`, cookie)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.NotZero(t, body["id"])
	assert.Equal(t, "Olma MChJ", body["name"])
	assert.Equal(t, end, body["end_date"])
	assert.EqualValues(t, 30, body["days_left"])
	assert.Equal(t, true, body["is_active"])

	rec = api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"31.12.2026","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/admin/companies",
		`{"name":" ","end_date":"`+end+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Kompaniya nomini kiriting"}`, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/admin/companies", `{}`).Code, "needs a session")
}

func TestListCompanies(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	d := dbToday(t, api.pool)
	api.createCompany(t, cookie, "Olma", d)
	api.createCompany(t, cookie, "Olcha", d.AddDate(0, 0, -1))
	api.createCompany(t, cookie, "Nok", d)

	rec := api.do(t, http.MethodGet, "/admin/companies?search=ol&status=active&page=1", "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.EqualValues(t, 1, body["total"])
	assert.EqualValues(t, 1, body["page"])
	assert.EqualValues(t, 20, body["page_size"])
	items, _ := body["items"].([]any)
	require.Len(t, items, 1)
	assert.Equal(t, "Olma", items[0].(map[string]any)["name"])

	rec = api.do(t, http.MethodGet, "/admin/companies", "", cookie)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 3, decode(t, rec)["total"], "no filter, page 1")
	rec = api.do(t, http.MethodGet, "/admin/companies?search=behi", "", cookie)
	assert.Equal(t, []any{}, decode(t, rec)["items"], "an empty page is [], not null")

	rec = api.do(t, http.MethodGet, "/admin/companies?page=abc", "", cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Sahifa raqami noto'g'ri"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodGet, "/admin/companies?status=deleted", "", cookie).Code)
}
