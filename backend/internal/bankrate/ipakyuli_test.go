package bankrate

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

// parsed is the page, as html.
func parsed(t *testing.T, page []byte) *html.Node {
	t.Helper()
	doc, err := html.Parse(bytes.NewReader(page))
	require.NoError(t, err)
	return doc
}

// Ipak Yo'li's page carries its rates in the Nuxt payload it is rendered
// with (a snapshot of 2026-05-13, tw-dobroe's: testdata/ipakyuli_rates.html),
// each a hundred times the so'm.
func TestIpakYuliReadsTheNuxtPayload(t *testing.T) {
	got, err := parseIpakYuli(parsed(t, fixture(t, "ipakyuli_rates.html")))

	require.NoError(t, err)
	assert.Equal(t, Rates{USD: 12190, EUR: 14720, RUB: 169}, got)
}

func TestIpakYuliFailsWithoutThePayloadsRates(t *testing.T) {
	cases := []struct{ name, page string }{
		{"no payload", `<html><body><p>USD 12 190</p></body></html>`},
		{"not JSON", `<html><body><script id="__NUXT_DATA__" type="application/json">{</script></body></html>`},
		{"no euro", `<html><body><script id="__NUXT_DATA__" type="application/json">["USD",0,{"buy":3,"sell":4,"cb":5},1218000,1219000,1201437]</script></body></html>`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := parseIpakYuli(parsed(t, []byte(c.page)))

			assert.Error(t, err)
		})
	}
}
