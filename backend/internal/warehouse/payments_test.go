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
	closed := addAccount(t, pool, olma.company, "Yopiq", 1, false)

	p, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("1200.5"), At: on, Note: ptr(" Naqd ")})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, bozor.ID, p.SupplierID)
	assert.Nil(t, p.PurchaseID, "entered on its own")
	assert.Nil(t, p.PurchaseNumber)
	assert.Equal(t, olma.cash, p.BankAccountID)
	assert.Equal(t, "Naqd", p.AccountName)
	assert.Equal(t, "1200.50", p.Amount)
	assert.EqualValues(t, 1, p.CurrencyID, "the account's currency")
	assert.Equal(t, "1.0000", p.Rate)
	assert.Equal(t, "1200.50", p.AmountUZS)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), p.At)
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
		"no account":          {PaymentInput{Amount: ptr("1"), At: on}, "Akkauntni tanlang"},
		"another's account":   {PaymentInput{BankAccountID: nok.cash, Amount: ptr("1"), At: on}, "Akkauntni tanlang"},
		"an inactive account": {PaymentInput{BankAccountID: closed, Amount: ptr("1"), At: on}, "Akkaunt nofaol"},
		"no amount":           {PaymentInput{BankAccountID: olma.cash, At: on}, "Summani kiriting"},
		"zero":                {PaymentInput{BankAccountID: olma.cash, Amount: ptr("0"), At: on}, "Summa noto'g'ri"},
		"a bad amount":        {PaymentInput{BankAccountID: olma.cash, Amount: ptr("1,5"), At: on}, "Summa noto'g'ri"},
		"no time":             {PaymentInput{BankAccountID: olma.cash, Amount: ptr("1")}, "Vaqtni kiriting"},
		"a bad time":          {PaymentInput{BankAccountID: olma.cash, Amount: ptr("1"), At: "7.10.2026"}, "Vaqt noto'g'ri"},
		"a rate for the so'm": {PaymentInput{BankAccountID: olma.cash, Amount: ptr("1"), At: on, Rate: ptr("12800")}, "Kurs noto'g'ri"},
		"a long note":         {PaymentInput{BankAccountID: olma.cash, Amount: ptr("1"), At: on, Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
		"the account first":   {PaymentInput{At: "x"}, "Akkauntni tanlang"},
	} {
		_, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddPayment(ctx, nok.company, ali, bozor.ID, PaymentInput{BankAccountID: nok.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's supplier")
	_, err = s.AddPayment(ctx, olma.company, ali, 999999, PaymentInput{At: "x"})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "the supplier comes before the input")
	_, err = s.SetSupplierActive(ctx, olma.company, bozor.ID, false)
	require.NoError(t, err)
	paid, err := s.AddPayment(ctx, olma.company, vali, bozor.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("1"), At: on})
	require.NoError(t, err, "an inactive supplier is still paid")
	assert.Nil(t, paid.CreatedByName, "Vali goes by no name")
}

func TestAPaymentInDollars(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	card := addAccount(t, pool, olma.company, "Karta", 2, true)
	turnOn(t, pool, olma.company, 2)

	_, err = s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: card, Amount: ptr("10"), At: on})
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "the dollar has no rate yet")
	standardRate(t, pool, olma.company, "12800", "2026-10-01 00:00+05")
	p, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: card, Amount: ptr("10"), At: on})
	require.NoError(t, err)
	assert.EqualValues(t, 2, p.CurrencyID)
	assert.Equal(t, "12800.0000", p.Rate, "the standard rate at the moment")
	assert.Equal(t, "10.00", p.Amount)
	assert.Equal(t, "128000.00", p.AmountUZS)
	own, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: card, Amount: ptr("10"), At: on, Rate: ptr("13000")})
	require.NoError(t, err)
	assert.Equal(t, "13000.0000", own.Rate, "the payment's own rate")
	assert.Equal(t, "130000.00", own.AmountUZS)
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "-258000.00", sup.Balance, "in so'm, each by its rate")
	assert.Equal(t, []BalanceLine{{CurrencyID: 2, Amount: "-20.00"}}, sup.BalanceByCurrency)
}

func TestListUpdateAndDeletePayments(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	dehqon, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("100"), At: "2026-10-01T09:00:00+05:00"})
	require.NoError(t, err)
	second, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("200"), At: "2026-10-05T09:00:00+05:00"})
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, ali, dehqon.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("300"), At: "2026-10-06T09:00:00+05:00"})
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

	standardRate(t, pool, olma.company, "12800", "2026-10-01 00:00+05")
	card := addAccount(t, pool, olma.company, "Karta", 2, true)
	saved, err := s.UpdatePayment(ctx, olma.company, ali, bozor.ID, first.ID, PaymentInput{BankAccountID: card, Amount: ptr("15"), At: "2026-10-02T09:00:00+05:00", Note: ptr("Karta")})
	require.NoError(t, err)
	assert.Equal(t, card, saved.BankAccountID, "another account")
	assert.Equal(t, "15.00", saved.Amount)
	assert.EqualValues(t, 2, saved.CurrencyID, "in its currency")
	assert.Equal(t, "12800.0000", saved.Rate)
	assert.Equal(t, "192000.00", saved.AmountUZS)
	assert.Equal(t, time.Date(2026, 10, 2, 4, 0, 0, 0, time.UTC), saved.At)
	assert.Equal(t, ptr("Karta"), saved.Note)
	assert.True(t, saved.UpdatedAt.After(first.UpdatedAt))
	_, err = s.UpdatePayment(ctx, olma.company, ali, dehqon.ID, first.ID, PaymentInput{BankAccountID: olma.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "another supplier's payment")
	_, err = s.UpdatePayment(ctx, olma.company, ali, bozor.ID, first.ID, PaymentInput{BankAccountID: olma.cash, At: on})
	refused(t, err, apperr.Invalid, "validation_error", "Summani kiriting")
	_, err = s.UpdatePayment(ctx, olma.company, ali, bozor.ID, 999999, PaymentInput{At: "x"})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "the payment comes before the input")
	_, err = pool.Exec(ctx, "UPDATE bank_accounts SET is_active = false WHERE id = $1", card)
	require.NoError(t, err)
	_, err = s.UpdatePayment(ctx, olma.company, ali, bozor.ID, first.ID, PaymentInput{BankAccountID: card, Amount: ptr("16"), At: on})
	assert.NoError(t, err, "the account the payment already names is kept, inactive and all")
	_, err = s.UpdatePayment(ctx, olma.company, ali, bozor.ID, second.ID, PaymentInput{BankAccountID: card, Amount: ptr("16"), At: on})
	refused(t, err, apperr.Invalid, "validation_error", "Akkaunt nofaol", "new to this payment")

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
