package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// warehouse is a company with a member, two locations, a supplier and two
// products: what the document queries need.
type warehouse struct {
	company, asosiy, chilonzor, bozor, olma, nok int64
}

func newWarehouse(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) warehouse {
	t.Helper()
	company := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', 'Ali aka')", enteredBy, company.ID)
	return warehouse{
		company:   company.ID,
		asosiy:    addLocation(t, pool, company.ID, "Asosiy"),
		chilonzor: addLocation(t, pool, company.ID, "Chilonzor"),
		bozor:     createSupplier(t, q, company.ID, "Bozor").ID,
		olma:      createProduct(t, q, company.ID, "product", "Olma", ptr("kg")).ID,
		nok:       createProduct(t, q, company.ID, "product", "Nok", ptr("dona")).ID,
	}
}

// at is a moment as the queries take one.
func at(t *testing.T, s string) time.Time {
	t.Helper()
	m, err := time.Parse("2006-01-02 15:04-07", s)
	require.NoError(t, err)
	return m.UTC()
}

// zeroRateOf is the company's zero rate row (status 2, nothing in it),
// made on the first ask: what a document in so'm refers to in the tests.
func zeroRateOf(t *testing.T, pool *pgxpool.Pool, companyID int64) int64 {
	t.Helper()
	ctx := context.Background()
	var id int64
	err := pool.QueryRow(ctx, "SELECT id FROM currency_rates WHERE company_id = $1 AND status = 2 AND usd = 0 AND eur = 0 AND rub = 0 ORDER BY id LIMIT 1", companyID).Scan(&id)
	if err == nil {
		return id
	}
	require.ErrorIs(t, err, pgx.ErrNoRows)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, status, set_by) VALUES ($1, 2, $2) RETURNING id", companyID, enteredBy).Scan(&id))
	return id
}

// standardRate enters a standard rate row of the company (1 USD = usd so'm)
// set at the moment, and turns the dollar on for the company.
func standardRate(t *testing.T, pool *pgxpool.Pool, companyID int64, usd, setAt string) int64 {
	t.Helper()
	mustExec(t, pool, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 2) ON CONFLICT DO NOTHING", companyID)
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), "INSERT INTO currency_rates (company_id, usd, set_by, set_at) VALUES ($1, $2::numeric, $3, $4) RETURNING id", companyID, usd, enteredBy, at(t, setAt)).Scan(&id))
	return id
}

// cashOf is the company's cash account, made on the first ask.
func cashOf(t *testing.T, pool *pgxpool.Pool, companyID int64) int64 {
	t.Helper()
	ctx := context.Background()
	var id int64
	err := pool.QueryRow(ctx, "SELECT id FROM bank_accounts WHERE company_id = $1 AND deleted_at IS NULL ORDER BY (lower(name) = 'naqd') DESC, id LIMIT 1", companyID).Scan(&id)
	if err == nil {
		return id
	}
	require.ErrorIs(t, err, pgx.ErrNoRows)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", companyID).Scan(&id))
	return id
}

// doc is a document as a test enters it straight into the journal; what is
// left out takes the fixture's usual: 9:00 on 2026-10-07 in Tashkent, so'm
// by the company's zero row, an amount of 0.
type doc struct {
	kind       string
	number     int32
	at         string
	location   *int64
	toLocation *int64
	supplier   *int64
	customer   *int64
	account    *int64
	toAccount  *int64
	category   *int64
	linked     *int64
	currency   int64
	rate       int64
	total      string
	toTotal    string
	deleted    bool
}

func addDocument(t *testing.T, pool *pgxpool.Pool, companyID int64, d doc) int64 {
	t.Helper()
	if d.at == "" {
		d.at = "2026-10-07 09:00+05"
	}
	if d.currency == 0 {
		d.currency = 1
	}
	if d.rate == 0 {
		d.rate = zeroRateOf(t, pool, companyID)
	}
	if d.total == "" {
		d.total = "0"
	}
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, to_location_id, supplier_id, customer_id, bank_account_id, to_bank_account_id, category_id, linked_id,
			currency_id, currency_rate_id, total, to_total, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::numeric, NULLIF($16, '')::numeric, $17, CASE WHEN $18 THEN now() END) RETURNING id`,
		companyID, d.kind, d.number, at(t, d.at), d.location, d.toLocation, d.supplier, d.customer, d.account, d.toAccount, d.category, d.linked, d.currency, d.rate, d.total, d.toTotal, enteredBy, d.deleted).Scan(&id))
	return id
}

// addPurchase enters a purchase of the supplier in the location with one
// line, its total set, its line moved into the stock unless deleted.
func addPurchase(t *testing.T, pool *pgxpool.Pool, companyID, locationID, supplierID, productID int64, number int32, quantity, price string, deleted bool) int64 {
	t.Helper()
	id := addDocument(t, pool, companyID, doc{kind: "purchase", number: number, location: &locationID, supplier: &supplierID, deleted: deleted})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", id, productID, quantity, price)
	mustExec(t, pool, "UPDATE transactions SET total = (SELECT sum(quantity * price) FROM transaction_items WHERE transaction_id = $1) WHERE id = $1", id)
	if !deleted {
		mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5::numeric)", id, companyID, locationID, productID, quantity)
	}
	return id
}

// addPayment enters a payment to the supplier out of the company's cash,
// linked to purchaseID when given, numbered after the ones there.
func addPayment(t *testing.T, pool *pgxpool.Pool, companyID, supplierID int64, purchaseID *int64, amount string, deleted bool) int64 {
	t.Helper()
	var number int32
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = 'supplier_payment'", companyID).Scan(&number))
	cash := cashOf(t, pool, companyID)
	return addDocument(t, pool, companyID, doc{kind: "supplier_payment", number: number, supplier: &supplierID, account: &cash, linked: purchaseID, total: amount, deleted: deleted})
}

func TestNextNumberCountsTheCompanysDocumentsOfTheKindDeletedOnesToo(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	nok := createCompany(t, q, "Nok", today(t, pool))

	n, err := q.NextNumber(ctx, gen.NextNumberParams{CompanyID: w.company, Kind: "purchase"})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "the first")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	n, err = q.NextNumber(ctx, gen.NextNumberParams{CompanyID: w.company, Kind: "purchase"})
	require.NoError(t, err)
	assert.EqualValues(t, 3, n, "a deleted document keeps its number")
	n, err = q.NextNumber(ctx, gen.NextNumberParams{CompanyID: w.company, Kind: "supplier_payment"})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "each kind counts its own")
	n, err = q.NextNumber(ctx, gen.NextNumberParams{CompanyID: nok.ID, Kind: "purchase"})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "another company counts its own")
}

func TestCreateAndGetPurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	rate := zeroRateOf(t, pool, w.company)

	p, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
		CompanyID: w.company, Kind: "purchase", Number: 7, DocAt: at(t, "2026-10-07 09:30+05"), LocationID: &w.asosiy, SupplierID: &w.bozor,
		CurrencyID: 1, CurrencyRateID: rate, Total: numeric(t, "0"), Note: ptr("Ertalab"), CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	assert.EqualValues(t, 7, p.Number)
	assert.Equal(t, "0", numericText(t, p.Total), "no lines yet")

	require.NoError(t, q.AddTransactionItem(ctx, gen.AddTransactionItemParams{TransactionID: p.ID, ProductID: w.olma, Quantity: numeric(t, "12.5"), Price: numeric(t, "1000"), Position: 1}))
	require.NoError(t, q.AddTransactionItem(ctx, gen.AddTransactionItemParams{TransactionID: p.ID, ProductID: w.nok, Quantity: numeric(t, "3"), Price: numeric(t, "2500.5"), Position: 2}))
	total, err := q.SetTransactionTotal(ctx, p.ID)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", numericText(t, total), "12.5 × 1000 + 3 × 2500.5")

	got, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	assert.EqualValues(t, 7, got.Number)
	assert.Equal(t, w.asosiy, got.LocationID)
	assert.Equal(t, "Asosiy", got.LocationName)
	assert.Equal(t, w.bozor, got.SupplierID)
	assert.Equal(t, "Bozor", got.SupplierName)
	assert.Equal(t, at(t, "2026-10-07 09:30+05"), got.DocAt.UTC())
	assert.Equal(t, ptr("Ertalab"), got.Note)
	assert.EqualValues(t, 1, got.CurrencyID)
	assert.Equal(t, "1.0000", numericText(t, got.Rate), "so'm to so'm")
	assert.Equal(t, "20001.50", numericText(t, got.Total))
	assert.Equal(t, "20001.50", numericText(t, got.TotalUzs))
	assert.Equal(t, "0", numericText(t, got.Paid), "nothing paid")
	assert.EqualValues(t, 2, got.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)

	addPayment(t, pool, w.company, w.bozor, &p.ID, "5000", false)
	addPayment(t, pool, w.company, w.bozor, &p.ID, "1000", false)
	addPayment(t, pool, w.company, w.bozor, &p.ID, "99", true)
	got, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, "6000.00", numericText(t, got.Paid), "the live payments entered with it")

	items, err := q.ListTransactionItems(ctx, p.ID)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "Olma", items[0].Name, "in the order entered")
	assert.Equal(t, ptr("kg"), items[0].Unit)
	assert.Equal(t, "12.500", numericText(t, items[0].Quantity))
	assert.Equal(t, "1000.00", numericText(t, items[0].Price))
	assert.Equal(t, "12500.00", numericText(t, items[0].Amount))
	assert.Equal(t, "7501.50", numericText(t, items[1].Amount))
	assert.False(t, items[0].Expected.Valid, "no stock expected: not an inventory")

	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.chilonzor}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "outside the member's locations")
	nok := createCompany(t, q, "Nok", today(t, pool))
	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: nok.ID, LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")
	payment := addPayment(t, pool, w.company, w.bozor, nil, "1", false)
	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: payment, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a payment is no purchase")
}

func TestAPurchaseInDollarsIsToldInSomByItsRateRow(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	usd := int64(2)
	p := addDocument(t, pool, w.company, doc{kind: "purchase", number: 1, location: &w.asosiy, supplier: &w.bozor, currency: usd, rate: rate})
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, 2, 50, 1)", p, w.olma)
	_, err := q.SetTransactionTotal(ctx, p)
	require.NoError(t, err)
	// Paid in so'm out of the cash (its own rate row: the same standard one).
	cash := cashOf(t, pool, w.company)
	addDocument(t, pool, w.company, doc{kind: "supplier_payment", number: 1, supplier: &w.bozor, account: &cash, linked: &p, rate: rate, total: "640000"})

	got, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, got.CurrencyID)
	assert.Equal(t, "12800.0000", numericText(t, got.Rate), "1 USD in so'm")
	assert.Equal(t, "100.00", numericText(t, got.Total), "in dollars")
	assert.Equal(t, "1280000.00", numericText(t, got.TotalUzs), "in so'm by the rate row")
	assert.Equal(t, "50.00", numericText(t, got.Paid), "640 000 so'm is 50 dollars at 12 800")
}

func TestListPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", one, at(t, "2026-10-01 09:00+05"))
	two := addPurchase(t, pool, w.company, w.chilonzor, dehqon, w.olma, 2, "1", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", two, at(t, "2026-10-05 09:00+05"))
	three := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "1", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", three, at(t, "2026-10-05 09:00+05"))
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", true)
	addPayment(t, pool, w.company, w.bozor, nil, "1", false)
	numbers := func(params gen.ListPurchasesParams) []int32 {
		rows, err := q.ListPurchases(ctx, params)
		require.NoError(t, err)
		out := make([]int32, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Number)
		}
		return out
	}
	all := []int64{w.asosiy, w.chilonzor}

	assert.Equal(t, []int32{3, 2, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 20}), "the newest first, then the later entered; the deleted and the payments left out")
	assert.Equal(t, []int32{3, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}, Limit: 20}), "one location")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, SupplierID: &dehqon, Limit: 20}), "one supplier")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 1, Offset: 1}), "paged")
	assert.Empty(t, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{}, Limit: 20}), "a member with no location sees none")
	count, err := q.CountPurchases(ctx, gen.CountPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
}

func TestUpdateAndDeleteTransaction(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	id := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")

	p, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: w.company, DocAt: at(t, "2026-10-09 18:00+05"), SupplierID: &dehqon, CurrencyID: 2, CurrencyRateID: rate, Note: ptr("Kechga")})
	require.NoError(t, err)
	assert.Equal(t, &dehqon, p.SupplierID)
	assert.Equal(t, at(t, "2026-10-09 18:00+05"), p.DocAt.UTC())
	assert.EqualValues(t, 2, p.CurrencyID)
	assert.Equal(t, rate, p.CurrencyRateID)
	assert.Equal(t, ptr("Kechga"), p.Note)
	assert.EqualValues(t, 1, p.Number, "the number stays")
	assert.Equal(t, &w.asosiy, p.LocationID, "the location stays")
	assert.Equal(t, "1.00", numericText(t, p.Total), "the total stays until the lines are written")

	require.NoError(t, q.DeleteTransactionItems(ctx, id))
	items, err := q.ListTransactionItems(ctx, id)
	require.NoError(t, err)
	assert.Empty(t, items)
	total, err := q.SetTransactionTotal(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "0", numericText(t, total), "no lines, no total")
	require.NoError(t, q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: id, Total: numeric(t, "70")}))
	got, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "70.00", numericText(t, got.Total), "a money document's amount is set apart")
	assert.False(t, got.ToTotal.Valid)

	_, err = q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: w.company})
	require.NoError(t, err)
	_, err = q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "hidden")
	_, err = q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: w.company, DocAt: at(t, "2026-10-09 18:00+05"), SupplierID: &dehqon, CurrencyID: 1, CurrencyRateID: rate})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted document is not edited")
}

func TestThePaymentsEnteredWithAPurchaseAreListedAndHiddenTogether(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	cash := cashOf(t, pool, w.company)
	var card int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id, is_active) VALUES ($1, 'Karta', 1, false) RETURNING id", w.company).Scan(&card))
	first := addPayment(t, pool, w.company, w.bozor, &purchase, "5000", false)
	second := addDocument(t, pool, w.company, doc{kind: "supplier_payment", number: 2, supplier: &w.bozor, account: &card, linked: &purchase, total: "1000"})
	addPayment(t, pool, w.company, w.bozor, &purchase, "7", true)
	own := addPayment(t, pool, w.company, w.bozor, nil, "300", false)

	rows, err := q.ListLinkedPayments(ctx, purchase)
	require.NoError(t, err)
	require.Len(t, rows, 2, "the live ones entered with it")
	assert.Equal(t, first, rows[0].ID, "in the order entered")
	assert.Equal(t, cash, rows[0].BankAccountID)
	assert.Equal(t, "Naqd", rows[0].AccountName)
	assert.True(t, rows[0].AccountActive)
	assert.Equal(t, "5000.00", numericText(t, rows[0].Amount))
	assert.EqualValues(t, 1, rows[0].CurrencyID)
	assert.Equal(t, second, rows[1].ID)
	assert.False(t, rows[1].AccountActive, "an account turned off since")

	require.NoError(t, q.HideLinkedPayments(ctx, purchase))
	rows, err = q.ListLinkedPayments(ctx, purchase)
	require.NoError(t, err)
	assert.Empty(t, rows)
	_, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own, SupplierID: w.bozor, CompanyID: w.company})
	assert.NoError(t, err, "a payment entered on its own stays")
	require.NoError(t, q.HideLinkedPayments(ctx, purchase), "nothing to hide is fine")
}

func TestGetAndListPayments(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", false)
	linked := addPayment(t, pool, w.company, w.bozor, &purchase, "5000", false)
	own := addPayment(t, pool, w.company, w.bozor, nil, "1200.5", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2, note = 'Naqd' WHERE id = $1", own, at(t, "2026-10-09 09:00+05"))
	addPayment(t, pool, w.company, w.bozor, nil, "1", true)
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	var card int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 2) RETURNING id", w.company).Scan(&card))
	dollars := addDocument(t, pool, w.company, doc{kind: "supplier_payment", number: 9, at: "2026-10-02 09:00+05", supplier: &w.bozor, account: &card, currency: 2, rate: rate, total: "10"})

	got, err := q.GetPayment(ctx, gen.GetPaymentParams{ID: linked, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, &purchase, got.PurchaseID)
	assert.Equal(t, ptr(int32(4)), got.PurchaseNumber, "the number of the purchase it was entered with")
	assert.Equal(t, w.bozor, got.SupplierID)
	assert.Equal(t, cashOf(t, pool, w.company), got.BankAccountID)
	assert.Equal(t, "Naqd", got.AccountName)
	assert.Equal(t, "5000.00", numericText(t, got.Amount))
	assert.EqualValues(t, 1, got.CurrencyID)
	assert.Equal(t, "1.0000", numericText(t, got.Rate))
	assert.Equal(t, "5000.00", numericText(t, got.AmountUzs))
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	got, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Nil(t, got.PurchaseID)
	assert.Nil(t, got.PurchaseNumber)
	assert.Equal(t, ptr("Naqd"), got.Note)
	got, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: dollars, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, got.CurrencyID, "the account's currency")
	assert.Equal(t, "12800.0000", numericText(t, got.Rate))
	assert.Equal(t, "10.00", numericText(t, got.Amount))
	assert.Equal(t, "128000.00", numericText(t, got.AmountUzs))
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	_, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own, SupplierID: dehqon, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another supplier's")
	_, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: purchase, SupplierID: w.bozor, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a purchase is no payment")

	rows, err := q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	assert.Equal(t, []int64{own, linked, dollars}, []int64{rows[0].ID, rows[1].ID, rows[2].ID}, "the newest first")
	count, err := q.CountPayments(ctx, gen.CountPaymentsParams{SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 3, count)
	rows, err = q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 1, Offset: 1})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, linked, rows[0].ID, "paged")
}

func TestTheDocumentsOfASupplierALocationAndAProductAreCounted(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.nok, 3, "1", "1", false)
	addPayment(t, pool, w.company, w.bozor, nil, "1", false)
	addPayment(t, pool, w.company, w.bozor, nil, "1", true)
	addDocument(t, pool, w.company, doc{kind: "transfer", number: 1, location: &w.chilonzor, toLocation: &w.asosiy})

	count, err := q.CountSupplierDocuments(ctx, w.bozor)
	require.NoError(t, err)
	assert.EqualValues(t, 3, count, "the live purchases and payments of the supplier")
	count, err = q.CountLocationDocuments(ctx, w.asosiy)
	require.NoError(t, err)
	assert.EqualValues(t, 2, count, "the live purchase in it and the transfer into it")
	count, err = q.CountProductDocuments(ctx, w.olma)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "the live documents holding the product, whatever the location")
	count, err = q.CountProductDocuments(ctx, createProduct(t, q, w.company, "product", "Anor", ptr("kg")).ID)
	require.NoError(t, err)
	assert.Zero(t, count)
}

func TestAProductsPurchaseLines(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", one, at(t, "2026-10-01 09:00+05"))
	two := addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 2, "2", "1200.5", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", two, at(t, "2026-10-05 09:00+05"))
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "9999", true)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.nok, 4, "1", "1", false)

	rows, err := q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.EqualValues(t, 2, rows[0].Number, "the newest first")
	assert.Equal(t, at(t, "2026-10-05 09:00+05"), rows[0].DocAt.UTC())
	assert.Equal(t, "Bozor", rows[0].SupplierName)
	assert.Equal(t, "Chilonzor", rows[0].LocationName)
	assert.EqualValues(t, 1, rows[0].CurrencyID)
	assert.Equal(t, "2.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, "1200.50", numericText(t, rows[0].Price))
	assert.Equal(t, "2401.00", numericText(t, rows[0].Amount))
	assert.EqualValues(t, 1, rows[1].Number)
	rows, err = q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1, "the member's locations alone")
	lines, err := q.CountProductPurchaseLines(ctx, gen.CountProductPurchaseLinesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, lines)
}
