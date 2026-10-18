package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// A payment entered for an order on its own (logic/orders.md, 4.3): the
// customer's payment, at its own moment, linked to the order's document
// (made for it when the order has none yet); saved and deleted through
// the order alone.
func TestAnOrdersPayments(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")

	first, err := s.AddOrderPayment(ctx, m.scope(), ali, order.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("300"), At: on, Note: ptr(" Qolgani ")})

	require.NoError(t, err)
	assert.Equal(t, "300.00", first.Amount)
	assert.Equal(t, m.cash, first.BankAccountID)
	assert.Equal(t, "Naqd", first.AccountName)
	assert.EqualValues(t, 1, first.CurrencyID)
	assert.Equal(t, "300.00", first.AmountUZS)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), first.At, "at its own moment")
	assert.Equal(t, ptr("Qolgani"), first.Note)
	assert.Equal(t, ptr("Ali aka"), first.CreatedByName)
	assert.Equal(t, []string{"order:1:0.00:false"}, documentsOf(t, pool, order.ID), "a document made for the payment to link to")
	money := readMoney(t, s, m.company, order.ID)
	assert.Equal(t, "300.00", money.Paid)
	var kind string
	var customer, linked *int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT kind, customer_id, linked_id FROM transactions WHERE id = $1", first.ID).Scan(&kind, &customer, &linked))
	assert.Equal(t, "customer_payment", kind, "the customer's payment")
	assert.Equal(t, &m.karim, customer)
	assert.Equal(t, &money.DocumentID, linked, "linked to the order's document")

	second, err := s.AddOrderPayment(ctx, m.scope(), vali, order.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("200"), At: "2026-10-09T10:00:00+05:00"})
	require.NoError(t, err)
	money = readMoney(t, s, m.company, order.ID)
	assert.Equal(t, "500.00", money.Paid)
	require.Len(t, money.Payments, 2)
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{money.Payments[0].ID, money.Payments[1].ID}, "the newest first")
	assert.Equal(t, []string{"order:1:0.00:false"}, documentsOf(t, pool, order.ID), "the one document")

	saved, err := s.UpdateOrderPayment(ctx, m.scope(), ali, order.ID, first.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("350"), At: "2026-10-08T10:00:00+05:00"})
	require.NoError(t, err)
	assert.Equal(t, "350.00", saved.Amount)
	assert.Equal(t, time.Date(2026, 10, 8, 5, 0, 0, 0, time.UTC), saved.At)
	assert.Nil(t, saved.Note, "the note left out is taken away")
	assert.Equal(t, "550.00", readMoney(t, s, m.company, order.ID).Paid)

	require.NoError(t, s.DeleteOrderPayment(ctx, m.scope(), order.ID, second.ID))
	assert.Equal(t, "350.00", readMoney(t, s, m.company, order.ID).Paid)
	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM transactions WHERE id = $1", second.ID).Scan(&hidden))
	assert.True(t, hidden, "hidden, not removed")

	// Through the customer's own payments the order's are seen, not changed.
	list, err := s.ListCustomerPayments(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	assert.Equal(t, &order.ID, list.Items[0].OrderID, "the order it was entered for")
	assert.Nil(t, list.Items[0].SaleID)
	linkedMessage := "Bu to'lov buyurtma bilan kiritilgan: buyurtmani oching"
	_, err = s.UpdateCustomerPayment(ctx, m.company, ali, m.karim, first.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.Conflict, "payment_linked", linkedMessage)
	refused(t, s.DeleteCustomerPayment(ctx, m.company, m.karim, first.ID), apperr.Conflict, "payment_linked", linkedMessage)

	// What is refused: an order out of the scope, a payment of another
	// order, a payment gone, the payment's own rules.
	other := addOrder(t, pool, m.company, m.karim, m.chilonzor, "Yetkazish")
	_, err = s.AddOrderPayment(ctx, m.scope(m.asosiy), ali, other.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Buyurtma topilmadi", "an order outside the member's locations")
	_, err = s.AddOrderPayment(ctx, m.scope(), ali, order.ID+1000, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "Buyurtma topilmadi", "no such order")
	_, err = s.UpdateOrderPayment(ctx, m.scope(), ali, other.ID, first.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "a payment of another order")
	_, err = s.UpdateOrderPayment(ctx, m.scope(), ali, order.ID, second.ID, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "a payment gone")
	refused(t, s.DeleteOrderPayment(ctx, m.scope(), order.ID, second.ID), apperr.NotFound, "not_found", "To'lov topilmadi")
	for name, tc := range map[string]struct {
		in      PaymentInput
		message string
	}{
		"no account": {PaymentInput{Amount: ptr("1"), At: on}, "Akkauntni tanlang"},
		"no amount":  {PaymentInput{BankAccountID: m.cash, At: on}, "Summani kiriting"},
		"no moment":  {PaymentInput{BankAccountID: m.cash, Amount: ptr("1")}, "Vaqtni kiriting"},
	} {
		_, err := s.AddOrderPayment(ctx, m.scope(), ali, order.ID, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
}

// The customer's statement and a product's moves name the order.
func TestTheStatementAndTheMovesNameTheOrder(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	order := addOrder(t, pool, m.company, m.karim, m.asosiy, "Montaj")
	_, err := write(t, s, m, order, OrderMoneyInput{Amount: ptr("5000"), Items: []ItemInput{move(m.olma, "2")}, Payments: []ledger.PaymentLine{pay(m.cash, "400")}}, true)
	require.NoError(t, err)

	statement, err := s.CustomerStatement(ctx, m.company, m.karim, 1)
	require.NoError(t, err)
	require.Len(t, statement.Items, 2)
	assert.Equal(t, "customer_payment", statement.Items[0].Kind)
	assert.Equal(t, &order.ID, statement.Items[0].OrderID, "the payment names the order it was entered for")
	assert.Equal(t, ptr("Montaj"), statement.Items[0].OrderTitle)
	assert.Equal(t, "order", statement.Items[1].Kind)
	assert.Equal(t, &order.ID, statement.Items[1].OrderID)
	assert.Equal(t, ptr("Montaj"), statement.Items[1].OrderTitle)
	assert.Equal(t, "5000.00", statement.Items[1].Amount)

	moves, err := s.ProductMoves(ctx, m.scope(), m.olma, 0, 1)
	require.NoError(t, err)
	require.Len(t, moves.Items, 2)
	assert.Equal(t, "order", moves.Items[0].Kind)
	assert.Equal(t, &order.ID, moves.Items[0].OrderID)
	assert.Equal(t, ptr("Montaj"), moves.Items[0].OrderTitle)
	assert.Equal(t, ptr("Karim aka"), moves.Items[0].Counterpart, "the customer")
	assert.Equal(t, "-2.000", moves.Items[0].Quantity)
	assert.Nil(t, moves.Items[1].OrderID, "a purchase names no order")
}
