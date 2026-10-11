package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// The supplier's balance is told in so'm by each document's own rate row
// and, apart, in each currency; the statement walks the documents in time
// with what was owed after each.
func TestSupplierBalanceByCurrencyAndStatement(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	early := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	late := standardRate(t, pool, w.company, "13000", "2026-10-04 00:00+05")
	cash := cashOf(t, pool, w.company)
	var card int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 2) RETURNING id", w.company).Scan(&card))
	// The 1st: a purchase of 100 USD at 12 800.
	purchase := addDocument(t, pool, w.company, doc{kind: "purchase", number: 1, at: "2026-10-01 10:00+05", location: &w.asosiy, supplier: &w.bozor, currency: 2, rate: early})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, 2, 50, 1)", purchase, w.olma)
	_, err := q.SetTransactionTotal(ctx, purchase)
	require.NoError(t, err)
	// The 2nd: an opening debt of 1 000 000 so'm. The 3rd: 500 000 so'm paid
	// out of the cash. The 5th: 100 USD paid out of the card at 13 000, with
	// the purchase.
	debt := addDocument(t, pool, w.company, doc{kind: "supplier_debt", number: 1, at: "2026-10-02 10:00+05", supplier: &w.bozor, total: "1000000"})
	som := addDocument(t, pool, w.company, doc{kind: "supplier_payment", number: 1, at: "2026-10-03 10:00+05", supplier: &w.bozor, account: &cash, total: "500000"})
	usd := addDocument(t, pool, w.company, doc{kind: "supplier_payment", number: 2, at: "2026-10-05 10:00+05", supplier: &w.bozor, account: &card, linked: &purchase, currency: 2, rate: late, total: "100"})
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "999999", true)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	addPayment(t, pool, w.company, dehqon, nil, "5", false)

	by, err := q.ListSupplierBalanceByCurrency(ctx, w.bozor)
	require.NoError(t, err)
	require.Len(t, by, 1, "the dollars come to 0 and are left out")
	assert.EqualValues(t, 1, by[0].CurrencyID)
	assert.Equal(t, "500000.00", numericText(t, by[0].Amount), "1 000 000 owed less 500 000 paid")

	rows, err := q.ListSupplierStatement(ctx, gen.ListSupplierStatementParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 4, "the live documents of the supplier alone")
	assert.Equal(t, []int64{usd, som, debt, purchase}, []int64{rows[0].ID, rows[1].ID, rows[2].ID, rows[3].ID}, "the newest first")
	assert.Equal(t, "supplier_payment", rows[0].Kind)
	assert.EqualValues(t, 2, rows[0].Number)
	assert.Equal(t, "100.00", numericText(t, rows[0].Amount))
	assert.EqualValues(t, 2, rows[0].CurrencyID)
	assert.Equal(t, "1300000.00", numericText(t, rows[0].AmountUzs), "by its own rate row")
	assert.Equal(t, "-1300000.00", numericText(t, rows[0].DeltaUzs), "a payment takes away")
	assert.Equal(t, "480000.00", numericText(t, rows[0].BalanceUzs), "1 280 000 + 1 000 000 − 500 000 − 1 300 000: the rate difference stays")
	assert.Equal(t, &purchase, rows[0].LinkedID)
	assert.Equal(t, ptr(int32(1)), rows[0].LinkedNumber, "the purchase it was entered with")
	assert.Equal(t, "-500000.00", numericText(t, rows[1].DeltaUzs))
	assert.Equal(t, "1780000.00", numericText(t, rows[1].BalanceUzs))
	assert.Equal(t, "supplier_debt", rows[2].Kind)
	assert.Equal(t, "1000000.00", numericText(t, rows[2].DeltaUzs), "an opening debt adds")
	assert.Equal(t, "2280000.00", numericText(t, rows[2].BalanceUzs))
	assert.Equal(t, "purchase", rows[3].Kind)
	assert.Equal(t, "100.00", numericText(t, rows[3].Amount))
	assert.Equal(t, "1280000.00", numericText(t, rows[3].AmountUzs))
	assert.Equal(t, "1280000.00", numericText(t, rows[3].BalanceUzs), "what was owed after the first document")
	assert.Nil(t, rows[3].LinkedID)
	assert.Equal(t, ptr("Ali aka"), rows[3].CreatedByName)
	count, err := q.CountSupplierStatement(ctx, gen.CountSupplierStatementParams{SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 4, count)
	rows, err = q.ListSupplierStatement(ctx, gen.ListSupplierStatementParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 2, Offset: 2})
	require.NoError(t, err)
	require.Len(t, rows, 2, "paged")
	assert.Equal(t, debt, rows[0].ID)
	assert.Equal(t, "2280000.00", numericText(t, rows[0].BalanceUzs), "the balance is of the whole, not the page")

	s, err := q.GetSupplier(ctx, gen.GetSupplierParams{ID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "1280000.00", numericText(t, s.PurchasesTotal), "the purchases in so'm")
	assert.Equal(t, "1800000.00", numericText(t, s.PaymentsTotal), "the payments in so'm")
	assert.Equal(t, "480000.00", numericText(t, s.Balance), "with the opening debt")
}
