package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	locationNotFound = `{"error":"not_found","message":"Lokatsiya topilmadi"}`
	ownerOnlyBody    = `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`
)

// The owner restricts an employee to some locations, or lets them work in
// every one again (logic/locations.md, section 5); it takes effect from the
// employee's next request on.
func TestSetEmployeeLocations(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	gone := api.addLocation(t, olma, "Yopilgan")
	api.exec(t, "UPDATE locations SET deleted_at = now() WHERE id = $1", gone)
	noksAsosiy := api.addLocation(t, nok, "Asosiy")
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	path := "/app/employees/" + valisPhone + "/locations"

	rec := api.do(t, http.MethodPut, path, fmt.Sprintf(`{"location_ids":[%d,%d,%d]}`, chilonzor, asosiy, chilonzor), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, valisPhone, body["phone"])
	assert.Equal(t, []any{location(asosiy, "Asosiy"), location(chilonzor, "Chilonzor")}, body["locations"], "the restriction's locations, in the order they were added, each once")
	me := decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(employee)))
	assert.Equal(t, []any{location(asosiy, "Asosiy"), location(chilonzor, "Chilonzor")}, me["locations"], "the employee works by the restriction from the next request on")
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"location_ids":[%d]}`, chilonzor), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/tasks?location_id=%d", asosiy), "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a location outside the restriction, at once")
	assert.JSONEq(t, noPermission, rec.Body.String())

	rec = api.do(t, http.MethodPut, path, `{"location_ids":null}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, decode(t, rec), "locations")
	assert.Nil(t, decode(t, rec)["locations"], "every location again")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, fmt.Sprintf("/app/tasks?location_id=%d", asosiy), "", bearer(employee)).Code)

	for name, tc := range map[string]struct {
		path, body string
		status     int
		want       string
	}{
		"no location":                  {path, `{"location_ids":[]}`, http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta lokatsiyani tanlang"}`},
		"a deleted location":           {path, fmt.Sprintf(`{"location_ids":[%d]}`, gone), http.StatusNotFound, locationNotFound},
		"another company's location":   {path, fmt.Sprintf(`{"location_ids":[%d]}`, noksAsosiy), http.StatusNotFound, locationNotFound},
		"a location that is not there": {path, `{"location_ids":[999999]}`, http.StatusNotFound, locationNotFound},
		"the owner":                    {"/app/employees/" + alisPhone + "/locations", fmt.Sprintf(`{"location_ids":[%d]}`, chilonzor), http.StatusConflict, cannotChangeOwner},
		"not a member":                 {"/app/employees/998909999999/locations", fmt.Sprintf(`{"location_ids":[%d]}`, chilonzor), http.StatusNotFound, `{"error":"not_found","message":"Xodim topilmadi"}`},
		"not JSON":                     {path, `{"location_ids":`, http.StatusBadRequest, `{"error":"bad_request","message":"So'rov noto'g'ri"}`},
	} {
		rec := api.do(t, http.MethodPut, tc.path, tc.body, bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"location_ids":[%d]}`, chilonzor), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the restriction is the owner's to set")
	assert.JSONEq(t, ownerOnlyBody, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"location_ids":[%d]}`, chilonzor), bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company")
	assert.JSONEq(t, ownerOnlyBody, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, `{}`).Code, "no access token")
}
