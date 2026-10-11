package ledger

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
)

func TestPriceInSomWithoutRates(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	at := must(At("2026-10-07T09:00:00+05:00"))

	p, err := PriceIn(ctx, q, s.company, PriceInput{}, at, ali, nil)
	require.NoError(t, err)
	assert.Equal(t, currency.UZS, p.CurrencyID, "so'm unless told")
	assert.Equal(t, "1.0000", currency.RateText(p.Rate))
	var status int16
	var usd string
	require.NoError(t, pool.QueryRow(ctx, "SELECT status, usd::text FROM currency_rates WHERE id = $1", p.RateID).Scan(&status, &usd))
	assert.EqualValues(t, 2, status, "the company's zero row, out of the history")
	assert.Equal(t, "0.0000", usd)
	again, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(currency.UZS), Rate: ptr("1")}, at, vali, nil)
	require.NoError(t, err)
	assert.Equal(t, p.RateID, again.RateID, "the zero row is made once; a rate of 1 for so'm is fine")
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM currency_rates WHERE company_id = $1", s.company).Scan(&rows))
	assert.Equal(t, 1, rows)

	_, err = PriceIn(ctx, q, s.company, PriceInput{Rate: ptr("2")}, at, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Kurs noto'g'ri", "so'm has no other rate")
	_, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(9))}, at, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Valyuta noto'g'ri")
	_, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(2))}, at, ali, nil)
	refused(t, err, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")
	turnOn(t, pool, s.company, 2)
	_, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(2))}, at, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "the dollar is on, its rate is not set")
	_, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(2)), Rate: ptr("12 800")}, at, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Kurs noto'g'ri")
	own, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(2)), Rate: ptr("12900.5")}, at, ali, nil)
	require.NoError(t, err)
	assert.EqualValues(t, 2, own.CurrencyID)
	assert.Equal(t, "12900.5000", currency.RateText(own.Rate))
	assert.NotEqual(t, p.RateID, own.RateID, "the document's own row")
	var eur string
	require.NoError(t, pool.QueryRow(ctx, "SELECT status, usd::text, eur::text FROM currency_rates WHERE id = $1", own.RateID).Scan(&status, &usd, &eur))
	assert.EqualValues(t, 2, status)
	assert.Equal(t, "12900.5000", usd)
	assert.Equal(t, "0.0000", eur, "the rest stays 0 without a standard row")
}

func TestPriceInWithStandardRates(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	turnOn(t, pool, s.company, 2)
	turnOn(t, pool, s.company, 3)
	first := standardRate(t, pool, s.company, "12800", "14000", "2026-10-01 00:00+05")
	second := standardRate(t, pool, s.company, "13000", "14100", "2026-10-10 00:00+05")
	usd := ptr(int64(2))
	on := func(raw string) time.Time { return must(At(raw)) }

	p, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd}, on("2026-10-05T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, first, p.RateID, "the standard row in force at the moment")
	assert.Equal(t, "12800.0000", currency.RateText(p.Rate))
	p, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd}, on("2026-10-12T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, second, p.RateID, "a later moment, the later row")
	p, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd}, on("2026-09-01T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, first, p.RateID, "before any rate: the first")
	p, err = PriceIn(ctx, q, s.company, PriceInput{}, on("2026-10-05T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, first, p.RateID, "a document in so'm refers to the standard row too")
	assert.Equal(t, currency.UZS, p.CurrencyID)
	p, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd, Rate: ptr("12800.0000")}, on("2026-10-05T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, first, p.RateID, "the standard rate given back is the standard row")

	own, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd, Rate: ptr("12850")}, on("2026-10-05T09:00:00+05:00"), vali, nil)
	require.NoError(t, err)
	assert.NotContains(t, []int64{first, second}, own.RateID, "another rate: the document's own row")
	assert.Equal(t, "12850.0000", currency.RateText(own.Rate))
	var status int16
	var usdText, eurText, setBy string
	require.NoError(t, pool.QueryRow(ctx, "SELECT status, usd::text, eur::text, set_by FROM currency_rates WHERE id = $1", own.RateID).Scan(&status, &usdText, &eurText, &setBy))
	assert.EqualValues(t, 2, status)
	assert.Equal(t, "12850.0000", usdText)
	assert.Equal(t, "14000.0000", eurText, "the rest from the standard row in force")
	assert.Equal(t, vali, setBy)
	kept, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd, Rate: ptr("12850")}, on("2026-10-12T09:00:00+05:00"), ali, &own)
	require.NoError(t, err)
	assert.Equal(t, own.RateID, kept.RateID, "an edit that gives the document's own rate back keeps its row, whatever the moment")
	changed, err := PriceIn(ctx, q, s.company, PriceInput{CurrencyID: usd}, on("2026-10-12T09:00:00+05:00"), ali, &own)
	require.NoError(t, err)
	assert.Equal(t, second, changed.RateID, "an edit without a rate takes the standard row at the new moment")
	p, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(3))}, on("2026-10-05T09:00:00+05:00"), ali, nil)
	require.NoError(t, err)
	assert.Equal(t, "14000.0000", currency.RateText(p.Rate), "the euro's column")
	turnOn(t, pool, s.company, 4)
	_, err = PriceIn(ctx, q, s.company, PriceInput{CurrencyID: ptr(int64(4))}, on("2026-10-05T09:00:00+05:00"), ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "the ruble is on, its column is 0")
	assert.Equal(t, "12850.0000", RateText(own), "four decimals for the API")
}
