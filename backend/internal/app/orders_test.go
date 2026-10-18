package app

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// orderShop is what a company is set up with for orders, beside its
// customers: its location Asosiy, the stages Yangi, Jarayonda and Bajarildi
// (done), and the type Buyurtma with a required text Izoh, a number Summa
// and a checkbox Kanal over the customers' dropdown Manba.
type orderShop struct {
	customerShop
	asosiy                      int64
	yangi, jarayonda, bajarildi int64
	buyurtma                    int64
	izoh, summa, kanal          int64
}

func (api testAPI) orderShop(t *testing.T, companyID int64) orderShop {
	t.Helper()
	sh := orderShop{customerShop: api.customerShop(t, companyID)}
	sh.asosiy = api.addLocation(t, companyID, "Asosiy")
	sh.yangi = api.addStage(t, companyID, "Yangi", "blue", false, 1)
	sh.jarayonda = api.addStage(t, companyID, "Jarayonda", "amber", false, 2)
	sh.bajarildi = api.addStage(t, companyID, "Bajarildi", "green", true, 3)
	sh.buyurtma = api.addOrderType(t, companyID, "Buyurtma", 1)
	manba := api.id(t, "SELECT dropdown_id FROM customer_fields WHERE id = $1", sh.manba)
	sh.izoh = api.id(t, `INSERT INTO order_fields (company_id, type_id, label, kind, required, position)
		VALUES ($1, $2, 'Izoh', 'string', true, 1) RETURNING id`, companyID, sh.buyurtma)
	sh.summa = api.id(t, `INSERT INTO order_fields (company_id, type_id, label, kind, position)
		VALUES ($1, $2, 'Summa', 'int', 2) RETURNING id`, companyID, sh.buyurtma)
	sh.kanal = api.id(t, `INSERT INTO order_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Kanal', 'checkbox', $3, 3) RETURNING id`, companyID, sh.buyurtma, manba)
	return sh
}

// orderBody is a body for POST /app/orders: an order of the type Buyurtma in
// Asosiy, due on the day, in the stage, for the customer that is there,
// with the answers (JSON) and whatever else the caller adds (",key":value).
func orderBody(sh orderShop, deadline string, stageID int64, customerID any, values, extra string) string {
	return fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":%q,"stage_id":%d,"values":%s,"customer":{"id":%v}%s}`,
		sh.buyurtma, sh.asosiy, deadline, stageID, values, customerID, extra)
}

// enterOrder enters an order through the API, as the member the token is of,
// and returns it as the API answers.
func (api testAPI) enterOrder(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/orders", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

const orderNotFound = `{"error":"not_found","message":"Buyurtma topilmadi"}`

func TestCreateOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)
	sh := api.orderShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))

	rec := api.do(t, http.MethodPost, "/app/orders", orderBody(sh, "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":" Ertalab ","%d":45000,"%d":[%d,%d]}`, sh.izoh, sh.summa, sh.kanal, sh.linkedin, sh.instagram),
		`,"assignee_phone":"+998 90 123 45 67"`), bearer(employee))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	order := decode(t, rec)
	assert.NotEmpty(t, order["id"])
	assert.EqualValues(t, sh.buyurtma, order["type_id"])
	assert.EqualValues(t, sh.yangi, order["stage_id"])
	assert.EqualValues(t, sh.asosiy, order["location_id"], "the location the order stands in")
	assert.EqualValues(t, 1, order["number"], "an employee enters an order; it takes the company's first number")
	assert.NotContains(t, order, "title", "an order has no name")
	assert.Equal(t, "2026-10-10", order["deadline"], "a day, as it was sent")
	assert.Equal(t, map[string]any{"id": ali["id"], "phone": "998901112233", "name": "Ali Valiyev"}, order["customer"], "the customer by its name")
	assert.Equal(t, map[string]any{"phone": alisPhone, "full_name": nil}, order["assignee"], "the assignee's phone as kept, by the name they go by")
	assert.Equal(t, map[string]any{
		key(sh.izoh): "Ertalab", key(sh.summa): float64(45000), key(sh.kanal): []any{float64(sh.instagram), float64(sh.linkedin)},
	}, order["values"], "the answers by the id of the field, the options in their order")
	assert.Equal(t, "Vali Aliyev", order["created_by_name"], "under the name they go by in the company")
	assert.NotEmpty(t, order["created_at"])
	assert.Equal(t, order["created_at"], order["updated_at"])

	rec = api.do(t, http.MethodPost, "/app/orders", fmt.Sprintf(
		`{"type_id":%d,"location_id":%d,"deadline":"2026-10-11","stage_id":%d,"values":{"%d":"Yangi mijoz bilan"},`+
			`"customer":{"type_id":%d,"phone":"+998 90 111 22 44","values":{"%d":" Vali Aliyev "}}}`,
		sh.buyurtma, sh.asosiy, sh.yangi, sh.izoh, sh.jismoniy, sh.fish), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, "with a new customer: %s", rec.Body.String())
	order = decode(t, rec)
	vali, _ := order["customer"].(map[string]any)
	assert.Equal(t, "998901112244", vali["phone"], "the customer is entered with the order")
	assert.Equal(t, "Vali Aliyev", vali["name"])
	assert.Nil(t, order["assignee"], "assigned to nobody")
	assert.Nil(t, order["created_by_name"], "the owner goes by no name")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/customers/%v", vali["id"]), "", bearer(owner))
	assert.Equal(t, http.StatusOK, rec.Code, "and is there to read: %s", rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/orders", fmt.Sprintf(
		`{"type_id":%d,"location_id":%d,"deadline":"2026-10-11","stage_id":%d,"values":{"%d":"X"},`+
			`"customer":{"type_id":%d,"phone":"998901112233","values":{"%d":"Ali"}}}`,
		sh.buyurtma, sh.asosiy, sh.yangi, sh.izoh, sh.jismoniy, sh.fish), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"phone_taken","message":"Bu raqamli mijoz allaqachon bor","customer_id":%v}`, ali["id"]),
		rec.Body.String(), "the refusal names the customer who has the phone")

	ok := fmt.Sprintf(`{"%d":"X"}`, sh.izoh)
	for _, tt := range []struct{ name, body, message string }{
		{"no deadline", orderBody(sh, "", sh.yangi, ali["id"], ok, ""), "Muddatni kiriting"},
		{"a deadline that is no day", orderBody(sh, "10.10.2026", sh.yangi, ali["id"], ok, ""), "Muddat noto'g'ri"},
		{"no location", fmt.Sprintf(`{"type_id":%d,"deadline":"2026-10-10","stage_id":%d,"values":%s,"customer":{"id":%v}}`, sh.buyurtma, sh.yangi, ok, ali["id"]), "Lokatsiyani tanlang"},
		{"no type", fmt.Sprintf(`{"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"customer":{"id":%v}}`, sh.asosiy, sh.yangi, ali["id"]), "Buyurtma turini tanlang"},
		{"no stage", orderBody(sh, "2026-10-10", 0, ali["id"], ok, ""), "Bosqichni tanlang"},
		{"an assignee who is no member", orderBody(sh, "2026-10-10", sh.yangi, ali["id"], ok, `,"assignee_phone":"998907777777"`), "Mas'ul kompaniya a'zosi emas"},
		{"a required field left empty", orderBody(sh, "2026-10-10", sh.yangi, ali["id"], `{}`, ""), "«Izoh» maydonini to'ldiring"},
		{"no customer", fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"values":%s}`, sh.buyurtma, sh.asosiy, sh.yangi, ok), "Mijozni tanlang"},
		{"an empty customer", fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"values":%s,"customer":{}}`, sh.buyurtma, sh.asosiy, sh.yangi, ok), "Mijozni tanlang"},
		{"a customer that is not there", orderBody(sh, "2026-10-10", sh.yangi, 999999, ok, ""), "Mijozni tanlang"},
		{"a new customer with no name", fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"values":%s,`+
			`"customer":{"type_id":%d,"phone":"998901112266"}}`, sh.buyurtma, sh.asosiy, sh.yangi, ok, sh.jismoniy), "«F.I.Sh.» maydonini to'ldiring"},
	} {
		rec := api.do(t, http.MethodPost, "/app/orders", tt.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, tt.name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":%q}`, tt.message), rec.Body.String(), tt.name)
	}
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/orders", `{"type_id":`, bearer(owner)).Code, "not JSON")
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/orders",
		orderBody(sh, "2026-10-10", sh.yangi, ali["id"], `["X"]`, ""), bearer(owner)).Code, "values that are no object")

	rec = api.do(t, http.MethodPost, "/app/orders", `{}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/app/orders", `{}`).Code, "no access token")
}

func TestGetOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.orderShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	order := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab","%d":[%d]}`, sh.izoh, sh.kanal, sh.linkedin), fmt.Sprintf(`,"assignee_phone":%q`, valisPhone)))
	path := fmt.Sprintf("/app/orders/%v", order["id"])

	rec := api.do(t, http.MethodGet, path, "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, order, decode(t, rec), "any member reads the order as it was entered")

	rec = api.do(t, http.MethodGet, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's order")
	assert.JSONEq(t, orderNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/app/orders/999999", "", bearer(owner)).Code, "an order that is not there")
	rec = api.do(t, http.MethodGet, "/app/orders/abc", "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "an id that is no number")
	assert.JSONEq(t, orderNotFound, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, path, "").Code, "no access token")
}

func TestListOrders(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.orderShop(t, olma)
	shikoyat := api.addOrderType(t, olma, "Shikoyat", 2)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	zarina := api.enter(t, owner, sh.jismoniy, "998905555555", fmt.Sprintf(`{"%d":"Zarina Karimova"}`, sh.fish))
	later := api.enterOrder(t, owner, orderBody(sh, "2026-10-12", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab yozish","%d":45000}`, sh.izoh, sh.summa), ""))
	sooner := api.enterOrder(t, employee, orderBody(sh, "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"X"}`, sh.izoh), fmt.Sprintf(`,"assignee_phone":%q`, valisPhone)))
	other := api.enterOrder(t, owner, fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"customer":{"id":%v}}`,
		shikoyat, sh.asosiy, sh.bajarildi, zarina["id"]))
	// The list's rows carry the order alone, not its page's lines and payments.
	later, sooner, other = row(later), row(sooner), row(other)
	begona := api.orderShop(t, nok)
	strangers := api.enter(t, stranger, begona.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Begona"}`, begona.fish))
	api.enterOrder(t, stranger, orderBody(begona, "2026-10-01", begona.yangi, strangers["id"], fmt.Sprintf(`{"%d":"X"}`, begona.izoh), ""))
	// get reads a page of Olma's orders as its employee.
	get := func(query url.Values) map[string]any {
		t.Helper()
		rec := api.do(t, http.MethodGet, "/app/orders?"+query.Encode(), "", bearer(employee))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode(t, rec)
	}

	page := get(nil)

	assert.Equal(t, []any{sooner, other, later}, page["items"],
		"the company's orders, the one due soonest first and the older before the newer of one day, each as it is read alone")
	assert.EqualValues(t, 3, page["total"])
	assert.EqualValues(t, 1, page["page"])
	assert.EqualValues(t, 20, page["page_size"])

	assert.Equal(t, []any{other}, get(url.Values{"type_id": {fmt.Sprint(shikoyat)}})["items"], "one type")
	assert.Equal(t, []any{sooner, later}, get(url.Values{"stage_id": {fmt.Sprint(sh.yangi)}})["items"], "one stage")
	assert.Equal(t, []any{sooner}, get(url.Values{"assignee": {valisPhone}})["items"], "one assignee")
	found := get(url.Values{"customer_id": {fmt.Sprint(zarina["id"])}})
	assert.Equal(t, []any{other}, found["items"], "one customer")
	assert.EqualValues(t, 1, found["total"])
	assert.Equal(t, []any{later}, get(url.Values{"search": {"ERTALAB"}})["items"], "in the orders' text answers")
	assert.Equal(t, []any{other}, get(url.Values{"search": {"karim"}})["items"], "in the customers' names")
	assert.Equal(t, []any{other}, get(url.Values{"search": {"90 555"}})["items"], "a number in the customers' phones")
	assert.Equal(t, []any{later}, get(url.Values{"search": {"450"}})["items"], "and in the orders' number answers")
	assert.Equal(t, []any{}, get(url.Values{"stage_id": {fmt.Sprint(sh.yangi)}, "search": {"karim"}})["items"], "the filters work together")
	past := get(url.Values{"page": {"2"}})
	assert.Equal(t, []any{}, past["items"], "a page past the last")
	assert.EqualValues(t, 3, past["total"])
	assert.EqualValues(t, 2, past["page"])

	for query, message := range map[string]string{
		"page=abc":        "Sahifa raqami noto'g'ri",
		"page=0":          "Sahifa raqami noto'g'ri",
		"type_id=abc":     "Buyurtma turi noto'g'ri",
		"type_id=0":       "Buyurtma turi noto'g'ri",
		"stage_id=abc":    "Bosqich noto'g'ri",
		"customer_id=abc": "Mijoz noto'g'ri",
		"assignee=vali":   "Mas'ul noto'g'ri",
	} {
		rec := api.do(t, http.MethodGet, "/app/orders?"+query, "", bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, query)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":%q}`, message), rec.Body.String(), query)
	}
	rec := api.do(t, http.MethodGet, "/app/orders", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/orders", "").Code, "no access token")
}

func TestUpdateOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)
	sh := api.orderShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	order := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab","%d":45000}`, sh.izoh, sh.summa), ""))
	path := fmt.Sprintf("/app/orders/%v", order["id"])
	body := fmt.Sprintf(`{"deadline":"2026-10-12","stage_id":%d,"assignee_phone":%q,"values":{"%d":"Kechqurun"}}`,
		sh.jarayonda, valisPhone, sh.izoh)

	rec := api.do(t, http.MethodPut, path, body, bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, order["number"], edited["number"], "any member edits an order; the number stays")
	assert.Equal(t, "2026-10-12", edited["deadline"])
	assert.EqualValues(t, sh.jarayonda, edited["stage_id"])
	assert.Equal(t, map[string]any{"phone": valisPhone, "full_name": "Vali Aliyev"}, edited["assignee"])
	assert.Equal(t, map[string]any{key(sh.izoh): "Kechqurun"}, edited["values"], "an answer left out is taken away")
	assert.Equal(t, order["customer"], edited["customer"], "the customer stays")
	assert.Equal(t, order["type_id"], edited["type_id"], "the type stays")
	assert.Equal(t, order["created_at"], edited["created_at"])
	assert.NotEqual(t, order["updated_at"], edited["updated_at"], "the moment of the edit")
	rec = api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, edited, decode(t, rec))

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"deadline":"2026-10-12","stage_id":%d,"values":{}}`, sh.jarayonda), bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"«Izoh» maydonini to'ldiring"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPut, path, `{"deadline":`, bearer(owner)).Code, "not JSON")
	rec = api.do(t, http.MethodPut, path, body, bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's order")
	assert.JSONEq(t, orderNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPut, "/app/orders/abc", body, bearer(owner)).Code, "an id that is no number")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, body).Code, "no access token")
}

func TestMoveOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.orderShop(t, olma)
	begona := api.addStage(t, nok, "Begona", "red", false, 1)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	order := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	path := fmt.Sprintf("/app/orders/%v/stage", order["id"])

	rec := api.do(t, http.MethodPatch, path, fmt.Sprintf(`{"stage_id":%d}`, sh.bajarildi), bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	moved := decode(t, rec)
	assert.EqualValues(t, sh.bajarildi, moved["stage_id"], "any member moves an order to another stage")
	assert.Equal(t, order["number"], moved["number"], "nothing else changes")
	assert.Equal(t, order["values"], moved["values"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/orders/%v", order["id"]), "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, moved, decode(t, rec))

	for _, body := range []string{`{"stage_id":0}`, `{}`, fmt.Sprintf(`{"stage_id":%d}`, begona)} {
		rec = api.do(t, http.MethodPatch, path, body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, body)
		assert.JSONEq(t, `{"error":"validation_error","message":"Bosqichni tanlang"}`, rec.Body.String(), body)
	}
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPatch, path, `{"stage_id":`, bearer(owner)).Code, "not JSON")
	rec = api.do(t, http.MethodPatch, path, fmt.Sprintf(`{"stage_id":%d}`, begona), bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's order")
	assert.JSONEq(t, orderNotFound, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPatch, path, `{}`).Code, "no access token")
}

func TestDeleteOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.orderShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	order := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	path := fmt.Sprintf("/app/orders/%v", order["id"])
	customer := fmt.Sprintf("/app/customers/%v", ali["id"])

	rec := api.do(t, http.MethodDelete, customer, "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a customer with an order is not deleted")
	assert.JSONEq(t, `{"error":"customer_in_use","message":"Bu mijozda 1 ta buyurtma bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's order")
	assert.JSONEq(t, orderNotFound, rec.Body.String())

	rec = api.do(t, http.MethodDelete, path, "", bearer(employee))

	assert.Equal(t, http.StatusNoContent, rec.Code, "any member deletes an order: %s", rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, path, "", bearer(owner)).Code, "the order is gone")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, path, "", bearer(owner)).Code, "deleted already")
	assert.Equal(t, []any{}, decode(t, api.do(t, http.MethodGet, "/app/orders", "", bearer(owner)))["items"], "and out of the list")
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, customer, "", bearer(owner)).Code, "once its orders are deleted, the customer goes")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, "/app/orders/abc", "", bearer(owner)).Code, "an id that is no number")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodDelete, path, "").Code, "no access token")
}

func TestOrderHistory(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Ali Egasi' WHERE user_phone = $1", alisPhone)
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Xodim' WHERE user_phone = $1", valisPhone)
	sh := api.orderShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	order := api.enterOrder(t, employee, orderBody(sh, "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	rec := api.do(t, http.MethodPut, fmt.Sprintf("/app/orders/%v", order["id"]),
		fmt.Sprintf(`{"deadline":"2026-10-12","stage_id":%d,"assignee_phone":%q,"values":{"%d":"Kechqurun"}}`, sh.jarayonda, valisPhone, sh.izoh), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	path := fmt.Sprintf("/app/orders/%v/history", order["id"])

	rec = api.do(t, http.MethodGet, path, "", bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	history := list(t, rec)
	require.Len(t, history, 2)
	edited, entered := history[0], history[1]
	assert.Equal(t, "updated", edited["action"], "the latest first")
	assert.Equal(t, "Ali Egasi", edited["actor_name"])
	assert.Equal(t, []any{
		map[string]any{"label": "Muddat", "old": "10.10.2026", "new": "12.10.2026"},
		map[string]any{"label": "Bosqich", "old": "Yangi", "new": "Jarayonda"},
		map[string]any{"label": "Mas'ul", "old": "", "new": "Vali Xodim"},
		map[string]any{"label": "Izoh", "old": "Ertalab", "new": "Kechqurun"},
	}, edited["changes"], "what the edit changed: the order's own fields, then the type's")
	assert.NotEmpty(t, edited["id"])
	assert.NotEmpty(t, edited["created_at"])
	assert.Equal(t, "created", entered["action"])
	assert.Equal(t, "Vali Xodim", entered["actor_name"])
	assert.Equal(t, []any{}, entered["changes"])

	rec = api.do(t, http.MethodGet, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the history is for the owner")
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "the owner of another company")
	assert.JSONEq(t, orderNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/app/orders/abc/history", "", bearer(owner)).Code, "an id that is no number")
	rec = api.do(t, http.MethodGet, path, "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, path, "").Code, "no access token")
	require.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, fmt.Sprintf("/app/orders/%v", order["id"]), "", bearer(owner)).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, path, "", bearer(owner)).Code, "a deleted order's history is kept, not shown")
}

// The orders a member works with are those of the locations they may work in
// (logic/locations.md, section 6): the list is of them (of the one named
// alone), an order standing elsewhere is not there, an order is entered into
// one of them, and the assignee works in the order's location.
func TestOrdersAreTheLocationsTheMemberMayWorkIn(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	sh := api.orderShop(t, olma)
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	api.restrictTo(t, valisPhone, olma, chilonzor)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	ok := fmt.Sprintf(`{"%d":"X"}`, sh.izoh)
	inAsosiy := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, ali["id"], ok, ""))
	inChilonzor := api.enterOrder(t, owner, fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-09","stage_id":%d,"values":%s,"customer":{"id":%v}}`,
		sh.buyurtma, chilonzor, sh.yangi, ok, ali["id"]))
	numbers := func(token string, query string) []any {
		rec := api.do(t, http.MethodGet, "/app/orders"+query, "", bearer(token))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		items, _ := decode(t, rec)["items"].([]any)
		list := make([]any, 0, len(items))
		for _, item := range items {
			order, _ := item.(map[string]any)
			list = append(list, order["number"])
		}
		return list
	}

	assert.Equal(t, []any{2.0, 1.0}, numbers(owner, ""), "the owner: every location")
	assert.Equal(t, []any{1.0}, numbers(owner, fmt.Sprintf("?location_id=%d", sh.asosiy)), "one location")
	assert.Equal(t, []any{2.0}, numbers(employee, ""), "a restricted employee: the restriction's locations")
	assert.Equal(t, []any{2.0}, numbers(employee, fmt.Sprintf("?location_id=%d", chilonzor)))
	rec := api.do(t, http.MethodGet, fmt.Sprintf("/app/orders?location_id=%d", sh.asosiy), "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a location the employee may not work in")
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/orders?location_id=999999", "", bearer(owner))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a location that is not there: the same")
	rec = api.do(t, http.MethodGet, "/app/orders?location_id=abc", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())

	id := fmt.Sprintf("%.0f", inAsosiy["id"])
	for _, r := range []struct{ method, path, body string }{
		{http.MethodGet, "/app/orders/" + id, ""},
		{http.MethodPut, "/app/orders/" + id, fmt.Sprintf(`{"deadline":"2026-10-10","stage_id":%d,"values":%s}`, sh.yangi, ok)},
		{http.MethodPatch, "/app/orders/" + id + "/stage", fmt.Sprintf(`{"stage_id":%d}`, sh.bajarildi)},
		{http.MethodDelete, "/app/orders/" + id, ""},
	} {
		rec := api.do(t, r.method, r.path, r.body, bearer(employee))
		assert.Equal(t, http.StatusNotFound, rec.Code, "%s %s: an order standing where the employee may not work", r.method, r.path)
		assert.JSONEq(t, orderNotFound, rec.Body.String(), r.method)
	}
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, fmt.Sprintf("/app/orders/%.0f", inChilonzor["id"]), "", bearer(employee)).Code, "one in the restriction's location")

	rec = api.do(t, http.MethodPost, "/app/orders", orderBody(sh, "2026-10-10", sh.yangi, ali["id"], ok, ""), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "entered into a location the employee may not work in")
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/orders", fmt.Sprintf(`{"type_id":%d,"location_id":%d,"deadline":"2026-10-10","stage_id":%d,"values":%s,"customer":{"id":%v}}`,
		sh.buyurtma, chilonzor, sh.yangi, ok, ali["id"]), bearer(employee))
	assert.Equal(t, http.StatusCreated, rec.Code, "into one of theirs: %s", rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/orders", orderBody(sh, "2026-10-10", sh.yangi, ali["id"], ok, fmt.Sprintf(`,"assignee_phone":%q`, valisPhone)), bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code, "assigned, in Asosiy, to an employee who works in Chilonzor alone")
	assert.JSONEq(t, `{"error":"validation_error","message":"Mas'ul bu lokatsiyada ishlamaydi"}`, rec.Body.String())

	// The restriction is read afresh on every request.
	api.exec(t, "UPDATE user_companies SET all_locations = true WHERE user_phone = $1", valisPhone)
	assert.Equal(t, []any{2.0, 1.0, 3.0}, numbers(employee, ""), "lifted: every location at once")
}
