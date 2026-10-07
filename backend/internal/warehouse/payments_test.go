package warehouse

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestAddPayment(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)

	p, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("1200.5"), PaidOn: "2026-10-07", Note: ptr(" Naqd ")})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, bozor.ID, p.SupplierID)
	assert.Nil(t, p.PurchaseID, "entered on its own")
	assert.Nil(t, p.PurchaseNumber)
	assert.Equal(t, "1200.50", p.Amount)
	assert.Equal(t, "2026-10-07", p.PaidOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Naqd"), p.Note, "trimmed")
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	assert.Equal(t, p.CreatedAt, p.UpdatedAt)
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "-1200.50", sup.Balance, "an advance: nothing was bought")
	assert.Equal(t, "1200.50", sup.PaymentsTotal)

	for name, tc := range map[string]struct {
		in      PaymentInput
		message string
	}{
		"no amount":    {PaymentInput{PaidOn: "2026-10-07"}, "Summani kiriting"},
		"zero":         {PaymentInput{Amount: ptr("0"), PaidOn: "2026-10-07"}, "Summa noto'g'ri"},
		"a bad amount": {PaymentInput{Amount: ptr("1,5"), PaidOn: "2026-10-07"}, "Summa noto'g'ri"},
		"no day":       {PaymentInput{Amount: ptr("1")}, "Sanani kiriting"},
		"a bad day":    {PaymentInput{Amount: ptr("1"), PaidOn: "7.10.2026"}, "Sana noto'g'ri"},
		"a long note":  {PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07", Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddPayment(ctx, nok.company, ali, bozor.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's supplier")
	_, err = s.AddPayment(ctx, olma.company, ali, 999999, PaymentInput{PaidOn: "x"})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "the supplier comes before the input")
	_, err = s.SetSupplierActive(ctx, olma.company, bozor.ID, false)
	require.NoError(t, err)
	paid, err := s.AddPayment(ctx, olma.company, vali, bozor.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
	require.NoError(t, err, "an inactive supplier is still paid")
	assert.Nil(t, paid.CreatedByName, "Vali goes by no name")
}

func TestListUpdateAndDeletePayments(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	dehqon, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("100"), PaidOn: "2026-10-01"})
	require.NoError(t, err)
	second, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("200"), PaidOn: "2026-10-05"})
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, ali, dehqon.ID, PaymentInput{Amount: ptr("300"), PaidOn: "2026-10-06"})
	require.NoError(t, err)

	page, err := s.ListPayments(ctx, olma.company, bozor.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first, the supplier's alone")
	_, err = s.ListPayments(ctx, olma.company, bozor.ID, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	_, err = s.ListPayments(ctx, olma.company, 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")

	saved, err := s.UpdatePayment(ctx, olma.company, bozor.ID, first.ID, PaymentInput{Amount: ptr("150"), PaidOn: "2026-10-02", Note: ptr("Karta")})
	require.NoError(t, err)
	assert.Equal(t, "150.00", saved.Amount)
	assert.Equal(t, "2026-10-02", saved.PaidOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Karta"), saved.Note)
	assert.True(t, saved.UpdatedAt.After(first.UpdatedAt))
	_, err = s.UpdatePayment(ctx, olma.company, dehqon.ID, first.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-02"})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "another supplier's payment")
	_, err = s.UpdatePayment(ctx, olma.company, bozor.ID, first.ID, PaymentInput{PaidOn: "2026-10-02"})
	refused(t, err, apperr.Invalid, "validation_error", "Summani kiriting")
	_, err = s.UpdatePayment(ctx, olma.company, bozor.ID, 999999, PaymentInput{PaidOn: "x"})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "the payment comes before the input")

	require.NoError(t, s.DeletePayment(ctx, olma.company, bozor.ID, first.ID))
	err = s.DeletePayment(ctx, olma.company, bozor.ID, first.ID)
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "deleted already")
	err = s.DeletePayment(ctx, olma.company, bozor.ID, second.ID+1000)
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi")
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "-200.00", sup.Balance, "the deleted payment no longer counts")
	page, err = s.ListPayments(ctx, olma.company, bozor.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, page.Total)
}
