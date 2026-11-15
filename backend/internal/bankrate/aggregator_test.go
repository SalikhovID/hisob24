package bankrate

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A bank's branch selling rates at the aggregator (a snapshot of
// 2026-05-12, tw-dobroe's: testdata/valyutalarkursi.json).
func TestAggregatorReadsABanksBranchRates(t *testing.T) {
	url := serve(t, http.StatusOK, fixture(t, "valyutalarkursi.json"))
	cases := []struct {
		name string
		bank int
		want Rates
	}{
		{"Kapitalbank", aggregatorKapital, Rates{USD: 12205, EUR: 14460, RUB: 167}},
		{"Asakabank", aggregatorAsaka, Rates{USD: 12200, EUR: 14800, RUB: 170}},
		{"Hamkorbank", aggregatorHamkor, Rates{USD: 12190, EUR: 14400, RUB: 164}},
		{"Ipak Yo'li", aggregatorIpakYuli, Rates{USD: 12190, EUR: 14720, RUB: 169}},
		{"OFB", aggregatorOFB, Rates{USD: 12200, EUR: 15000, RUB: 167}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client := &Client{HTTP: http.DefaultClient, URLs: URLs{Aggregator: url}}

			got, err := client.aggregator(t.Context(), c.bank)

			require.NoError(t, err)
			assert.Equal(t, c.want, got)
		})
	}
}

func TestAggregatorFailsWithoutTheBanksRates(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
	}{
		{"a bank it does not list", http.StatusOK, `[{"bank":{"id":15},"currency":{"code":"USD"},"rate_type":"branch","sell_rate":12205}]`},
		{"no euro", http.StatusOK, `[{"bank":{"id":4},"currency":{"code":"USD"},"rate_type":"branch","sell_rate":12200}]`},
		{"the app's rate, not the branch's", http.StatusOK, `[{"bank":{"id":4},"currency":{"code":"USD"},"rate_type":"app","sell_rate":12200},{"bank":{"id":4},"currency":{"code":"EUR"},"rate_type":"app","sell_rate":14800}]`},
		{"the aggregator is down", http.StatusBadGateway, ""},
		{"not JSON", http.StatusOK, "<html></html>"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client := &Client{HTTP: http.DefaultClient, URLs: URLs{Aggregator: serve(t, c.status, []byte(c.body))}}

			_, err := client.aggregator(t.Context(), aggregatorAsaka)

			assert.Error(t, err)
		})
	}
}
