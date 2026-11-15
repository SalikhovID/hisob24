package currency

import (
	"context"
	"errors"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/bankrate"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// RateSource is where a company takes its rates, a bank or "manual", and
// the step the night's run rounds the dollar and the euro to
// (logic/currencies.md, section 4).
type RateSource struct {
	Source   string
	Rounding int
}

// rateSources are the sources a company may take its rates from: by hand,
// or a bank, the central bank first.
var rateSources = []string{manual, bankrate.CBU, bankrate.Kapital, bankrate.IpakYuli, bankrate.Asaka, bankrate.Hamkor, bankrate.Uzum, bankrate.OFB}

// roundings are the steps the dollar and the euro may be rounded to; 1
// keeps them as the bank gives them.
var roundings = []int{1, 10, 100, 1000}

// SourceOf is the company's rate source.
func (s *Service) SourceOf(ctx context.Context, companyID int64) (RateSource, error) {
	row, err := s.q.GetRateSource(ctx, companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return RateSource{}, errCompanyNotFound
	}
	if err != nil {
		return RateSource{}, err
	}
	return RateSource{Source: row.RateSource, Rounding: int(row.RateRounding)}, nil
}

// SetSourceOf sets the company's rate source, as the admin: a source of
// the list (400 «Manba noto'g'ri») and a step of the list (400 «Yaxlitlash
// noto'g'ri»). The night's run goes by it from the next midnight.
func (s *Service) SetSourceOf(ctx context.Context, companyID int64, in RateSource) (RateSource, error) {
	if !slices.Contains(rateSources, in.Source) {
		return RateSource{}, invalid("Manba noto'g'ri")
	}
	if !slices.Contains(roundings, in.Rounding) {
		return RateSource{}, invalid("Yaxlitlash noto'g'ri")
	}
	row, err := s.q.SetRateSource(ctx, gen.SetRateSourceParams{ID: companyID, RateSource: in.Source, RateRounding: int32(in.Rounding)})
	if errors.Is(err, pgx.ErrNoRows) {
		return RateSource{}, errCompanyNotFound
	}
	if err != nil {
		return RateSource{}, err
	}
	return RateSource{Source: row.RateSource, Rounding: int(row.RateRounding)}, nil
}
