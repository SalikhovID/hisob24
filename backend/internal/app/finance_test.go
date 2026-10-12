package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// decodeList reads a JSON array answer.
func decodeList(t *testing.T, rec *httptest.ResponseRecorder) []any {
	t.Helper()
	var list []any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list), rec.Body.String())
	return list
}

// addAccount gives the company an account, as the admin does, and returns its id.
func (api testAPI) addAccount(t *testing.T, companyID int64, name string, currencyID int64, active bool) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO bank_accounts (company_id, name, currency_id, is_active) VALUES ($1, $2, $3, $4) RETURNING id", companyID, name, currencyID, active)
}

// /app/me tells the company's live accounts, where a payment may go
// (logic/finance.md, section 3); none before a company is chosen.
func TestMeTellsTheCompanysAccounts(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	cash := api.cashOf(t, olma)
	card := api.addAccount(t, olma, "Karta", 2, false)
	gone := api.addAccount(t, olma, "Eski", 1, true)
	api.exec(t, "UPDATE bank_accounts SET deleted_at = now() WHERE id = $1", gone)

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{
		map[string]any{"id": float64(cash), "name": "Naqd", "currency_id": 1.0, "is_active": true},
		map[string]any{"id": float64(card), "name": "Karta", "currency_id": 2.0, "is_active": false},
	}, decode(t, rec)["accounts"], "the live accounts in the order added, the inactive too")
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(undecided))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, []any{}, decode(t, rec)["accounts"], "nothing before a choice of company")
}

func TestFinanceCategories(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	path := "/app/finance-categories"
	add := func(body string) map[string]any {
		rec := api.do(t, http.MethodPost, path, body, bearer(owner))
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return decode(t, rec)
	}
	names := func(token, query string) []any {
		rec := api.do(t, http.MethodGet, path+query, "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out []any
		for _, item := range decodeList(t, rec) {
			out = append(out, item.(map[string]any)["name"])
		}
		return out
	}

	ijara := add(`{"name":" Ijara ","kind":"expense"}`)
	assert.NotEmpty(t, ijara["id"])
	assert.Equal(t, "Ijara", ijara["name"], "trimmed")
	assert.Equal(t, "expense", ijara["kind"])
	assert.Equal(t, true, ijara["is_active"])
	kommunal := add(`{"name":"Kommunal","kind":"expense"}`)
	add(`{"name":"Boshqa kirim","kind":"income"}`)

	assert.Equal(t, []any{"Ijara", "Kommunal", "Boshqa kirim"}, names(employee, ""), "every member reads them, the expenses first")
	assert.Equal(t, []any{"Boshqa kirim"}, names(owner, "?kind=income"))
	rec := api.do(t, http.MethodGet, path+"?kind=transfer", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tur noto'g'ri"}`, rec.Body.String())

	for name, tc := range map[string]struct{ body, want string }{
		"no kind":     {`{"name":"Soliq"}`, `{"error":"validation_error","message":"Turni tanlang"}`},
		"no name":     {`{"name":" ","kind":"expense"}`, `{"error":"validation_error","message":"Nomni kiriting"}`},
		"a long name": {fmt.Sprintf(`{"name":"%s","kind":"expense"}`, strings.Repeat("a", 61)), `{"error":"validation_error","message":"Nom 60 belgidan oshmasin"}`},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, path, `{"name":"ijara","kind":"expense"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli kategoriya allaqachon bor"}`, rec.Body.String())

	ijaraPath := fmt.Sprintf("%s/%v", path, ijara["id"])
	rec = api.do(t, http.MethodPatch, ijaraPath, `{"name":"Ofis ijarasi","is_active":false}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "Ofis ijarasi", edited["name"])
	assert.Equal(t, false, edited["is_active"])
	assert.Equal(t, "expense", edited["kind"], "the kind stays")
	rec = api.do(t, http.MethodPatch, path+"/999999", `{"name":"Soliq"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Kategoriya topilmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"kind":"expense","ids":[%v,%v]}`, kommunal["id"], ijara["id"]), bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, []any{"Kommunal", "Ofis ijarasi"}, names(owner, "?kind=expense"), "in the new order")
	rec = api.do(t, http.MethodPut, path+"/order", fmt.Sprintf(`{"kind":"expense","ids":[%v]}`, kommunal["id"]), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"order_changed","message":"Ro'yxat o'zgargan. Sahifani yangilang"}`, rec.Body.String())

	rec = api.do(t, http.MethodDelete, ijaraPath, "", bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, ijaraPath, "", bearer(owner)).Code, "deleted already")
	assert.Equal(t, []any{"Kommunal"}, names(owner, "?kind=expense"))

	// The settings are the owner's (and settings.* roles'), not an employee's.
	for name, req := range map[string]struct{ method, path, body string }{
		"adding":   {http.MethodPost, path, `{"name":"Soliq","kind":"expense"}`},
		"changing": {http.MethodPatch, fmt.Sprintf("%s/%v", path, kommunal["id"]), `{"name":"Soliq"}`},
		"ordering": {http.MethodPut, path + "/order", fmt.Sprintf(`{"kind":"expense","ids":[%v]}`, kommunal["id"])},
		"deleting": {http.MethodDelete, fmt.Sprintf("%s/%v", path, kommunal["id"]), ""},
	} {
		rec := api.do(t, req.method, req.path, req.body, bearer(employee))
		assert.Equal(t, http.StatusForbidden, rec.Code, name)
		assert.JSONEq(t, noPermission, rec.Body.String(), name)
	}
}

// cashbook is a company with its cash, a card in dollars, a second cash,
// an expense category (Ijara) and an income category (Boshqa kirim), and
// its owner signed in.
type cashbook struct {
	company, cash, card, kassa2, ijara, boshqa int64
	owner, employee                            string
}

func (api testAPI) newCashbook(t *testing.T) cashbook {
	t.Helper()
	b := cashbook{company: api.addCompany(t, "Olma", 30)}
	b.cash = api.cashOf(t, b.company)
	api.turnOn(t, b.company, 2)
	b.card = api.addAccount(t, b.company, "Karta", 2, true)
	b.kassa2 = api.addAccount(t, b.company, "Kassa 2", 1, true)
	b.owner, _ = api.signIn(t, alisPhone, map[int64]string{b.company: "owner"})
	b.employee, _ = api.signIn(t, valisPhone, map[int64]string{b.company: "user"})
	category := func(name, kind string) int64 {
		rec := api.do(t, http.MethodPost, "/app/finance-categories", fmt.Sprintf(`{"name":"%s","kind":"%s"}`, name, kind), bearer(b.owner))
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return int64(decode(t, rec)["id"].(float64))
	}
	b.ijara = category("Ijara", "expense")
	b.boshqa = category("Boshqa kirim", "income")
	return b
}

// enter posts a cash document and reads it back.
func (api testAPI) enterCash(t *testing.T, token, path, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, path, body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

// refusal checks a request's answer: its status and its body.
func (api testAPI) expectRefusal(t *testing.T, token, method, path, body string, status int, want string, about string) {
	t.Helper()
	rec := api.do(t, method, path, body, bearer(token))
	assert.Equal(t, status, rec.Code, about)
	assert.JSONEq(t, want, rec.Body.String(), about)
}

const documentNotFound = `{"error":"not_found","message":"Hujjat topilmadi"}`

func TestCashOpeningsAPI(t *testing.T) {
	api := newTestAPI(t)
	b := api.newCashbook(t)
	path := "/app/cash-openings"

	d := api.enterCash(t, b.owner, path, fmt.Sprintf(`{"bank_account_id":%d,"amount":"1000000","at":"%s","note":" Boshlanish "}`, b.cash, at))
	assert.NotEmpty(t, d["id"])
	assert.EqualValues(t, 1, d["number"])
	assert.EqualValues(t, b.cash, d["bank_account_id"])
	assert.Equal(t, "Naqd", d["account_name"])
	assert.EqualValues(t, 1, d["currency_id"])
	assert.Equal(t, "1000000.00", d["amount"])
	assert.Equal(t, atUTC, d["at"])
	assert.Equal(t, "Boshlanish", d["note"], "trimmed")
	assert.Contains(t, d, "created_by_name")
	assert.NotEmpty(t, d["created_at"])
	assert.Equal(t, d["created_at"], d["updated_at"])
	usd := api.enterCash(t, b.owner, path, fmt.Sprintf(`{"bank_account_id":%d,"amount":"250.5","at":"2026-10-06T09:00:00+05:00"}`, b.card))
	assert.EqualValues(t, 2, usd["number"])
	assert.EqualValues(t, 2, usd["currency_id"], "the account's currency")
	assert.Equal(t, "250.50", usd["amount"])
	assert.Nil(t, usd["note"])

	for name, tc := range map[string]struct{ body, want string }{
		"no account": {fmt.Sprintf(`{"amount":"5","at":"%s"}`, at), `{"error":"validation_error","message":"Akkauntni tanlang"}`},
		"no moment":  {fmt.Sprintf(`{"bank_account_id":%d,"amount":"5"}`, b.cash), `{"error":"validation_error","message":"Vaqtni kiriting"}`},
		"no amount":  {fmt.Sprintf(`{"bank_account_id":%d,"at":"%s"}`, b.cash, at), `{"error":"validation_error","message":"Summani kiriting"}`},
	} {
		api.expectRefusal(t, b.owner, http.MethodPost, path, tc.body, http.StatusBadRequest, tc.want, name)
	}

	rec := api.do(t, http.MethodGet, path, "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	assert.EqualValues(t, 1, page["page"])
	assert.EqualValues(t, 20, page["page_size"])
	items := page["items"].([]any)
	require.Len(t, items, 2)
	assert.Equal(t, d["id"], items[0].(map[string]any)["id"], "the newest first")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("%s?account_id=%d", path, b.card), "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "the card's alone")
	api.expectRefusal(t, b.owner, http.MethodGet, path+"?account_id=x", "", http.StatusBadRequest, `{"error":"validation_error","message":"Akkaunt noto'g'ri"}`, "an account that is not a number")
	api.expectRefusal(t, b.owner, http.MethodGet, path+"?page=x", "", http.StatusBadRequest, `{"error":"validation_error","message":"Sahifa raqami noto'g'ri"}`, "a page that is not a number")

	one := fmt.Sprintf("%s/%v", path, d["id"])
	rec = api.do(t, http.MethodGet, one, "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, d, decode(t, rec))
	rec = api.do(t, http.MethodPut, one, fmt.Sprintf(`{"bank_account_id":%d,"amount":"80","at":"2026-10-08T09:00:00+05:00"}`, b.card), bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, 1, saved["number"], "the number stays")
	assert.EqualValues(t, b.card, saved["bank_account_id"])
	assert.EqualValues(t, 2, saved["currency_id"])
	assert.Equal(t, "80.00", saved["amount"])
	assert.Nil(t, saved["note"], "cleared")
	api.expectRefusal(t, b.owner, http.MethodPut, path+"/999999", fmt.Sprintf(`{"bank_account_id":%d,"amount":"5","at":"%s"}`, b.cash, at), http.StatusNotFound, documentNotFound, "unknown")
	api.expectRefusal(t, b.owner, http.MethodDelete, path+"/999999", "", http.StatusNotFound, documentNotFound, "deleting unknown")
	rec = api.do(t, http.MethodDelete, one, "", bearer(b.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	api.expectRefusal(t, b.owner, http.MethodGet, one, "", http.StatusNotFound, documentNotFound, "deleted")
	api.expectRefusal(t, b.owner, http.MethodDelete, one, "", http.StatusNotFound, documentNotFound, "deleted twice")
	// Whoever may see the finance (the employee, by default) reads the list.
	rec = api.do(t, http.MethodGet, path, "", bearer(b.employee))
	assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func TestExpensesAPI(t *testing.T) {
	api := newTestAPI(t)
	b := api.newCashbook(t)
	path := "/app/expenses"

	rent := api.enterCash(t, b.owner, path, fmt.Sprintf(`{"kind":"expense","bank_account_id":%d,"category_id":%d,"amount":"150000","at":"%s","note":"Oktabr"}`, b.cash, b.ijara, at))
	assert.Equal(t, "expense", rent["kind"])
	assert.EqualValues(t, 1, rent["number"])
	assert.EqualValues(t, b.cash, rent["bank_account_id"])
	assert.Equal(t, "Naqd", rent["account_name"])
	assert.EqualValues(t, b.ijara, rent["category_id"])
	assert.Equal(t, "Ijara", rent["category_name"])
	assert.Equal(t, "150000.00", rent["amount"])
	assert.Equal(t, atUTC, rent["at"])
	assert.Equal(t, "Oktabr", rent["note"])
	income := api.enterCash(t, b.owner, path, fmt.Sprintf(`{"kind":"income","bank_account_id":%d,"category_id":%d,"amount":"200000","at":"2026-10-06T09:00:00+05:00"}`, b.cash, b.boshqa))
	assert.Equal(t, "income", income["kind"])
	assert.EqualValues(t, 1, income["number"], "numbered apart")
	assert.Equal(t, "Boshqa kirim", income["category_name"])

	for name, tc := range map[string]struct{ body, want string }{
		"no kind":          {fmt.Sprintf(`{"bank_account_id":%d,"category_id":%d,"amount":"5","at":"%s"}`, b.cash, b.ijara, at), `{"error":"validation_error","message":"Turni tanlang"}`},
		"no category":      {fmt.Sprintf(`{"kind":"expense","bank_account_id":%d,"amount":"5","at":"%s"}`, b.cash, at), `{"error":"validation_error","message":"Kategoriyani tanlang"}`},
		"the other kind's": {fmt.Sprintf(`{"kind":"expense","bank_account_id":%d,"category_id":%d,"amount":"5","at":"%s"}`, b.cash, b.boshqa, at), `{"error":"validation_error","message":"Kategoriya turi mos emas"}`},
	} {
		api.expectRefusal(t, b.owner, http.MethodPost, path, tc.body, http.StatusBadRequest, tc.want, name)
	}

	ids := func(query string) []any {
		rec := api.do(t, http.MethodGet, path+query, "", bearer(b.owner))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out []any
		for _, item := range decode(t, rec)["items"].([]any) {
			out = append(out, item.(map[string]any)["id"])
		}
		return out
	}
	assert.Equal(t, []any{rent["id"]}, ids(""), "the expenses unless another kind is asked")
	assert.Equal(t, []any{income["id"]}, ids("?kind=income"))
	assert.Equal(t, []any{rent["id"]}, ids(fmt.Sprintf("?account_id=%d&category_id=%d", b.cash, b.ijara)))
	assert.Empty(t, ids(fmt.Sprintf("?category_id=%d", b.boshqa)), "no expense under an income's category")
	assert.Equal(t, []any{rent["id"]}, ids("?from=2026-10-07&to=2026-10-07"), "the day, in the member's zone")
	assert.Empty(t, ids("?from=2026-10-08"))
	assert.Equal(t, []any{income["id"]}, ids("?kind=income&to=2026-10-06"))
	for name, tc := range map[string]struct{ query, want string }{
		"a kind unknown":             {"?kind=gift", `{"error":"validation_error","message":"Tur noto'g'ri"}`},
		"a category not a number":    {"?category_id=x", `{"error":"validation_error","message":"Kategoriya noto'g'ri"}`},
		"a day that is not one":      {"?from=yesterday", `{"error":"validation_error","message":"Sana noto'g'ri"}`},
		"a span that runs backwards": {"?from=2026-10-08&to=2026-10-07", `{"error":"validation_error","message":"Sana noto'g'ri"}`},
	} {
		api.expectRefusal(t, b.owner, http.MethodGet, path+tc.query, "", http.StatusBadRequest, tc.want, name)
	}

	one := fmt.Sprintf("%s/%v", path, rent["id"])
	rec := api.do(t, http.MethodGet, one, "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, rent, decode(t, rec))
	api.expectRefusal(t, b.owner, http.MethodPut, one, fmt.Sprintf(`{"kind":"income","bank_account_id":%d,"category_id":%d,"amount":"5","at":"%s"}`, b.cash, b.boshqa, at), http.StatusBadRequest, `{"error":"validation_error","message":"Tur o'zgartirilmaydi"}`, "an expense made an income")
	rec = api.do(t, http.MethodPut, one, fmt.Sprintf(`{"kind":"expense","bank_account_id":%d,"category_id":%d,"amount":"160000","at":"%s"}`, b.kassa2, b.ijara, at), bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, b.kassa2, saved["bank_account_id"])
	assert.Equal(t, "160000.00", saved["amount"])
	rec = api.do(t, http.MethodDelete, one, "", bearer(b.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	api.expectRefusal(t, b.owner, http.MethodGet, one, "", http.StatusNotFound, documentNotFound, "deleted")
	api.expectRefusal(t, b.owner, http.MethodGet, fmt.Sprintf("/app/cash-openings/%v", income["id"]), "", http.StatusNotFound, documentNotFound, "an income is no opening balance")
}

func TestMoneyTransfersAndConversionsAPI(t *testing.T) {
	api := newTestAPI(t)
	b := api.newCashbook(t)

	moved := api.enterCash(t, b.owner, "/app/money-transfers", fmt.Sprintf(`{"from_account_id":%d,"to_account_id":%d,"amount":"100000","at":"%s","note":"Kassaga"}`, b.cash, b.kassa2, at))
	assert.Equal(t, "money_transfer", moved["kind"])
	assert.EqualValues(t, 1, moved["number"])
	assert.EqualValues(t, b.cash, moved["from_account_id"])
	assert.Equal(t, "Naqd", moved["from_account_name"])
	assert.EqualValues(t, 1, moved["currency_id"])
	assert.Equal(t, "100000.00", moved["amount"])
	assert.EqualValues(t, b.kassa2, moved["to_account_id"])
	assert.Equal(t, "Kassa 2", moved["to_account_name"])
	assert.EqualValues(t, 1, moved["to_currency_id"])
	assert.Nil(t, moved["to_amount"], "the same amount arrives")
	assert.Nil(t, moved["rate"])
	assert.Equal(t, "Kassaga", moved["note"])
	api.expectRefusal(t, b.owner, http.MethodPost, "/app/money-transfers", fmt.Sprintf(`{"from_account_id":%d,"to_account_id":%d,"amount":"5","at":"%s"}`, b.cash, b.card, at), http.StatusBadRequest, `{"error":"validation_error","message":"Valyutalar farq qilsa konvertatsiya kiriting"}`, "another currency")
	api.expectRefusal(t, b.owner, http.MethodPost, "/app/money-transfers", fmt.Sprintf(`{"from_account_id":%d,"amount":"5","at":"%s"}`, b.cash, at), http.StatusBadRequest, `{"error":"validation_error","message":"Maqsad akkauntni tanlang"}`, "no target")

	converted := api.enterCash(t, b.owner, "/app/conversions", fmt.Sprintf(`{"from_account_id":%d,"amount":"128000","to_account_id":%d,"to_amount":"10","at":"2026-10-08T09:00:00+05:00"}`, b.cash, b.card))
	assert.Equal(t, "conversion", converted["kind"])
	assert.EqualValues(t, 1, converted["number"], "numbered apart from the transfers")
	assert.Equal(t, "128000.00", converted["amount"])
	assert.EqualValues(t, b.card, converted["to_account_id"])
	assert.Equal(t, "Karta", converted["to_account_name"])
	assert.EqualValues(t, 2, converted["to_currency_id"])
	assert.Equal(t, "10.00", converted["to_amount"])
	assert.Equal(t, "12800.0000", converted["rate"], "so'm per dollar")
	api.expectRefusal(t, b.owner, http.MethodPost, "/app/conversions", fmt.Sprintf(`{"from_account_id":%d,"amount":"5","to_account_id":%d,"to_amount":"5","at":"%s"}`, b.cash, b.kassa2, at), http.StatusBadRequest, `{"error":"validation_error","message":"Bir xil valyutada o'tkazma kiriting"}`, "the same currency")
	api.expectRefusal(t, b.owner, http.MethodPost, "/app/conversions", fmt.Sprintf(`{"from_account_id":%d,"amount":"5","to_account_id":%d,"at":"%s"}`, b.cash, b.card, at), http.StatusBadRequest, `{"error":"validation_error","message":"Maqsad summani kiriting"}`, "nothing arriving")

	ids := func(path string) []any {
		rec := api.do(t, http.MethodGet, path, "", bearer(b.owner))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out []any
		for _, item := range decode(t, rec)["items"].([]any) {
			out = append(out, item.(map[string]any)["id"])
		}
		return out
	}
	assert.Equal(t, []any{converted["id"], moved["id"]}, ids("/app/money-transfers"), "the transfers and the conversions in one list, the newest first")
	assert.Equal(t, []any{converted["id"]}, ids("/app/conversions"), "the conversions alone")
	assert.Equal(t, []any{moved["id"]}, ids(fmt.Sprintf("/app/money-transfers?account_id=%d", b.kassa2)), "the second cash: the transfer into it")

	transferPath := fmt.Sprintf("/app/money-transfers/%v", moved["id"])
	conversionPath := fmt.Sprintf("/app/conversions/%v", converted["id"])
	rec := api.do(t, http.MethodGet, transferPath, "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, moved, decode(t, rec))
	api.expectRefusal(t, b.owner, http.MethodGet, fmt.Sprintf("/app/money-transfers/%v", converted["id"]), "", http.StatusNotFound, documentNotFound, "a conversion is no transfer")
	api.expectRefusal(t, b.owner, http.MethodGet, fmt.Sprintf("/app/conversions/%v", moved["id"]), "", http.StatusNotFound, documentNotFound, "a transfer is no conversion")
	rec = api.do(t, http.MethodPut, transferPath, fmt.Sprintf(`{"from_account_id":%d,"to_account_id":%d,"amount":"60000","at":"%s"}`, b.kassa2, b.cash, at), bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, b.kassa2, saved["from_account_id"])
	assert.EqualValues(t, b.cash, saved["to_account_id"])
	assert.Equal(t, "60000.00", saved["amount"])
	rec = api.do(t, http.MethodPut, conversionPath, fmt.Sprintf(`{"from_account_id":%d,"amount":"130000","to_account_id":%d,"to_amount":"10","at":"%s"}`, b.cash, b.card, at), bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "13000.0000", decode(t, rec)["rate"], "the rate follows the amounts")
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, transferPath, "", bearer(b.owner)).Code)
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, conversionPath, "", bearer(b.owner)).Code)
	api.expectRefusal(t, b.owner, http.MethodGet, conversionPath, "", http.StatusNotFound, documentNotFound, "deleted")
}

func TestAccountsAPI(t *testing.T) {
	api := newTestAPI(t)
	b := api.newCashbook(t)
	api.exec(t, "UPDATE bank_accounts SET is_active = false WHERE id = $1", b.kassa2)
	api.enterCash(t, b.owner, "/app/cash-openings", fmt.Sprintf(`{"bank_account_id":%d,"amount":"1000000","at":"2026-10-01T09:00:00+05:00"}`, b.cash))
	rent := api.enterCash(t, b.owner, "/app/expenses", fmt.Sprintf(`{"kind":"expense","bank_account_id":%d,"category_id":%d,"amount":"150000","at":"2026-10-03T09:00:00+05:00","note":"Oktabr"}`, b.cash, b.ijara))
	converted := api.enterCash(t, b.owner, "/app/conversions", fmt.Sprintf(`{"from_account_id":%d,"amount":"128000","to_account_id":%d,"to_amount":"10","at":"2026-10-06T09:00:00+05:00"}`, b.cash, b.card))

	rec := api.do(t, http.MethodGet, "/app/accounts", "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []any{
		map[string]any{"id": float64(b.cash), "name": "Naqd", "currency_id": 1.0, "is_active": true, "balance": "722000.00"},
		map[string]any{"id": float64(b.card), "name": "Karta", "currency_id": 2.0, "is_active": true, "balance": "10.00"},
		map[string]any{"id": float64(b.kassa2), "name": "Kassa 2", "currency_id": 1.0, "is_active": false, "balance": "0.00"},
	}, decodeList(t, rec), "what each holds; the one turned off last")

	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/accounts/%d/statement", b.cash), "", bearer(b.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	page := decode(t, rec)
	assert.EqualValues(t, 3, page["total"])
	assert.EqualValues(t, 1, page["page"])
	assert.EqualValues(t, 20, page["page_size"])
	rows := page["items"].([]any)
	require.Len(t, rows, 3)
	first := rows[0].(map[string]any)
	assert.Equal(t, converted["id"], first["id"])
	assert.Equal(t, "conversion", first["kind"])
	assert.EqualValues(t, 1, first["number"])
	assert.Equal(t, "2026-10-06T04:00:00Z", first["at"])
	assert.Equal(t, "-128000.00", first["delta"])
	assert.Equal(t, "722000.00", first["balance"])
	assert.Equal(t, "Karta", first["party_name"])
	assert.Nil(t, first["linked_id"])
	assert.Nil(t, first["linked_number"])
	assert.Nil(t, first["note"])
	assert.Contains(t, first, "created_by_name")
	second := rows[1].(map[string]any)
	assert.Equal(t, rent["id"], second["id"])
	assert.Equal(t, "-150000.00", second["delta"])
	assert.Equal(t, "850000.00", second["balance"])
	assert.Equal(t, "Ijara", second["party_name"])
	assert.Equal(t, "Oktabr", second["note"])
	third := rows[2].(map[string]any)
	assert.Equal(t, "cash_opening", third["kind"])
	assert.Equal(t, "1000000.00", third["delta"])
	assert.Nil(t, third["party_name"])
	api.expectRefusal(t, b.owner, http.MethodGet, "/app/accounts/999999/statement", "", http.StatusNotFound, `{"error":"not_found","message":"Akkaunt topilmadi"}`, "unknown")
	api.expectRefusal(t, b.owner, http.MethodGet, fmt.Sprintf("/app/accounts/%d/statement?page=x", b.cash), "", http.StatusBadRequest, `{"error":"validation_error","message":"Sahifa raqami noto'g'ri"}`, "a page that is not a number")
}
