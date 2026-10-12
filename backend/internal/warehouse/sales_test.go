package warehouse

import (
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// addCustomer enters a customer of a type whose first text field is the
// name, as the customers' section does; deleted hides it.
func addCustomer(t *testing.T, pool *pgxpool.Pool, companyID int64, name, phone string, deleted bool) int64 {
	t.Helper()
	ctx := t.Context()
	var typeID int64
	err := pool.QueryRow(ctx, "SELECT id FROM customer_types WHERE company_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1", companyID).Scan(&typeID)
	if err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", companyID).Scan(&typeID))
		_, err = pool.Exec(ctx, "INSERT INTO customer_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'F.I.Sh.', 'string', 1)", companyID, typeID)
		require.NoError(t, err)
	}
	var id, fieldID int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM customer_fields WHERE type_id = $1 AND kind = 'string' ORDER BY position, id LIMIT 1", typeID).Scan(&fieldID))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO customers (company_id, type_id, phone, created_by, deleted_at) VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END) RETURNING id", companyID, typeID, phone, ali, deleted).Scan(&id))
	_, err = pool.Exec(ctx, "INSERT INTO customer_values (customer_id, field_id, text_value) VALUES ($1, $2, $3)", id, fieldID, name)
	require.NoError(t, err)
	return id
}

// stockedMarket is a market whose Asosiy holds 10 Olma and 5 Nok, with a
// customer, Karim, and a service, Yetkazish.
type stockedMarket struct {
	market
	karim, yetkazish int64
}

func newStockedMarket(t *testing.T, s *Service, pool *pgxpool.Pool) stockedMarket {
	t.Helper()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	return stockedMarket{market: m, karim: addCustomer(t, pool, m.company, "Karim aka", "998905555555", false), yetkazish: addProduct(t, pool, m.company, "Yetkazish", nil, true)}
}

func saleOf(customerID *int64, items ...ItemInput) SaleInput {
	return SaleInput{CustomerID: customerID, At: on, Items: items}
}

func TestCreateSale(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)

	// Karim buys 4 Olma at 3 000 and the delivery at 10 000, pays 5 000 of it.
	sale, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{
		CustomerID: &m.karim, At: on, Note: ptr(" Kechqurun "), Payments: []ledger.PaymentLine{pay(m.cash, "5000")},
		Items: []ItemInput{line(m.olma, "4", "3000"), line(m.yetkazish, "1", "10000")},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 1, sale.Number, "the company's first sale")
	assert.Equal(t, m.asosiy, sale.LocationID)
	assert.Equal(t, "Asosiy", sale.LocationName)
	assert.Equal(t, &m.karim, sale.CustomerID)
	assert.Equal(t, ptr("Karim aka"), sale.CustomerName)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), sale.At)
	assert.EqualValues(t, 1, sale.CurrencyID)
	assert.Equal(t, "1.0000", sale.Rate)
	assert.Equal(t, ptr("Kechqurun"), sale.Note)
	assert.Equal(t, "22000.00", sale.Total)
	assert.Equal(t, "22000.00", sale.TotalUZS)
	assert.Equal(t, "5000.00", sale.Paid)
	assert.EqualValues(t, 2, sale.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), sale.CreatedByName)
	assert.Equal(t, []Item{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "4.000", Price: "3000.00", Amount: "12000.00"},
		{ProductID: m.yetkazish, Name: "Yetkazish", Unit: nil, Quantity: "1.000", Price: "10000.00", Amount: "10000.00"},
	}, sale.Items)
	require.Len(t, sale.Payments, 1)
	assert.Equal(t, LinkedPayment{ID: sale.Payments[0].ID, BankAccountID: m.cash, AccountName: "Naqd", Amount: "5000.00", CurrencyID: 1}, sale.Payments[0])
	assert.Equal(t, "6.000", stockOf(t, pool, m.asosiy, m.olma), "out of the stock at once")
	var moves int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM stock_moves WHERE transaction_id = $1", sale.ID).Scan(&moves))
	assert.Equal(t, 1, moves, "a service moves nothing")
	var kind string
	var customer *int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT kind, customer_id FROM transactions WHERE linked_id = $1", sale.ID).Scan(&kind, &customer))
	assert.Equal(t, "customer_payment", kind, "the payment entered with it is the customer's")
	assert.Equal(t, &m.karim, customer)
	next, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, saleOf(&m.karim, line(m.olma, "1", "3000")))
	require.NoError(t, err)
	assert.EqualValues(t, 2, next.Number)
	purchases, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 1, purchases.Items[0].Number, "the purchases count on their own")

	// A retail sale: nobody's, paid in full with it.
	retail, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{At: on, Items: []ItemInput{line(m.nok, "2", "2000")}, Payments: []ledger.PaymentLine{pay(m.cash, "4000")}})
	require.NoError(t, err)
	assert.Nil(t, retail.CustomerID)
	assert.Nil(t, retail.CustomerName)
	assert.Equal(t, "4000.00", retail.Paid)
	require.NoError(t, pool.QueryRow(ctx, "SELECT kind, customer_id FROM transactions WHERE linked_id = $1", retail.ID).Scan(&kind, &customer))
	assert.Equal(t, "customer_payment", kind)
	assert.Nil(t, customer, "a retail sale's payment names no customer")
}

func TestCreateSaleRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	nok := newShop(t, pool, "Nok")
	stranger := addCustomer(t, pool, nok.company, "Begona", "998907777777", false)
	gone := addCustomer(t, pool, m.company, "Ketgan", "998908888888", true)
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	closed := addAccount(t, pool, m.company, "Yopiq", 1, false)
	ok := []ItemInput{line(m.olma, "1", "1")}

	for name, tc := range map[string]struct {
		location int64
		in       SaleInput
		code     string
		message  string
	}{
		"no location":            {0, saleOf(nil, ok...), "validation_error", "Lokatsiyani tanlang"},
		"a location outside":     {nok.asosiy, saleOf(nil, ok...), "validation_error", "Lokatsiyani tanlang"},
		"another's customer":     {m.asosiy, saleOf(&stranger, ok...), "validation_error", "Mijozni tanlang"},
		"a deleted customer":     {m.asosiy, saleOf(&gone, ok...), "validation_error", "Mijozni tanlang"},
		"no time":                {m.asosiy, SaleInput{Items: ok}, "validation_error", "Vaqtni kiriting"},
		"a currency off":         {m.asosiy, SaleInput{At: on, CurrencyID: ptr(int64(3)), Items: ok}, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan"},
		"a long note":            {m.asosiy, SaleInput{At: on, Note: ptr(strings.Repeat("x", 501)), Items: ok}, "validation_error", "Izoh 500 belgidan oshmasin"},
		"no lines":               {m.asosiy, SaleInput{At: on}, "validation_error", "Kamida bitta mahsulot qo'shing"},
		"no product":             {m.asosiy, saleOf(nil, ItemInput{Quantity: ptr("1"), Price: ptr("1")}), "validation_error", "Mahsulotni tanlang"},
		"an inactive product":    {m.asosiy, saleOf(nil, line(eski, "1", "1")), "validation_error", "Mahsulot nofaol"},
		"a product twice":        {m.asosiy, saleOf(nil, line(m.olma, "1", "1"), line(m.olma, "1", "1")), "validation_error", "«Olma» ikki marta kiritilgan"},
		"a quantity of nothing":  {m.asosiy, saleOf(nil, line(m.olma, "0", "1")), "validation_error", "«Olma» miqdori noto'g'ri"},
		"no price":               {m.asosiy, saleOf(nil, ItemInput{ProductID: m.olma, Quantity: ptr("1")}), "validation_error", "«Olma» narxi noto'g'ri"},
		"no account":             {m.asosiy, SaleInput{CustomerID: &m.karim, At: on, Items: ok, Payments: []ledger.PaymentLine{{Amount: ptr("1")}}}, "validation_error", "Akkauntni tanlang"},
		"a closed account":       {m.asosiy, SaleInput{CustomerID: &m.karim, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(closed, "1")}}, "validation_error", "Akkaunt nofaol"},
		"a bad amount":           {m.asosiy, SaleInput{CustomerID: &m.karim, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "0")}}, "validation_error", "To'lov summasi noto'g'ri"},
		"a retail sale unpaid":   {m.asosiy, saleOf(nil, ok...), "validation_error", "Mijozsiz sotuv to'liq to'langan bo'lsin"},
		"a retail sale overpaid": {m.asosiy, SaleInput{At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "2")}}, "validation_error", "Mijozsiz sotuv to'liq to'langan bo'lsin"},
		"the customer first":     {m.asosiy, SaleInput{CustomerID: &stranger, At: "x"}, "validation_error", "Mijozni tanlang"},
	} {
		_, err := s.CreateSale(ctx, m.scope(), ali, tc.location, tc.in)
		refused(t, err, apperr.Invalid, tc.code, tc.message, name)
	}
	_, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, saleOf(&m.karim, line(m.olma, "11", "1")))
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "more than the location has")
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma), "nothing moved")
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE company_id = $1 AND kind IN ('sale', 'customer_payment')", m.company).Scan(&count))
	assert.Zero(t, count, "nothing written")
	more, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{CustomerID: &m.karim, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "100")}})
	require.NoError(t, err, "a customer may pay more than the sale: an advance")
	assert.Equal(t, "100.00", more.Paid)
}

func TestSalesAreListedEditedAndDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	malika := addCustomer(t, pool, m.company, "Malika opa", "998906666666", false)
	first, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{CustomerID: &m.karim, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{line(m.olma, "4", "3000")}, Payments: []ledger.PaymentLine{pay(m.cash, "5000")}})
	require.NoError(t, err)
	second, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{At: "2026-10-06T09:00:00+05:00", Items: []ItemInput{line(m.nok, "1", "2000")}, Payments: []ledger.PaymentLine{pay(m.cash, "2000")}})
	require.NoError(t, err)
	_, err = s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "2")}})
	require.NoError(t, err)
	third, err := s.CreateSale(ctx, m.scope(), ali, m.chilonzor, SaleInput{CustomerID: &m.karim, At: "2026-10-08T09:00:00+05:00", Items: []ItemInput{line(m.olma, "1", "3000")}})
	require.NoError(t, err)
	ids := func(scope Scope, in SaleListInput) []int64 {
		page, err := s.ListSales(ctx, scope, in)
		require.NoError(t, err)
		out := make([]int64, 0, len(page.Items))
		for _, sale := range page.Items {
			out = append(out, sale.ID)
		}
		return out
	}

	assert.Equal(t, []int64{third.ID, second.ID, first.ID}, ids(m.scope(), SaleListInput{Page: 1}), "the newest first")
	assert.Equal(t, []int64{second.ID, first.ID}, ids(m.scope(), SaleListInput{LocationID: m.asosiy, Page: 1}), "one location")
	assert.Equal(t, []int64{third.ID, first.ID}, ids(m.scope(), SaleListInput{CustomerID: m.karim, Page: 1}), "one customer, every location")
	assert.Equal(t, []int64{third.ID}, ids(m.scope(m.chilonzor), SaleListInput{Page: 1}), "a member of Chilonzor")
	assert.Empty(t, ids(m.scope(m.chilonzor), SaleListInput{LocationID: m.asosiy, Page: 1}), "a location outside the scope counts as none")
	got, err := s.GetSale(ctx, m.scope(), first.ID)
	require.NoError(t, err)
	assert.Equal(t, first, got)
	_, err = s.GetSale(ctx, m.scope(m.chilonzor), first.ID)
	refused(t, err, apperr.NotFound, "not_found", "Sotuv topilmadi")
	_, err = s.ListSales(ctx, m.scope(), SaleListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")

	// An edit: another customer, more Olma, the payment replaced; the stock
	// and both customers' balances follow.
	saved, err := s.UpdateSale(ctx, m.scope(), ali, first.ID, SaleInput{CustomerID: &malika, At: "2026-10-05T10:00:00+05:00", Note: ptr("Qayta"), Items: []ItemInput{line(m.olma, "5", "3000")}, Payments: []ledger.PaymentLine{pay(m.cash, "1000")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, &malika, saved.CustomerID)
	assert.Equal(t, ptr("Malika opa"), saved.CustomerName)
	assert.Equal(t, "15000.00", saved.Total)
	assert.Equal(t, "1000.00", saved.Paid)
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, m.olma), "10 − 5 − 2 moved")
	var customers []int64
	rows, err := pool.Query(ctx, "SELECT customer_id FROM transactions WHERE linked_id = $1 AND deleted_at IS NULL", first.ID)
	require.NoError(t, err)
	for rows.Next() {
		var c int64
		require.NoError(t, rows.Scan(&c))
		customers = append(customers, c)
	}
	rows.Close()
	assert.Equal(t, []int64{malika}, customers, "the payment entered with it follows the customer")
	_, err = s.UpdateSale(ctx, m.scope(), ali, first.ID, SaleInput{At: on, Items: []ItemInput{line(m.olma, "1", "3000")}, Payments: []ledger.PaymentLine{pay(m.cash, "1000")}})
	refused(t, err, apperr.Invalid, "validation_error", "Mijozsiz sotuv to'liq to'langan bo'lsin", "the customer taken out: paid in full or not at all")
	_, err = s.UpdateSale(ctx, m.scope(), ali, first.ID, saleOf(&malika, line(m.olma, "9", "3000")))
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	assert.Equal(t, "15000.00", must(s.GetSale(ctx, m.scope(), first.ID)).Total, "unchanged")
	_, err = s.UpdateSale(ctx, m.scope(m.chilonzor), ali, first.ID, saleOf(&malika, line(m.olma, "1", "1")))
	refused(t, err, apperr.NotFound, "not_found", "Sotuv topilmadi")

	// A deletion gives the stock back and takes the payment with it.
	require.NoError(t, s.DeleteSale(ctx, m.scope(), first.ID))
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma))
	var live int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE linked_id = $1 AND deleted_at IS NULL", first.ID).Scan(&live))
	assert.Zero(t, live, "its payment went with it")
	_, err = s.GetSale(ctx, m.scope(), first.ID)
	refused(t, err, apperr.NotFound, "not_found", "Sotuv topilmadi")
	err = s.DeleteSale(ctx, m.scope(m.chilonzor), second.ID)
	refused(t, err, apperr.NotFound, "not_found", "Sotuv topilmadi")
	fourth, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, saleOf(&m.karim, line(m.olma, "1", "1")))
	require.NoError(t, err)
	assert.EqualValues(t, 4, fourth.Number, "a deleted sale keeps its number")
}

func TestASaleInDollars(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newStockedMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01 00:00+05")
	card := addAccount(t, pool, m.company, "Karta", 2, true)

	sale, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{CustomerID: &m.karim, At: on, CurrencyID: ptr(int64(2)), Items: []ItemInput{line(m.olma, "2", "1.5")}, Payments: []ledger.PaymentLine{pay(card, "1"), pay(m.cash, "12800")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, sale.CurrencyID)
	assert.Equal(t, "12800.0000", sale.Rate)
	assert.Equal(t, "3.00", sale.Total)
	assert.Equal(t, "38400.00", sale.TotalUZS)
	assert.Equal(t, "2.00", sale.Paid, "1 USD from the card and 12 800 so'm from the cash, in dollars")
	retail, err := s.CreateSale(ctx, m.scope(), ali, m.asosiy, SaleInput{At: on, CurrencyID: ptr(int64(2)), Items: []ItemInput{line(m.olma, "1", "2")}, Payments: []ledger.PaymentLine{pay(m.cash, "25600")}})
	require.NoError(t, err, "a retail sale paid in full in another currency")
	assert.Equal(t, "2.00", retail.Paid)
}

// must is the value of a call that cannot fail here.
func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}
