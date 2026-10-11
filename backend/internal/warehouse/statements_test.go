package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

func TestSupplierStatement(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01 00:00+05")
	card := addAccount(t, pool, m.company, "Karta", 2, true)
	usd := ptr(int64(2))
	// The 1st: a purchase of 100 USD paid 10 USD with it. The 3rd: 500 000
	// so'm paid out of the cash. The 5th: 50 USD paid at 13 000, entered on
	// its own.
	purchase, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-01T10:00:00+05:00", CurrencyID: usd, Items: []ItemInput{line(m.olma, "2", "50")}, Payments: []ledger.PaymentLine{pay(card, "10")}})
	require.NoError(t, err)
	som, err := s.AddPayment(ctx, m.company, ali, m.bozor, PaymentInput{BankAccountID: m.cash, Amount: ptr("500000"), At: "2026-10-03T10:00:00+05:00"})
	require.NoError(t, err)
	own, err := s.AddPayment(ctx, m.company, vali, m.bozor, PaymentInput{BankAccountID: card, Amount: ptr("50"), At: "2026-10-05T10:00:00+05:00", Rate: ptr("13000"), Note: ptr("Qolgani")})
	require.NoError(t, err)
	gone, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-06T10:00:00+05:00", Items: []ItemInput{line(m.olma, "1", "999999")}})
	require.NoError(t, err)
	require.NoError(t, s.DeletePurchase(ctx, m.scope(), gone.ID))

	page, err := s.Statement(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 4, page.Total, "the live documents of the supplier")
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	require.Len(t, page.Items, 4)
	assert.Equal(t, StatementRow{
		ID: own.ID, Kind: "supplier_payment", Number: 3, At: time.Date(2026, 10, 5, 5, 0, 0, 0, time.UTC), Amount: "50.00", CurrencyID: 2,
		AmountUZS: "650000.00", DeltaUZS: "-650000.00", BalanceUZS: "2000.00", Note: ptr("Qolgani"),
	}, page.Items[0], "the newest first: 1 280 000 − 128 000 − 500 000 − 650 000")
	assert.Equal(t, som.ID, page.Items[1].ID)
	assert.Equal(t, "-500000.00", page.Items[1].DeltaUZS)
	assert.Equal(t, "652000.00", page.Items[1].BalanceUZS)
	assert.Equal(t, purchase.Payments[0].ID, page.Items[2].ID)
	assert.Equal(t, &purchase.ID, page.Items[2].LinkedID, "the payment entered with the purchase names it")
	assert.Equal(t, ptr(int32(1)), page.Items[2].LinkedNumber)
	assert.Equal(t, "-128000.00", page.Items[2].DeltaUZS)
	assert.Equal(t, "1152000.00", page.Items[2].BalanceUZS)
	assert.Equal(t, StatementRow{
		ID: purchase.ID, Kind: "purchase", Number: 1, At: time.Date(2026, 10, 1, 5, 0, 0, 0, time.UTC), Amount: "100.00", CurrencyID: 2,
		AmountUZS: "1280000.00", DeltaUZS: "1280000.00", BalanceUZS: "1280000.00", CreatedByName: ptr("Ali aka"),
	}, page.Items[3])
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "2000.00", sup.Balance, "what the statement ends on")

	_, err = s.Statement(ctx, m.company, 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
	_, err = s.Statement(ctx, m.company, m.bozor, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	page, err = s.Statement(ctx, m.company, m.bozor, 2)
	require.NoError(t, err)
	assert.Empty(t, page.Items, "past the last page")
}
