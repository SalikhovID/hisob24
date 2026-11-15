package bankrate

import (
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
