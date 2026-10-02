package admin

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdmins(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)

	rec := api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":42,"full_name":"Ikkinchi"}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.EqualValues(t, 42, body["telegram_id"])
	assert.Equal(t, "Ikkinchi", body["full_name"])
	assert.Equal(t, true, body["is_active"])

	rec = api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":42,"full_name":"Yana"}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"admin_exists","message":"Bu admin allaqachon faol"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":0,"full_name":"X"}`, cookie).Code)

	rec = api.do(t, http.MethodGet, "/admin/admins", "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var admins []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &admins))
	require.Len(t, admins, 2)
	assert.EqualValues(t, ownerID, admins[0]["telegram_id"])
	assert.EqualValues(t, 42, admins[1]["telegram_id"])
}
