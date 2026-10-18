package warehouse

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// addOrder enters an order of the company for the customer in the
// location, under a stage and a type made on the first ask.
func addOrder(t *testing.T, pool *pgxpool.Pool, companyID, customerID, locationID int64, title string) OrderHead {
	t.Helper()
	ctx := t.Context()
	var stage, typ int64
	if err := pool.QueryRow(ctx, "SELECT id FROM order_stages WHERE company_id = $1 ORDER BY id LIMIT 1", companyID).Scan(&stage); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO order_stages (company_id, name, color, position) VALUES ($1, 'Yangi', 'blue', 1) RETURNING id", companyID).Scan(&stage))
	}
	if err := pool.QueryRow(ctx, "SELECT id FROM order_types WHERE company_id = $1 ORDER BY id LIMIT 1", companyID).Scan(&typ); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO order_types (company_id, name, position) VALUES ($1, 'Buyurtma', 1) RETURNING id", companyID).Scan(&typ))
	}
	head := OrderHead{CustomerID: customerID, LocationID: locationID}
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, '2026-10-20', $7) RETURNING id`, companyID, typ, stage, customerID, locationID, title, ali).Scan(&head.ID))
	return head
}

// documentsOf is the order's documents, live and hidden: "kind:number:total:hidden".
func documentsOf(t *testing.T, pool *pgxpool.Pool, orderID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT kind || ':' || number || ':' || total::text || ':' || (deleted_at IS NOT NULL)::text FROM transactions WHERE order_id = $1 ORDER BY id", orderID)
	require.NoError(t, err)
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		require.NoError(t, rows.Scan(&s))
		out = append(out, s)
	}
	return out
}

// write saves the order's money inside a write of the service, as Ali.
func write(t *testing.T, s *Service, m stockedMarket, order OrderHead, in OrderMoneyInput, withPayments bool) (OrderMoney, error) {
	t.Helper()
	var money OrderMoney
	err := s.write(t.Context(), m.company, func(q *gen.Queries) error {
		var err error
		money, err = WriteOrderDocument(t.Context(), q, m.company, ali, ptr("Ali aka"), order, in, withPayments)
		return err
	})
	return money, err
}

func readMoney(t *testing.T, s *Service, companyID, orderID int64) OrderMoney {
	t.Helper()
	money, err := ReadOrderMoney(t.Context(), s.q, companyID, orderID)
	require.NoError(t, err)
	return money
}

// An order's document is written when there is something to write: a
// price, a line or an advance; once there, it stays.
func TestWriteOrderDocumentWhenNeeded(t *testing.T) {
	s, pool := newService(t)
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")

	money, err := write(t, s, m, order, OrderMoneyInput{}, true)
	require.NoError(t, err)
	assert.Equal(t, OrderMoney{Amount: "0.00", CurrencyID: 1, Rate: "1.0000", AmountUZS: "0.00", Paid: "0.00", Items: []OrderLine{}, Payments: []OrderPayment{}}, money, "nothing to write: no document")
	assert.Empty(t, documentsOf(t, pool, order.ID))
	assert.Equal(t, money, readMoney(t, s, m.company, order.ID))
	_, err = write(t, s, m, order, OrderMoneyInput{Amount: ptr("0")}, true)
	require.NoError(t, err)
	assert.Empty(t, documentsOf(t, pool, order.ID), "a price of nothing is no price")

	money, err = write(t, s, m, order, OrderMoneyInput{Amount: ptr("5000")}, true)
	require.NoError(t, err)
	assert.Equal(t, []string{"order:1:5000.00:false"}, documentsOf(t, pool, order.ID), "a price: the document, the company's first of the kind")
	assert.NotZero(t, money.DocumentID)
	assert.Equal(t, "5000.00", money.Amount)
	var customer, location, docAt any
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT customer_id, location_id, doc_at FROM transactions WHERE id = $1", money.DocumentID).Scan(&customer, &location, &docAt))
	assert.EqualValues(t, m.karim, customer, "the order's customer")
	assert.EqualValues(t, m.asosiy, location, "the order's location")
	assert.WithinDuration(t, time.Now(), docAt.(time.Time), time.Minute, "at the moment it is written")
	money, err = write(t, s, m, order, OrderMoneyInput{}, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"order:1:0.00:false"}, documentsOf(t, pool, order.ID), "the price taken away: the document stays, priced at nothing")
	assert.Equal(t, money.DocumentID, readMoney(t, s, m.company, order.ID).DocumentID)

	goods := addOrder(t, pool, m.company, m.karim, m.asosiy, "Yetkazish")
	money, err = write(t, s, m, goods, OrderMoneyInput{Items: []ItemInput{move(m.olma, "2")}}, true)
	require.NoError(t, err)
	assert.Equal(t, []string{"order:2:0.00:false"}, documentsOf(t, pool, goods.ID), "goods alone: a document priced at nothing")
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma), "out of the stock")
	paid := addOrder(t, pool, m.company, m.karim, m.asosiy, "Ta'mir")
	money, err = write(t, s, m, paid, OrderMoneyInput{Payments: []ledger.PaymentLine{pay(m.cash, "1000")}}, true)
	require.NoError(t, err)
	assert.Equal(t, []string{"order:3:0.00:false"}, documentsOf(t, pool, paid.ID), "an advance alone: a document for it to link to")
	assert.Equal(t, "1000.00", money.Paid)
}

// An order's price in a currency, its lines of products and services and
// the advance paid with it.
func TestWriteOrderDocumentPriceLinesAndAdvance(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01T00:00:00+05:00")
	card := addAccount(t, pool, m.company, "Karta", 2, true)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")

	money, err := write(t, s, m, order, OrderMoneyInput{
		Amount: ptr("5000"), CurrencyID: ptr(int64(2)),
		Items:    []ItemInput{move(m.olma, "2.5"), move(m.yetkazish, "1")},
		Payments: []ledger.PaymentLine{pay(card, "400"), pay(m.cash, "1280000")},
	}, true)

	require.NoError(t, err)
	assert.Equal(t, "5000.00", money.Amount)
	assert.EqualValues(t, 2, money.CurrencyID)
	assert.Equal(t, "12800.0000", money.Rate, "the standard rate at the moment")
	assert.Equal(t, "64000000.00", money.AmountUZS)
	assert.Equal(t, "500.00", money.Paid, "400 USD and 1 280 000 so'm, in dollars")
	assert.Equal(t, []OrderLine{
		{ProductID: m.olma, Name: "Olma", Kind: "product", Unit: ptr("kg"), Quantity: "2.500"},
		{ProductID: m.yetkazish, Name: "Yetkazish", Kind: "service", Unit: nil, Quantity: "1.000"},
	}, money.Items, "the lines in the order entered, without prices")
	require.Len(t, money.Payments, 2)
	assert.Equal(t, "Karta", money.Payments[1].AccountName)
	assert.Equal(t, "400.00", money.Payments[1].Amount)
	assert.EqualValues(t, 2, money.Payments[1].CurrencyID)
	assert.Equal(t, "5120000.00", money.Payments[1].AmountUZS)
	assert.Equal(t, "Naqd", money.Payments[0].AccountName, "the later entered first")
	assert.Equal(t, ptr("Ali aka"), money.Payments[0].CreatedByName)
	assert.Equal(t, "7.500", stockOf(t, pool, m.asosiy, m.olma), "the product out of the stock")
	var moves int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM stock_moves WHERE transaction_id = $1", money.DocumentID).Scan(&moves))
	assert.Equal(t, 1, moves, "a service moves nothing")
	var kind string
	var customer *int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT kind, customer_id FROM transactions WHERE linked_id = $1 LIMIT 1", money.DocumentID).Scan(&kind, &customer))
	assert.Equal(t, "customer_payment", kind, "the advance is the customer's payment")
	assert.Equal(t, &m.karim, customer)
	assert.Equal(t, money, readMoney(t, s, m.company, order.ID))

	// Another rate typed: the document's own rate row.
	own := addOrder(t, pool, m.company, m.karim, m.asosiy, "Ta'mir")
	money, err = write(t, s, m, own, OrderMoneyInput{Amount: ptr("100"), CurrencyID: ptr(int64(2)), Rate: ptr("13000")}, true)
	require.NoError(t, err)
	assert.Equal(t, "13000.0000", money.Rate)
	assert.Equal(t, "1300000.00", money.AmountUZS)
}

// What is wrong is told in this order: the price, the currency and the
// rate, the lines, the advance; then the stock. Nothing is written after
// a refusal.
func TestWriteOrderDocumentRefusals(t *testing.T) {
	s, pool := newService(t)
	m := newStockedMarket(t, s, pool)
	other := newShop(t, pool, "Nok")
	foreign := addProduct(t, pool, other.company, "Anor", ptr("kg"), true)
	off := addProduct(t, pool, m.company, "Eski", ptr("kg"), false)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")
	for name, tc := range map[string]struct {
		in      OrderMoneyInput
		kind    apperr.Kind
		code    string
		message string
	}{
		"a bad price":                  {OrderMoneyInput{Amount: ptr("5 000")}, apperr.Invalid, "validation_error", "Narx noto'g'ri"},
		"a price below zero":           {OrderMoneyInput{Amount: ptr("-1")}, apperr.Invalid, "validation_error", "Narx noto'g'ri"},
		"a currency not on":            {OrderMoneyInput{Amount: ptr("1"), CurrencyID: ptr(int64(3))}, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan"},
		"a currency with no rate":      {OrderMoneyInput{Amount: ptr("1"), CurrencyID: ptr(int64(2))}, apperr.Invalid, "validation_error", "Kursni kiriting"},
		"a bad rate":                   {OrderMoneyInput{Amount: ptr("1"), CurrencyID: ptr(int64(2)), Rate: ptr("abc")}, apperr.Invalid, "validation_error", "Kurs noto'g'ri"},
		"a line of no product":         {OrderMoneyInput{Items: []ItemInput{move(0, "1")}}, apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		"another's product":            {OrderMoneyInput{Items: []ItemInput{move(foreign, "1")}}, apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		"a product turned off":         {OrderMoneyInput{Items: []ItemInput{move(off, "1")}}, apperr.Invalid, "validation_error", "Mahsulot nofaol"},
		"a product twice":              {OrderMoneyInput{Items: []ItemInput{move(m.olma, "1"), move(m.olma, "2")}}, apperr.Invalid, "validation_error", "«Olma» ikki marta kiritilgan"},
		"a bad quantity":               {OrderMoneyInput{Items: []ItemInput{move(m.olma, "0")}}, apperr.Invalid, "validation_error", "«Olma» miqdori noto'g'ri"},
		"an advance of nothing":        {OrderMoneyInput{Payments: []ledger.PaymentLine{pay(m.cash, "0")}}, apperr.Invalid, "validation_error", "To'lov summasi noto'g'ri"},
		"an advance of nowhere":        {OrderMoneyInput{Payments: []ledger.PaymentLine{{Amount: ptr("1")}}}, apperr.Invalid, "validation_error", "Akkauntni tanlang"},
		"the price before the lines":   {OrderMoneyInput{Amount: ptr("x"), Items: []ItemInput{move(0, "1")}}, apperr.Invalid, "validation_error", "Narx noto'g'ri"},
		"the lines before the advance": {OrderMoneyInput{Items: []ItemInput{move(0, "1")}, Payments: []ledger.PaymentLine{pay(m.cash, "0")}}, apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		"the advance before the stock": {OrderMoneyInput{Items: []ItemInput{move(m.olma, "11")}, Payments: []ledger.PaymentLine{pay(m.cash, "0")}}, apperr.Invalid, "validation_error", "To'lov summasi noto'g'ri"},
		"more than the stock":          {OrderMoneyInput{Items: []ItemInput{move(m.olma, "11")}}, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q"},
	} {
		turnOn(t, pool, m.company, 2)
		_, err := write(t, s, m, order, tc.in, true)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}
	assert.Empty(t, documentsOf(t, pool, order.ID), "nothing written")
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma))
}

// Saved again: the price and the lines are replaced (the moves written
// anew, the stock checked for the old and the new products), the moment
// and the number stay, the payments are left alone; a product the order
// holds stays once turned off.
func TestWriteOrderDocumentAgain(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")
	first, err := write(t, s, m, order, OrderMoneyInput{Amount: ptr("5000"), Items: []ItemInput{move(m.olma, "4")}, Payments: []ledger.PaymentLine{pay(m.cash, "400")}}, true)
	require.NoError(t, err)
	var docAt time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT doc_at FROM transactions WHERE id = $1", first.DocumentID).Scan(&docAt))

	again, err := write(t, s, m, order, OrderMoneyInput{Amount: ptr("6000"), Items: []ItemInput{move(m.nok, "3")}, Payments: []ledger.PaymentLine{pay(m.cash, "999")}}, false)

	require.NoError(t, err)
	assert.Equal(t, first.DocumentID, again.DocumentID, "the same document")
	assert.Equal(t, "6000.00", again.Amount)
	assert.Equal(t, "400.00", again.Paid, "the advance stays: an edit does not touch the payments")
	assert.Equal(t, []OrderLine{{ProductID: m.nok, Name: "Nok", Kind: "product", Unit: ptr("dona"), Quantity: "3.000"}}, again.Items)
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma), "the old line's product is back")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.nok))
	var at time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT doc_at FROM transactions WHERE id = $1", again.DocumentID).Scan(&at))
	assert.True(t, docAt.Equal(at), "the moment stays")
	assert.Equal(t, []string{"order:1:6000.00:false"}, documentsOf(t, pool, order.ID))

	_, err = pool.Exec(ctx, "UPDATE products SET is_active = false WHERE id = $1", m.nok)
	require.NoError(t, err)
	_, err = write(t, s, m, order, OrderMoneyInput{Amount: ptr("6000"), Items: []ItemInput{move(m.nok, "5")}}, false)
	require.NoError(t, err, "a product the order holds stays once turned off")
	_, err = write(t, s, m, order, OrderMoneyInput{Amount: ptr("6000"), Items: []ItemInput{move(m.nok, "6")}}, false)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Nok» uchun omborda yetarli qoldiq yo'q", "the stock is checked against the new lines")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok), "the refused edit changed nothing")
	sold(t, pool, m.shop, m.olma, "10")
	_, err = write(t, s, m, order, OrderMoneyInput{Items: []ItemInput{move(m.nok, "1")}}, false)
	require.NoError(t, err, "a line taken away gives its product back whatever the stock")
}

// Deleting hides the document, gives the products back to the stock and
// hides the payments linked to it; an order with no document has nothing
// to delete.
func TestDeleteOrderDocument(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")
	bare := addOrder(t, pool, m.company, m.karim, m.asosiy, "Yetkazish")
	money, err := write(t, s, m, order, OrderMoneyInput{Amount: ptr("5000"), Items: []ItemInput{move(m.olma, "4")}, Payments: []ledger.PaymentLine{pay(m.cash, "400")}}, true)
	require.NoError(t, err)

	require.NoError(t, s.write(ctx, m.company, func(q *gen.Queries) error { return DeleteOrderDocument(ctx, q, m.company, order.ID) }))

	assert.Equal(t, []string{"order:1:5000.00:true"}, documentsOf(t, pool, order.ID), "hidden")
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma), "the product is back")
	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM transactions WHERE linked_id = $1", money.DocumentID).Scan(&hidden))
	assert.True(t, hidden, "its payment is hidden")
	assert.Zero(t, readMoney(t, s, m.company, order.ID).DocumentID, "nothing left to read")
	require.NoError(t, s.write(ctx, m.company, func(q *gen.Queries) error { return DeleteOrderDocument(ctx, q, m.company, bare.ID) }))
}

// The texts the history writes: the price as money, the lines as a list.
func TestOrderMoneyTexts(t *testing.T) {
	for name, tc := range map[string]struct {
		money OrderMoney
		price string
		lines string
	}{
		"so'm":     {OrderMoney{Amount: "1200000.00", CurrencyID: 1}, "1 200 000 so'm", ""},
		"dollars":  {OrderMoney{Amount: "5000.00", CurrencyID: 2}, "5 000 $", ""},
		"decimals": {OrderMoney{Amount: "12.50", CurrencyID: 2}, "12,5 $", ""},
		"no price": {OrderMoney{Amount: "0.00", CurrencyID: 1}, "", ""},
		"lines":    {OrderMoney{Amount: "0.00", CurrencyID: 1, Items: []OrderLine{{Name: "Kabel", Unit: ptr("m"), Quantity: "2.000"}, {Name: "Montaj", Quantity: "1.000"}, {Name: "Olma", Unit: ptr("kg"), Quantity: "1.500"}}}, "", "Kabel × 2 m, Montaj × 1, Olma × 1,5 kg"},
	} {
		assert.Equal(t, tc.price, tc.money.PriceText(), name)
		assert.Equal(t, tc.lines, tc.money.LinesText(), name)
	}
}

// The document is dated to the minute, as the forms date every other
// document (their field holds minutes): a payment the order's page enters
// within the same minute then follows the order in the statement instead
// of preceding it.
func TestOrderDocumentIsDatedToTheMinute(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")
	_, err := write(t, s, m, order, OrderMoneyInput{Amount: ptr("5000")}, true)
	require.NoError(t, err)

	doc, err := s.q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: order.ID, CompanyID: m.company})
	require.NoError(t, err)
	assert.Zero(t, doc.DocAt.Second(), "dated to the minute")
	assert.Zero(t, doc.DocAt.Nanosecond(), "dated to the minute")

	// The page's payment, at the minute its field holds.
	minute := time.Now().Truncate(time.Minute).Format(time.RFC3339)
	_, err = s.AddOrderPayment(ctx, Scope{CompanyID: m.company, LocationIDs: []int64{m.asosiy}}, ali, order.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("300"), At: minute})
	require.NoError(t, err)
	page, err := s.CustomerStatement(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	assert.Equal(t, []string{"customer_payment", "order"}, []string{page.Items[0].Kind, page.Items[1].Kind}, "newest first: the payment follows the order")
}
