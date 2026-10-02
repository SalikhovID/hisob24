package httpx

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestRateLimiterAllowsLimitPerKey(t *testing.T) {
	l := NewRateLimiter(5, time.Minute)

	for i := range 5 {
		assert.True(t, l.Allow("a"), "request %d", i+1)
	}
	assert.False(t, l.Allow("a"), "the sixth request within the minute")
	assert.True(t, l.Allow("b"), "keys are independent")
}

func TestRateLimiterWindowSlides(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	l := NewRateLimiter(2, time.Minute)
	l.now = func() time.Time { return now }

	assert.True(t, l.Allow("a"))
	now = now.Add(30 * time.Second)
	assert.True(t, l.Allow("a"))
	assert.False(t, l.Allow("a"))
	now = now.Add(31 * time.Second) // the first request has left the window
	assert.True(t, l.Allow("a"))
	assert.False(t, l.Allow("a"))
}
