package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

func TestACustomersPayments(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	nok := newShop(t, pool, "Nok")
	stranger := addCustomer(t, pool, nok.company, "Begona", "998907777777", false)
	closed := addAccount(t, pool, m.company, "Yopiq", 1, false)
	sale, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{CustomerID: &m.karim, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{line(m.olma, "4", "3000")}, Payments: []ledger.PaymentLine{pay(m.cash, "5000")}})
	require.NoError(t, err)

	p, err := s.AddCustomerPayment(ctx, m.company, ali, m.karim, PaymentInput{BankAccountID: m.cash, Amount: ptr("1200.5"), At: on, Note: ptr(" Naqd ")})
	require.NoError(t, err)
	assert.Equal(t, m.karim, p.CustomerID)
	assert.Nil(t, p.SaleID, "entered on its own")
	assert.Nil(t, p.SaleNumber)
	assert.Equal(t, m.cash, p.BankAccountID)
	assert.Equal(t, "Naqd", p.AccountName)
	assert.Equal(t, "1200.50", p.Amount)
	assert.EqualValues(t, 1, p.CurrencyID)
	assert.Equal(t, "1.0000", p.Rate)
	assert.Equal(t, "1200.50", p.AmountUZS)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), p.At)
	assert.Equal(t, ptr("Naqd"), p.Note)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	for name, tc := range map[string]struct {
		in      PaymentInput
		message string
	}{
		"no account":          {PaymentInput{Amount: ptr("1"), At: on}, "Akkauntni tanlang"},
		"an inactive account": {PaymentInput{BankAccountID: closed, Amount: ptr("1"), At: on}, "Akkaunt nofaol"},
		"no amount":           {PaymentInput{BankAccountID: m.cash, At: on}, "Summani kiriting"},
		"zero":                {PaymentInput{BankAccountID: m.cash, Amount: ptr("0"), At: on}, "Summa noto'g'ri"},
		"no time":             {PaymentInput{BankAccountID: m.cash, Amount: ptr("1")}, "Vaqtni kiriting"},
	} {
		_, err := s.AddCustomerPayment(ctx, m.company, ali, m.karim, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddCustomerPayment(ctx, m.company, ali, stranger, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Mijoz topilmadi", "another company's customer")

	page, err := s.ListCustomerPayments(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	require.Len(t, page.Items, 2, "the one entered with the sale too")
	assert.Equal(t, p.ID, page.Items[0].ID, "the newest first")
	assert.Equal(t, &sale.ID, page.Items[1].SaleID)
	assert.Equal(t, ptr(int32(1)), page.Items[1].SaleNumber)
	assert.Equal(t, sale.At, page.Items[1].At, "at the sale's moment")
	_, err = s.ListCustomerPayments(ctx, m.company, stranger, 1)
	refused(t, err, apperr.NotFound, "not_found", "Mijoz topilmadi")

	saved, err := s.UpdateCustomerPayment(ctx, m.company, ali, m.karim, p.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1500"), At: "2026-10-08T09:00:00+05:00", Note: ptr("Aniq")})
	require.NoError(t, err)
	assert.Equal(t, "1500.00", saved.Amount)
	assert.Equal(t, time.Date(2026, 10, 8, 4, 0, 0, 0, time.UTC), saved.At)
	assert.Equal(t, ptr("Aniq"), saved.Note)
	_, err = s.UpdateCustomerPayment(ctx, m.company, ali, m.karim, page.Items[1].ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang")
	err = s.DeleteCustomerPayment(ctx, m.company, m.karim, page.Items[1].ID)
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang")
	_, err = s.UpdateCustomerPayment(ctx, m.company, ali, m.karim, 999999, PaymentInput{})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "the record before its fields")
	require.NoError(t, s.DeleteCustomerPayment(ctx, m.company, m.karim, p.ID))
	err = s.DeleteCustomerPayment(ctx, m.company, m.karim, p.ID)
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "deleted already")
}

func TestACustomersOpeningBalancesAndStatement(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01 00:00+05")

	debt, err := s.AddCustomerOpening(ctx, m.company, ali, m.karim, OpeningInput{Kind: "debt", Amount: ptr("300000"), At: "2026-10-01T09:00:00+05:00", Note: ptr(" Eski qarz ")})
	require.NoError(t, err)
	assert.Equal(t, "debt", debt.Kind)
	assert.Equal(t, m.karim, debt.CustomerID)
	assert.Equal(t, "300000.00", debt.Amount)
	assert.EqualValues(t, 1, debt.CurrencyID)
	assert.Equal(t, "300000.00", debt.AmountUZS)
	assert.Equal(t, ptr("Eski qarz"), debt.Note)
	prepay, err := s.AddCustomerOpening(ctx, m.company, ali, m.karim, OpeningInput{Kind: "prepay", Amount: ptr("10"), CurrencyID: ptr(int64(2)), At: "2026-10-02T09:00:00+05:00"})
	require.NoError(t, err)
	assert.Equal(t, "prepay", prepay.Kind)
	assert.Equal(t, "12800.0000", prepay.Rate)
	assert.Equal(t, "128000.00", prepay.AmountUZS)
	sale, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{CustomerID: &m.karim, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{line(m.olma, "4", "3000")}, Payments: []ledger.PaymentLine{pay(m.cash, "5000")}})
	require.NoError(t, err)
	_, err = s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{At: "2026-10-06T09:00:00+05:00", Items: []ItemInput{line(m.nok, "1", "2000")}, Payments: []ledger.PaymentLine{pay(m.cash, "2000")}})
	require.NoError(t, err, "a retail sale is nobody's")
	for name, tc := range map[string]struct {
		in      OpeningInput
		message string
	}{
		"no kind":      {OpeningInput{Amount: ptr("1"), At: on}, "Turni tanlang"},
		"a bad kind":   {OpeningInput{Kind: "loan", Amount: ptr("1"), At: on}, "Tur noto'g'ri"},
		"no amount":    {OpeningInput{Kind: "debt", At: on}, "Summani kiriting"},
		"a bad amount": {OpeningInput{Kind: "debt", Amount: ptr("0"), At: on}, "Summa noto'g'ri"},
		"no time":      {OpeningInput{Kind: "debt", Amount: ptr("1")}, "Vaqtni kiriting"},
	} {
		_, err := s.AddCustomerOpening(ctx, m.company, ali, m.karim, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddCustomerOpening(ctx, m.company, ali, 999999, OpeningInput{Kind: "debt", Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Mijoz topilmadi")

	page, err := s.ListCustomerOpenings(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	assert.Equal(t, []int64{prepay.ID, debt.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first")
	statement, err := s.CustomerStatement(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	require.Len(t, statement.Items, 4, "the sale, its payment, the advance and the debt; not the retail sale")
	assert.Equal(t, []string{"customer_payment", "sale", "customer_prepay", "customer_debt"}, []string{statement.Items[0].Kind, statement.Items[1].Kind, statement.Items[2].Kind, statement.Items[3].Kind})
	assert.Equal(t, "-5000.00", statement.Items[0].DeltaUZS)
	assert.Equal(t, "179000.00", statement.Items[0].BalanceUZS, "300 000 − 128 000 + 12 000 − 5 000")
	assert.Equal(t, &sale.ID, statement.Items[0].LinkedID)
	assert.Equal(t, ptr(int32(1)), statement.Items[0].LinkedNumber)
	assert.Equal(t, ptr("Naqd"), statement.Items[0].AccountName)
	assert.Equal(t, "12000.00", statement.Items[1].DeltaUZS, "a sale adds")
	_, err = s.CustomerStatement(ctx, m.company, 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Mijoz topilmadi")

	saved, err := s.UpdateCustomerOpening(ctx, m.company, ali, m.karim, debt.ID, OpeningInput{Kind: "debt", Amount: ptr("1500"), At: "2026-10-08T09:00:00+05:00", Note: ptr("Aniq")})
	require.NoError(t, err)
	assert.Equal(t, "1500.00", saved.Amount)
	_, err = s.UpdateCustomerOpening(ctx, m.company, ali, m.karim, debt.ID, OpeningInput{Kind: "prepay", Amount: ptr("1"), At: on})
	refused(t, err, apperr.Invalid, "validation_error", "Tur o'zgartirilmaydi")
	_, err = s.UpdateCustomerOpening(ctx, m.company, ali, m.karim, 999999, OpeningInput{})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi")
	require.NoError(t, s.DeleteCustomerOpening(ctx, m.company, m.karim, prepay.ID))
	err = s.DeleteCustomerOpening(ctx, m.company, m.karim, prepay.ID)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted already")
}
