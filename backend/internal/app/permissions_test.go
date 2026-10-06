package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const noPermission = `{"error":"forbidden","message":"Bu amal uchun ruxsatingiz yo'q"}`

// addRole makes a company role with permissions and returns its id.
func (api testAPI) addRole(t *testing.T, companyID int64, name string, permissions ...string) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3) RETURNING id",
		companyID, name, append([]string{}, permissions...))
}

// giveRole hands the member with phone the role, or takes it away (nil).
func (api testAPI) giveRole(t *testing.T, phone string, companyID int64, roleID *int64) {
	t.Helper()
	api.exec(t, "UPDATE user_companies SET role_id = $1 WHERE user_phone = $2 AND company_id = $3", roleID, phone, companyID)
}

func TestARoleLimitsWhatAnEmployeeMayDo(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	sh := api.customerShop(t, olma)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "customers.view", "tasks.view")
	api.giveRole(t, valisPhone, olma, &kuzatuvchi)
	customer := api.enter(t, owner, sh.jismoniy, "998911112233", fmt.Sprintf(`{"%s":"Dilshod"}`, key(sh.fish)))
	customerPath := fmt.Sprintf("/app/customers/%v", customer["id"])
	newCustomer := fmt.Sprintf(`{"type_id":%d,"phone":"998911112244","values":{"%s":"Malika"}}`, sh.jismoniy, key(sh.fish))

	// What the role holds.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customers", "", bearer(employee)).Code, "the customers may be seen")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, customerPath, "", bearer(employee)).Code)
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/tasks", "", bearer(employee)).Code, "the tasks may be seen")
	// What every member has.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(employee)).Code, "the types are every member's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/members", "", bearer(employee)).Code, "the members are every member's")
	// What the role lacks.
	for name, req := range map[string]struct{ method, path, body string }{
		"adding a customer":      {http.MethodPost, "/app/customers", newCustomer},
		"editing a customer":     {http.MethodPut, customerPath, `{"phone":"998911112233","values":{}}`},
		"deleting a customer":    {http.MethodDelete, customerPath, ""},
		"the customer's history": {http.MethodGet, customerPath + "/history", ""},
		"moving a task":          {http.MethodPatch, "/app/tasks/1/stage", `{"stage_id":1}`},
		"the employees":          {http.MethodGet, "/app/employees", ""},
		"adding a type":          {http.MethodPost, "/app/customer-types", `{"name":"Yuridik"}`},
		"deleting a type":        {http.MethodDelete, fmt.Sprintf("/app/customer-types/%d", sh.jismoniy), ""},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, name)
		assert.JSONEq(t, noPermission, rec.Body.String(), name)
	}
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, customerPath, "", bearer(owner)).Code, "nothing was changed: the customer is there")

	// The role grows: the next request counts it, no new sign-in needed.
	api.exec(t, "UPDATE roles SET permissions = '{customers.view,customers.create,tasks.view}' WHERE id = $1", kuzatuvchi)
	rec := api.do(t, http.MethodPost, "/app/customers", newCustomer, bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	// Without a role the employee is back to the default: the customers and
	// the tasks, not the employees.
	api.giveRole(t, valisPhone, olma, nil)
	rec = api.do(t, http.MethodDelete, customerPath, "", bearer(employee))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/employees", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, noPermission, rec.Body.String())

	// The owner may do everything.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code)
	assert.Equal(t, http.StatusCreated, api.do(t, http.MethodPost, "/app/customer-types", `{"name":"Yuridik"}`, bearer(owner)).Code)
}

func TestPermissionRoutesNeedACompany(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "owner", nok: "owner"})

	for _, path := range []string{"/app/employees", "/app/customers", "/app/tasks"} {
		rec := api.do(t, http.MethodGet, path, "", bearer(undecided))
		require.Equal(t, http.StatusForbidden, rec.Code, path)
		assert.JSONEq(t, companyRequired, rec.Body.String(), path)
	}
}
