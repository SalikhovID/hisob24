package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// shopWithCustomer is the store with 10 Olma in Asosiy and a customer, Dilshod.
type shopWithCustomer struct {
	store
	customer map[string]any
}

func (api testAPI) shopWithCustomer(t *testing.T) shopWithCustomer {
	t.Helper()
	s := shopWithCustomer{store: api.newStore(t)}
	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	sh := api.customerShop(t, s.company)
	s.customer = api.enter(t, s.owner, sh.jismoniy, "998911112233", fmt.Sprintf(`{"%s":"Dilshod"}`, key(sh.fish)))
	return s
}

// sale is the body of a sale out of the location to the customer (0: a
// retail sale) at the usual moment, with the lines and payments given.
func (s shopWithCustomer) sale(locationID int64, customer bool, lines, payments string) string {
	customerID := "null"
	if customer {
		customerID = fmt.Sprint(s.customer["id"])
	}
	return fmt.Sprintf(`{"location_id":%d,"customer_id":%s,"at":"%s","items":[%s],"payments":[%s]}`, locationID, customerID, at, lines, payments)
}

func (api testAPI) enterSale(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/sales", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func TestSalesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.shopWithCustomer(t)

	sale := api.enterSale(t, s.owner, fmt.Sprintf(`{"location_id":%d,"customer_id":%v,"at":"%s","note":" Kechqurun ","items":[%s],"payments":[%s]}`, s.asosiy, s.customer["id"], at, s.item("4", "3000"), s.paid("5000")))
	assert.EqualValues(t, 1, sale["number"])
	assert.EqualValues(t, s.asosiy, sale["location_id"])
	assert.Equal(t, "Asosiy", sale["location_name"])
	assert.Equal(t, map[string]any{"id": s.customer["id"], "name": "Dilshod"}, sale["customer"])
	assert.Equal(t, atUTC, sale["at"])
	assert.EqualValues(t, 1, sale["currency_id"])
	assert.Equal(t, "1.0000", sale["rate"])
	assert.Equal(t, "Kechqurun", sale["note"])
	assert.Equal(t, "12000.00", sale["total"])
	assert.Equal(t, "12000.00", sale["total_uzs"])
	assert.Equal(t, "5000.00", sale["paid"])
	assert.EqualValues(t, 1, sale["items_count"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "4.000", "price": "3000.00", "amount": "12000.00"}}, sale["items"])
	payments := sale["payments"].([]any)
	require.Len(t, payments, 1)
	assert.Equal(t, "Naqd", payments[0].(map[string]any)["account_name"])
	path := fmt.Sprintf("/app/sales/%v", sale["id"])
	retail := api.enterSale(t, s.owner, s.sale(s.asosiy, false, s.item("1", "3000"), s.paid("3000")))
	assert.Nil(t, retail["customer"], "a retail sale")
	assert.EqualValues(t, 2, retail["number"])

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"no location":        {fmt.Sprintf(`{"customer_id":null,"at":"%s","items":[%s]}`, at, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`},
		"a location outside": {s.sale(999999, true, s.item("1", "1"), ""), http.StatusForbidden, noPermission},
		"no customer such":   {fmt.Sprintf(`{"location_id":%d,"customer_id":999999,"at":"%s","items":[%s]}`, s.asosiy, at, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Mijozni tanlang"}`},
		"no lines":           {s.sale(s.asosiy, true, "", ""), http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta mahsulot qo'shing"}`},
		"a retail sale owed": {s.sale(s.asosiy, false, s.item("1", "3000"), ""), http.StatusBadRequest, `{"error":"validation_error","message":"Mijozsiz sotuv to'liq to'langan bo'lsin"}`},
		"more than there is": {s.sale(s.asosiy, true, s.item("6", "1"), ""), http.StatusConflict, `{"error":"stock_insufficient","message":"«Olma» uchun omborda yetarli qoldiq yo'q"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/sales", tc.body, bearer(s.owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}

	rec := api.do(t, http.MethodGet, "/app/sales", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	assert.EqualValues(t, 2, page["items"].([]any)[0].(map[string]any)["number"], "the newest first")
	assert.Nil(t, page["items"].([]any)[0].(map[string]any)["items"], "no lines in the list")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/sales?customer_id=%v", s.customer["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "one customer's")
	rec = api.do(t, http.MethodGet, "/app/sales?customer_id=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Mijoz noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/sales?location_id=%d", s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the employee works in Chilonzor alone")
	rec = api.do(t, http.MethodGet, "/app/sales", "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 0, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Sotuv topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "12000.00", decode(t, rec)["total"])

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"customer_id":%v,"at":"%s","items":[%s],"payments":[]}`, s.customer["id"], at, s.item("2", "3000")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.Equal(t, "6000.00", saved["total"])
	assert.Equal(t, "0.00", saved["paid"], "the payment replaced by none")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "7.000", decode(t, rec)["quantity"], "10 − 2 − 1")
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "9.000", decode(t, rec)["quantity"], "its Olma back")
}

func TestCustomerMoneyAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.shopWithCustomer(t)
	customerPath := fmt.Sprintf("/app/customers/%v", s.customer["id"])
	api.enterSale(t, s.owner, s.sale(s.asosiy, true, s.item("4", "3000"), s.paid("5000")))

	// A payment on its own.
	rec := api.do(t, http.MethodPost, customerPath+"/payments", fmt.Sprintf(`{"bank_account_id":%d,"amount":"1000","at":"%s","note":" Naqd "}`, s.cash, at), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	payment := decode(t, rec)
	assert.Equal(t, s.customer["id"], payment["customer_id"])
	assert.Nil(t, payment["sale_id"])
	assert.Nil(t, payment["sale_number"])
	assert.Equal(t, "Naqd", payment["account_name"])
	assert.Equal(t, "1000.00", payment["amount"])
	assert.Equal(t, "1000.00", payment["amount_uzs"])
	assert.Equal(t, atUTC, payment["at"])
	assert.Equal(t, "Naqd", payment["note"])
	rec = api.do(t, http.MethodPost, customerPath+"/payments", fmt.Sprintf(`{"bank_account_id":%d,"at":"%s"}`, s.cash, at), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Summani kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, customerPath+"/payments", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	payments := decode(t, rec)
	assert.EqualValues(t, 2, payments["total"], "the one entered with the sale too")
	linked := payments["items"].([]any)[1].(map[string]any)
	assert.EqualValues(t, 1, linked["sale_number"])
	own := fmt.Sprintf("%s/payments/%v", customerPath, payment["id"])
	rec = api.do(t, http.MethodPut, own, fmt.Sprintf(`{"bank_account_id":%d,"amount":"1500","at":"%s"}`, s.cash, at), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "1500.00", decode(t, rec)["amount"])
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("%s/payments/%v", customerPath, linked["id"]), "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"payment_linked","message":"Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, own, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, own, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"To'lov topilmadi"}`, rec.Body.String())

	// An opening debt.
	rec = api.do(t, http.MethodPost, customerPath+"/openings", fmt.Sprintf(`{"kind":"debt","amount":"300000","at":"%s"}`, at), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	debt := decode(t, rec)
	assert.Equal(t, "debt", debt["kind"])
	assert.Equal(t, s.customer["id"], debt["customer_id"])
	assert.Equal(t, "300000.00", debt["amount"])
	rec = api.do(t, http.MethodGet, customerPath+"/openings", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	openingPath := fmt.Sprintf("%s/openings/%v", customerPath, debt["id"])
	rec = api.do(t, http.MethodPut, openingPath, fmt.Sprintf(`{"kind":"prepay","amount":"1","at":"%s"}`, at), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tur o'zgartirilmaydi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, openingPath, fmt.Sprintf(`{"kind":"debt","amount":"200000","at":"%s"}`, at), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "200000.00", decode(t, rec)["amount"])

	// The balance and the statement: 12 000 sold, 5 000 paid, 200 000 owed before.
	rec = api.do(t, http.MethodGet, customerPath, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	customer := decode(t, rec)
	assert.Equal(t, "207000.00", customer["balance"])
	assert.Equal(t, []any{map[string]any{"currency_id": 1.0, "amount": "207000.00"}}, customer["balance_by_currency"])
	rec = api.do(t, http.MethodGet, "/app/customers", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	listed := decode(t, rec)["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "207000.00", listed["balance"], "the list carries the balance")
	assert.Nil(t, listed["balance_by_currency"], "but not by currency")
	rec = api.do(t, http.MethodGet, customerPath+"/statement", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	statement := decode(t, rec)
	assert.EqualValues(t, 3, statement["total"])
	rows := statement["items"].([]any)
	kinds := []any{rows[0].(map[string]any)["kind"], rows[1].(map[string]any)["kind"], rows[2].(map[string]any)["kind"]}
	assert.ElementsMatch(t, []any{"customer_debt", "sale", "customer_payment"}, kinds)
	assert.Equal(t, "207000.00", rows[0].(map[string]any)["balance_uzs"])
	rec = api.do(t, http.MethodGet, "/app/customers/999999/statement", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Mijoz topilmadi"}`, rec.Body.String())

	// A customer with documents is kept.
	rec = api.do(t, http.MethodDelete, customerPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"customer_in_use","message":"Bu mijozda 3 ta hujjat bor"}`, rec.Body.String())

	// Without the sales the balance is nobody's business.
	kuzatuvchi := api.addRole(t, s.company, "Kuzatuvchi", "customers.view")
	api.giveRole(t, valisPhone, s.company, &kuzatuvchi)
	rec = api.do(t, http.MethodGet, customerPath, "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	hidden := decode(t, rec)
	assert.Nil(t, hidden["balance"])
	assert.Nil(t, hidden["balance_by_currency"])
	rec = api.do(t, http.MethodGet, "/app/customers", "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Nil(t, decode(t, rec)["items"].([]any)[0].(map[string]any)["balance"])
	rec = api.do(t, http.MethodGet, customerPath+"/statement", "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
}
