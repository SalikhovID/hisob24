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

// store is a company with two locations, its cash, its owner Ali and its
// employee Vali (restricted to Chilonzor), a supplier and a product.
type store struct {
	company, asosiy, chilonzor, cash int64
	owner, employee                  string
	supplier, product                map[string]any
}

func (api testAPI) newStore(t *testing.T) store {
	t.Helper()
	s := store{company: api.addCompany(t, "Olma", 30)}
	s.cash = api.cashOf(t, s.company)
	s.asosiy = api.addLocation(t, s.company, "Asosiy")
	s.chilonzor = api.addLocation(t, s.company, "Chilonzor")
	s.owner, _ = api.signIn(t, alisPhone, map[int64]string{s.company: "owner"})
	s.employee, _ = api.signIn(t, valisPhone, map[int64]string{s.company: "user"})
	api.restrictTo(t, valisPhone, s.company, s.chilonzor)
	s.supplier = api.enterSupplier(t, s.owner, `{"name":"Bozor","phone":"+998 90 123-45-67"}`)
	s.product = api.enterProduct(t, s.owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	return s
}

// at is the usual moment of a document in the tests, 9:00 on 2026-10-07 in
// Tashkent, as the client sends it; atUTC is how the API tells it back.
const (
	at    = "2026-10-07T09:00:00+05:00"
	atUTC = "2026-10-07T04:00:00Z"
)

// purchase is the body of a purchase from the store's supplier in the
// location, at the usual moment, with the lines given.
func (s store) purchase(locationID int64, lines string) string {
	return fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","items":[%s]}`, locationID, s.supplier["id"], at, lines)
}

// paid is a payment line out of the store's cash.
func (s store) paid(amount string) string {
	return fmt.Sprintf(`{"bank_account_id":%d,"amount":"%s"}`, s.cash, amount)
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
	assert.Equal(t, []any{}, s.supplier["balance_by_currency"], "nothing owed in any currency")
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
	assert.Nil(t, row["balance_by_currency"])
	rec = api.do(t, http.MethodGet, path, "", bearer(watcher))
	require.Equal(t, http.StatusOK, rec.Code)
	got := decode(t, rec)
	assert.Nil(t, got["balance"])
	assert.Nil(t, got["purchases_total"])
	assert.Nil(t, got["payments_total"])
	assert.Nil(t, got["balance_by_currency"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	got = decode(t, rec)
	assert.Equal(t, "10000.00", got["balance"], "the whole company's, whatever the employee's locations")
	assert.Equal(t, "10000.00", got["purchases_total"])
	assert.Equal(t, "0.00", got["payments_total"])
	assert.Equal(t, []any{map[string]any{"currency_id": 1.0, "amount": "10000.00"}}, got["balance_by_currency"])
	rec = api.do(t, http.MethodGet, "/app/suppliers", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Nil(t, decode(t, rec)["items"].([]any)[0].(map[string]any)["balance_by_currency"], "the list carries the balance in so'm alone")
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
	assert.JSONEq(t, `{"error":"supplier_in_use","message":"Bu ta'minotchida 1 ta hujjat bor"}`, rec.Body.String())
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
	purchase := api.enterPurchase(t, s.owner, fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","payments":[%s],"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.paid("500"), s.item("10", "1000")))

	rec := api.do(t, http.MethodPost, path, fmt.Sprintf(`{"bank_account_id":%d,"amount":"1200.5","at":"2026-10-08T09:00:00+05:00","note":" Naqd "}`, s.cash), bearer(s.employee))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	own := decode(t, rec)
	assert.Equal(t, s.supplier["id"], own["supplier_id"])
	assert.EqualValues(t, s.cash, own["bank_account_id"])
	assert.Equal(t, "Naqd", own["account_name"])
	assert.Equal(t, "1200.50", own["amount"])
	assert.EqualValues(t, 1, own["currency_id"], "the account's currency")
	assert.Equal(t, "1.0000", own["rate"])
	assert.Equal(t, "1200.50", own["amount_uzs"])
	assert.Equal(t, "2026-10-08T04:00:00Z", own["at"], "told in UTC")
	assert.Equal(t, "Naqd", own["note"])
	assert.Nil(t, own["purchase_id"])
	assert.Nil(t, own["purchase_number"])
	assert.Nil(t, own["created_by_name"])
	assert.NotEmpty(t, own["created_at"])
	for name, tc := range map[string]struct{ body, message string }{
		"no account": {`{"amount":"1","at":"2026-10-08T09:00:00+05:00"}`, "Akkauntni tanlang"},
		"no amount":  {fmt.Sprintf(`{"bank_account_id":%d,"at":"2026-10-08T09:00:00+05:00"}`, s.cash), "Summani kiriting"},
		"zero":       {fmt.Sprintf(`{"bank_account_id":%d,"amount":"0","at":"2026-10-08T09:00:00+05:00"}`, s.cash), "Summa noto'g'ri"},
		"no time":    {fmt.Sprintf(`{"bank_account_id":%d,"amount":"1"}`, s.cash), "Vaqtni kiriting"},
		"a bad time": {fmt.Sprintf(`{"bank_account_id":%d,"amount":"1","at":"8.10.2026"}`, s.cash), "Vaqt noto'g'ri"},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, "/app/suppliers/999999/payments", fmt.Sprintf(`{"bank_account_id":%d,"amount":"1","at":"%s"}`, s.cash, at), bearer(s.owner))
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
	assert.Equal(t, atUTC, linked["at"], "at the purchase's moment")
	rec = api.do(t, http.MethodGet, path+"?page=0", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	ownPath := fmt.Sprintf("%s/%v", path, own["id"])
	rec = api.do(t, http.MethodPut, ownPath, fmt.Sprintf(`{"bank_account_id":%d,"amount":"1500","at":"2026-10-09T09:00:00+05:00"}`, s.cash), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got := decode(t, rec)
	assert.Equal(t, "1500.00", got["amount"])
	assert.Equal(t, "2026-10-09T04:00:00Z", got["at"])
	assert.Nil(t, got["note"], "left out: cleared")
	rec = api.do(t, http.MethodPut, ownPath, fmt.Sprintf(`{"bank_account_id":%d,"at":"2026-10-09T09:00:00+05:00"}`, s.cash), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Summani kiriting"}`, rec.Body.String())
	linkedPath := fmt.Sprintf("%s/%v", path, linked["id"])
	rec = api.do(t, http.MethodPut, linkedPath, fmt.Sprintf(`{"bank_account_id":%d,"amount":"1","at":"%s"}`, s.cash, at), bearer(s.owner))
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

	// The statement: the documents in time, the newest first, with what was
	// owed after each.
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/suppliers/%v/statement", s.supplier["id"]), "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	statement := decode(t, rec)
	assert.EqualValues(t, 2, statement["total"])
	rows := statement["items"].([]any)
	assert.Equal(t, map[string]any{
		"id": linked["id"], "kind": "supplier_payment", "number": 1.0, "at": atUTC, "amount": "500.00", "currency_id": 1.0, "rate": "1.0000",
		"amount_uzs": "500.00", "delta_uzs": "-500.00", "balance_uzs": "9500.00", "linked_id": purchase["id"], "linked_number": 1.0,
		"bank_account_id": float64(s.cash), "account_name": "Naqd", "note": nil, "created_by_name": nil,
	}, rows[0], "the payment, entered with the purchase, after it, with its account")
	assert.Nil(t, rows[1].(map[string]any)["bank_account_id"], "a purchase names no account")
	assert.Equal(t, "purchase", rows[1].(map[string]any)["kind"])
	assert.Equal(t, "10000.00", rows[1].(map[string]any)["delta_uzs"])
	assert.Equal(t, "10000.00", rows[1].(map[string]any)["balance_uzs"])
	rec = api.do(t, http.MethodGet, "/app/suppliers/999999/statement", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/suppliers/%v/statement?page=x", s.supplier["id"]), "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPurchasesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)

	rec := api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","note":" Ertalab ","payments":[%s],"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.paid("5000"), s.item("12.5", "1000")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	p := decode(t, rec)
	assert.NotEmpty(t, p["id"])
	assert.EqualValues(t, 1, p["number"])
	assert.EqualValues(t, s.asosiy, p["location_id"])
	assert.Equal(t, "Asosiy", p["location_name"])
	assert.Equal(t, map[string]any{"id": s.supplier["id"], "name": "Bozor"}, p["supplier"])
	assert.Equal(t, atUTC, p["at"], "told in UTC")
	assert.EqualValues(t, 1, p["currency_id"], "so'm unless told")
	assert.Equal(t, "1.0000", p["rate"])
	assert.Equal(t, "Ertalab", p["note"])
	assert.Equal(t, "12500.00", p["total"])
	assert.Equal(t, "12500.00", p["total_uzs"])
	assert.Equal(t, "5000.00", p["paid"])
	assert.EqualValues(t, 1, p["items_count"])
	assert.Nil(t, p["created_by_name"])
	assert.NotEmpty(t, p["created_at"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "12.500", "price": "1000.00", "amount": "12500.00"}}, p["items"])
	payments := p["payments"].([]any)
	require.Len(t, payments, 1)
	assert.Equal(t, map[string]any{"id": payments[0].(map[string]any)["id"], "bank_account_id": float64(s.cash), "account_name": "Naqd", "amount": "5000.00", "currency_id": 1.0}, payments[0])
	path := fmt.Sprintf("/app/purchases/%v", p["id"])

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"no location":        {s.purchase(0, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`},
		"a location outside": {s.purchase(999999, s.item("1", "1")), http.StatusForbidden, noPermission},
		"no supplier":        {fmt.Sprintf(`{"location_id":%d,"at":"%s","items":[%s]}`, s.asosiy, at, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Ta'minotchini tanlang"}`},
		"no time":            {fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"items":[%s]}`, s.asosiy, s.supplier["id"], s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Vaqtni kiriting"}`},
		"a currency off":     {fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","currency_id":3,"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.item("1", "1")), http.StatusBadRequest, `{"error":"currency_not_allowed","message":"Bu valyuta kompaniyada yoqilmagan"}`},
		"no lines":           {s.purchase(s.asosiy, ""), http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta mahsulot qo'shing"}`},
		"a bad quantity":     {s.purchase(s.asosiy, s.item("0", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» miqdori noto'g'ri"}`},
		"a product twice":    {s.purchase(s.asosiy, s.item("1", "1")+","+s.item("2", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» ikki marta kiritilgan"}`},
		"no account":         {fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","payments":[{"amount":"1"}],"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Akkauntni tanlang"}`},
		"a bad payment":      {fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","payments":[%s],"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.paid("x"), s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"To'lov summasi noto'g'ri"}`},
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
	assert.Equal(t, []any{}, theirs["payments"], "nothing paid with it")

	// In dollars: the standard rate at the moment, or the document's own.
	api.turnOn(t, s.company, 2)
	api.exec(t, "INSERT INTO currency_rates (company_id, usd, set_by, set_at) VALUES ($1, 12800, $2, '2026-10-01 00:00+05')", s.company, alisPhone)
	rec = api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","currency_id":2,"payments":[%s],"items":[%s]}`, s.asosiy, s.supplier["id"], at, s.paid("640000"), s.item("2", "50")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	dollars := decode(t, rec)
	assert.EqualValues(t, 2, dollars["currency_id"])
	assert.Equal(t, "12800.0000", dollars["rate"])
	assert.Equal(t, "100.00", dollars["total"])
	assert.Equal(t, "1280000.00", dollars["total_uzs"])
	assert.Equal(t, "50.00", dollars["paid"], "640 000 so'm in dollars")
	rec = api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","currency_id":2,"rate":"13000","items":[%s]}`, s.asosiy, s.supplier["id"], at, s.item("1", "10")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, "13000.0000", decode(t, rec)["rate"], "the document's own rate")
	rec = api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"at":"%s","currency_id":2,"rate":"abc","items":[%s]}`, s.asosiy, s.supplier["id"], at, s.item("1", "10")), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Kurs noto'g'ri"}`, rec.Body.String())

	// The list: the member's locations, or one of them; the newest first.
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 4, page["total"])
	first := page["items"].([]any)[0].(map[string]any)
	assert.Nil(t, first["items"], "no lines in the list")
	assert.Nil(t, first["payments"], "nor payments")
	assert.EqualValues(t, 1, first["items_count"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?location_id=%d", s.asosiy), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 3, decode(t, rec)["total"])
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
	assert.EqualValues(t, 4, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/purchases?page=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	// The page: the member's locations alone.
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, p["items"], decode(t, rec)["items"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Xarid topilmadi"}`, rec.Body.String())

	// An edit: the number and the location stay, the stock moves, the
	// payments are the ones sent.
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"at":"2026-10-09T09:00:00+05:00","items":[%s]}`, s.supplier["id"], s.item("4", "1100")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, 1, saved["number"])
	assert.EqualValues(t, s.asosiy, saved["location_id"])
	assert.Equal(t, "2026-10-09T04:00:00Z", saved["at"])
	assert.Equal(t, "4400.00", saved["total"])
	assert.Equal(t, "0.00", saved["paid"], "nothing paid now")
	assert.Equal(t, []any{}, saved["payments"])
	assert.Nil(t, saved["note"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "8.000", decode(t, rec)["quantity"], "4 + 2 + 1 in Asosiy, 1 in Chilonzor")
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":0,"at":"%s","items":[]}`, at), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Ta'minotchini tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"at":"%s","items":[%s]}`, s.supplier["id"], at, s.item("1", "1")), bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code, "the employee may not see it")

	// A deletion: the stock comes back, the number is never given again.
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "4.000", decode(t, rec)["quantity"])
	next := api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("1", "1")))
	assert.EqualValues(t, 5, next["number"])
}
