package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The members of the company are every member's to see, by name, phone and
// role: a task's assignee is chosen among them. Managing them stays the
// owner's (/app/employees).
func TestListMembers(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali (hisobchi)' WHERE user_phone = $1", valisPhone)
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})

	rec := api.do(t, http.MethodGet, "/app/members", "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	list := members(t, rec)
	require.Len(t, list, 3, "the members of the company the employee works in, nobody else's")
	assert.Equal(t, alisPhone, list[0]["phone"], "the owner first")
	assert.Equal(t, "owner", list[0]["role"])
	assert.Equal(t, valisPhone, list[1]["phone"], "then the users, in the order they joined")
	assert.Equal(t, "Vali (hisobchi)", list[1]["full_name"], "under the name in this company")
	assert.Equal(t, "user", list[1]["role"])
	assert.Equal(t, sardorsPhone, list[2]["phone"])
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/members", "", bearer(owner)).Code, "the owner")

	rec = api.do(t, http.MethodGet, "/app/members", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/members", "").Code, "no access token")
	rec = api.do(t, http.MethodGet, "/app/employees", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "managing the members stays the owner's")
	assert.JSONEq(t, noPermission, rec.Body.String())
}
