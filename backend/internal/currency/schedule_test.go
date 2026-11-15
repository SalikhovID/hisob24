package currency

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/SalikhovID/hisob24/backend/internal/bankrate"
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

// fakeClock is a clock the test moves.
type fakeClock struct {
	mu sync.Mutex
	at time.Time
}

func (c *fakeClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.at
}

func (c *fakeClock) set(at time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.at = at
}

// The run fills the day at once (the API may start after midnight), waits
// for the next midnight, runs again then, and stops with the context.
func TestRunDailyFillsTheDayThenRunsEveryMidnight(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.CBU: centralBank}}
	start := time.Now()
	clock := &fakeClock{at: start}
	ticks := make(chan time.Time)
	waits := make(chan time.Duration, 4)
	after := func(d time.Duration) <-chan time.Time {
		waits <- d
		return ticks
	}
	waited := func() time.Duration {
		t.Helper()
		select {
		case d := <-waits:
			return d
		case <-time.After(5 * time.Second):
			t.Fatal("the run never waited for midnight")
			return 0
		}
	}
	ctx, cancel := context.WithCancel(t.Context())
	stopped := make(chan struct{})

	go func() {
		s.runDaily(ctx, banks, clock.now, after)
		close(stopped)
	}()

	assert.Equal(t, NextMidnight(start).Sub(start), waited(), "until midnight")
	assert.Len(t, standardRows(t, pool, olma), 1, "the day filled at once")
	clock.set(NextMidnight(start).Add(time.Second))
	ticks <- time.Now()
	assert.Equal(t, 24*time.Hour-time.Second, waited(), "until the midnight after")
	assert.Len(t, standardRows(t, pool, olma), 2, "the next day's row")
	cancel()
	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("the run did not stop with the context")
	}
}
