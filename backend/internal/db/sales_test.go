package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// addNamedCustomer enters a customer of a type whose first text field is
// the name: how the sales name their customer.
func addNamedCustomer(t *testing.T, q *gen.Queries, companyID int64, name, phone string) int64 {
	t.Helper()
	jismoniy := createType(t, q, companyID, "Jismoniy")
	fish := addField(t, q, companyID, jismoniy.ID, "F.I.Sh.", "string", nil)
	c := createCustomer(t, q, companyID, jismoniy.ID, phone)
	answer(t, q, c.ID, fish.ID, name)
	return c.ID
}

// addSale enters a sale in the location with one line of the product, its
// total set, its line moved out of the stock unless deleted; customerID nil
// is a retail sale.
func addSale(t *testing.T, pool *pgxpool.Pool, companyID, locationID int64, customerID *int64, productID int64, number int32, at, quantity, price string, deleted bool) int64 {
	t.Helper()
	id := addDocument(t, pool, companyID, doc{kind: "sale", number: number, at: at, location: &locationID, customer: customerID, deleted: deleted})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", id, productID, quantity, price)
	mustExec(t, pool, "UPDATE transactions SET total = (SELECT sum(quantity * price) FROM transaction_items WHERE transaction_id = $1) WHERE id = $1", id)
	if !deleted {
		mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, -$5::numeric)", id, companyID, locationID, productID, quantity)
	}
	return id
}

func TestSalesAreReadWithTheirCustomerAndWhatWasPaid(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	ali := addNamedCustomer(t, q, w.company, "Ali Karimov", "998901234567")
	cash := cashOf(t, pool, w.company)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "20", "1000", false)
	// Ali bought 2 Olma at 5 000 on the 5th and paid 4 000 with it; a retail
	// sale of 1 Olma on the 6th, paid in full; a deleted sale; a sale in Chilonzor.
	sale := addSale(t, pool, w.company, w.asosiy, &ali, w.olma, 1, "2026-10-05 10:00+05", "2", "5000", false)
	addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &ali, account: &cash, linked: &sale, total: "4000"})
	retail := addSale(t, pool, w.company, w.asosiy, nil, w.olma, 2, "2026-10-06 10:00+05", "1", "5000", false)
	addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-06 10:00+05", account: &cash, linked: &retail, total: "5000"})
	addSale(t, pool, w.company, w.asosiy, &ali, w.olma, 3, "2026-10-07 10:00+05", "1", "5000", true)
	elsewhere := addSale(t, pool, w.company, w.chilonzor, &ali, w.olma, 4, "2026-10-08 10:00+05", "1", "5000", false)

	got, err := q.GetSale(ctx, gen.GetSaleParams{ID: sale, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, got.Number)
	assert.Equal(t, "Asosiy", got.LocationName)
	assert.Equal(t, &ali, got.CustomerID)
	assert.Equal(t, ptr("Ali Karimov"), got.CustomerName, "the first text answer of the customer's type")
	assert.Equal(t, ptr("998901234567"), got.CustomerPhone)
	assert.Equal(t, "10000.00", numericText(t, got.Total))
	assert.Equal(t, "10000.00", numericText(t, got.TotalUzs))
	assert.Equal(t, "4000.00", numericText(t, got.Paid), "the payment entered with it")
	assert.EqualValues(t, 1, got.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	shop, err := q.GetSale(ctx, gen.GetSaleParams{ID: retail, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.Nil(t, shop.CustomerID, "a retail sale")
	assert.Nil(t, shop.CustomerName)
	assert.Equal(t, "5000.00", numericText(t, shop.Paid))
	_, err = q.GetSale(ctx, gen.GetSaleParams{ID: elsewhere, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a location outside the scope")

	rows, err := q.ListSales(ctx, gen.ListSalesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy, w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{elsewhere, retail, sale}, []int64{rows[0].ID, rows[1].ID, rows[2].ID}, "the newest first, the deleted left out")
	count, err := q.CountSales(ctx, gen.CountSalesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy, w.chilonzor}, CustomerID: &ali})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count, "the customer's live sales")
	rows, err = q.ListSales(ctx, gen.ListSalesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}, CustomerID: &ali, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, sale, rows[0].ID)
}

func TestACustomersPaymentsOpeningsAndDocumentsAreCounted(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	ali := addNamedCustomer(t, q, w.company, "Ali Karimov", "998901234567")
	cash := cashOf(t, pool, w.company)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "20", "1000", false)
	sale := addSale(t, pool, w.company, w.asosiy, &ali, w.olma, 1, "2026-10-05 10:00+05", "2", "5000", false)
	withSale := addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &ali, account: &cash, linked: &sale, total: "4000"})
	own := addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-06 10:00+05", customer: &ali, account: &cash, total: "1000"})
	addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 3, at: "2026-10-07 10:00+05", customer: &ali, account: &cash, total: "1", deleted: true})
	debt := addDocument(t, pool, w.company, doc{kind: "customer_debt", number: 1, at: "2026-10-01 10:00+05", customer: &ali, total: "300000"})
	prepay := addDocument(t, pool, w.company, doc{kind: "customer_prepay", number: 1, at: "2026-10-02 10:00+05", customer: &ali, total: "50000"})
	retail := addSale(t, pool, w.company, w.asosiy, nil, w.olma, 2, "2026-10-06 10:00+05", "1", "5000", false)
	addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 4, at: "2026-10-06 10:00+05", account: &cash, linked: &retail, total: "5000"})

	p, err := q.GetCustomerPayment(ctx, gen.GetCustomerPaymentParams{ID: withSale, CustomerID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, &sale, p.SaleID)
	assert.Equal(t, ptr(int32(1)), p.SaleNumber, "the sale it was entered with")
	assert.Equal(t, "Naqd", p.AccountName)
	assert.Equal(t, "4000.00", numericText(t, p.Amount))
	assert.Equal(t, "4000.00", numericText(t, p.AmountUzs))
	rows, err := q.ListCustomerPayments(ctx, gen.ListCustomerPaymentsParams{CustomerID: ali, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{own, withSale}, []int64{rows[0].ID, rows[1].ID}, "the newest first, the deleted and the retail left out")
	assert.Nil(t, rows[0].SaleID)
	count, err := q.CountCustomerPayments(ctx, gen.CountCustomerPaymentsParams{CustomerID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)

	o, err := q.GetCustomerOpening(ctx, gen.GetCustomerOpeningParams{ID: debt, CustomerID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "customer_debt", o.Kind)
	assert.Equal(t, "300000.00", numericText(t, o.Amount))
	openings, err := q.ListCustomerOpenings(ctx, gen.ListCustomerOpeningsParams{CustomerID: ali, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{prepay, debt}, []int64{openings[0].ID, openings[1].ID})
	n, err := q.CountCustomerOpenings(ctx, gen.CountCustomerOpeningsParams{CustomerID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, n)
	_, err = q.GetCustomerOpening(ctx, gen.GetCustomerOpeningParams{ID: own, CustomerID: ali, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a payment is no opening balance")

	docs, err := q.CountCustomerDocuments(ctx, ali)
	require.NoError(t, err)
	assert.EqualValues(t, 5, docs, "the sale, two payments, the debt and the advance; not the deleted, not the retail")
}

// The customer's balance is told in so'm by each document's own rate row,
// and apart in each currency; the statement walks the documents in time.
func TestACustomersBalanceAndStatement(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	ali := addNamedCustomer(t, q, w.company, "Ali Karimov", "998901234567")
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	cash := cashOf(t, pool, w.company)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "20", "1000", false)
	// The 1st: an opening debt of 100 000 so'm. The 5th: 2 Olma at 50 USD,
	// 40 USD paid with it. The 6th: 100 000 so'm paid on its own.
	debt := addDocument(t, pool, w.company, doc{kind: "customer_debt", number: 1, at: "2026-10-01 10:00+05", customer: &ali, total: "100000"})
	sale := addDocument(t, pool, w.company, doc{kind: "sale", number: 1, at: "2026-10-05 10:00+05", location: &w.asosiy, customer: &ali, currency: 2, rate: rate})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, 2, 50, 1)", sale, w.olma)
	_, err := q.SetTransactionTotal(ctx, sale)
	require.NoError(t, err)
	var card int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 2) RETURNING id", w.company).Scan(&card))
	usd := addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &ali, account: &card, linked: &sale, currency: 2, rate: rate, total: "40"})
	som := addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-06 10:00+05", customer: &ali, account: &cash, total: "100000"})
	retail := addSale(t, pool, w.company, w.asosiy, nil, w.olma, 2, "2026-10-06 10:00+05", "1", "5000", false)
	addDocument(t, pool, w.company, doc{kind: "customer_payment", number: 3, at: "2026-10-06 10:00+05", account: &cash, linked: &retail, total: "5000"})

	c, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "768000.00", numericText(t, c.Balance), "100 000 + 1 280 000 − 512 000 − 100 000")
	by, err := q.ListPartyBalanceByCurrency(ctx, gen.ListPartyBalanceByCurrencyParams{Party: "customer", PartyID: ali})
	require.NoError(t, err)
	require.Len(t, by, 1, "the so'm come to 0 (100 000 owed, 100 000 paid) and are left out")
	assert.EqualValues(t, 2, by[0].CurrencyID)
	assert.Equal(t, "60.00", numericText(t, by[0].Amount), "100 USD sold less 40 paid")

	rows, err := q.ListPartyStatement(ctx, gen.ListPartyStatementParams{Party: "customer", PartyID: ali, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 4, "the customer's live documents alone: the retail sale and its payment are nobody's")
	assert.Equal(t, []int64{som, usd, sale, debt}, []int64{rows[0].ID, rows[1].ID, rows[2].ID, rows[3].ID}, "the newest first")
	assert.Equal(t, "-100000.00", numericText(t, rows[0].DeltaUzs), "a payment takes away")
	assert.Equal(t, "768000.00", numericText(t, rows[0].BalanceUzs))
	assert.Equal(t, "customer_payment", rows[1].Kind)
	assert.Equal(t, &sale, rows[1].LinkedID)
	assert.Equal(t, ptr(int32(1)), rows[1].LinkedNumber, "the sale it was entered with")
	assert.Equal(t, ptr("Karta"), rows[1].AccountName)
	assert.Equal(t, "sale", rows[2].Kind)
	assert.Equal(t, "1280000.00", numericText(t, rows[2].DeltaUzs), "a sale adds")
	assert.Equal(t, "1380000.00", numericText(t, rows[2].BalanceUzs))
	assert.Equal(t, "customer_debt", rows[3].Kind)
	count, err := q.CountPartyStatement(ctx, gen.CountPartyStatementParams{Party: "customer", PartyID: ali, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 4, count)
	list, err := q.ListCustomers(ctx, gen.ListCustomersParams{CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "768000.00", numericText(t, list[0].Balance), "the list carries the balance too")
}
