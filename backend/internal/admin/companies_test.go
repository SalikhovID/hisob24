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

func TestGetCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool).AddDate(0, 0, 3))

	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "Olma", body["name"])
	assert.EqualValues(t, 3, body["days_left"])
	users, _ := body["users"].([]any)
	require.Len(t, users, 1)
	owner, _ := users[0].(map[string]any)
	assert.Equal(t, "998901234567", owner["phone"])
	assert.Equal(t, "Ali", owner["full_name"])
	assert.Equal(t, "owner", owner["role"])
	assert.Contains(t, owner, "role_id", "the member's company role goes with the member")
	assert.Nil(t, owner["role_name"], "the owner holds none")
	assert.Contains(t, owner, "locations", "and the locations they may work in")
	assert.Nil(t, owner["locations"], "every one: null")
	locations, _ := body["locations"].([]any)
	require.Len(t, locations, 1, "the company's locations: the ready one")
	asosiy, _ := locations[0].(map[string]any)
	assert.NotEmpty(t, asosiy["id"])
	assert.Equal(t, "Asosiy", asosiy["name"])
	assert.EqualValues(t, 0, asosiy["tasks_count"], "with how many tasks stand in it")
	assert.NotEmpty(t, asosiy["created_at"])

	rec = api.do(t, http.MethodGet, "/admin/companies/999999", "", cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/admin/companies/abc", "", cookie).Code)
}

func TestPatchCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	path := "/admin/companies/" + api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))

	rec := api.do(t, http.MethodPatch, path, `{"is_active":false}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, false, body["is_active"])
	assert.Equal(t, "Olma", body["name"], "untouched")

	rec = api.do(t, http.MethodPatch, path, `{"name":"Olma MChJ"}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.Equal(t, "Olma MChJ", body["name"])
	assert.Equal(t, false, body["is_active"], "untouched")

	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPatch, path, `{"name":""}`, cookie).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPatch, "/admin/companies/999999", `{"name":"X"}`, cookie).Code)
}

func TestReplaceCompanyOwner(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	company := "/admin/companies/" + api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))
	path := company + "/owner"

	rec := api.do(t, http.MethodPut, path, `{"phone":"90 222 33 44","full_name":" Yangi Egasi "}`, cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "998902223344", body["phone"])
	assert.Equal(t, "Yangi Egasi", body["full_name"])
	assert.Equal(t, "owner", body["role"])
	assert.NotEmpty(t, body["created_at"])
	rec = api.do(t, http.MethodGet, company, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	roles := map[string]any{}
	users, _ := decode(t, rec)["users"].([]any)
	for _, u := range users {
		member, _ := u.(map[string]any)
		roles[member["phone"].(string)] = member["role"]
	}
	assert.Equal(t, map[string]any{"998901234567": "user", "998902223344": "owner"}, roles, "the owner before stays as a user")

	rec = api.do(t, http.MethodPut, path, `{"phone":"998903334455","full_name":" "}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Ismni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, `{"phone":"12ab","full_name":"Ism"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Telefon raqami noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/admin/companies/999999/owner", `{"phone":"998903334455","full_name":"Ism"}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, `{"phone":"998903334455","full_name":"Ism"}`).Code,
		"needs a session")
}

// locationsOf reads the company's locations as "name (N)".
func (api testAPI) locationsOf(t *testing.T, cookie *http.Cookie, id string) []string {
	t.Helper()
	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	raw, _ := decode(t, rec)["locations"].([]any)
	list := make([]string, 0, len(raw))
	for _, l := range raw {
		location, _ := l.(map[string]any)
		list = append(list, fmt.Sprintf("%s (%.0f)", location["name"], location["tasks_count"]))
	}
	return list
}

// addTask enters a task of the company in the location, as the user app
// would, for a customer entered with it; the company's ready settings are
// used.
func (api testAPI) addTask(t *testing.T, companyID string, locationID any) {
	t.Helper()
	_, err := api.pool.Exec(t.Context(), `WITH c AS (
		INSERT INTO customers (company_id, type_id, phone, created_by)
		SELECT $1, id, '998901234567', '998901234567' FROM customer_types WHERE company_id = $1 LIMIT 1 RETURNING id)
		INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		SELECT $1, (SELECT id FROM task_types WHERE company_id = $1 LIMIT 1), (SELECT id FROM task_stages WHERE company_id = $1 LIMIT 1),
		       c.id, $2, 'Qo''ng''iroq', CURRENT_DATE, '998901234567' FROM c`, companyID, locationID)
	require.NoError(t, err)
}

func TestLocations(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	id := api.createCompany(t, cookie, "Olma", dbToday(t, api.pool))
	nok := api.createCompany(t, cookie, "Nok", dbToday(t, api.pool))
	path := "/admin/companies/" + id + "/locations"

	rec := api.do(t, http.MethodPost, path, `{"name":"  Chilonzor "}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	chilonzor := decode(t, rec)
	assert.Equal(t, "Chilonzor", chilonzor["name"], "the name without the spaces around it")
	assert.NotEmpty(t, chilonzor["id"])
	assert.EqualValues(t, 0, chilonzor["tasks_count"])
	assert.NotEmpty(t, chilonzor["created_at"])
	assert.Equal(t, []string{"Asosiy (0)", "Chilonzor (0)"}, api.locationsOf(t, cookie, id), "in the order they were added")

	rec = api.do(t, http.MethodPost, path, `{"name":" "}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Nomni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, path, `{"name":"chilonzor"}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code, "the name is taken, whatever the case")
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli lokatsiya allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/admin/companies/999999/locations", `{"name":"X"}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kompaniya topilmadi"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, path, `{"name":`, cookie).Code, "not JSON")

	one := fmt.Sprintf("%s/%.0f", path, chilonzor["id"])
	rec = api.do(t, http.MethodPatch, one, `{"name":" Chilonzor filiali "}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "Chilonzor filiali", decode(t, rec)["name"])
	rec = api.do(t, http.MethodPatch, one, `{"name":"asosiy"}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code, "another location's name")
	rec = api.do(t, http.MethodPatch, path+"/999999", `{"name":"X"}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Lokatsiya topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, "/admin/companies/"+nok+"/locations/"+fmt.Sprintf("%.0f", chilonzor["id"]), `{"name":"X"}`, cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's location")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPatch, path+"/abc", `{"name":"X"}`, cookie).Code, "an id that is no number")

	asosiy := fmt.Sprintf("%s/%.0f", path, decode(t, api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie))["locations"].([]any)[0].(map[string]any)["id"])
	api.addTask(t, id, chilonzor["id"])
	rec = api.do(t, http.MethodDelete, one, "", cookie)
	assert.Equal(t, http.StatusConflict, rec.Code, "a task stands in it")
	assert.JSONEq(t, `{"error":"location_in_use","message":"Bu lokatsiyada 1 ta vazifa bor"}`, rec.Body.String())
	assert.Equal(t, []string{"Asosiy (0)", "Chilonzor filiali (1)"}, api.locationsOf(t, cookie, id), "the count on the list")
	_, err := api.pool.Exec(t.Context(), "UPDATE tasks SET deleted_at = now()")
	require.NoError(t, err)
	rec = api.do(t, http.MethodDelete, one, "", cookie)
	assert.Equal(t, http.StatusNoContent, rec.Code, "the deleted task does not hold it: %s", rec.Body.String())
	assert.Equal(t, []string{"Asosiy (0)"}, api.locationsOf(t, cookie, id), "hidden")
	rec = api.do(t, http.MethodDelete, asosiy, "", cookie)
	assert.Equal(t, http.StatusConflict, rec.Code, "the company's only location")
	assert.JSONEq(t, `{"error":"last_location","message":"Kompaniyaning yagona lokatsiyasi o'chirilmaydi"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, one, "", cookie)
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")

	for _, r := range []struct{ method, path string }{{http.MethodPost, path}, {http.MethodPatch, one}, {http.MethodDelete, one}} {
		assert.Equal(t, http.StatusUnauthorized, api.do(t, r.method, r.path, `{"name":"X"}`).Code, "%s without a session", r.method)
	}
}
