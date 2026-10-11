package currency

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestRate(t *testing.T) {
	t.Parallel()
	for raw, ok := range map[string]bool{
		"12800": true, "12800.5": true, "12800.1234": true, "0.0001": true, "1234567890.1234": true,
		"0": false, "0.0000": false, "12800.12345": false, "12345678901": false, "-1": false, "1,5": false, "": false, " 12800": false,
	} {
		n, err := Rate(raw)
		if ok {
			assert.NoError(t, err, raw)
			assert.True(t, n.Valid, raw)
		} else {
			refused(t, err, apperr.Invalid, "validation_error", "Kurs noto'g'ri")
		}
	}
}

func TestRateText(t *testing.T) {
	t.Parallel()
	for raw, want := range map[string]string{"12800": "12800.0000", "12800.5": "12800.5000", "0": "0.0000", "1": "1.0000"} {
		n, err := Rate(raw)
		if raw == "0" {
			n = zeroRate()
			err = nil
		}
		require.NoError(t, err)
		assert.Equal(t, want, RateText(n), raw)
	}
}

func TestSetRates(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")

	_, err := s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12800")})
	refused(t, err, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")
	_, err = s.SetRates(ctx, olma, ali, RatesInput{})
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting")

	turnOn(t, pool, olma, 2)
	turnOn(t, pool, olma, 3)
	first, err := s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12800"), EUR: ptr("13900.5")})
	require.NoError(t, err)
	assert.Positive(t, first.ID)
	assert.Equal(t, "12800.0000", first.USD)
	assert.Equal(t, "13900.5000", first.EUR)
	assert.Equal(t, "0.0000", first.RUB, "a currency that is off stays 0")
	assert.Equal(t, ptr("Ali aka"), first.SetByName)
	assert.WithinDuration(t, time.Now(), first.SetAt, time.Minute)

	second, err := s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12900")})
	require.NoError(t, err)
	assert.Equal(t, "12900.0000", second.USD)
	assert.Equal(t, "13900.5000", second.EUR, "a rate not given is carried from the row before")

	_, err = s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("abc")})
	refused(t, err, apperr.Invalid, "validation_error", "Kurs noto'g'ri")
	_, err = s.SetRates(ctx, olma, ali, RatesInput{RUB: ptr("150")})
	refused(t, err, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")

	page, err := s.History(ctx, olma, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total)
	require.Len(t, page.Items, 2)
	assert.Equal(t, second.ID, page.Items[0].ID, "the newest first")
	assert.Equal(t, first.ID, page.Items[1].ID)
	assert.Equal(t, 20, page.PageSize)
	_, err = s.History(ctx, olma, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")

	_, err = s.SetRates(ctx, olma+1000, ali, RatesInput{USD: ptr("12800")})
	refused(t, err, apperr.NotFound, "not_found", "Kompaniya topilmadi")
}

func TestRateAt(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	q := gen.New(pool)

	got, err := RateAt(ctx, q, olma, time.Now())
	require.NoError(t, err)
	assert.Nil(t, got, "no rate at all")

	turnOn(t, pool, olma, 2)
	first, err := s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12700")})
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE currency_rates SET set_at = now() - interval '2 days' WHERE id = $1", first.ID)
	require.NoError(t, err)
	second, err := s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12800")})
	require.NoError(t, err)

	got, err = RateAt(ctx, q, olma, time.Now().Add(time.Minute))
	require.NoError(t, err)
	assert.Equal(t, second.ID, got.ID, "the newest row now")
	assert.Equal(t, "12800.0000", RateText(ColumnOf(*got, 2)))
	assert.Equal(t, "1.0000", RateText(ColumnOf(*got, 1)))
	assert.Equal(t, "0.0000", RateText(ColumnOf(*got, 4)))
	got, err = RateAt(ctx, q, olma, time.Now().Add(-24*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, first.ID, got.ID, "the row in force a day ago")
	got, err = RateAt(ctx, q, olma, time.Now().Add(-72*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, first.ID, got.ID, "before any rate: the earliest")
}
