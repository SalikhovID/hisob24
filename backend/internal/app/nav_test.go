package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A member puts the sections of the menu in their own order, which their
// membership keeps (logic/roles.md, section 8).
func TestSetNavOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user", nok: "user"})

	rec := api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["tasks","home","tasks","settings"]}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, []any{"tasks", "home", "settings"}, body["nav_order"], "the answer is /app/me with the order, a repeated key once")
	assert.Equal(t, "Olma", body["company"].(map[string]any)["name"])
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	assert.Equal(t, []any{"tasks", "home", "settings"}, decode(t, rec)["nav_order"], "kept")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["tasks","reports"]}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Bo'lim noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	assert.Equal(t, []any{"tasks", "home", "settings"}, decode(t, rec)["nav_order"], "a refused order changes nothing")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":[]}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{}, decode(t, rec)["nav_order"], "nothing is an order too")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":null}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Nil(t, decode(t, rec)["nav_order"], "back to the default")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["home"]}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}
