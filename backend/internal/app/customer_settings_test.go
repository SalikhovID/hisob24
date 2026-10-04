package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// list decodes a JSON array of records.
func list(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var records []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &records), rec.Body.String())
	return records
}

// id inserts a row with sql and returns the id it gives back.
func (api testAPI) id(t *testing.T, sql string, args ...any) int64 {
	t.Helper()
	var id int64
	require.NoError(t, api.pool.QueryRow(t.Context(), sql, args...).Scan(&id))
	return id
}

const (
	companyRequired = `{"error":"company_required","message":"Avval kompaniyani tanlang"}`
	ownerOnly       = `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`
)

func TestListCustomerDropdowns(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	instagram := api.id(t, `INSERT INTO customer_dropdown_options (dropdown_id, label, position, is_active)
		VALUES ($1, 'Instagram', 1, false) RETURNING id`, manba)
	api.exec(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Begona')", nok)

	rec := api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`[{"id":%d,"name":"Manba","options":[{"id":%d,"label":"Instagram","is_active":false}]}]`, manba, instagram),
		rec.Body.String(), "an employee reads the dropdowns of the company they work in, nobody else's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner)).Code, "the owner")

	rec = api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/customer-dropdowns", "").Code, "no access token")
	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE - 1 WHERE id = $1", olma)
	assert.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner)).Code,
		"an expired company")
}

func TestListCustomerTypes(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	yuridik := api.id(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Yuridik', 1) RETURNING id", olma)
	inn := api.id(t, `INSERT INTO customer_fields (company_id, type_id, label, kind, required, is_unique, position)
		VALUES ($1, $2, 'INN', 'int', true, true, 1) RETURNING id`, olma, yuridik)
	source := api.id(t, `INSERT INTO customer_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Manba', 'dropdown', $3, 2) RETURNING id`, olma, yuridik, manba)
	api.exec(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Begona', 1)", nok)

	rec := api.do(t, http.MethodGet, "/app/customer-types", "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`[{"id":%d,"name":"Yuridik","fields":[
		{"id":%d,"label":"INN","kind":"int","required":true,"is_unique":true,"dropdown_id":null},
		{"id":%d,"label":"Manba","kind":"dropdown","required":false,"is_unique":false,"dropdown_id":%d}]}]`, yuridik, inn, source, manba),
		rec.Body.String(), "an employee reads the types of the company they work in, nobody else's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(owner)).Code, "the owner")

	rec = api.do(t, http.MethodGet, "/app/customer-types", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/customer-types", "").Code, "no access token")
}

func TestCreateCustomerDropdown(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})

	rec := api.do(t, http.MethodPost, "/app/customer-dropdowns", `{"name":" Manba "}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Manba", created["name"])
	assert.Equal(t, []any{}, created["options"])
	assert.NotEmpty(t, created["id"])
	assert.Len(t, list(t, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner))), 1, "it joins the company's dropdowns")

	rec = api.do(t, http.MethodPost, "/app/customer-dropdowns", `{"name":"manba"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli dropdown allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-dropdowns", `{"name":""}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Nomni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-dropdowns", `{"name":`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code, "not JSON")

	rec = api.do(t, http.MethodPost, "/app/customer-dropdowns", `{"name":"Holat"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

const dropdownNotFound = `{"error":"not_found","message":"Dropdown topilmadi"}`

func TestRenameCustomerDropdown(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	path := fmt.Sprintf("/app/customer-dropdowns/%d", manba)

	rec := api.do(t, http.MethodPatch, path, `{"name":"Qayerdan"}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"name":"Qayerdan","options":[]}`, manba), rec.Body.String())

	rec = api.do(t, http.MethodPatch, "/app/customer-dropdowns/999", `{"name":"Yo'q"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, dropdownNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPatch, "/app/customer-dropdowns/abc", `{"name":"Yo'q"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "an id that is no number")
	assert.JSONEq(t, dropdownNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"name":"Begona"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}
