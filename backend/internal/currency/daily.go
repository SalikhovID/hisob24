package currency

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/bankrate"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Fetcher is where the night's run takes a bank's rates: the bank's own,
// or the central bank's when it has none, and the bank they are from.
type Fetcher interface {
	Fetch(ctx context.Context, source string) (bankrate.Rates, string, error)
}

// manual is the source of a company that enters its rates by hand: the
// night's run asks no bank for it and carries yesterday's rates.
const manual = "manual"

// Report is what a night's run did: the rows it took from a bank, the
// rows it carried from yesterday for a company that enters its rates by
// hand or for want of a bank's, the companies it left as they were, and
// those it failed on.
type Report struct {
	Fetched, Carried, Failed, Skipped, Errors int
}

// Daily writes the day's standard rate row of every company
// (logic/currencies.md, section 4): the rates of the bank it takes them
// from, the dollar and the euro rounded to its step, the ruble as the bank
// gives it; yesterday's rates again for a company that enters its rates by
// hand, or when no bank answers. A company with no rates yet has no
// yesterday: it gets nothing.
func (s *Service) Daily(ctx context.Context, f Fetcher, at time.Time) Report {
	var report Report
	companies, err := s.q.ListRateSources(ctx)
	if err != nil {
		slog.Error("daily rates: the companies", "err", err)
		report.Errors++
		return report
	}
	// The companies with no standard row since the day began: the owner's
	// own of the morning, or this run's, stands.
	var due []gen.ListRateSourcesRow
	for _, c := range companies {
		has, err := s.q.HasStandardRateSince(ctx, gen.HasStandardRateSinceParams{CompanyID: c.ID, Since: dayStart(at)})
		if err != nil {
			slog.Warn("daily rates: a company's row", "company_id", c.ID, "err", err)
			report.Errors++
			continue
		}
		if has {
			report.Skipped++
			continue
		}
		due = append(due, c)
	}
	taken := takeRates(ctx, f, due)
	for _, c := range due {
		o, err := s.dailyRow(ctx, c, taken[c.RateSource], at)
		if err != nil {
			slog.Warn("daily rates: a company's row", "company_id", c.ID, "err", err)
			report.Errors++
			continue
		}
		report.count(o)
	}
	return report
}

// bankRates is what a bank gave the night's run: its rates and the bank
// they are from, or none (ok false).
type bankRates struct {
	rates bankrate.Rates
	used  string
	ok    bool
}

// takeRates asks each bank the companies take their rates from, once,
// whatever the number of them.
func takeRates(ctx context.Context, f Fetcher, companies []gen.ListRateSourcesRow) map[string]bankRates {
	taken := map[string]bankRates{}
	for _, c := range companies {
		if _, asked := taken[c.RateSource]; asked || c.RateSource == manual {
			continue
		}
		rates, used, err := f.Fetch(ctx, c.RateSource)
		if err != nil {
			slog.Warn("daily rates: no bank answered", "source", c.RateSource, "err", err)
			taken[c.RateSource] = bankRates{}
			continue
		}
		taken[c.RateSource] = bankRates{rates: rates, used: used, ok: true}
	}
	return taken
}

// outcome is what the night's run did for a company.
type outcome int

const (
	fetched outcome = iota
	carried
	failed
	skipped
)

func (r *Report) count(o outcome) {
	switch o {
	case fetched:
		r.Fetched++
	case carried:
		r.Carried++
	case failed:
		r.Failed++
	case skipped:
		r.Skipped++
	}
}

// dailyRow writes the company's row for the day: the bank's rates, or
// yesterday's again.
func (s *Service) dailyRow(ctx context.Context, c gen.ListRateSourcesRow, got bankRates, at time.Time) (outcome, error) {
	switch {
	case c.RateSource == manual:
		return s.carry(ctx, c.ID, at, carried)
	case !got.ok:
		return s.carry(ctx, c.ID, at, failed)
	}
	return fetched, s.writeFetched(ctx, c, got.rates)
}

// carry enters the company's row in force at the moment again, as it was:
// for a manual company ("carried") or for want of a bank's rates
// ("failed"). Without a row there is nothing to carry.
func (s *Service) carry(ctx context.Context, companyID int64, at time.Time, o outcome) (outcome, error) {
	prev, err := RateAt(ctx, s.q, companyID, at)
	if err != nil {
		return o, err
	}
	if prev == nil {
		return skipped, nil
	}
	source := "carried"
	if o == failed {
		source = "failed"
	}
	_, err = s.q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: companyID, Usd: prev.Usd, Eur: prev.Eur, Rub: prev.Rub, Source: source})
	return o, err
}

// writeFetched enters the company's row of the bank's rates.
func (s *Service) writeFetched(ctx context.Context, c gen.ListRateSourcesRow, r bankrate.Rates) error {
	usd, err := numeric(roundRate(r.USD, c.RateRounding))
	if err != nil {
		return err
	}
	eur, err := numeric(roundRate(r.EUR, c.RateRounding))
	if err != nil {
		return err
	}
	rub, err := numeric(r.RUB)
	if err != nil {
		return err
	}
	_, err = s.q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: c.ID, Usd: usd, Eur: eur, Rub: rub, Source: c.RateSource})
	return err
}

// numeric is a rate as the rows keep it, four decimals.
func numeric(v float64) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	err := n.Scan(strconv.FormatFloat(v, 'f', 4, 64))
	return n, err
}

// tashkent is the zone the night's run keeps: UTC+5, with no summer time.
var tashkent = time.FixedZone("UTC+5", 5*60*60)

// dayStart is the start of the moment's day in Tashkent.
func dayStart(at time.Time) time.Time {
	y, m, d := at.In(tashkent).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, tashkent)
}
