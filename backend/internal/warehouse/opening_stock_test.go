package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestOpeningStock(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01 00:00+05")

	o, err := s.CreateOpeningStock(ctx, m.scope(), ali, m.asosiy, OpeningStockInput{At: on, Note: ptr(" Boshi "), Items: []ItemInput{line(m.olma, "12.5", "1000"), line(m.nok, "3", "2500.5")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, o.Number)
	assert.Equal(t, m.asosiy, o.LocationID)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), o.At)
	assert.EqualValues(t, 1, o.CurrencyID)
	assert.Equal(t, "1.0000", o.Rate)
	assert.Equal(t, "20001.50", o.Total)
	assert.Equal(t, "20001.50", o.TotalUZS)
	assert.Equal(t, ptr("Boshi"), o.Note)
	assert.Equal(t, []Item{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "12.500", Price: "1000.00", Amount: "12500.00"},
		{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "3.000", Price: "2500.50", Amount: "7501.50"},
	}, o.Items)
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "into the stock")
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, p.Number, "the purchases count on their own")

	dollars, err := s.CreateOpeningStock(ctx, m.scope(), ali, m.chilonzor, OpeningStockInput{At: on, CurrencyID: ptr(int64(2)), Items: []ItemInput{line(m.olma, "2", "50")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, dollars.Number)
	assert.Equal(t, "12800.0000", dollars.Rate)
	assert.Equal(t, "100.00", dollars.Total)
	assert.Equal(t, "1280000.00", dollars.TotalUZS)
	for name, tc := range map[string]struct {
		in      OpeningStockInput
		code    string
		message string
	}{
		"no time":        {OpeningStockInput{Items: []ItemInput{line(m.olma, "1", "1")}}, "validation_error", "Vaqtni kiriting"},
		"a currency off": {OpeningStockInput{At: on, CurrencyID: ptr(int64(3)), Items: []ItemInput{line(m.olma, "1", "1")}}, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan"},
		"no lines":       {OpeningStockInput{At: on}, "validation_error", "Kamida bitta mahsulot qo'shing"},
		"no price":       {OpeningStockInput{At: on, Items: []ItemInput{move(m.olma, "1")}}, "validation_error", "«Olma» narxi noto'g'ri"},
		"no quantity":    {OpeningStockInput{At: on, Items: []ItemInput{line(m.olma, "0", "1")}}, "validation_error", "«Olma» miqdori noto'g'ri"},
	} {
		_, err := s.CreateOpeningStock(ctx, m.scope(), ali, m.asosiy, tc.in)
		refused(t, err, apperr.Invalid, tc.code, tc.message, name)
	}

	page, err := s.ListOpeningStock(ctx, m.scope(), DocumentListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{dollars.ID, o.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first")
	page, err = s.ListOpeningStock(ctx, m.scope(), DocumentListInput{LocationID: m.asosiy, Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 1, page.Total, "one location")
	got, err := s.GetOpeningStock(ctx, m.scope(), o.ID)
	require.NoError(t, err)
	assert.Equal(t, o, got)
	_, err = s.GetOpeningStock(ctx, m.scope(m.chilonzor), o.ID)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi")

	saved, err := s.UpdateOpeningStock(ctx, m.scope(), ali, o.ID, OpeningStockInput{At: "2026-10-08T09:00:00+05:00", Items: []ItemInput{line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "4400.00", saved.Total)
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "4 + the purchase's 1")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok), "out")
	sold(t, pool, m.shop, m.olma, "5")
	_, err = s.UpdateOpeningStock(ctx, m.scope(), ali, o.ID, OpeningStockInput{At: on, Items: []ItemInput{line(m.olma, "1", "1100")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	err = s.DeleteOpeningStock(ctx, m.scope(), o.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	require.NoError(t, s.DeleteOpeningStock(ctx, m.scope(), dollars.ID))
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma))
	_, err = s.GetOpeningStock(ctx, m.scope(), dollars.ID)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi")
}
