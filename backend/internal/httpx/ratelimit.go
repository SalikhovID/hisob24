package httpx

import (
	"sync"
	"time"
)

// RateLimiter allows each key at most limit requests in any window: a
// sliding-window log of the key's recent requests.
type RateLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu   sync.Mutex
	hits map[string][]time.Time
}

// NewRateLimiter allows limit requests per key in any window.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{limit: limit, window: window, now: time.Now, hits: map[string][]time.Time{}}
}

// Allow records a request for key and reports whether it is within the limit.
func (l *RateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	since := now.Add(-l.window)

	recent := l.hits[key][:0]
	for _, at := range l.hits[key] {
		if at.After(since) {
			recent = append(recent, at)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}
