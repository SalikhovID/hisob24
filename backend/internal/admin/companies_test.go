package admin

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	end := dbToday(t, api.pool).AddDate(0, 0, 30).Format(time.DateOnly)

	rec := api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma MChJ","end_date":"`+end+`","owner_phone":"+998 90 123 45 67","owner_full_name":"Ali"}`, cookie)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.NotZero(t, body["id"])
	assert.Equal(t, "Olma MChJ", body["name"])
	assert.Equal(t, end, body["end_date"])
	assert.EqualValues(t, 30, body["days_left"])
	assert.Equal(t, true, body["is_active"])

	rec = api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"31.12.2026","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/admin/companies",
		`{"name":" ","end_date":"`+end+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Kompaniya nomini kiriting"}`, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/admin/companies", `{}`).Code, "needs a session")
}
