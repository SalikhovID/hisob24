package bankrate

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// OFB's page has its rates in a table of its own (a snapshot of 2026-05-12,
// tw-dobroe's: testdata/ofb_rates.html): the currency in the first cell,
// the selling rate in the third.
func TestOFBReadsTheCurrencyTable(t *testing.T) {
	got, err := parseOFB(parsed(t, fixture(t, "ofb_rates.html")))

	require.NoError(t, err)
	assert.Equal(t, Rates{USD: 12200, EUR: 15000, RUB: 167}, got)
}

func TestOFBReadsTheCurrencyTableAlone(t *testing.T) {
	page := `<html><body>
		<table class="calculator"><tr><td><img alt="USD flag"></td><td>1</td><td>99 999</td></tr></table>
		<table class="currency-table w-full">
			<tr><th>Valyuta</th><th>Sotib olish</th><th>Sotish</th></tr>
			<tr><td><img alt="USD flag"></td><td>12 100</td><td>12 200</td></tr>
			<tr><td>1 EUR</td><td>14 900</td><td>15 000</td></tr>
		</table></body></html>`

	got, err := parseOFB(parsed(t, []byte(page)))

	require.NoError(t, err)
	assert.Equal(t, Rates{USD: 12200, EUR: 15000}, got, "the calculator left out, no ruble")
}

func TestOFBFailsWithoutTheTablesRates(t *testing.T) {
	cases := []struct{ name, page string }{
		{"no table", `<html><body><p>USD 12 200</p></body></html>`},
		{"no euro", `<html><body><table class="currency-table"><tr><td><img alt="USD flag"></td><td>12 100</td><td>12 200</td></tr></table></body></html>`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := parseOFB(parsed(t, []byte(c.page)))

			assert.Error(t, err)
		})
	}
}
