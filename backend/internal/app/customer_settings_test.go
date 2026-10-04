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
