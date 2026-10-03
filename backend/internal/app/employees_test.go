package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

const (
	valisPhone   = "998902223344"
	sardorsPhone = "998903334455"
)

func TestEmployeesAreForTheOwnerOnly(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	const ownerOnly = `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`

	rec := api.do(t, http.MethodGet, "/app/employees", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a user of the company")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	rec = api.do(t, http.MethodGet, "/app/employees", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an owner who has not chosen the company yet")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/employees", "").Code, "no access token")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code, "the owner")

	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE - 1 WHERE id = $1", olma)
	assert.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code,
		"the owner of an expired company")
}
