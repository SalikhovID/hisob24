package currency

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNextMidnight(t *testing.T) {
	t.Parallel()
	at := func(y int, m time.Month, d, h, min, s int) time.Time { return time.Date(y, m, d, h, min, s, 0, tashkent) }
	cases := []struct {
		name      string
		now, want time.Time
	}{
		{"in the afternoon", at(2026, 11, 15, 17, 0, 0), at(2026, 11, 16, 0, 0, 0)},
		{"a second before", at(2026, 11, 15, 23, 59, 59), at(2026, 11, 16, 0, 0, 0)},
		{"at midnight, the next", at(2026, 11, 16, 0, 0, 0), at(2026, 11, 17, 0, 0, 0)},
		{"a server's clock in UTC", time.Date(2026, 11, 15, 19, 30, 0, 0, time.UTC), at(2026, 11, 17, 0, 0, 0)},
		{"the year's last day", at(2026, 12, 31, 12, 0, 0), at(2027, 1, 1, 0, 0, 0)},
	}
	for _, c := range cases {
		got := NextMidnight(c.now)
		assert.True(t, c.want.Equal(got), "%s: want %v, got %v", c.name, c.want, got)
	}
}
