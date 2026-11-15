package currency

import (
	"context"
	"log/slog"
	"time"
)

// NextMidnight is the next 00:00 in Tashkent after the moment: the night's
// run waits for it. At midnight itself it is the next day's.
func NextMidnight(now time.Time) time.Time {
	return dayStart(now).AddDate(0, 0, 1)
}

// RunDaily is the night's run (logic/currencies.md, section 4): the day
// filled at once, as the API may start after midnight, then a run at every
// midnight in Tashkent until the context ends. It blocks; main runs it in a
// goroutine of its own.
func (s *Service) RunDaily(ctx context.Context, f Fetcher) {
	s.runDaily(ctx, f, now, time.After)
}

// runDaily is RunDaily on the clock and the timer given.
func (s *Service) runDaily(ctx context.Context, f Fetcher, clock func() time.Time, after func(time.Duration) <-chan time.Time) {
	for {
		r := s.Daily(ctx, f, clock())
		slog.Info("daily rates", "fetched", r.Fetched, "carried", r.Carried, "failed", r.Failed, "skipped", r.Skipped, "errors", r.Errors)
		at := clock()
		select {
		case <-ctx.Done():
			return
		case <-after(NextMidnight(at).Sub(at)):
		}
	}
}
