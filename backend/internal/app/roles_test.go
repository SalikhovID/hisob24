package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// roleBody is a body for POST and PUT /app/roles: a role with the name and
// the permissions.
func roleBody(name string, permissions ...string) string {
	if permissions == nil {
		permissions = []string{}
	}
	b, _ := json.Marshal(map[string]any{"name": name, "permissions": permissions})
	return string(b)
}

const (
	ownerOnly         = `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`
	roleNotFound      = `{"error":"not_found","message":"Rol topilmadi"}`
	cannotChangeOwner = `{"error":"cannot_change_owner","message":"Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"}`
)

func TestRolesAreTheOwners(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	hr := api.addRole(t, olma, "HR", "employees.view", "employees.create", "employees.edit", "employees.delete")
	api.giveRole(t, valisPhone, olma, &hr)

	for name, req := range map[string]struct{ method, path, body string }{
		"listing the roles": {http.MethodGet, "/app/roles", ""},
		"making a role":     {http.MethodPost, "/app/roles", roleBody("Kassir", "tasks.view")},
		"changing a role":   {http.MethodPut, fmt.Sprintf("/app/roles/%d", hr), roleBody("HR", "employees.view")},
		"deleting a role":   {http.MethodDelete, fmt.Sprintf("/app/roles/%d", hr), ""},
		"giving a role":     {http.MethodPut, "/app/employees/" + sardorsPhone + "/role", fmt.Sprintf(`{"role_id":%d}`, hr)},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, "%s: an employee, with the employees permissions even", name)
		assert.JSONEq(t, ownerOnly, rec.Body.String(), name)
		rec = api.do(t, req.method, req.path, req.body, bearer(undecided))
		assert.Equal(t, http.StatusForbidden, rec.Code, "%s: no company chosen", name)
		assert.JSONEq(t, ownerOnly, rec.Body.String(), name)
		assert.Equal(t, http.StatusUnauthorized, api.do(t, req.method, req.path, req.body).Code, "%s: no token", name)
	}
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/roles", "", bearer(owner)).Code, "the owner")
}

func TestRolesCRUD(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})

	rec := api.do(t, http.MethodPost, "/app/roles", roleBody(" Sotuvchi ", "tasks.view", "customers.view", "customers.view"), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Sotuvchi", created["name"], "trimmed")
	assert.Equal(t, []any{"customers.view", "tasks.view"}, created["permissions"], "in the catalog's order, once each")
	assert.EqualValues(t, 0, created["members_count"])
	assert.NotEmpty(t, created["id"])
	path := fmt.Sprintf("/app/roles/%v", created["id"])

	rec = api.do(t, http.MethodPost, "/app/roles", roleBody("admin"), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, []any{}, decode(t, rec)["permissions"], "a role may hold nothing")

	list := members(t, api.do(t, http.MethodGet, "/app/roles", "", bearer(owner)))
	require.Len(t, list, 2)
	assert.Equal(t, "admin", list[0]["name"], "by name, whatever the case")
	assert.Equal(t, "Sotuvchi", list[1]["name"])

	rec = api.do(t, http.MethodPut, path, roleBody("Katta sotuvchi", "customers.create", "customers.view"), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	changed := decode(t, rec)
	assert.Equal(t, "Katta sotuvchi", changed["name"])
	assert.Equal(t, []any{"customers.view", "customers.create"}, changed["permissions"], "replaced")

	for name, tc := range map[string]struct {
		method, path, body string
		status             int
		want               string
	}{
		"a name taken":            {http.MethodPost, "/app/roles", roleBody("katta SOTUVCHI"), http.StatusConflict, `{"error":"name_taken","message":"Bu nomli rol allaqachon bor"}`},
		"no name":                 {http.MethodPost, "/app/roles", roleBody(" "), http.StatusBadRequest, `{"error":"validation_error","message":"Nomni kiriting"}`},
		"an unknown permission":   {http.MethodPost, "/app/roles", roleBody("Kassir", "customers.fly"), http.StatusBadRequest, `{"error":"validation_error","message":"Ruxsat noto'g'ri"}`},
		"an action without view":  {http.MethodPut, path, roleBody("Katta sotuvchi", "customers.create"), http.StatusBadRequest, `{"error":"validation_error","message":"«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"}`},
		"no such role":            {http.MethodPut, "/app/roles/999999", roleBody("X"), http.StatusNotFound, roleNotFound},
		"an id that is no number": {http.MethodDelete, "/app/roles/abc", "", http.StatusNotFound, roleNotFound},
		"not JSON":                {http.MethodPost, "/app/roles", `{"name":`, http.StatusBadRequest, `{"error":"bad_request","message":"So'rov noto'g'ri"}`},
	} {
		rec := api.do(t, tc.method, tc.path, tc.body, bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	assert.Len(t, members(t, api.do(t, http.MethodGet, "/app/roles", "", bearer(owner))), 2, "nothing else was made")

	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, path, "", bearer(owner)).Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "gone")
	assert.JSONEq(t, roleNotFound, rec.Body.String())
	assert.Len(t, members(t, api.do(t, http.MethodGet, "/app/roles", "", bearer(owner))), 1)
}

func TestARoleSomeoneHoldsIsNotDeleted(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	sotuvchi := api.addRole(t, olma, "Sotuvchi", "customers.view")
	api.giveRole(t, valisPhone, olma, &sotuvchi)
	path := fmt.Sprintf("/app/roles/%d", sotuvchi)

	rec := api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"role_in_use","message":"Bu rol 1 ta xodimga biriktirilgan"}`, rec.Body.String())
	list := members(t, api.do(t, http.MethodGet, "/app/roles", "", bearer(owner)))
	require.Len(t, list, 1, "the role stays")
	assert.EqualValues(t, 1, list[0]["members_count"])

	api.giveRole(t, valisPhone, olma, nil)
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, path, "", bearer(owner)).Code, "a role nobody holds")
}

func TestSetEmployeeRole(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "tasks.view")
	begona := api.addRole(t, nok, "Begona")
	path := "/app/employees/" + valisPhone + "/role"

	rec := api.do(t, http.MethodPut, path, fmt.Sprintf(`{"role_id":%d}`, kuzatuvchi), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, valisPhone, body["phone"])
	assert.EqualValues(t, kuzatuvchi, body["role_id"])
	assert.Equal(t, "Kuzatuvchi", body["role_name"])
	assert.Equal(t, "user", body["role"])
	me := decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(employee)))
	assert.Equal(t, []string{"tasks.view"}, permissionsOf(t, me), "the employee works by the role from the next request on")
	assert.Equal(t, http.StatusForbidden, api.do(t, http.MethodGet, "/app/customers", "", bearer(employee)).Code)

	rec = api.do(t, http.MethodPut, path, `{"role_id":null}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Nil(t, decode(t, rec)["role_id"], "taken away")
	assert.Nil(t, decode(t, rec)["role_name"])
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/customers", "", bearer(employee)).Code, "back to the default")

	for name, tc := range map[string]struct {
		path, body string
		status     int
		want       string
	}{
		"the owner":              {"/app/employees/" + alisPhone + "/role", fmt.Sprintf(`{"role_id":%d}`, kuzatuvchi), http.StatusConflict, cannotChangeOwner},
		"not a member":           {"/app/employees/998909999999/role", fmt.Sprintf(`{"role_id":%d}`, kuzatuvchi), http.StatusNotFound, `{"error":"not_found","message":"Xodim topilmadi"}`},
		"another company's role": {path, fmt.Sprintf(`{"role_id":%d}`, begona), http.StatusNotFound, roleNotFound},
		"no such role":           {path, `{"role_id":999999}`, http.StatusNotFound, roleNotFound},
		"not JSON":               {path, `{"role_id":`, http.StatusBadRequest, `{"error":"bad_request","message":"So'rov noto'g'ri"}`},
	} {
		rec := api.do(t, http.MethodPut, tc.path, tc.body, bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	assert.Nil(t, members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)))[1]["role_id"], "nothing was given")
}
