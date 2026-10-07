package app

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// enterSupplier enters a supplier as the session and returns the API's answer.
func (api testAPI) enterSupplier(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/suppliers", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

// enterPurchase enters a purchase as the session and returns the API's answer.
func (api testAPI) enterPurchase(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/purchases", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

// store is a company with two locations, its owner Ali and its employee
// Vali (restricted to Chilonzor), a supplier and a product.
type store struct {
	company, asosiy, chilonzor int64
	owner, employee            string
	supplier, product          map[string]any
}

func (api testAPI) newStore(t *testing.T) store {
	t.Helper()
	s := store{company: api.addCompany(t, "Olma", 30)}
	s.asosiy = api.addLocation(t, s.company, "Asosiy")
	s.chilonzor = api.addLocation(t, s.company, "Chilonzor")
	s.owner, _ = api.signIn(t, alisPhone, map[int64]string{s.company: "owner"})
	s.employee, _ = api.signIn(t, valisPhone, map[int64]string{s.company: "user"})
	api.restrictTo(t, valisPhone, s.company, s.chilonzor)
	s.supplier = api.enterSupplier(t, s.owner, `{"name":"Bozor","phone":"+998 90 123-45-67"}`)
	s.product = api.enterProduct(t, s.owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	return s
}

// purchase is the body of a purchase from the store's supplier in the
// location, on 2026-10-07, with the lines given.
func (s store) purchase(locationID int64, lines string) string {
	return fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","items":[%s]}`, locationID, s.supplier["id"], lines)
}

// item is a line of the store's product.
func (s store) item(quantity, price string) string {
	return fmt.Sprintf(`{"product_id":%v,"quantity":"%s","price":"%s"}`, s.product["id"], quantity, price)
}

func TestSuppliersAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	kuzatuvchi := api.addRole(t, s.company, "Kuzatuvchi", "suppliers.view")
	watcher, _ := api.signIn(t, sardorsPhone, map[int64]string{s.company: "user"})
	api.giveRole(t, sardorsPhone, s.company, &kuzatuvchi)

	assert.Equal(t, "Bozor", s.supplier["name"])
	assert.Equal(t, "998901234567", s.supplier["phone"], "normalized")
	assert.Nil(t, s.supplier["note"])
	assert.Equal(t, true, s.supplier["is_active"])
	assert.Equal(t, "0.00", s.supplier["balance"], "the owner sees the balance")
	assert.Equal(t, "0.00", s.supplier["purchases_total"])
	assert.Equal(t, "0.00", s.supplier["payments_total"])
	assert.Nil(t, s.supplier["created_by_name"], "the owner goes by no name here")
	assert.NotEmpty(t, s.supplier["created_at"])
	path := fmt.Sprintf("/app/suppliers/%v", s.supplier["id"])

	for name, tc := range map[string]struct{ body, message string }{
		"no name":     {`{"name":" "}`, "Nomni kiriting"},
		"a bad phone": {`{"name":"X","phone":"12"}`, "Telefon raqami noto'g'ri"},
		"a long note": {fmt.Sprintf(`{"name":"X","note":"%s"}`, strings.Repeat("x", 501)), "Izoh 500 belgidan oshmasin"},
	} {
		rec := api.do(t, http.MethodPost, "/app/suppliers", tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
	rec := api.do(t, http.MethodPost, "/app/suppliers", `{"name":"bozor"}`, bearer(s.employee))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli ta'minotchi allaqachon bor"}`, rec.Body.String())

	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	rec = api.do(t, http.MethodGet, "/app/suppliers", "", bearer(watcher))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 1, page["total"])
	row := page["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "Bozor", row["name"])
	assert.Nil(t, row["balance"], "without purchases.view the balance is not shown")
	rec = api.do(t, http.MethodGet, path, "", bearer(watcher))
	require.Equal(t, http.StatusOK, rec.Code)
	got := decode(t, rec)
	assert.Nil(t, got["balance"])
	assert.Nil(t, got["purchases_total"])
	assert.Nil(t, got["payments_total"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	got = decode(t, rec)
	assert.Equal(t, "10000.00", got["balance"], "the whole company's, whatever the employee's locations")
	assert.Equal(t, "10000.00", got["purchases_total"])
	assert.Equal(t, "0.00", got["payments_total"])
	rec = api.do(t, http.MethodGet, "/app/suppliers?status=inactive", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 0, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/suppliers?status=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Holat noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/suppliers?page=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Sahifa raqami noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/suppliers?search=90123", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "digits search the phone")
	rec = api.do(t, http.MethodGet, "/app/suppliers?search=zor", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "text searches the name")

	rec = api.do(t, http.MethodPut, path, `{"name":"Eski bozor","note":"Chorsu"}`, bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got = decode(t, rec)
	assert.Equal(t, "Eski bozor", got["name"])
	assert.Nil(t, got["phone"], "left out: cleared")
	assert.Equal(t, "Chorsu", got["note"])
	rec = api.do(t, http.MethodPut, path, `{"name":" "}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = api.do(t, http.MethodPatch, path, `{"is_active":false}`, bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, false, decode(t, rec)["is_active"])
	rec = api.do(t, http.MethodPatch, path, `{}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Holat noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"supplier_in_use","message":"Bu ta'minotchida 1 ta xarid bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/suppliers/999999", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Ta'minotchi topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/suppliers/abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	fresh := api.enterSupplier(t, s.owner, `{"name":"Dehqon"}`)
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("/app/suppliers/%v", fresh["id"]), "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("/app/suppliers/%v", fresh["id"]), "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestPaymentsAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	path := fmt.Sprintf("/app/suppliers/%v/payments", s.supplier["id"])
	purchase := api.enterPurchase(t, s.owner, fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","paid":"500","items":[%s]}`, s.asosiy, s.supplier["id"], s.item("10", "1000")))

	rec := api.do(t, http.MethodPost, path, `{"amount":"1200.5","paid_on":"2026-10-08","note":" Naqd "}`, bearer(s.employee))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	own := decode(t, rec)
	assert.Equal(t, s.supplier["id"], own["supplier_id"])
	assert.Equal(t, "1200.50", own["amount"])
	assert.Equal(t, "2026-10-08", own["paid_on"])
	assert.Equal(t, "Naqd", own["note"])
	assert.Nil(t, own["purchase_id"])
	assert.Nil(t, own["purchase_number"])
	assert.Nil(t, own["created_by_name"])
	assert.NotEmpty(t, own["created_at"])
	for name, tc := range map[string]struct{ body, message string }{
		"no amount": {`{"paid_on":"2026-10-08"}`, "Summani kiriting"},
		"zero":      {`{"amount":"0","paid_on":"2026-10-08"}`, "Summa noto'g'ri"},
		"no day":    {`{"amount":"1"}`, "Sanani kiriting"},
		"a bad day": {`{"amount":"1","paid_on":"8.10.2026"}`, "Sana noto'g'ri"},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, "/app/suppliers/999999/payments", `{"amount":"1","paid_on":"2026-10-08"}`, bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Ta'minotchi topilmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	items := page["items"].([]any)
	assert.Equal(t, own["id"], items[0].(map[string]any)["id"], "the newest first")
	linked := items[1].(map[string]any)
	assert.Equal(t, purchase["id"], linked["purchase_id"], "the one entered with the purchase")
	assert.EqualValues(t, 1, linked["purchase_number"])
	assert.Equal(t, "500.00", linked["amount"])
	assert.Equal(t, "2026-10-07", linked["paid_on"])
	rec = api.do(t, http.MethodGet, path+"?page=0", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	ownPath := fmt.Sprintf("%s/%v", path, own["id"])
	rec = api.do(t, http.MethodPut, ownPath, `{"amount":"1500","paid_on":"2026-10-09"}`, bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got := decode(t, rec)
	assert.Equal(t, "1500.00", got["amount"])
	assert.Nil(t, got["note"], "left out: cleared")
	rec = api.do(t, http.MethodPut, ownPath, `{"paid_on":"2026-10-09"}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Summani kiriting"}`, rec.Body.String())
	linkedPath := fmt.Sprintf("%s/%v", path, linked["id"])
	rec = api.do(t, http.MethodPut, linkedPath, `{"amount":"1","paid_on":"2026-10-09"}`, bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"payment_linked","message":"Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, linkedPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	rec = api.do(t, http.MethodDelete, ownPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, ownPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"To'lov topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/suppliers/%v", s.supplier["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "9500.00", decode(t, rec)["balance"], "10000 − 500")
}

func TestPurchasesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)

	rec := api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","note":" Ertalab ","paid":"5000","items":[%s]}`, s.asosiy, s.supplier["id"], s.item("12.5", "1000")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	p := decode(t, rec)
	assert.NotEmpty(t, p["id"])
	assert.EqualValues(t, 1, p["number"])
	assert.EqualValues(t, s.asosiy, p["location_id"])
	assert.Equal(t, "Asosiy", p["location_name"])
	assert.Equal(t, map[string]any{"id": s.supplier["id"], "name": "Bozor"}, p["supplier"])
	assert.Equal(t, "2026-10-07", p["purchased_on"])
	assert.Equal(t, "Ertalab", p["note"])
	assert.Equal(t, "12500.00", p["total"])
	assert.Equal(t, "5000.00", p["paid"])
	assert.EqualValues(t, 1, p["items_count"])
	assert.Nil(t, p["created_by_name"])
	assert.NotEmpty(t, p["created_at"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "12.500", "price": "1000.00", "amount": "12500.00"}}, p["items"])
	path := fmt.Sprintf("/app/purchases/%v", p["id"])

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"no location":        {s.purchase(0, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`},
		"a location outside": {s.purchase(999999, s.item("1", "1")), http.StatusForbidden, noPermission},
		"no supplier":        {fmt.Sprintf(`{"location_id":%d,"purchased_on":"2026-10-07","items":[%s]}`, s.asosiy, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Ta'minotchini tanlang"}`},
		"no lines":           {s.purchase(s.asosiy, ""), http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta mahsulot qo'shing"}`},
		"a bad quantity":     {s.purchase(s.asosiy, s.item("0", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» miqdori noto'g'ri"}`},
		"a product twice":    {s.purchase(s.asosiy, s.item("1", "1")+","+s.item("2", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» ikki marta kiritilgan"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/purchases", tc.body, bearer(s.owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, "/app/purchases", s.purchase(s.asosiy, s.item("1", "1")), bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the employee is restricted to Chilonzor")
	assert.JSONEq(t, noPermission, rec.Body.String())
	theirs := api.enterPurchase(t, s.employee, s.purchase(s.chilonzor, s.item("1", "900")))
	assert.EqualValues(t, 2, theirs["number"])

	// The list: the member's locations, or one of them; the newest first.
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	assert.Nil(t, page["items"].([]any)[0].(map[string]any)["items"], "no lines in the list")
	assert.EqualValues(t, 1, page["items"].([]any)[0].(map[string]any)["items_count"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?location_id=%d", s.asosiy), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "the employee's location alone")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?location_id=%d", s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/purchases?location_id=abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/purchases?supplier_id=abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Ta'minotchi noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?supplier_id=%v", s.supplier["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 2, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/purchases?page=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	// The page: the member's locations alone.
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, p["items"], decode(t, rec)["items"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Xarid topilmadi"}`, rec.Body.String())

	// An edit: the number and the location stay, the stock moves.
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"purchased_on":"2026-10-09","items":[%s]}`, s.supplier["id"], s.item("4", "1100")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, 1, saved["number"])
	assert.EqualValues(t, s.asosiy, saved["location_id"])
	assert.Equal(t, "2026-10-09", saved["purchased_on"])
	assert.Equal(t, "4400.00", saved["total"])
	assert.Equal(t, "0.00", saved["paid"], "nothing paid now")
	assert.Nil(t, saved["note"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "5.000", decode(t, rec)["quantity"], "4 in Asosiy, 1 in Chilonzor")
	rec = api.do(t, http.MethodPut, path, `{"supplier_id":0,"purchased_on":"2026-10-09","items":[]}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Ta'minotchini tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"purchased_on":"2026-10-09","items":[%s]}`, s.supplier["id"], s.item("1", "1")), bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code, "the employee may not see it")

	// A deletion: the stock comes back, the number is never given again.
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "1.000", decode(t, rec)["quantity"])
	next := api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("1", "1")))
	assert.EqualValues(t, 3, next["number"])
}
