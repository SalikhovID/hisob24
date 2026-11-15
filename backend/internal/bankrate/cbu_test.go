package bankrate

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The central bank's rates come from its JSON (a snapshot of 2026-11-14:
// testdata/cbu.json); a rate for more than one unit is divided by them.
func TestCBUReadsTheOfficialRates(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		want   Rates
		fails  bool
	}{
		{name: "the snapshot", status: http.StatusOK, body: string(fixture(t, "cbu.json")), want: Rates{USD: 12014.37, EUR: 13280.68, RUB: 146.19}},
		{name: "a rate for ten units", status: http.StatusOK, body: `[
			{"Ccy":"USD","Nominal":"1","Rate":"12014.37"},
			{"Ccy":"EUR","Nominal":"1","Rate":"13280.68"},
			{"Ccy":"RUB","Nominal":"10","Rate":"1461.9"}]`, want: Rates{USD: 12014.37, EUR: 13280.68, RUB: 146.19}},
		{name: "no dollar", status: http.StatusOK, body: `[{"Ccy":"EUR","Nominal":"1","Rate":"13280.68"},{"Ccy":"RUB","Nominal":"1","Rate":"146.19"}]`, fails: true},
		{name: "no ruble", status: http.StatusOK, body: `[{"Ccy":"USD","Nominal":"1","Rate":"12014.37"},{"Ccy":"EUR","Nominal":"1","Rate":"13280.68"}]`, fails: true},
		{name: "not a rate", status: http.StatusOK, body: `[{"Ccy":"USD","Nominal":"1","Rate":"x"},{"Ccy":"EUR","Nominal":"1","Rate":"13280.68"},{"Ccy":"RUB","Nominal":"1","Rate":"146.19"}]`, fails: true},
		{name: "the bank is down", status: http.StatusInternalServerError, body: "", fails: true},
		{name: "not JSON", status: http.StatusOK, body: "<html></html>", fails: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client := &Client{HTTP: http.DefaultClient, URLs: URLs{CBU: serve(t, c.status, []byte(c.body))}}

			got, err := client.cbu(t.Context())

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
