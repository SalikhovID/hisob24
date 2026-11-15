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

// A company that enters its rates by hand asks no bank: it gets
// yesterday's rates again.
func TestDailyCarriesYesterdaysRatesForAManualCompany(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	takeRatesFrom(t, pool, olma, "manual", 100)
	enteredYesterday(t, s, pool, olma)
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.CBU: centralBank}}

	report := s.Daily(t.Context(), banks, time.Now())

	rows := standardRows(t, pool, olma)
	require.Len(t, rows, 2)
	assert.Equal(t, standardRow{USD: "12800.0000", EUR: "13900.5000", RUB: "0.0000", Source: ptr("carried")}, rows[0])
	assert.Empty(t, banks.calls, "no bank asked")
	assert.Equal(t, Report{Carried: 1}, report)
}

// With no row yet there is no yesterday to carry: nothing is written.
func TestDailyWritesNothingWithoutYesterdaysRates(t *testing.T) {
	s, pool := newService(t)
	byHand := addCompany(t, pool, "Olma")
	takeRatesFrom(t, pool, byHand, "manual", 100)
	unanswered := addCompany(t, pool, "Nok")
	takeRatesFrom(t, pool, unanswered, bankrate.Hamkor, 100)

	report := s.Daily(t.Context(), &fakeBanks{}, time.Now())

	assert.Empty(t, standardRows(t, pool, byHand))
	assert.Empty(t, standardRows(t, pool, unanswered))
	assert.Equal(t, Report{Skipped: 2}, report)
}

// A day's row is written once: a company that has a standard row since the
// day began, the owner's own too, is left as it is, and a second run that
// day writes nothing.
func TestDailyWritesADaysRowOnce(t *testing.T) {
	s, pool := newService(t)
	entered := addCompany(t, pool, "Olma")
	turnOn(t, pool, entered, 2)
	_, err := s.SetRates(t.Context(), entered, ali, RatesInput{USD: ptr("12900")})
	require.NoError(t, err)
	twice := addCompany(t, pool, "Nok")
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.CBU: centralBank}}

	first := s.Daily(t.Context(), banks, time.Now())
	second := s.Daily(t.Context(), banks, time.Now())

	rows := standardRows(t, pool, entered)
	require.Len(t, rows, 1, "the owner's rate of the morning stands")
	assert.Nil(t, rows[0].Source)
	assert.Len(t, standardRows(t, pool, twice), 1, "one row a day")
	assert.Equal(t, Report{Fetched: 1, Skipped: 1}, first)
	assert.Equal(t, Report{Skipped: 2}, second)
}

// The day is Tashkent's (UTC+5), whatever zone the server's clock is in:
// at 09:00 there a row of 01:00 is the day's, one of 23:59 the day before
// is yesterday's.
func TestDailyCountsTheDayInTashkent(t *testing.T) {
	s, pool := newService(t)
	at := time.Date(2026, 3, 10, 4, 0, 0, 0, time.UTC) // 09:00 in Tashkent
	todays := addCompany(t, pool, "Olma")
	yesterdays := addCompany(t, pool, "Nok")
	for id, setAt := range map[int64]time.Time{
		todays:     time.Date(2026, 3, 9, 20, 0, 0, 0, time.UTC),  // 01:00 on the 10th in Tashkent
		yesterdays: time.Date(2026, 3, 9, 18, 59, 0, 0, time.UTC), // 23:59 on the 9th
	} {
		takeRatesFrom(t, pool, id, "manual", 100)
		_, err := pool.Exec(t.Context(), "INSERT INTO currency_rates (company_id, usd, set_by, set_at) VALUES ($1, 12800, $2, $3)", id, ali, setAt)
		require.NoError(t, err)
	}

	report := s.Daily(t.Context(), &fakeBanks{}, at)

	assert.Len(t, standardRows(t, pool, todays), 1, "the day's row is there")
	rows := standardRows(t, pool, yesterdays)
	require.Len(t, rows, 2)
	assert.Equal(t, ptr("carried"), rows[0].Source)
	assert.Equal(t, Report{Carried: 1, Skipped: 1}, report)
}

// A night asks each bank once, however many companies take their rates
// from it.
func TestDailyAsksEachBankOnce(t *testing.T) {
	s, pool := newService(t)
	var companies []int64
	for _, source := range []string{bankrate.Kapital, bankrate.Kapital, bankrate.Kapital, bankrate.CBU, bankrate.CBU} {
		id := addCompany(t, pool, "Olma")
		takeRatesFrom(t, pool, id, source, 100)
		companies = append(companies, id)
	}
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.Kapital: {USD: 12045, EUR: 13380, RUB: 142}, bankrate.CBU: centralBank}}

	report := s.Daily(t.Context(), banks, time.Now())

	assert.Equal(t, map[string]int{bankrate.Kapital: 1, bankrate.CBU: 1}, banks.calls)
	for _, id := range companies {
		assert.Len(t, standardRows(t, pool, id), 1)
	}
	assert.Equal(t, Report{Fetched: 5}, report)
}

// When the central bank stands in for a company's bank, the row says so.
func TestDailySaysTheCentralBankStoodIn(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	takeRatesFrom(t, pool, olma, bankrate.Kapital, 100)
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.Kapital: centralBank}, used: map[string]string{bankrate.Kapital: bankrate.CBU}}

	s.Daily(t.Context(), banks, time.Now())

	rows := standardRows(t, pool, olma)
	require.Len(t, rows, 1)
	assert.Equal(t, standardRow{USD: "12000.0000", EUR: "13300.0000", RUB: "146.1900", Source: ptr(bankrate.CBU)}, rows[0])
}

// A bank that gives no rate of a currency leaves it at yesterday's, 0 with
// no yesterday.
func TestDailyKeepsYesterdaysRateOfACurrencyTheBankLacks(t *testing.T) {
	s, pool := newService(t)
	withYesterday := addCompany(t, pool, "Olma")
	withoutYesterday := addCompany(t, pool, "Nok")
	for _, id := range []int64{withYesterday, withoutYesterday} {
		takeRatesFrom(t, pool, id, bankrate.OFB, 100)
	}
	_, err := pool.Exec(t.Context(), "INSERT INTO currency_rates (company_id, usd, rub, set_by, set_at) VALUES ($1, 12800, 147, $2, now() - interval '1 day')", withYesterday, ali)
	require.NoError(t, err)
	banks := &fakeBanks{rates: map[string]bankrate.Rates{bankrate.OFB: {USD: 12060, EUR: 13700}}}

	s.Daily(t.Context(), banks, time.Now())

	assert.Equal(t, standardRow{USD: "12100.0000", EUR: "13700.0000", RUB: "147.0000", Source: ptr(bankrate.OFB)}, standardRows(t, pool, withYesterday)[0], "the ruble of yesterday")
	assert.Equal(t, standardRow{USD: "12100.0000", EUR: "13700.0000", RUB: "0.0000", Source: ptr(bankrate.OFB)}, standardRows(t, pool, withoutYesterday)[0], "no ruble at all")
}

// meetingBanks answers only once n runs have asked it: by then each of
// them has found the company due its row.
type meetingBanks struct {
	n   int
	mu  sync.Mutex
	in  int
	all chan struct{}
}

func (b *meetingBanks) Fetch(ctx context.Context, source string) (bankrate.Rates, string, error) {
	b.mu.Lock()
	b.in++
	if b.in == b.n {
		close(b.all)
	}
	b.mu.Unlock()
	select {
	case <-b.all:
		return centralBank, source, nil
	case <-ctx.Done():
		return bankrate.Rates{}, "", ctx.Err()
	}
}

// Two runs at once, a deploy's old process and its new one, write the
// day's row once: the second finds the first's under the company's lock.
func TestDailyTwoRunsAtOnceWriteOneRow(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	banks := &meetingBanks{n: 2, all: make(chan struct{})}
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()

	reports := make([]Report, 2)
	var wg sync.WaitGroup
	for i := range reports {
		wg.Add(1)
		go func() {
			defer wg.Done()
			reports[i] = s.Daily(ctx, banks, time.Now())
		}()
	}
	wg.Wait()

	assert.Len(t, standardRows(t, pool, olma), 1)
	assert.Equal(t, 1, reports[0].Fetched+reports[1].Fetched, "one wrote it")
	assert.Equal(t, 1, reports[0].Skipped+reports[1].Skipped, "the other found it")
}
