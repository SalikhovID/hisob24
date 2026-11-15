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
// gives it.
func (s *Service) Daily(ctx context.Context, f Fetcher, at time.Time) Report {
	var report Report
	companies, err := s.q.ListRateSources(ctx)
	if err != nil {
		slog.Error("daily rates: the companies", "err", err)
		report.Errors++
		return report
	}
	for _, c := range companies {
		if c.RateSource == manual {
			if err := s.carry(ctx, c.ID, at, "carried"); err != nil {
				slog.Warn("daily rates: a company's row", "company_id", c.ID, "err", err)
				report.Errors++
				continue
			}
			report.Carried++
			continue
		}
		rates, _, fetchErr := f.Fetch(ctx, c.RateSource)
		var err error
		if fetchErr == nil {
			err = s.writeFetched(ctx, c, rates)
		} else {
			slog.Warn("daily rates: no bank answered", "company_id", c.ID, "source", c.RateSource, "err", fetchErr)
			err = s.carry(ctx, c.ID, at, "failed")
		}
		if err != nil {
			slog.Warn("daily rates: a company's row", "company_id", c.ID, "err", err)
			report.Errors++
			continue
		}
		if fetchErr == nil {
			report.Fetched++
		} else {
			report.Failed++
		}
	}
	return report
}

// carry enters the company's row in force at the moment again, as the
// source says: yesterday's rates, as they were.
func (s *Service) carry(ctx context.Context, companyID int64, at time.Time, source string) error {
	prev, err := RateAt(ctx, s.q, companyID, at)
	if err != nil || prev == nil {
		return err
	}
	_, err = s.q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: companyID, Usd: prev.Usd, Eur: prev.Eur, Rub: prev.Rub, Source: source})
	return err
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
