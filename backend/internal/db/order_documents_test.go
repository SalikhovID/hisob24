package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// orderBooks is a warehouse with a named customer (Ali Karimov), the order
// settings and an order of Ali's in Asosiy: what the order document
// queries need (logic/orders.md, 4.3).
type orderBooks struct {
	w     warehouse
	ali   int64
	cash  int64
	stage gen.OrderStage
	typ   gen.OrderType
	order gen.Order
}

func newOrderBooks(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) orderBooks {
	t.Helper()
	b := orderBooks{w: newWarehouse(t, q, pool)}
	b.ali = addNamedCustomer(t, q, b.w.company, "Ali Karimov", "998901234567")
	b.cash = cashOf(t, pool, b.w.company)
	b.stage = createStage(t, q, b.w.company, "Yangi", "blue")
	b.typ = createOrderType(t, q, b.w.company, "Buyurtma")
	b.order = b.newOrder(t, q, "Montaj")
	return b
}

// newOrder enters an order of Ali's in Asosiy, in the first stage.
func (b orderBooks) newOrder(t *testing.T, q *gen.Queries, title string) gen.Order {
	t.Helper()
	order, err := q.CreateOrder(t.Context(), gen.CreateOrderParams{
		CompanyID: b.w.company, TypeID: b.typ.ID, StageID: b.stage.ID, CustomerID: b.ali, LocationID: b.w.asosiy,
		Title: title, Deadline: day("2026-10-20"), CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	return order
}

// document enters the order's document: its price (total) in the currency
// by the rate row, at the moment.
func (b orderBooks) document(t *testing.T, pool *pgxpool.Pool, orderID int64, number int32, at string, currency, rate int64, total string, deleted bool) int64 {
	t.Helper()
	return addDocument(t, pool, b.w.company, doc{kind: "order", number: number, at: at, location: &b.w.asosiy, customer: &b.ali, order: &orderID, currency: currency, rate: rate, total: total, deleted: deleted})
}

// An order is read with its document's money: its price in its currency
// and in so'm, what was paid for it by the payments linked to the
// document, each turned into the order's currency.
func TestAnOrderIsReadWithItsPriceAndWhatWasPaid(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newOrderBooks(t, q, pool)
	rate := standardRate(t, pool, b.w.company, "12800", "2026-10-01 00:00+05")
	scope := []int64{b.w.asosiy}

	got, err := q.GetOrder(ctx, gen.GetOrderParams{ID: b.order.ID, CompanyID: b.w.company, LocationIds: scope})
	require.NoError(t, err)
	assert.Equal(t, "0", numericText(t, got.Amount), "no document yet: no price")
	assert.EqualValues(t, 1, got.CurrencyID, "in so'm")
	assert.Equal(t, "1.0000", numericText(t, got.Rate))
	assert.Equal(t, "0", numericText(t, got.AmountUzs))
	assert.Equal(t, "0", numericText(t, got.Paid))
	assert.Zero(t, got.DocumentID)
	_, err = q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: b.order.ID, CompanyID: b.w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	// 5 000 USD at 12 800; 400 USD paid from the card with it, 1 280 000
	// so'm (100 USD by the rate) from the cash later; a payment deleted
	// since and a document of the order hidden since count for nothing.
	card := addAccountRow(t, pool, b.w.company, "Karta", 2, true)
	b.document(t, pool, b.order.ID, 1, "2026-10-04 10:00+05", 2, rate, "9", true)
	document := b.document(t, pool, b.order.ID, 2, "2026-10-05 10:00+05", 2, rate, "5000", false)
	advance := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &b.ali, account: &card, linked: &document, currency: 2, rate: rate, total: "400"})
	later := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-06 10:00+05", customer: &b.ali, account: &b.cash, linked: &document, rate: rate, total: "1280000"})
	addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 3, at: "2026-10-07 10:00+05", customer: &b.ali, account: &b.cash, linked: &document, rate: rate, total: "7", deleted: true})

	d, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: b.order.ID, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.Equal(t, document, d.ID, "the live document of the order")
	assert.EqualValues(t, 2, d.Number)
	assert.EqualValues(t, 2, d.CurrencyID)
	assert.Equal(t, rate, d.CurrencyRateID)
	assert.Equal(t, "12800.0000", numericText(t, d.Rate))
	assert.Equal(t, "5000.00", numericText(t, d.Total))
	assert.Equal(t, "64000000.00", numericText(t, d.TotalUzs))
	assert.Equal(t, "500.00", numericText(t, d.Paid), "400 USD and 1 280 000 so'm turned into dollars")
	assert.Equal(t, at(t, "2026-10-05 10:00+05"), d.DocAt.UTC())
	_, err = q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: b.order.ID, CompanyID: b.w.company + 1})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company")

	got, err = q.GetOrder(ctx, gen.GetOrderParams{ID: b.order.ID, CompanyID: b.w.company, LocationIds: scope})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", numericText(t, got.Amount))
	assert.EqualValues(t, 2, got.CurrencyID)
	assert.Equal(t, "12800.0000", numericText(t, got.Rate))
	assert.Equal(t, "64000000.00", numericText(t, got.AmountUzs))
	assert.Equal(t, "500.00", numericText(t, got.Paid))
	assert.Equal(t, document, got.DocumentID)
	rows, err := q.ListOrders(ctx, gen.ListOrdersParams{CompanyID: b.w.company, LocationIds: scope, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "5000.00", numericText(t, rows[0].Amount), "the list carries the money too")
	assert.Equal(t, "500.00", numericText(t, rows[0].Paid))
	active, err := q.ListActiveOrders(ctx, gen.ListActiveOrdersParams{CompanyID: b.w.company, LocationIds: scope, Limit: 5})
	require.NoError(t, err)
	require.Len(t, active, 1)
	assert.Equal(t, "5000.00", numericText(t, active[0].Amount), "so do the nearest deadlines")

	payments, err := q.ListOrderPayments(ctx, document)
	require.NoError(t, err)
	require.Len(t, payments, 2, "the live payments linked to the document")
	assert.Equal(t, []int64{later, advance}, []int64{payments[0].ID, payments[1].ID}, "the newest first")
	assert.Equal(t, "Naqd", payments[0].AccountName)
	assert.Equal(t, b.cash, payments[0].BankAccountID)
	assert.Equal(t, "1280000.00", numericText(t, payments[0].Amount))
	assert.EqualValues(t, 1, payments[0].CurrencyID)
	assert.Equal(t, "1.0000", numericText(t, payments[0].Rate))
	assert.Equal(t, "1280000.00", numericText(t, payments[0].AmountUzs))
	assert.Equal(t, &b.ali, payments[0].CustomerID)
	assert.Equal(t, at(t, "2026-10-06 10:00+05"), payments[0].DocAt.UTC())
	assert.Equal(t, ptr("Ali aka"), payments[0].CreatedByName)
	assert.Equal(t, "Karta", payments[1].AccountName)
	assert.Equal(t, "400.00", numericText(t, payments[1].Amount))
	assert.Equal(t, "5120000.00", numericText(t, payments[1].AmountUzs), "by its rate row")
	p, err := q.GetOrderPayment(ctx, gen.GetOrderPaymentParams{ID: advance, LinkedID: document})
	require.NoError(t, err)
	assert.Equal(t, "400.00", numericText(t, p.Amount))
	_, err = q.GetOrderPayment(ctx, gen.GetOrderPaymentParams{ID: advance, LinkedID: document + 1})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a payment linked to another document")

	other := b.newOrder(t, q, "Yetkazish")
	created, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
		CompanyID: b.w.company, Kind: "order", Number: 3, DocAt: at(t, "2026-10-08 10:00+05"), LocationID: &b.w.asosiy, CustomerID: &b.ali, OrderID: &other.ID,
		CurrencyID: 1, CurrencyRateID: rate, Total: numeric(t, "0"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	assert.Equal(t, &other.ID, created.OrderID, "a document entered with its order")
}

// A customer's payment names the order it was entered for, as one entered
// with a sale names the sale.
func TestACustomersPaymentNamesTheOrderItWasEnteredFor(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newOrderBooks(t, q, pool)
	document := b.document(t, pool, b.order.ID, 1, "2026-10-05 10:00+05", 1, 0, "5000", false)
	forOrder := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &b.ali, account: &b.cash, linked: &document, total: "400"})
	addPurchase(t, pool, b.w.company, b.w.asosiy, b.w.bozor, b.w.olma, 1, "20", "1000", false)
	sale := addSale(t, pool, b.w.company, b.w.asosiy, &b.ali, b.w.olma, 1, "2026-10-06 10:00+05", "2", "5000", false)
	forSale := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-06 10:00+05", customer: &b.ali, account: &b.cash, linked: &sale, total: "4000"})
	own := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 3, at: "2026-10-07 10:00+05", customer: &b.ali, account: &b.cash, total: "1000"})

	p, err := q.GetCustomerPayment(ctx, gen.GetCustomerPaymentParams{ID: forOrder, CustomerID: b.ali, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.Nil(t, p.SaleID, "no sale")
	assert.Nil(t, p.SaleNumber)
	assert.Equal(t, &b.order.ID, p.OrderID, "the order it was entered for")
	p, err = q.GetCustomerPayment(ctx, gen.GetCustomerPaymentParams{ID: forSale, CustomerID: b.ali, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.Equal(t, &sale, p.SaleID)
	assert.Nil(t, p.OrderID)
	rows, err := q.ListCustomerPayments(ctx, gen.ListCustomerPaymentsParams{CustomerID: b.ali, CompanyID: b.w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	assert.Equal(t, []int64{own, forSale, forOrder}, []int64{rows[0].ID, rows[1].ID, rows[2].ID})
	assert.Nil(t, rows[0].OrderID)
	assert.Nil(t, rows[1].OrderID)
	assert.Equal(t, &b.order.ID, rows[2].OrderID)
	assert.Nil(t, rows[2].SaleID)
}

// An order's price adds to what the customer owes, its payments take away;
// the statement shows the order by its title, and the payments linked to
// it name the order too; an order priced at nothing is not in it.
func TestAnOrderCountsInTheCustomersBalanceAndStatement(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newOrderBooks(t, q, pool)
	rate := standardRate(t, pool, b.w.company, "12800", "2026-10-01 00:00+05")
	card := addAccountRow(t, pool, b.w.company, "Karta", 2, true)
	// The 5th: the order at 5 000 USD, 400 USD paid with it. The 6th: an
	// order with goods alone (priced at nothing). The 7th: 300 USD paid.
	document := b.document(t, pool, b.order.ID, 1, "2026-10-05 10:00+05", 2, rate, "5000", false)
	advance := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &b.ali, account: &card, linked: &document, currency: 2, rate: rate, total: "400"})
	goods := b.newOrder(t, q, "Yetkazish")
	b.document(t, pool, goods.ID, 2, "2026-10-06 10:00+05", 1, rate, "0", false)
	later := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 2, at: "2026-10-07 10:00+05", customer: &b.ali, account: &card, linked: &document, currency: 2, rate: rate, total: "300"})

	c, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: b.ali, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.Equal(t, "55040000.00", numericText(t, c.Balance), "(5 000 − 400 − 300) × 12 800")
	list, err := q.ListCustomers(ctx, gen.ListCustomersParams{CompanyID: b.w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "55040000.00", numericText(t, list[0].Balance), "the list too")
	by, err := q.ListPartyBalanceByCurrency(ctx, gen.ListPartyBalanceByCurrencyParams{Party: "customer", PartyID: b.ali})
	require.NoError(t, err)
	require.Len(t, by, 1)
	assert.EqualValues(t, 2, by[0].CurrencyID)
	assert.Equal(t, "4300.00", numericText(t, by[0].Amount), "5 000 USD less 700 paid")

	rows, err := q.ListPartyStatement(ctx, gen.ListPartyStatementParams{Party: "customer", PartyID: b.ali, CompanyID: b.w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 3, "the order priced at nothing is not shown")
	assert.Equal(t, []int64{later, advance, document}, []int64{rows[0].ID, rows[1].ID, rows[2].ID}, "the newest first")
	assert.Equal(t, "customer_payment", rows[0].Kind)
	assert.Equal(t, &document, rows[0].LinkedID)
	assert.Equal(t, &b.order.ID, rows[0].OrderID, "the order the payment was entered for")
	assert.Equal(t, ptr("Montaj"), rows[0].OrderTitle)
	assert.Equal(t, "-3840000.00", numericText(t, rows[0].DeltaUzs))
	assert.Equal(t, "55040000.00", numericText(t, rows[0].BalanceUzs))
	assert.Equal(t, "order", rows[2].Kind)
	assert.Equal(t, &b.order.ID, rows[2].OrderID)
	assert.Equal(t, ptr("Montaj"), rows[2].OrderTitle)
	assert.Equal(t, "5000.00", numericText(t, rows[2].Amount))
	assert.Equal(t, "64000000.00", numericText(t, rows[2].DeltaUzs), "an order adds")
	assert.Equal(t, "64000000.00", numericText(t, rows[2].BalanceUzs))
	assert.Nil(t, rows[2].LinkedID)
	count, err := q.CountPartyStatement(ctx, gen.CountPartyStatementParams{Party: "customer", PartyID: b.ali, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 3, count)
	docs, err := q.CountCustomerDocuments(ctx, b.ali)
	require.NoError(t, err)
	assert.EqualValues(t, 4, docs, "both documents and both payments keep the customer")
}

// The account's statement names the order a customer's payment was
// entered for.
func TestAccountStatementNamesTheOrderOfALinkedPayment(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newOrderBooks(t, q, pool)
	document := b.document(t, pool, b.order.ID, 1, "2026-10-05 10:00+05", 1, 0, "5000", false)
	payment := addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-05 10:00+05", customer: &b.ali, account: &b.cash, linked: &document, total: "400"})

	rows, err := q.ListAccountStatement(ctx, gen.ListAccountStatementParams{CompanyID: b.w.company, AccountID: b.cash, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1, "the order's document names no account; its payment does")
	assert.Equal(t, payment, rows[0].ID)
	assert.Equal(t, &document, rows[0].LinkedID)
	assert.Equal(t, &b.order.ID, rows[0].OrderID)
	assert.Equal(t, ptr("Montaj"), rows[0].OrderTitle)
	assert.Equal(t, ptr("Ali Karimov"), rows[0].CustomerName)
}

// A product's moves name the order that took it and the customer, as a
// sale's name the customer.
func TestProductMovesNameTheOrderAndTheCustomer(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newOrderBooks(t, q, pool)
	purchase := addPurchase(t, pool, b.w.company, b.w.asosiy, b.w.bozor, b.w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE transactions SET doc_at = $2 WHERE id = $1", purchase, at(t, "2026-10-01 09:00+05"))
	document := b.document(t, pool, b.order.ID, 1, "2026-10-05 10:00+05", 1, 0, "5000", false)
	mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, position) VALUES ($1, $2, 2, 1)", document, b.w.olma)
	mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, -2)", document, b.w.company, b.w.asosiy, b.w.olma)
	addSale(t, pool, b.w.company, b.w.asosiy, &b.ali, b.w.olma, 1, "2026-10-06 10:00+05", "1", "5000", false)

	rows, err := q.ListProductMoves(ctx, gen.ListProductMovesParams{ProductID: b.w.olma, LocationIds: []int64{b.w.asosiy}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	assert.Equal(t, "sale", rows[0].Kind)
	assert.Equal(t, "Ali Karimov", rows[0].Counterpart, "a sale names its customer")
	assert.Nil(t, rows[0].OrderID)
	assert.Equal(t, "order", rows[1].Kind)
	assert.Equal(t, &b.order.ID, rows[1].OrderID)
	assert.Equal(t, ptr("Montaj"), rows[1].OrderTitle)
	assert.Equal(t, "Ali Karimov", rows[1].Counterpart, "an order names its customer")
	assert.Equal(t, "-2.000", numericText(t, rows[1].Quantity))
	assert.Equal(t, "Bozor", rows[2].Counterpart)
	assert.Nil(t, rows[2].OrderTitle)
}

// The moves of the products, in time, each with the unit cost in so'm its
// document's line bought it at (a purchase, an opening stock) or none:
// what the FIFO cost is replayed from (logic/warehouse.md, section 10).
func TestProductCostMovesCarryTheUnitCost(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	rate := standardRate(t, pool, w.company, "12800", "2026-10-01 00:00+05")
	move := func(txID, locationID, productID int64, quantity string) {
		mustExec(t, pool, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5::numeric)", txID, w.company, locationID, productID, quantity)
	}
	line := func(txID, productID int64, quantity string, price *string) {
		mustExec(t, pool, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", txID, productID, quantity, price)
	}
	// The 1st: 10 Olma bought at 1.5 USD. The 2nd: 3 Nok as an opening
	// stock at 2 000 so'm. The 3rd: 4 Olma sold. The 4th: 2 Olma moved to
	// Chilonzor (the move in entered first). The 5th: 1 Olma more counted
	// in Chilonzor. A purchase deleted since, moves and all, is not there.
	purchase := addDocument(t, pool, w.company, doc{kind: "purchase", number: 1, at: "2026-10-01 09:00+05", location: &w.asosiy, supplier: &w.bozor, currency: 2, rate: rate})
	line(purchase, w.olma, "10", ptr("1.5"))
	move(purchase, w.asosiy, w.olma, "10")
	opening := addDocument(t, pool, w.company, doc{kind: "opening_stock", number: 1, at: "2026-10-02 09:00+05", location: &w.asosiy, rate: rate})
	line(opening, w.nok, "3", ptr("2000"))
	move(opening, w.asosiy, w.nok, "3")
	sale := addDocument(t, pool, w.company, doc{kind: "sale", number: 1, at: "2026-10-03 09:00+05", location: &w.asosiy, rate: rate})
	line(sale, w.olma, "4", ptr("5000"))
	move(sale, w.asosiy, w.olma, "-4")
	transfer := addDocument(t, pool, w.company, doc{kind: "transfer", number: 1, at: "2026-10-04 09:00+05", location: &w.asosiy, toLocation: &w.chilonzor, rate: rate})
	line(transfer, w.olma, "2", nil)
	move(transfer, w.chilonzor, w.olma, "2")
	move(transfer, w.asosiy, w.olma, "-2")
	inventory := addDocument(t, pool, w.company, doc{kind: "inventory", number: 1, at: "2026-10-05 09:00+05", location: &w.chilonzor, rate: rate})
	move(inventory, w.chilonzor, w.olma, "1")
	gone := addDocument(t, pool, w.company, doc{kind: "purchase", number: 2, at: "2026-10-06 09:00+05", location: &w.asosiy, supplier: &w.bozor, rate: rate, deleted: true})
	line(gone, w.olma, "9", ptr("1"))
	move(gone, w.asosiy, w.olma, "9")

	rows, err := q.ListProductCostMoves(ctx, gen.ListProductCostMovesParams{CompanyID: w.company, ProductIds: []int64{w.olma, w.nok}})
	require.NoError(t, err)
	require.Len(t, rows, 6)
	assert.Equal(t, []int64{purchase, sale, transfer, transfer, inventory, opening}, idsOf(rows, func(r gen.ListProductCostMovesRow) int64 { return r.TransactionID }), "by product, then in time")
	assert.Equal(t, "purchase", rows[0].Kind)
	assert.Equal(t, w.olma, rows[0].ProductID)
	assert.Equal(t, w.asosiy, rows[0].LocationID)
	assert.Equal(t, "10.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, "19200.00", numericText(t, rows[0].UnitCostUzs), "1.5 USD at 12 800")
	assert.Equal(t, at(t, "2026-10-01 09:00+05"), rows[0].DocAt.UTC())
	assert.False(t, rows[1].UnitCostUzs.Valid, "a sale's line has a price, not a cost")
	assert.Equal(t, "-2.000", numericText(t, rows[2].Quantity), "a transfer's move out comes before its move in")
	assert.Equal(t, w.asosiy, rows[2].LocationID)
	assert.Equal(t, "2.000", numericText(t, rows[3].Quantity))
	assert.Equal(t, w.chilonzor, rows[3].LocationID)
	assert.False(t, rows[3].UnitCostUzs.Valid)
	assert.Equal(t, "inventory", rows[4].Kind)
	assert.Equal(t, w.nok, rows[5].ProductID)
	assert.Equal(t, "2000.00", numericText(t, rows[5].UnitCostUzs), "an opening stock's line in so'm")
	rows, err = q.ListProductCostMoves(ctx, gen.ListProductCostMovesParams{CompanyID: w.company, ProductIds: []int64{w.nok}})
	require.NoError(t, err)
	assert.Len(t, rows, 1, "the products asked about")
}
