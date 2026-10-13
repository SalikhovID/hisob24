package app

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// daysSoFar is how many days of this month have begun in Tashkent: the
// length of a dashboard's day-by-day series.
func daysSoFar(t *testing.T) int {
	t.Helper()
	zone, err := time.LoadLocation("Asia/Tashkent")
	require.NoError(t, err)
	return time.Now().In(zone).Day()
}

// The home's blocks at a glance (docs/superpowers/specs/2026-10-13-mini-app-ui-design.md):
// each to whoever may see it, of the location asked for.
func TestDashboard(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	nok := api.addCompany(t, "Nok", 30)
	begona := api.addLocation(t, nok, "Begona")
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	// A purchase of 25 000 in Chilonzor today.
	var rate, bozor int64
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO currency_rates (company_id, set_by) VALUES ($1, $2) RETURNING id", olma, alisPhone).Scan(&rate))
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', $2) RETURNING id", olma, alisPhone).Scan(&bozor))
	api.exec(t, "INSERT INTO transactions (company_id, kind, number, doc_at, location_id, supplier_id, currency_rate_id, total, created_by) VALUES ($1, 'purchase', 1, now(), $2, $3, $4, 25000, $5)",
		olma, chilonzor, bozor, rate, alisPhone)

	rec := api.do(t, http.MethodGet, "/app/dashboard", "", bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	days := daysSoFar(t)
	zeros := func(value any) []any {
		out := make([]any, days)
		for i := range out {
			out[i] = value
		}
		return out
	}
	assert.Equal(t, map[string]any{"debt": "25000.00", "debtors": float64(1), "advance": "0.00"}, body["suppliers"])
	assert.Equal(t, map[string]any{"total": float64(0), "added_this_month": float64(0), "by_day": zeros(float64(0))}, body["customers"])
	assert.Equal(t, map[string]any{"active": float64(0), "late": float64(0), "by_stage": []any{}, "upcoming": []any{}}, body["tasks"])
	purchases := body["purchases"].(map[string]any)
	assert.Equal(t, "25000.00", purchases["month_total"], "every location of the member's")
	assert.Equal(t, float64(1), purchases["month_count"])
	assert.Len(t, purchases["by_day"], days)
	assert.Equal(t, "25000.00", purchases["by_day"].([]any)[days-1])
	assert.Equal(t, map[string]any{"month_total": "0.00", "month_count": float64(0), "by_day": zeros("0.00")}, body["sales"])

	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id="+strconv.FormatInt(asosiy, 10), "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, float64(0), decode(t, rec)["purchases"].(map[string]any)["month_count"], "Asosiy's alone")

	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id=x", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id="+strconv.FormatInt(begona, 10), "", bearer(owner))
	assert.Equal(t, http.StatusForbidden, rec.Code, "another company's location, as the lists answer it (logic/locations.md)")
	assert.JSONEq(t, `{"error":"forbidden","message":"Bu amal uchun ruxsatingiz yo'q"}`, rec.Body.String())

	// An employee whose role sees the tasks alone, restricted to Asosiy.
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "tasks.view")
	vali, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.giveRole(t, valisPhone, olma, &kuzatuvchi)
	api.restrictTo(t, valisPhone, olma, asosiy)
	rec = api.do(t, http.MethodGet, "/app/dashboard", "", bearer(vali))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.NotNil(t, body["tasks"])
	for _, block := range []string{"suppliers", "customers", "purchases", "sales"} {
		assert.Contains(t, body, block)
		assert.Nil(t, body[block], block+" is not the role's")
	}
	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id="+strconv.FormatInt(chilonzor, 10), "", bearer(vali))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a location the member may not work in")

	undecided, _ := api.signIn(t, "998907777777", map[int64]string{olma: "user", nok: "user"})
	rec = api.do(t, http.MethodGet, "/app/dashboard", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}
