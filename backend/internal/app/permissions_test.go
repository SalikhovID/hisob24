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
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "customers.view", "orders.view")
	api.giveRole(t, valisPhone, olma, &kuzatuvchi)
	customer := api.enter(t, owner, sh.jismoniy, "998911112233", fmt.Sprintf(`{"%s":"Dilshod"}`, key(sh.fish)))
	customerPath := fmt.Sprintf("/app/customers/%v", customer["id"])
	newCustomer := fmt.Sprintf(`{"type_id":%d,"phone":"998911112244","values":{"%s":"Malika"}}`, sh.jismoniy, key(sh.fish))

	// What the role holds.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customers", "", bearer(employee)).Code, "the customers may be seen")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, customerPath, "", bearer(employee)).Code)
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/orders", "", bearer(employee)).Code, "the orders may be seen")
	// What every member has.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customer-types", "", bearer(employee)).Code, "the types are every member's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/members", "", bearer(employee)).Code, "the members are every member's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/finance-categories", "", bearer(employee)).Code, "the finance categories are every member's")
	// What the role lacks.
	for name, req := range map[string]struct{ method, path, body string }{
		"adding a customer":       {http.MethodPost, "/app/customers", newCustomer},
		"editing a customer":      {http.MethodPut, customerPath, `{"phone":"998911112233","values":{}}`},
		"deleting a customer":     {http.MethodDelete, customerPath, ""},
		"the customer's history":  {http.MethodGet, customerPath + "/history", ""},
		"moving an order":         {http.MethodPatch, "/app/orders/1/stage", `{"stage_id":1}`},
		"the employees":           {http.MethodGet, "/app/employees", ""},
		"adding a type":           {http.MethodPost, "/app/customer-types", `{"name":"Yuridik"}`},
		"the products":            {http.MethodGet, "/app/products", ""},
		"adding a product":        {http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona"}`},
		"a product's purchases":   {http.MethodGet, "/app/products/1/purchases", ""},
		"the suppliers":           {http.MethodGet, "/app/suppliers", ""},
		"adding a supplier":       {http.MethodPost, "/app/suppliers", `{"name":"Bozor"}`},
		"a supplier's payments":   {http.MethodGet, "/app/suppliers/1/payments", ""},
		"a supplier's statement":  {http.MethodGet, "/app/suppliers/1/statement", ""},
		"the purchases":           {http.MethodGet, "/app/purchases", ""},
		"adding a purchase":       {http.MethodPost, "/app/purchases", `{"location_id":1}`},
		"a supplier's openings":   {http.MethodGet, "/app/suppliers/1/openings", ""},
		"the sales":               {http.MethodGet, "/app/sales", ""},
		"adding a sale":           {http.MethodPost, "/app/sales", `{"location_id":1}`},
		"a customer's payments":   {http.MethodGet, "/app/customers/1/payments", ""},
		"a customer's openings":   {http.MethodGet, "/app/customers/1/openings", ""},
		"a customer's statement":  {http.MethodGet, "/app/customers/1/statement", ""},
		"the transfers":           {http.MethodGet, "/app/transfers", ""},
		"adding a transfer":       {http.MethodPost, "/app/transfers", `{"location_id":1}`},
		"the inventories":         {http.MethodGet, "/app/inventories", ""},
		"the opening stock":       {http.MethodGet, "/app/opening-stock", ""},
		"the stock":               {http.MethodGet, "/app/stock?location_id=1", ""},
		"a product's moves":       {http.MethodGet, "/app/products/1/moves", ""},
		"deleting a type":         {http.MethodDelete, fmt.Sprintf("/app/customer-types/%d", sh.jismoniy), ""},
		"the rates":               {http.MethodGet, "/app/currency-rates", ""},
		"setting the rates":       {http.MethodPost, "/app/currency-rates", `{"usd":"12800"}`},
		"adding a category":       {http.MethodPost, "/app/finance-categories", `{"name":"Ijara","kind":"expense"}`},
		"the accounts":            {http.MethodGet, "/app/accounts", ""},
		"an account's statement":  {http.MethodGet, "/app/accounts/1/statement", ""},
		"the cash openings":       {http.MethodGet, "/app/cash-openings", ""},
		"adding a cash opening":   {http.MethodPost, "/app/cash-openings", `{"bank_account_id":1}`},
		"the expenses":            {http.MethodGet, "/app/expenses", ""},
		"adding an expense":       {http.MethodPost, "/app/expenses", `{"kind":"expense"}`},
		"the money transfers":     {http.MethodGet, "/app/money-transfers", ""},
		"adding a money transfer": {http.MethodPost, "/app/money-transfers", `{"from_account_id":1}`},
		"the conversions":         {http.MethodGet, "/app/conversions", ""},
		"adding a conversion":     {http.MethodPost, "/app/conversions", `{"from_account_id":1}`},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, name)
		assert.JSONEq(t, noPermission, rec.Body.String(), name)
	}
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, customerPath, "", bearer(owner)).Code, "nothing was changed: the customer is there")

	// The role grows: the next request counts it, no new sign-in needed.
	api.exec(t, "UPDATE roles SET permissions = '{customers.view,customers.create,orders.view}' WHERE id = $1", kuzatuvchi)
	rec := api.do(t, http.MethodPost, "/app/customers", newCustomer, bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	// Without a role the employee is back to the default: the customers and
	// the orders, not the employees.
	api.giveRole(t, valisPhone, olma, nil)
	rec = api.do(t, http.MethodDelete, customerPath, "", bearer(employee))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/employees", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona"}`, bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, "the default holds the warehouse sections too: %s", rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/suppliers", `{"name":"Bozor"}`, bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, "the suppliers too: %s", rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(employee))
	assert.Equal(t, http.StatusOK, rec.Code, "and the purchases: %s", rec.Body.String())

	// The owner may do everything.
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code)
	assert.Equal(t, http.StatusCreated, api.do(t, http.MethodPost, "/app/customer-types", `{"name":"Yuridik"}`, bearer(owner)).Code)
}

func TestPermissionRoutesNeedACompany(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "owner", nok: "owner"})

	for _, path := range []string{"/app/employees", "/app/customers", "/app/orders"} {
		rec := api.do(t, http.MethodGet, path, "", bearer(undecided))
		require.Equal(t, http.StatusForbidden, rec.Code, path)
		assert.JSONEq(t, companyRequired, rec.Body.String(), path)
	}
}

func TestAnOrderWithANewCustomerNeedsCustomersCreate(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	sh := api.orderShop(t, olma)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	operator := api.addRole(t, olma, "Operator", "orders.view", "orders.create", "customers.view")
	api.giveRole(t, valisPhone, olma, &operator)
	customer := api.enter(t, owner, sh.jismoniy, "998911112233", fmt.Sprintf(`{"%s":"Dilshod"}`, key(sh.fish)))
	newCustomer := fmt.Sprintf(`{"type_id":%d,"phone":"998911112244","values":{"%s":"Malika"}}`, sh.jismoniy, key(sh.fish))
	withNew := fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-20","stage_id":%d,"values":{"%s":"Izoh"},"customer":%s}`,
		sh.buyurtma, sh.asosiy, sh.yangi, key(sh.izoh), newCustomer)

	rec := api.do(t, http.MethodPost, "/app/orders", withNew, bearer(employee))

	assert.Equal(t, http.StatusForbidden, rec.Code, "entering a customer with the order needs customers.create")
	assert.JSONEq(t, noPermission, rec.Body.String())
	var orders, customers int
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT (SELECT count(*) FROM orders), (SELECT count(*) FROM customers)").Scan(&orders, &customers))
	assert.Equal(t, 0, orders, "no order")
	assert.Equal(t, 1, customers, "no customer beside the one that was there")

	withExisting := orderBody(sh, "2026-10-20", sh.yangi, customer["id"], fmt.Sprintf(`{"%s":"Izoh"}`, key(sh.izoh)), "")
	rec = api.do(t, http.MethodPost, "/app/orders", withExisting, bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, "an order for a customer that is there needs orders.create alone: %s", rec.Body.String())
}

// permissionsOf is the permissions /app/me tells, as strings.
func permissionsOf(t *testing.T, body map[string]any) []string {
	t.Helper()
	raw, ok := body["permissions"].([]any)
	require.True(t, ok, "permissions is a list: %v", body["permissions"])
	list := make([]string, 0, len(raw))
	for _, p := range raw {
		list = append(list, p.(string))
	}
	return list
}

func TestMeTellsThePermissionsAndTheRole(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "orders.view", "customers.view", "customers.history")
	api.giveRole(t, valisPhone, olma, &kuzatuvchi)

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(employee))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, []string{"customers.view", "customers.history", "orders.view"}, permissionsOf(t, body),
		"what the role holds, in the catalog's order")
	company, _ := body["company"].(map[string]any)
	assert.Equal(t, "Kuzatuvchi", company["role_name"], "the role the member holds, by name")
	companies, _ := body["companies"].([]any)
	require.Len(t, companies, 1)
	first, _ := companies[0].(map[string]any)
	assert.Equal(t, "Kuzatuvchi", first["role_name"], "in the list of companies too")

	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(undecided))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.Equal(t, []string{}, permissionsOf(t, body), "no company chosen: nothing may be done yet")
	assert.Nil(t, body["company"])
}
