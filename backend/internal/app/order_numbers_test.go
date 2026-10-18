package app

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An order is numbered, not named (logic/orders.md, 3.3;
// docs/superpowers/specs/2026-10-18-order-number-design.md): the API gives
// the number, takes no title (one sent is ignored) and finds an order by
// its number.
func TestOrdersAreNumbered(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	sh := api.orderShop(t, olma)
	// A phone with no digit a number could be mistaken for.
	karim := api.enter(t, owner, sh.jismoniy, "998900000000", fmt.Sprintf(`{"%d":"Karim Olimov"}`, sh.fish))
	ok := fmt.Sprintf(`{"%d":"X"}`, sh.izoh)
	find := func(search string) []any {
		rec := api.do(t, http.MethodGet, "/app/orders?search="+url.QueryEscape(search), "", bearer(owner))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode(t, rec)["items"].([]any)
	}

	first := api.enterOrder(t, owner, orderBody(sh, "2026-10-10", sh.yangi, karim["id"], ok, ""))
	second := api.enterOrder(t, owner, orderBody(sh, "2026-10-11", sh.yangi, karim["id"], ok, `,"title":"Nomsiz"`))

	assert.EqualValues(t, 1, first["number"], "the company's first order")
	assert.EqualValues(t, 2, second["number"], "the next; a title sent is ignored")
	assert.NotContains(t, second, "title")
	require.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, fmt.Sprintf("/app/orders/%v", second["id"]), "", bearer(owner)).Code)
	third := api.enterOrder(t, owner, orderBody(sh, "2026-10-12", sh.yangi, karim["id"], ok, ""))
	assert.EqualValues(t, 3, third["number"], "a deleted order keeps its number taken")
	assert.Equal(t, []any{row(third)}, find("3"), "a search of a number finds the order")
	assert.Equal(t, []any{}, find("2"), "the deleted one is not found")
	assert.Equal(t, []any{}, find("13"), "the number is matched whole")
}
