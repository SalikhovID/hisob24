package currency

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRoundRate(t *testing.T) {
	t.Parallel()
	cases := []struct {
		rate float64
		step int32
		want float64
	}{
		{12014.37, 100, 12000},
		{13280.68, 100, 13300},
		{12050, 100, 12100}, // half away from zero
		{12049.99, 100, 12000},
		{12014.37, 10, 12010},
		{12014.37, 1000, 12000},
		{12500, 1000, 13000},
		{12014.37, 1, 12014.37}, // as the bank gives it
	}
	for _, c := range cases {
		assert.InDelta(t, c.want, roundRate(c.rate, c.step), 1e-9, "%v to %d", c.rate, c.step)
	}
}
