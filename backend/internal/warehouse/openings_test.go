package warehouse

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestSupplierOpeningBalances(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	standardRate(t, pool, olma.company, "12800", "2026-10-01 00:00+05")

	debt, err := s.AddOpening(ctx, olma.company, ali, bozor.ID, OpeningInput{Kind: "debt", Amount: ptr("1000000"), At: on, Note: ptr(" Eski qarz ")})
	require.NoError(t, err)
	assert.Equal(t, "debt", debt.Kind)
	assert.Equal(t, bozor.ID, debt.SupplierID)
	assert.Equal(t, "1000000.00", debt.Amount)
	assert.EqualValues(t, 1, debt.CurrencyID)
	assert.Equal(t, "1.0000", debt.Rate)
	assert.Equal(t, "1000000.00", debt.AmountUZS)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), debt.At)
	assert.Equal(t, ptr("Eski qarz"), debt.Note)
	assert.Equal(t, ptr("Ali aka"), debt.CreatedByName)
	prepay, err := s.AddOpening(ctx, olma.company, vali, bozor.ID, OpeningInput{Kind: "prepay", Amount: ptr("10"), CurrencyID: ptr(int64(2)), At: on})
	require.NoError(t, err)
	assert.Equal(t, "prepay", prepay.Kind)
	assert.Equal(t, "12800.0000", prepay.Rate)
	assert.Equal(t, "128000.00", prepay.AmountUZS)
	assert.Nil(t, prepay.CreatedByName)
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "872000.00", sup.Balance, "the debt less the advance, in so'm")
	assert.Equal(t, []BalanceLine{{CurrencyID: 1, Amount: "1000000.00"}, {CurrencyID: 2, Amount: "-10.00"}}, sup.BalanceByCurrency)
	statement, err := s.Statement(ctx, olma.company, bozor.ID, 1)
	require.NoError(t, err)
	assert.Equal(t, []string{"supplier_prepay", "supplier_debt"}, []string{statement.Items[0].Kind, statement.Items[1].Kind}, "in the statement")

	for name, tc := range map[string]struct {
		in      OpeningInput
		message string
	}{
		"no kind":        {OpeningInput{Amount: ptr("1"), At: on}, "Turni tanlang"},
		"a bad kind":     {OpeningInput{Kind: "loan", Amount: ptr("1"), At: on}, "Tur noto'g'ri"},
		"no amount":      {OpeningInput{Kind: "debt", At: on}, "Summani kiriting"},
		"a bad amount":   {OpeningInput{Kind: "debt", Amount: ptr("0"), At: on}, "Summa noto'g'ri"},
		"no time":        {OpeningInput{Kind: "debt", Amount: ptr("1")}, "Vaqtni kiriting"},
		"a bad rate":     {OpeningInput{Kind: "debt", Amount: ptr("1"), CurrencyID: ptr(int64(2)), Rate: ptr("x"), At: on}, "Kurs noto'g'ri"},
		"a long note":    {OpeningInput{Kind: "debt", Amount: ptr("1"), At: on, Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
		"the kind first": {OpeningInput{At: "x"}, "Turni tanlang"},
	} {
		_, err := s.AddOpening(ctx, olma.company, ali, bozor.ID, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddOpening(ctx, nok.company, ali, bozor.ID, OpeningInput{Kind: "debt", Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's supplier")

	page, err := s.ListOpenings(ctx, olma.company, bozor.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, []int64{prepay.ID, debt.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first")
	_, err = s.ListOpenings(ctx, olma.company, 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")

	saved, err := s.UpdateOpening(ctx, olma.company, ali, bozor.ID, debt.ID, OpeningInput{Kind: "debt", Amount: ptr("1500"), At: "2026-10-08T09:00:00+05:00", Note: ptr("Aniq")})
	require.NoError(t, err)
	assert.Equal(t, "1500.00", saved.Amount)
	assert.Equal(t, time.Date(2026, 10, 8, 4, 0, 0, 0, time.UTC), saved.At)
	assert.Equal(t, ptr("Aniq"), saved.Note)
	_, err = s.UpdateOpening(ctx, olma.company, ali, bozor.ID, debt.ID, OpeningInput{Kind: "prepay", Amount: ptr("1"), At: on})
	refused(t, err, apperr.Invalid, "validation_error", "Tur o'zgartirilmaydi")
	_, err = s.UpdateOpening(ctx, olma.company, ali, bozor.ID, 999999, OpeningInput{})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "the record before its fields")
	require.NoError(t, s.DeleteOpening(ctx, olma.company, bozor.ID, prepay.ID))
	err = s.DeleteOpening(ctx, olma.company, bozor.ID, prepay.ID)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted already")
	sup, err = s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "1500.00", sup.Balance)
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.Conflict, "supplier_in_use", "Bu ta'minotchida 1 ta hujjat bor", "an opening balance is a document")
}
