package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A member chooses the pages of the tab bar, which their membership keeps
// (logic/roles.md, section 8).
func TestSetTabBar(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user", nok: "user"})

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	require.Contains(t, body, "tab_bar")
	assert.Nil(t, body["tab_bar"], "the default bar until the member chooses one")

	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":["sales","purchases","sales","home"]}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.Equal(t, []any{"sales", "purchases", "home"}, body["tab_bar"], "the answer is /app/me with the bar, a repeated key once")
	assert.Equal(t, "Olma", body["company"].(map[string]any)["name"])
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	assert.Equal(t, []any{"sales", "purchases", "home"}, decode(t, rec)["tab_bar"], "kept")

	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":["orders","settings"]}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Sahifa noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":["home","customers","orders","products","sales"]}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Panelda ko'pi bilan 4 ta sahifa"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	assert.Equal(t, []any{"sales", "purchases", "home"}, decode(t, rec)["tab_bar"], "a refused bar changes nothing")

	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":[]}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{}, decode(t, rec)["tab_bar"], "nothing is a bar too")

	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":null}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Nil(t, decode(t, rec)["tab_bar"], "back to the default")

	rec = api.do(t, http.MethodPut, "/app/me/tab-bar", `{"pages":["home"]}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}
