package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// enterTransfer enters a transfer as the session and returns the API's answer.
func (api testAPI) enterTransfer(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/transfers", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func TestTransfersAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	body := func(to int64, lines string) string {
		return fmt.Sprintf(`{"location_id":%d,"to_location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, to, at, lines)
	}
	move := func(quantity string) string {
		return fmt.Sprintf(`{"product_id":%v,"quantity":"%s"}`, s.product["id"], quantity)
	}

	tr := api.enterTransfer(t, s.owner, fmt.Sprintf(`{"location_id":%d,"to_location_id":%d,"at":"%s","note":" Filialga ","items":[%s]}`, s.asosiy, s.chilonzor, at, move("4")))
	assert.EqualValues(t, 1, tr["number"])
	assert.EqualValues(t, s.asosiy, tr["location_id"])
	assert.Equal(t, "Asosiy", tr["location_name"])
	assert.EqualValues(t, s.chilonzor, tr["to_location_id"])
	assert.Equal(t, "Chilonzor", tr["to_location_name"])
	assert.Equal(t, atUTC, tr["at"])
	assert.Equal(t, "Filialga", tr["note"])
	assert.EqualValues(t, 1, tr["items_count"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "4.000"}}, tr["items"])
	path := fmt.Sprintf("/app/transfers/%v", tr["id"])

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"no location":        {fmt.Sprintf(`{"to_location_id":%d,"at":"%s","items":[%s]}`, s.chilonzor, at, move("1")), http.StatusBadRequest, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`},
		"a location outside": {fmt.Sprintf(`{"location_id":999999,"to_location_id":%d,"at":"%s","items":[%s]}`, s.chilonzor, at, move("1")), http.StatusForbidden, noPermission},
		"the same location":  {body(s.asosiy, move("1")), http.StatusBadRequest, `{"error":"validation_error","message":"Maqsad lokatsiya boshqa bo'lsin"}`},
		"no destination":     {body(0, move("1")), http.StatusBadRequest, `{"error":"validation_error","message":"Maqsad lokatsiyani tanlang"}`},
		"no lines":           {body(s.chilonzor, ""), http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta mahsulot qo'shing"}`},
		"more than there is": {body(s.chilonzor, move("7")), http.StatusConflict, `{"error":"stock_insufficient","message":"«Olma» uchun omborda yetarli qoldiq yo'q"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/transfers", tc.body, bearer(s.owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}

	// The list: by either end; the employee of Chilonzor sees it, but may
	// not change it.
	rec := api.do(t, http.MethodGet, "/app/transfers", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 1, page["total"])
	assert.Nil(t, page["items"].([]any)[0].(map[string]any)["items"], "no lines in the list")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/transfers?location_id=%d", s.chilonzor), "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/transfers?location_id=%d", s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.do(t, http.MethodGet, "/app/transfers?location_id=abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code, "seen from its other end")
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"to_location_id":%d,"at":"%s","items":[%s]}`, s.chilonzor, at, move("1")), bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)

	// An edit and a deletion by the owner.
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"to_location_id":%d,"at":"2026-10-09T09:00:00+05:00","items":[%s]}`, s.chilonzor, move("2")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, 1, saved["number"])
	assert.Equal(t, "2026-10-09T04:00:00Z", saved["at"])
	assert.Nil(t, saved["note"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "10.000", decode(t, rec)["quantity"], "8 in Asosiy, 2 in Chilonzor")
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Ko'chirish topilmadi"}`, rec.Body.String())
}

func TestInventoriesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	count := func(quantity string) string {
		return fmt.Sprintf(`{"product_id":%v,"counted":"%s"}`, s.product["id"], quantity)
	}

	rec := api.do(t, http.MethodPost, "/app/inventories", fmt.Sprintf(`{"location_id":%d,"at":"%s","note":" Oylik ","items":[%s]}`, s.asosiy, at, count("9")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	inv := decode(t, rec)
	assert.EqualValues(t, 1, inv["number"])
	assert.Equal(t, "Oylik", inv["note"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "expected": "10.000", "counted": "9.000", "difference": "-1.000"}}, inv["items"])
	path := fmt.Sprintf("/app/inventories/%v", inv["id"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "9.000", decode(t, rec)["quantity"])

	rec = api.do(t, http.MethodPost, "/app/inventories", fmt.Sprintf(`{"location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, at, count("-1")), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"«Olma» miqdori noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/inventories", fmt.Sprintf(`{"location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, at, count("1")), bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the employee is restricted to Chilonzor")

	rec = api.do(t, http.MethodGet, "/app/inventories", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/inventories", "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 0, decode(t, rec)["total"], "the employee's location alone")
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Inventarizatsiya topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"at":"%s","items":[%s]}`, at, count("8")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "-2.000", decode(t, rec)["items"].([]any)[0].(map[string]any)["difference"])
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "10.000", decode(t, rec)["quantity"], "the count taken back")

	// The stock at a moment: what a count starts from.
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d", s.asosiy), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "10.000"}}, decodeList(t, rec))
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d&at=2026-09-01T00:00:00Z", s.asosiy), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, []any{}, decodeList(t, rec), "nothing yet then")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d&at=kecha", s.asosiy), "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Vaqt noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/stock", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d", s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)

	// The stock without one document's own moves: what an inventory's edit
	// form starts from.
	rec = api.do(t, http.MethodPost, "/app/inventories", fmt.Sprintf(`{"location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, at, count("7")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	counted := decode(t, rec)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d", s.asosiy), "", bearer(s.owner))
	assert.Equal(t, "7.000", decodeList(t, rec)[0].(map[string]any)["quantity"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d&exclude_id=%v", s.asosiy, counted["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "10.000", decodeList(t, rec)[0].(map[string]any)["quantity"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/stock?location_id=%d&exclude_id=x", s.asosiy), "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Hujjat noto'g'ri"}`, rec.Body.String())
}

func TestOpeningStockAndProductMovesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)

	rec := api.do(t, http.MethodPost, "/app/opening-stock", fmt.Sprintf(`{"location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, at, s.item("12.5", "1000")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	o := decode(t, rec)
	assert.EqualValues(t, 1, o["number"])
	assert.EqualValues(t, 1, o["currency_id"])
	assert.Equal(t, "1.0000", o["rate"])
	assert.Equal(t, "12500.00", o["total"])
	assert.Equal(t, "12500.00", o["total_uzs"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "12.500", "price": "1000.00", "amount": "12500.00"}}, o["items"])
	path := fmt.Sprintf("/app/opening-stock/%v", o["id"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	product := decode(t, rec)
	assert.Equal(t, "12.500", product["quantity"])
	assert.Equal(t, map[string]any{"amount": "1000.00", "currency_id": 1.0}, product["last_price"], "an opening stock's price is a last price")
	rec = api.do(t, http.MethodGet, "/app/opening-stock", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"at":"%s","items":[%s]}`, at, s.item("4", "1100")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "4400.00", decode(t, rec)["total"])
	rec = api.do(t, http.MethodPost, "/app/opening-stock", fmt.Sprintf(`{"location_id":%d,"at":"%s","currency_id":3,"items":[%s]}`, s.asosiy, at, s.item("1", "1")), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"currency_not_allowed","message":"Bu valyuta kompaniyada yoqilmagan"}`, rec.Body.String())

	// The product's moves: the opening stock, then a transfer out.
	api.enterTransfer(t, s.owner, fmt.Sprintf(`{"location_id":%d,"to_location_id":%d,"at":"2026-10-08T09:00:00+05:00","items":[{"product_id":%v,"quantity":"1"}]}`, s.asosiy, s.chilonzor, s.product["id"]))
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v/moves", s.product["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	moves := decode(t, rec)
	assert.EqualValues(t, 3, moves["total"])
	first := moves["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "transfer", first["kind"])
	assert.EqualValues(t, 1, first["number"])
	assert.Equal(t, "2026-10-08T04:00:00Z", first["at"])
	assert.EqualValues(t, s.chilonzor, first["location_id"])
	assert.Equal(t, "Chilonzor", first["location_name"])
	assert.Equal(t, "1.000", first["quantity"])
	assert.Equal(t, "Asosiy", first["counterpart"])
	last := moves["items"].([]any)[2].(map[string]any)
	assert.Equal(t, "opening_stock", last["kind"])
	assert.Equal(t, "4.000", last["quantity"])
	assert.Nil(t, last["counterpart"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v/moves", s.product["id"]), "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "the employee's location alone")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v/moves?location_id=%d", s.product["id"], s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.do(t, http.MethodGet, "/app/products/999999/moves", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "what was moved on has to stay")
	assert.JSONEq(t, `{"error":"stock_insufficient","message":"«Olma» uchun omborda yetarli qoldiq yo'q"}`, rec.Body.String())
}

func TestSupplierOpeningsAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	path := fmt.Sprintf("/app/suppliers/%v/openings", s.supplier["id"])

	rec := api.do(t, http.MethodPost, path, fmt.Sprintf(`{"kind":"debt","amount":"1000000","at":"%s","note":" Eski qarz "}`, at), bearer(s.employee))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	debt := decode(t, rec)
	assert.Equal(t, "debt", debt["kind"])
	assert.Equal(t, s.supplier["id"], debt["supplier_id"])
	assert.Equal(t, "1000000.00", debt["amount"])
	assert.EqualValues(t, 1, debt["currency_id"])
	assert.Equal(t, "1.0000", debt["rate"])
	assert.Equal(t, "1000000.00", debt["amount_uzs"])
	assert.Equal(t, atUTC, debt["at"])
	assert.Equal(t, "Eski qarz", debt["note"])
	for name, tc := range map[string]struct{ body, message string }{
		"no kind":    {fmt.Sprintf(`{"amount":"1","at":"%s"}`, at), "Turni tanlang"},
		"a bad kind": {fmt.Sprintf(`{"kind":"loan","amount":"1","at":"%s"}`, at), "Tur noto'g'ri"},
		"no amount":  {fmt.Sprintf(`{"kind":"debt","at":"%s"}`, at), "Summani kiriting"},
		"no time":    {`{"kind":"prepay","amount":"1"}`, "Vaqtni kiriting"},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/suppliers/%v", s.supplier["id"]), "", bearer(s.owner))
	assert.Equal(t, "1000000.00", decode(t, rec)["balance"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	own := fmt.Sprintf("%s/%v", path, debt["id"])
	rec = api.do(t, http.MethodPut, own, fmt.Sprintf(`{"kind":"debt","amount":"1500","at":"%s"}`, at), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "1500.00", decode(t, rec)["amount"])
	rec = api.do(t, http.MethodDelete, own, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, own, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Hujjat topilmadi"}`, rec.Body.String())
}
