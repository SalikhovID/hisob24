package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// orderedShop is a store with 10 Olma in Asosiy, a customer (Dilshod) and
// the order settings: what an order with money needs.
type orderedShop struct {
	store
	customer map[string]any
	orders   orderShop
}

func (api testAPI) orderedShop(t *testing.T) orderedShop {
	t.Helper()
	s := orderedShop{store: api.newStore(t)}
	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	sh := api.customerShop(t, s.company)
	s.customer = api.enter(t, s.owner, sh.jismoniy, "998911112233", fmt.Sprintf(`{"%s":"Dilshod"}`, key(sh.fish)))
	s.orders = orderShop{customerShop: sh, asosiy: s.asosiy}
	s.orders.yangi = api.addStage(t, s.company, "Yangi", "blue", false, 1)
	s.orders.bajarildi = api.addStage(t, s.company, "Bajarildi", "green", true, 2)
	s.orders.buyurtma = api.addOrderType(t, s.company, "Buyurtma", 1)
	return s
}

// order is the body of an order for the customer in Asosiy, with the money
// given (",amount":…).
func (s orderedShop) order(title string, money string) string {
	return orderBody(s.orders, title, "2026-10-20", s.orders.yangi, s.customer["id"], "{}", money)
}

// row is an order as a list's row shows it: without what its page alone
// carries (the lines, the payments, the cost).
func row(order map[string]any) map[string]any {
	out := make(map[string]any, len(order))
	for k, v := range order {
		switch k {
		case "items", "payments", "cost_uzs", "profit_uzs":
			continue
		}
		out[k] = v
	}
	return out
}

// An order is entered with its price, its goods and its advance, and read
// back with them: the money on the order, the lines and the payments on
// its page (logic/orders.md, 4.3).
func TestOrdersCarryTheirMoney(t *testing.T) {
	api := newTestAPI(t)
	s := api.orderedShop(t)
	money := fmt.Sprintf(`,"amount":"5000","items":[{"product_id":%v,"quantity":"2"}],"payments":[%s]`, s.product["id"], s.paid("400"))

	order := api.enterOrder(t, s.owner, s.order("Montaj", money))

	assert.Equal(t, "5000.00", order["amount"])
	assert.EqualValues(t, 1, order["currency_id"])
	assert.Equal(t, "1.0000", order["rate"])
	assert.Equal(t, "5000.00", order["amount_uzs"])
	assert.Equal(t, "400.00", order["paid"])
	items, ok := order["items"].([]any)
	require.True(t, ok, "the lines come with the order entered")
	require.Len(t, items, 1)
	line := items[0].(map[string]any)
	assert.Equal(t, "Olma", line["name"])
	assert.Equal(t, "product", line["kind"])
	assert.Equal(t, "kg", line["unit"])
	assert.Equal(t, "2.000", line["quantity"])
	assert.Nil(t, line["cost_uzs"], "the cost is not asked for")
	payments := order["payments"].([]any)
	require.Len(t, payments, 1)
	payment := payments[0].(map[string]any)
	assert.Equal(t, "400.00", payment["amount"])
	assert.Equal(t, "Naqd", payment["account_name"])
	assert.NotEmpty(t, payment["at"])
	assert.Nil(t, order["cost_uzs"])
	assert.Nil(t, order["profit_uzs"])
	path := fmt.Sprintf("/app/orders/%v", order["id"])

	rec := api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, order, decode(t, rec), "read back as it was entered")
	rec = api.do(t, http.MethodGet, "/app/orders", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	row := decode(t, rec)["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "5000.00", row["amount"], "the list carries the money")
	assert.Equal(t, "400.00", row["paid"])
	assert.Nil(t, row["items"], "not the lines")
	product := decode(t, api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner)))
	assert.Equal(t, "8.000", product["quantity"], "the product left the stock")

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"title":"Montaj","deadline":"2026-10-20","stage_id":%d,"values":{},"amount":"6000","items":[]}`, s.orders.yangi), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "6000.00", edited["amount"])
	assert.Equal(t, "400.00", edited["paid"], "the advance stays")
	assert.Empty(t, edited["items"], "the line is gone")
	assert.Len(t, edited["payments"], 1)
	rec = api.do(t, http.MethodPatch, path+"/stage", fmt.Sprintf(`{"stage_id":%d}`, s.orders.bajarildi), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	moved := decode(t, rec)
	assert.Equal(t, "6000.00", moved["amount"], "a move answers with the page's order")
	assert.Len(t, moved["payments"], 1)
	history := api.do(t, http.MethodGet, path+"/history", "", bearer(s.owner))
	assert.Contains(t, history.Body.String(), `"label":"Narx"`, "the price in the history")

	bare := api.enterOrder(t, s.owner, s.order("Qo'ng'iroq", ""))
	assert.Equal(t, "0.00", bare["amount"], "no money: nothing")
	assert.Equal(t, "0.00", bare["paid"])
	assert.Empty(t, bare["items"])
	assert.Empty(t, bare["payments"])

	rec = api.do(t, http.MethodPost, "/app/orders", s.order("Katta", fmt.Sprintf(`,"items":[{"product_id":%v,"quantity":"99"}]`, s.product["id"])), bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "more than the stock")
	assert.JSONEq(t, `{"error":"stock_insufficient","message":"«Olma» uchun omborda yetarli qoldiq yo'q"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/orders", s.order("Katta", `,"amount":"abc"`), bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Narx noto'g'ri"}`, rec.Body.String())
}
