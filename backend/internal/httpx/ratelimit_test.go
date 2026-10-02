package httpx

import (
	"net/http"
	"net/http/httptest"
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

func TestRateLimiterForgetsIdleKeys(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	l := NewRateLimiter(5, time.Minute)
	l.now = func() time.Time { return now }
	l.Allow("a")

	now = now.Add(2 * time.Minute)
	l.Allow("b")

	assert.NotContains(t, l.hits, "a")
	assert.Contains(t, l.hits, "b")
}

func TestRateLimitAnswers429(t *testing.T) {
	h := RateLimit(NewRateLimiter(5, time.Minute))(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	call := func(remote string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", nil)
		req.RemoteAddr = remote
		h.ServeHTTP(rec, req)
		return rec
	}

	for range 5 {
		assert.Equal(t, http.StatusNoContent, call("203.0.113.5:1").Code)
	}
	rec := call("203.0.113.5:1")
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.JSONEq(t, `{"error":"too_many_requests","message":"Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring"}`, rec.Body.String())
	assert.Equal(t, http.StatusNoContent, call("203.0.113.6:1").Code, "another client")
}
