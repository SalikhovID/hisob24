package bankrate

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseRateNumber(t *testing.T) {
	cases := []struct {
		in   string
		want float64
	}{
		{"12141.94", 12141.94},
		{"12 141.94", 12141.94},
		{"12 141.94", 12141.94}, // a no-break space, as a page's text has it
		{"12,141.94", 12141.94},
		{"12141,94", 12141.94},
		{"12.141,94", 12141.94},
		{"12190", 12190},
		{"146.19", 146.19},
	}
	for _, c := range cases {
		t.Run(c.in, func(t *testing.T) {
			got, err := parseRateNumber(c.in)
			require.NoError(t, err)
			assert.InDelta(t, c.want, got, 1e-9)
		})
	}
	_, err := parseRateNumber("dollar")
	assert.Error(t, err, "not a number")
}

// A page's text gives the rates after the currencies' names: the first
// number in a rate's range, never what a script holds.
func TestScrapeReadsTheRatesOffAPage(t *testing.T) {
	cases := []struct {
		name  string
		page  string
		want  Rates
		fails bool
	}{
		{name: "the names a page uses", page: `<html><body><table>
			<tr><td>Dollar</td><td>12 140,00</td></tr>
			<tr><td>Евро</td><td>13 400</td></tr>
			<tr><td>Rubl</td><td>147,50</td></tr></table></body></html>`, want: Rates{USD: 12140, EUR: 13400, RUB: 147.5}},
		{name: "a code before the rate", page: `<p>USD 840 12 140.00</p><p>EUR 978 13 400.00</p><p>RUB 147.00</p>`, want: Rates{USD: 12140, EUR: 13400, RUB: 147}},
		{name: "not a script's number", page: `<script>var USD = 15000, EUR = 16000;</script><p>USD 12 140</p><p>EUR 13 400</p>`, want: Rates{USD: 12140, EUR: 13400}},
		{name: "no ruble", page: `<p>USD 12 140</p><p>EUR 13 400</p>`, want: Rates{USD: 12140, EUR: 13400}},
		{name: "no dollar", page: `<p>EUR 13 400</p><p>RUB 147</p>`, fails: true},
		{name: "no euro", page: `<p>USD 12 140</p>`, fails: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client := &Client{HTTP: http.DefaultClient}

			got, err := client.scrape(t.Context(), serve(t, http.StatusOK, []byte(c.page)))

			if c.fails {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, c.want, got)
		})
	}
	_, err := (&Client{HTTP: http.DefaultClient}).scrape(t.Context(), serve(t, http.StatusForbidden, nil))
	assert.Error(t, err, "a page behind a challenge")
}
