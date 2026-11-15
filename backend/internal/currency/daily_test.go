package currency

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/bankrate"
)

// fakeBanks answers the night's run the way the banks would: the rates of
// each source it has, the central bank standing in where used says so;
// a source it has none of gives none. calls counts what was asked.
type fakeBanks struct {
	mu    sync.Mutex
	rates map[string]bankrate.Rates
	used  map[string]string
	calls map[string]int
}

func (f *fakeBanks) Fetch(_ context.Context, source string) (bankrate.Rates, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.calls == nil {
		f.calls = map[string]int{}
	}
	f.calls[source]++
	r, ok := f.rates[source]
	if !ok {
		return bankrate.Rates{}, "", errors.New("no bank answered")
	}
	if used, ok := f.used[source]; ok {
		return r, used, nil
	}
	return r, source, nil
}

// centralBank is the central bank's rates of 2026-11-14.
var centralBank = bankrate.Rates{USD: 12014.37, EUR: 13280.68, RUB: 146.19}

// standardRow is a standard rate row as the night's run is checked by.
type standardRow struct {
	USD, EUR, RUB string
	SetBy, Source *string
}

// standardRows is the company's standard rows, the newest first.
func standardRows(t *testing.T, pool *pgxpool.Pool, companyID int64) []standardRow {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT usd::text, eur::text, rub::text, set_by, source FROM currency_rates WHERE company_id = $1 AND status = 1 ORDER BY set_at DESC, id DESC", companyID)
	require.NoError(t, err)
	defer rows.Close()
	var list []standardRow
	for rows.Next() {
		var r standardRow
		require.NoError(t, rows.Scan(&r.USD, &r.EUR, &r.RUB, &r.SetBy, &r.Source))
		list = append(list, r)
	}
	require.NoError(t, rows.Err())
	return list
}

// takeRatesFrom sets where the company takes its rates and the step it
// rounds them to, as the admin does.
func takeRatesFrom(t *testing.T, pool *pgxpool.Pool, companyID int64, source string, step int) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "UPDATE companies SET rate_source = $2, rate_rounding = $3 WHERE id = $1", companyID, source, step)
	require.NoError(t, err)
}

// A company on a bank gets the day's row from it: the dollar and the euro
// rounded to its step, the ruble as the bank gives it; no member, the bank
// as its source.
func TestDailyTakesTheBanksRatesRoundedToTheStep(t *testing.T) {
	s, pool := newService(t)
	cases := []struct {
		step          int
		usd, eur, rub string
	}{
		{100, "12000.0000", "13300.0000", "146.1900"},
		{10, "12010.0000", "13280.0000", "146.1900"},
		{1000, "12000.0000", "13000.0000", "146.1900"},
		{1, "12014.3700", "13280.6800", "146.1900"},
	}
	companies := make([]int64, len(cases))
	for i, c := range cases {
		companies[i] = addCompany(t, pool, "Olma")
		takeRatesFrom(t, pool, companies[i], bankrate.CBU, c.step)
	}
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.CBU: centralBank}}

	report := s.Daily(t.Context(), banks, time.Now())

	for i, c := range cases {
		assert.Equal(t, []standardRow{{USD: c.usd, EUR: c.eur, RUB: c.rub, Source: ptr(bankrate.CBU)}}, standardRows(t, pool, companies[i]), "step %d", c.step)
	}
	assert.Equal(t, Report{Fetched: len(cases)}, report)
}

// enteredYesterday is a row the owner entered a day ago: the dollar and
// the euro on.
func enteredYesterday(t *testing.T, s *Service, pool *pgxpool.Pool, companyID int64) {
	t.Helper()
	turnOn(t, pool, companyID, 2)
	turnOn(t, pool, companyID, 3)
	row, err := s.SetRates(t.Context(), companyID, ali, RatesInput{USD: ptr("12800"), EUR: ptr("13900.5")})
	require.NoError(t, err)
	_, err = pool.Exec(t.Context(), "UPDATE currency_rates SET set_at = now() - interval '1 day' WHERE id = $1", row.ID)
	require.NoError(t, err)
}

// When no bank answers, the company gets yesterday's rates again, as the
// rates the bank failed to give.
func TestDailyCarriesYesterdaysRatesWhenNoBankAnswers(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	takeRatesFrom(t, pool, olma, bankrate.Kapital, 100)
	enteredYesterday(t, s, pool, olma)

	report := s.Daily(t.Context(), &fakeBanks{}, time.Now())

	rows := standardRows(t, pool, olma)
	require.Len(t, rows, 2)
	assert.Equal(t, standardRow{USD: "12800.0000", EUR: "13900.5000", RUB: "0.0000", Source: ptr("failed")}, rows[0], "yesterday's, not rounded")
	assert.Equal(t, Report{Failed: 1}, report)
}
