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
