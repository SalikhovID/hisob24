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

func TestDeleteCustomerDropdown(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	holat := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Holat') RETURNING id", olma)
	jismoniy := api.id(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", olma)
	api.exec(t, `INSERT INTO customer_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Holat', 'radio', $3, 1)`, olma, jismoniy, holat)
	path := fmt.Sprintf("/app/customer-dropdowns/%d", manba)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Empty(t, rec.Body.String())
	assert.Len(t, list(t, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner))), 1, "it is gone from the company's dropdowns")

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, dropdownNotFound, rec.Body.String())
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("/app/customer-dropdowns/%d", holat), "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a field takes its options from it")
	assert.JSONEq(t, `{"error":"dropdown_in_use","message":"Bu dropdown 1 ta maydonda ishlatilgan"}`, rec.Body.String())
}

const optionNotFound = `{"error":"not_found","message":"Variant topilmadi"}`

func TestAddCustomerDropdownOption(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	path := fmt.Sprintf("/app/customer-dropdowns/%d/options", manba)

	rec := api.do(t, http.MethodPost, path, `{"label":" Instagram "}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Instagram", created["label"])
	assert.Equal(t, true, created["is_active"])
	assert.NotEmpty(t, created["id"])

	rec = api.do(t, http.MethodPost, path, `{"label":"instagram"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu variant allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-dropdowns/999/options", `{"label":"Yo'q"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, dropdownNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPost, path, `{"label":"LinkedIn"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestUpdateCustomerDropdownOption(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	instagram := api.id(t, `INSERT INTO customer_dropdown_options (dropdown_id, label, position)
		VALUES ($1, 'Instagram', 1) RETURNING id`, manba)
	path := fmt.Sprintf("/app/customer-dropdowns/%d/options/%d", manba, instagram)

	rec := api.do(t, http.MethodPatch, path, `{"label":"Insta"}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"label":"Insta","is_active":true}`, instagram), rec.Body.String(), "renamed, still offered")

	rec = api.do(t, http.MethodPatch, path, `{"is_active":false}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"label":"Insta","is_active":false}`, instagram), rec.Body.String(), "turned off, under the same name")

	rec = api.do(t, http.MethodPatch, fmt.Sprintf("/app/customer-dropdowns/%d/options/999", manba), `{"label":"Yo'q"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, optionNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"label":"Begona"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestDeleteCustomerDropdownOption(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	instagram := api.id(t, `INSERT INTO customer_dropdown_options (dropdown_id, label, position)
		VALUES ($1, 'Instagram', 1) RETURNING id`, manba)
	path := fmt.Sprintf("/app/customer-dropdowns/%d/options/%d", manba, instagram)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	dropdowns := list(t, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner)))
	assert.Equal(t, []any{}, dropdowns[0]["options"], "it is gone from the dropdown")

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, optionNotFound, rec.Body.String())
}

const orderChanged = `{"error":"order_changed","message":"Ro'yxat o'zgargan. Sahifani yangilang"}`

func TestOrderCustomerDropdownOptions(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	instagram := api.id(t, `INSERT INTO customer_dropdown_options (dropdown_id, label, position)
		VALUES ($1, 'Instagram', 1) RETURNING id`, manba)
	linkedin := api.id(t, `INSERT INTO customer_dropdown_options (dropdown_id, label, position)
		VALUES ($1, 'LinkedIn', 2) RETURNING id`, manba)
	path := fmt.Sprintf("/app/customer-dropdowns/%d/options/order", manba)

	rec := api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d,%d]}`, linkedin, instagram), bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	options, _ := list(t, api.do(t, http.MethodGet, "/app/customer-dropdowns", "", bearer(owner)))[0]["options"].([]any)
	require.Len(t, options, 2)
	assert.Equal(t, "LinkedIn", options[0].(map[string]any)["label"], "the options stand in the new order")

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d]}`, instagram), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "an option is missing")
	assert.JSONEq(t, orderChanged, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/app/customer-dropdowns/999/options/order", `{"ids":[]}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, dropdownNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d,%d]}`, instagram, linkedin), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

const typeNotFound = `{"error":"not_found","message":"Tur topilmadi"}`

func TestCreateCustomerType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})

	rec := api.do(t, http.MethodPost, "/app/customer-types", `{"name":" Jismoniy "}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Jismoniy", created["name"])
	assert.Equal(t, []any{}, created["fields"])
	assert.NotEmpty(t, created["id"])
	assert.Len(t, list(t, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(owner))), 1, "it joins the company's types")

	rec = api.do(t, http.MethodPost, "/app/customer-types", `{"name":"jismoniy"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli tur allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-types", `{"name":" "}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Nomni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-types", `{"name":"Yuridik"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

// addType inserts a customer type of the company at a place and returns its id.
func (api testAPI) addType(t *testing.T, companyID int64, name string, position int) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, $2, $3) RETURNING id",
		companyID, name, position)
}

func TestOrderCustomerTypes(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	jismoniy := api.addType(t, olma, "Jismoniy", 1)
	yuridik := api.addType(t, olma, "Yuridik", 2)

	rec := api.do(t, http.MethodPut, "/app/customer-types/order", fmt.Sprintf(`{"ids":[%d,%d]}`, yuridik, jismoniy), bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(owner)))
	require.Len(t, types, 2)
	assert.Equal(t, "Yuridik", types[0]["name"], "the types stand in the new order")

	rec = api.do(t, http.MethodPut, "/app/customer-types/order", fmt.Sprintf(`{"ids":[%d]}`, jismoniy), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a type is missing")
	assert.JSONEq(t, orderChanged, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/app/customer-types/order", fmt.Sprintf(`{"ids":[%d,%d]}`, jismoniy, yuridik), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestRenameCustomerType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	jismoniy := api.addType(t, olma, "Jismoniy", 1)
	path := fmt.Sprintf("/app/customer-types/%d", jismoniy)

	rec := api.do(t, http.MethodPatch, path, `{"name":"Shaxs"}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"name":"Shaxs","fields":[]}`, jismoniy), rec.Body.String())

	rec = api.do(t, http.MethodPatch, "/app/customer-types/999", `{"name":"Yo'q"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, typeNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"name":"Begona"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestDeleteCustomerType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	jismoniy := api.addType(t, olma, "Jismoniy", 1)
	api.addType(t, olma, "Yuridik", 2)
	path := fmt.Sprintf("/app/customer-types/%d", jismoniy)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(owner)))
	require.Len(t, types, 1, "it is gone from the company's types")
	assert.Equal(t, "Yuridik", types[0]["name"])

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, typeNotFound, rec.Body.String())
}

const fieldNotFound = `{"error":"not_found","message":"Maydon topilmadi"}`

func TestAddCustomerField(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	jismoniy := api.addType(t, olma, "Jismoniy", 1)
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	path := fmt.Sprintf("/app/customer-types/%d/fields", jismoniy)

	rec := api.do(t, http.MethodPost, path, `{"label":" F.I.Sh. ","kind":"string","required":true,"is_unique":true}`, bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	fish := decode(t, rec)
	assert.NotEmpty(t, fish["id"])
	delete(fish, "id")
	assert.Equal(t, map[string]any{"label": "F.I.Sh.", "kind": "string", "required": true, "is_unique": true, "dropdown_id": nil}, fish)

	rec = api.do(t, http.MethodPost, path, fmt.Sprintf(`{"label":"Manba","kind":"checkbox","dropdown_id":%d}`, manba), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	source := decode(t, rec)
	assert.Equal(t, "checkbox", source["kind"])
	assert.Equal(t, false, source["required"], "a mark that is not given is off")
	assert.EqualValues(t, manba, source["dropdown_id"])

	rec = api.do(t, http.MethodPost, path, `{"label":"Tanlov","kind":"radio"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code, "a choice field without a dropdown")
	assert.JSONEq(t, `{"error":"validation_error","message":"Dropdownni tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, path, `{"label":"f.i.sh.","kind":"int"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli maydon allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customer-types/999/fields", `{"label":"Ism","kind":"string"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, typeNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPost, path, `{"label":"Izoh","kind":"string"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}
