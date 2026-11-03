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

// The home's blocks at a glance (docs/superpowers/specs/2026-11-03-flat-redesign-design.md):
// each to whoever may see it, of the location asked for.
func TestDashboard(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	nok := api.addCompany(t, "Nok", 30)
	begona := api.addLocation(t, nok, "Begona")
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	// The cash holds 1 000 000; Dilshod bought for 25 000 in Chilonzor
	// today, unpaid; Bolt has 2 left there.
	var rate, naqd, typeID, dilshod, sale, bolt int64
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO currency_rates (company_id, set_by) VALUES ($1, $2) RETURNING id", olma, alisPhone).Scan(&rate))
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT id FROM bank_accounts WHERE company_id = $1 AND name = 'Naqd'", olma).Scan(&naqd))
	api.exec(t, "INSERT INTO transactions (company_id, kind, number, doc_at, bank_account_id, currency_rate_id, total, created_by) VALUES ($1, 'cash_opening', 1, now(), $2, $3, 1000000, $4)",
		olma, naqd, rate, alisPhone)
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", olma).Scan(&typeID))
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO customers (company_id, type_id, phone, created_by) VALUES ($1, $2, '998901112233', $3) RETURNING id", olma, typeID, alisPhone).Scan(&dilshod))
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO transactions (company_id, kind, number, doc_at, location_id, customer_id, currency_rate_id, total, created_by) VALUES ($1, 'sale', 1, now(), $2, $3, $4, 25000, $5) RETURNING id",
		olma, chilonzor, dilshod, rate, alisPhone).Scan(&sale))
	require.NoError(t, api.pool.QueryRow(t.Context(), "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Bolt', 'dona', $2) RETURNING id", olma, alisPhone).Scan(&bolt))
	api.exec(t, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, 2)", sale, olma, chilonzor, bolt)

	rec := api.do(t, http.MethodGet, "/app/dashboard", "", bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	days := daysSoFar(t)
	assert.ElementsMatch(t, []string{"cash", "debtors", "orders", "sales", "low_stock"}, keys(body),
		"the suppliers' debt, the customers' count, the purchases and the priced orders are no block of the home's any more")
	assert.Equal(t, map[string]any{"totals": []any{map[string]any{"currency_id": float64(1), "amount": "1000000.00"}}, "accounts": float64(1)}, body["cash"])
	assert.Equal(t, map[string]any{"debt": "25000.00", "count": float64(1)}, body["debtors"])
	assert.Equal(t, map[string]any{"active": float64(0), "late": float64(0), "by_stage": []any{}, "upcoming": []any{}}, body["orders"])
	sales := body["sales"].(map[string]any)
	assert.Equal(t, "25000.00", sales["month_total"], "every location of the member's")
	assert.Equal(t, float64(1), sales["month_count"])
	assert.Len(t, sales["by_day"], days)
	assert.Equal(t, map[string]any{"count": float64(1), "names": []any{"Bolt"}}, body["low_stock"])

	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id="+strconv.FormatInt(asosiy, 10), "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.Equal(t, float64(0), body["sales"].(map[string]any)["month_count"], "Asosiy's alone")
	assert.Equal(t, map[string]any{"count": float64(0), "names": []any{}}, body["low_stock"], "Asosiy's alone")
	assert.Equal(t, "25000.00", body["debtors"].(map[string]any)["debt"], "the company's, whatever the location")

	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id=x", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/dashboard?location_id="+strconv.FormatInt(begona, 10), "", bearer(owner))
	assert.Equal(t, http.StatusForbidden, rec.Code, "another company's location, as the lists answer it (logic/locations.md)")
	assert.JSONEq(t, `{"error":"forbidden","message":"Bu amal uchun ruxsatingiz yo'q"}`, rec.Body.String())

	// An employee whose role sees the orders alone, restricted to Asosiy.
	kuzatuvchi := api.addRole(t, olma, "Kuzatuvchi", "orders.view")
	vali, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.giveRole(t, valisPhone, olma, &kuzatuvchi)
	api.restrictTo(t, valisPhone, olma, asosiy)
	rec = api.do(t, http.MethodGet, "/app/dashboard", "", bearer(vali))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body = decode(t, rec)
	assert.NotNil(t, body["orders"])
	for _, block := range []string{"cash", "debtors", "sales", "low_stock"} {
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

// keys is the object's keys.
func keys(object map[string]any) []string {
	out := make([]string, 0, len(object))
	for key := range object {
		out = append(out, key)
	}
	return out
}
