package bankrate

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Each bank is read the way its pages allow (tw-dobroe's order): the
// central bank's JSON; Kapitalbank, Asakabank and Hamkorbank at the
// aggregator, then their page; Ipak Yo'li's Nuxt payload, then the
// aggregator, then its page; OFB's table, then the aggregator, then its
// page; Uzum Bank's page.
func TestEachBankIsReadTheWayItsPagesAllow(t *testing.T) {
	cbu := serve(t, http.StatusOK, fixture(t, "cbu.json"))
	aggregator := serve(t, http.StatusOK, fixture(t, "valyutalarkursi.json"))
	nuxt := serve(t, http.StatusOK, fixture(t, "ipakyuli_rates.html"))
	table := serve(t, http.StatusOK, fixture(t, "ofb_rates.html"))
	page := serve(t, http.StatusOK, []byte(`<html><body><p>USD 12 300</p><p>EUR 13 500</p><p>RUB 150</p></body></html>`))
	down := serve(t, http.StatusServiceUnavailable, nil)
	fromPage := Rates{USD: 12300, EUR: 13500, RUB: 150}

	cases := []struct {
		name   string
		source string
		urls   URLs
		want   Rates
		fails  bool
	}{
		{name: "the central bank", source: CBU, urls: URLs{CBU: cbu}, want: Rates{USD: 12014.37, EUR: 13280.68, RUB: 146.19}},
		{name: "Kapitalbank at the aggregator", source: Kapital, urls: URLs{Aggregator: aggregator, Kapital: page}, want: Rates{USD: 12205, EUR: 14460, RUB: 167}},
		{name: "Kapitalbank's page", source: Kapital, urls: URLs{Aggregator: down, Kapital: page}, want: fromPage},
		{name: "Asakabank at the aggregator", source: Asaka, urls: URLs{Aggregator: aggregator, Asaka: page}, want: Rates{USD: 12200, EUR: 14800, RUB: 170}},
		{name: "Asakabank's page", source: Asaka, urls: URLs{Aggregator: down, Asaka: page}, want: fromPage},
		{name: "Hamkorbank at the aggregator", source: Hamkor, urls: URLs{Aggregator: aggregator, Hamkor: page}, want: Rates{USD: 12190, EUR: 14400, RUB: 164}},
		{name: "Hamkorbank's page", source: Hamkor, urls: URLs{Aggregator: down, Hamkor: page}, want: fromPage},
		{name: "Ipak Yo'li's payload", source: IpakYuli, urls: URLs{Aggregator: down, IpakYuli: nuxt}, want: Rates{USD: 12190, EUR: 14720, RUB: 169}},
		{name: "Ipak Yo'li at the aggregator", source: IpakYuli, urls: URLs{Aggregator: aggregator, IpakYuli: down}, want: Rates{USD: 12190, EUR: 14720, RUB: 169}},
		{name: "Ipak Yo'li's page", source: IpakYuli, urls: URLs{Aggregator: down, IpakYuli: page}, want: fromPage},
		{name: "OFB's table", source: OFB, urls: URLs{Aggregator: down, OFB: table}, want: Rates{USD: 12200, EUR: 15000, RUB: 167}},
		{name: "OFB at the aggregator", source: OFB, urls: URLs{Aggregator: aggregator, OFB: down}, want: Rates{USD: 12200, EUR: 15000, RUB: 167}},
		{name: "OFB's page", source: OFB, urls: URLs{Aggregator: down, OFB: page}, want: fromPage},
		{name: "Uzum Bank's page", source: Uzum, urls: URLs{Uzum: page}, want: fromPage},
		{name: "every way down", source: Kapital, urls: URLs{Aggregator: down, Kapital: down}, fails: true},
		{name: "not a source", source: "nbu", urls: URLs{CBU: cbu}, fails: true},
		{name: "manual is no bank", source: "manual", urls: URLs{CBU: cbu}, fails: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client := &Client{HTTP: http.DefaultClient, URLs: c.urls}

			got, err := client.one(t.Context(), c.source)

			if c.fails {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.InDelta(t, c.want.USD, got.USD, 1e-9)
			assert.InDelta(t, c.want.EUR, got.EUR, 1e-9)
			assert.InDelta(t, c.want.RUB, got.RUB, 1e-9)
		})
	}
}
