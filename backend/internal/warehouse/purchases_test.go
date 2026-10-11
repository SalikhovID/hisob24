package warehouse

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// stockOf is the product's stock in the location: the sum of its moves,
// "0.000" with none.
func stockOf(t *testing.T, pool *pgxpool.Pool, locationID, productID int64) string {
	t.Helper()
	var s string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT COALESCE(sum(quantity), 0)::numeric(14,3)::text FROM stock_moves WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s))
	return s
}

// sold takes the product's quantity out of the location, as a sale would.
func sold(t *testing.T, pool *pgxpool.Pool, s shop, productID int64, quantity string) {
	t.Helper()
	ctx := t.Context()
	var rate int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM currency_rates WHERE company_id = $1 ORDER BY id LIMIT 1", s.company).Scan(&rate))
	var id int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, currency_rate_id, created_by)
		VALUES ($1, 'sale', (SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = 'sale'), now(), $2, $3, $4) RETURNING id`, s.company, s.asosiy, rate, ali).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, -$5::numeric)", id, s.company, s.asosiy, productID, quantity)
	require.NoError(t, err)
}

// market is a shop with a supplier and two products, Olma (kg) and Nok (dona).
type market struct {
	shop
	bozor, olma, nok int64
}

func newMarket(t *testing.T, s *Service, pool *pgxpool.Pool) market {
	t.Helper()
	m := market{shop: newShop(t, pool, "Olma")}
	bozor, err := s.CreateSupplier(t.Context(), m.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	m.bozor = bozor.ID
	m.olma = addProduct(t, pool, m.company, "Olma", ptr("kg"), true)
	m.nok = addProduct(t, pool, m.company, "Nok", ptr("dona"), true)
	return m
}

// nowhere is a member with no location in the shop.
func (s shop) nowhere() Scope {
	return Scope{CompanyID: s.company, LocationIDs: []int64{}}
}

func line(productID int64, quantity, price string) ItemInput {
	return ItemInput{ProductID: productID, Quantity: ptr(quantity), Price: ptr(price)}
}

// purchaseOf is a purchase input of the supplier at the usual moment with
// the lines.
func purchaseOf(supplierID int64, items ...ItemInput) PurchaseInput {
	return PurchaseInput{SupplierID: supplierID, At: on, Items: items}
}

func TestCreatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)

	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, At: on, Note: ptr(" Ertalab "), Payments: []ledger.PaymentLine{pay(m.cash, "5000")},
		Items: []ItemInput{line(m.olma, "12.5", "1000"), line(m.nok, "3", "2500.5")},
	})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.EqualValues(t, 1, p.Number, "the company's first")
	assert.Equal(t, m.asosiy, p.LocationID)
	assert.Equal(t, "Asosiy", p.LocationName)
	assert.Equal(t, m.bozor, p.SupplierID)
	assert.Equal(t, "Bozor", p.SupplierName)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), p.At, "9:00 in Tashkent, kept in UTC")
	assert.EqualValues(t, 1, p.CurrencyID, "so'm unless told")
	assert.Equal(t, "1.0000", p.Rate)
	assert.Equal(t, ptr("Ertalab"), p.Note, "trimmed")
	assert.Equal(t, "20001.50", p.Total, "the lines, summed in the database")
	assert.Equal(t, "20001.50", p.TotalUZS)
	assert.Equal(t, "5000.00", p.Paid)
	assert.EqualValues(t, 2, p.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	assert.Equal(t, p.CreatedAt, p.UpdatedAt)
	assert.Equal(t, []Item{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "12.500", Price: "1000.00", Amount: "12500.00"},
		{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "3.000", Price: "2500.50", Amount: "7501.50"},
	}, p.Items, "in the order entered")
	require.Len(t, p.Payments, 1)
	assert.Equal(t, LinkedPayment{ID: p.Payments[0].ID, BankAccountID: m.cash, AccountName: "Naqd", Amount: "5000.00", CurrencyID: 1}, p.Payments[0])
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "into the stock at once")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, m.nok))
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma), "the other location untouched")
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", sup.PurchasesTotal)
	assert.Equal(t, "5000.00", sup.PaymentsTotal, "what was paid with it")
	assert.Equal(t, "15001.50", sup.Balance, "owed")
	assert.Equal(t, []BalanceLine{{CurrencyID: 1, Amount: "15001.50"}}, sup.BalanceByCurrency)
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Equal(t, &p.ID, payments.Items[0].PurchaseID, "linked to the purchase")
	assert.Equal(t, ptr(int32(1)), payments.Items[0].PurchaseNumber)
	assert.Equal(t, m.cash, payments.Items[0].BankAccountID)
	assert.Equal(t, "5000.00", payments.Items[0].Amount)
	assert.Equal(t, p.At, payments.Items[0].At, "at the purchase's moment")
	assert.Equal(t, ptr("Ali aka"), payments.Items[0].CreatedByName)

	second, err := s.CreatePurchase(ctx, m.scope(), vali, m.chilonzor, PurchaseInput{SupplierID: m.bozor, At: "2026-10-08T10:30:00+05:00", Items: []ItemInput{line(m.olma, "1", "900")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, second.Number, "the next number")
	assert.Equal(t, "0.00", second.Paid, "nothing paid: no payment")
	assert.Empty(t, second.Payments)
	assert.Nil(t, second.Note)
	assert.Nil(t, second.CreatedByName, "Vali goes by no name")
	payments, err = s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.Len(t, payments.Items, 1, "no payment of nothing")
	assert.Equal(t, "1.000", stockOf(t, pool, m.chilonzor, m.olma))
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "each location its own")
}

func TestCreatePurchaseInDollars(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	standardRate(t, pool, m.company, "12800", "2026-10-01 00:00+05")
	card := addAccount(t, pool, m.company, "Karta", 2, true)
	usd := ptr(int64(2))

	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, At: on, CurrencyID: usd, Items: []ItemInput{line(m.olma, "2", "50")},
		Payments: []ledger.PaymentLine{pay(m.cash, "640000"), pay(card, "10")},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 2, p.CurrencyID)
	assert.Equal(t, "12800.0000", p.Rate, "the standard rate at the moment")
	assert.Equal(t, "100.00", p.Total, "in dollars")
	assert.Equal(t, "1280000.00", p.TotalUZS)
	assert.Equal(t, "60.00", p.Paid, "640 000 so'm at 12 800 and 10 dollars, in the purchase's currency")
	assert.Equal(t, []LinkedPayment{
		{ID: p.Payments[0].ID, BankAccountID: m.cash, AccountName: "Naqd", Amount: "640000.00", CurrencyID: 1},
		{ID: p.Payments[1].ID, BankAccountID: card, AccountName: "Karta", Amount: "10.00", CurrencyID: 2},
	}, p.Payments, "each payment in its account's currency")
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "512000.00", sup.Balance, "1 280 000 − 640 000 − 128 000, in so'm")
	assert.Equal(t, []BalanceLine{{CurrencyID: 1, Amount: "-640000.00"}, {CurrencyID: 2, Amount: "90.00"}}, sup.BalanceByCurrency, "and by currency, as is")

	own, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, CurrencyID: usd, Rate: ptr("13000"), Items: []ItemInput{line(m.olma, "2", "50")}})
	require.NoError(t, err)
	assert.Equal(t, "13000.0000", own.Rate, "the document's own rate")
	assert.Equal(t, "1300000.00", own.TotalUZS)

	for name, tc := range map[string]struct {
		in      PurchaseInput
		code    string
		message string
	}{
		"a bad rate":          {PurchaseInput{SupplierID: m.bozor, At: on, CurrencyID: usd, Rate: ptr("12 800"), Items: []ItemInput{line(m.olma, "1", "1")}}, "validation_error", "Kurs noto'g'ri"},
		"a currency off":      {PurchaseInput{SupplierID: m.bozor, At: on, CurrencyID: ptr(int64(3)), Items: []ItemInput{line(m.olma, "1", "1")}}, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan"},
		"a rate for the so'm": {PurchaseInput{SupplierID: m.bozor, At: on, Rate: ptr("2"), Items: []ItemInput{line(m.olma, "1", "1")}}, "validation_error", "Kurs noto'g'ri"},
	} {
		_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, tc.in)
		refused(t, err, apperr.Invalid, tc.code, tc.message, name)
	}
	turnOn(t, pool, m.company, 3)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, CurrencyID: ptr(int64(3)), Items: []ItemInput{line(m.olma, "1", "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "the euro is on, its rate is not set")
	euro := addAccount(t, pool, m.company, "Yevro", 3, true)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}, Payments: []ledger.PaymentLine{pay(euro, "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "a payment out of an account whose currency has no rate")
}

func TestCreatePurchaseRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	nok := newShop(t, pool, "Nok")
	foreign, err := s.CreateSupplier(ctx, nok.company, ali, SupplierInput{Name: "Begona"})
	require.NoError(t, err)
	off, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Yopiq"})
	require.NoError(t, err)
	_, err = s.SetSupplierActive(ctx, m.company, off.ID, false)
	require.NoError(t, err)
	service := addProduct(t, pool, m.company, "Yetkazish", nil, true)
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	theirs := addProduct(t, pool, nok.company, "Begona", ptr("kg"), true)
	closed := addAccount(t, pool, m.company, "Yopiq", 1, false)
	ok := []ItemInput{line(m.olma, "1", "1000")}

	for name, tc := range map[string]struct {
		location int64
		in       PurchaseInput
		message  string
	}{
		"no location":           {0, purchaseOf(m.bozor, ok...), "Lokatsiyani tanlang"},
		"a location outside":    {nok.asosiy, purchaseOf(m.bozor, ok...), "Lokatsiyani tanlang"},
		"no supplier":           {m.asosiy, purchaseOf(0, ok...), "Ta'minotchini tanlang"},
		"another's supplier":    {m.asosiy, purchaseOf(foreign.ID, ok...), "Ta'minotchini tanlang"},
		"an inactive supplier":  {m.asosiy, purchaseOf(off.ID, ok...), "Ta'minotchi nofaol"},
		"no time":               {m.asosiy, PurchaseInput{SupplierID: m.bozor, Items: ok}, "Vaqtni kiriting"},
		"a bad time":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "7.10.2026", Items: ok}, "Vaqt noto'g'ri"},
		"a long note":           {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Note: ptr(strings.Repeat("x", 501)), Items: ok}, "Izoh 500 belgidan oshmasin"},
		"no lines":              {m.asosiy, purchaseOf(m.bozor), "Kamida bitta mahsulot qo'shing"},
		"no product":            {m.asosiy, purchaseOf(m.bozor, ItemInput{Quantity: ptr("1"), Price: ptr("1")}), "Mahsulotni tanlang"},
		"another's product":     {m.asosiy, purchaseOf(m.bozor, line(theirs, "1", "1")), "Mahsulotni tanlang"},
		"a service":             {m.asosiy, purchaseOf(m.bozor, line(service, "1", "1")), "Xizmat xaridga kiritilmaydi"},
		"an inactive product":   {m.asosiy, purchaseOf(m.bozor, line(eski, "1", "1")), "Mahsulot nofaol"},
		"a product twice":       {m.asosiy, purchaseOf(m.bozor, line(m.olma, "1", "1"), line(m.olma, "2", "1")), "«Olma» ikki marta kiritilgan"},
		"no quantity":           {m.asosiy, purchaseOf(m.bozor, ItemInput{ProductID: m.olma, Price: ptr("1")}), "«Olma» miqdori noto'g'ri"},
		"a zero quantity":       {m.asosiy, purchaseOf(m.bozor, line(m.olma, "0", "1")), "«Olma» miqdori noto'g'ri"},
		"no price":              {m.asosiy, purchaseOf(m.bozor, ItemInput{ProductID: m.nok, Quantity: ptr("1")}), "«Nok» narxi noto'g'ri"},
		"a bad price":           {m.asosiy, purchaseOf(m.bozor, line(m.nok, "1", "1,5")), "«Nok» narxi noto'g'ri"},
		"no account":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(0, "1")}}, "Akkauntni tanlang"},
		"another's account":     {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(nok.cash, "1")}}, "Akkauntni tanlang"},
		"an inactive account":   {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(closed, "1")}}, "Akkaunt nofaol"},
		"a bad payment":         {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "-1")}}, "To'lov summasi noto'g'ri"},
		"a payment of nothing":  {m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "0")}}, "To'lov summasi noto'g'ri"},
		"the first wrong thing": {m.asosiy, PurchaseInput{SupplierID: off.ID, At: "x", Items: nil}, "Ta'minotchi nofaol"},
	} {
		_, err := s.CreatePurchase(ctx, m.scope(), ali, tc.location, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma), "nothing was written")
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count, "no document, no payment")
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: ok, Payments: []ledger.PaymentLine{pay(m.cash, "99999")}})
	assert.NoError(t, err, "paying more than the total is an advance")
	_, err = s.CreatePurchase(ctx, m.scope(m.chilonzor), ali, m.asosiy, purchaseOf(m.bozor, ok...))
	refused(t, err, apperr.Invalid, "validation_error", "Lokatsiyani tanlang", "a restricted member's other location (the handler answers 403 before)")
}

func TestAPurchaseIsWrittenWholeOrNotAtAll(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	pgtest.FailInserts(t, pool, "stock_moves")

	_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}, Payments: []ledger.PaymentLine{pay(m.cash, "1")}})

	require.Error(t, err)
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count, "the head is not kept without its moves")
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transaction_items").Scan(&count))
	assert.Zero(t, count)
}

func TestAPurchaseWhosePaymentCannotBeWrittenIsNotWritten(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	closed := addAccount(t, pool, m.company, "Yopiq", 1, false)

	_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}, Payments: []ledger.PaymentLine{pay(m.cash, "1"), pay(closed, "1")}})

	refused(t, err, apperr.Invalid, "validation_error", "Akkaunt nofaol")
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count, "neither the purchase nor the first payment")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma))
}

func TestGetAndListPurchases(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-01T09:00:00+05:00", Items: []ItemInput{line(m.olma, "1", "1")}, Payments: []ledger.PaymentLine{pay(m.cash, "1")}})
	require.NoError(t, err)
	second, err := s.CreatePurchase(ctx, m.scope(), ali, m.chilonzor, PurchaseInput{SupplierID: dehqon.ID, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	third, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	numbers := func(scope Scope, in PurchaseListInput) []int32 {
		page, err := s.ListPurchases(ctx, scope, in)
		require.NoError(t, err)
		out := make([]int32, 0, len(page.Items))
		for _, p := range page.Items {
			out = append(out, p.Number)
		}
		return out
	}

	got, err := s.GetPurchase(ctx, m.scope(), first.ID)
	require.NoError(t, err)
	assert.Equal(t, first, got)
	_, err = s.GetPurchase(ctx, m.scope(m.chilonzor), first.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	_, err = s.GetPurchase(ctx, m.scope(), 999999)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi")
	_, err = s.GetPurchase(ctx, m.scope(), first.Payments[0].ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "a payment is no purchase")

	assert.Equal(t, []int32{3, 2, 1}, numbers(m.scope(), PurchaseListInput{Page: 1}), "the newest first, then the later entered")
	assert.Equal(t, []int32{3, 1}, numbers(m.scope(), PurchaseListInput{LocationID: m.asosiy, Page: 1}), "one location")
	assert.Equal(t, []int32{2}, numbers(m.scope(m.chilonzor), PurchaseListInput{Page: 1}), "a restricted member's locations")
	assert.Equal(t, []int32{2}, numbers(m.scope(), PurchaseListInput{SupplierID: dehqon.ID, Page: 1}), "one supplier")
	assert.Empty(t, numbers(m.nowhere(), PurchaseListInput{Page: 1}), "no location, no purchases")
	assert.Empty(t, numbers(m.scope(m.asosiy), PurchaseListInput{LocationID: m.chilonzor, Page: 1}), "a location outside the scope counts as none (the handler answers 403 before)")
	_, err = s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	page, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 3, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	assert.Equal(t, third.ID, page.Items[0].ID)
	assert.Equal(t, second.ID, page.Items[1].ID)
	assert.Empty(t, page.Items[2].Items, "the list carries no lines")
	assert.Empty(t, page.Items[2].Payments, "nor payments")
	assert.Equal(t, "1.00", page.Items[2].Paid, "but what was paid")
	assert.EqualValues(t, 1, page.Items[0].ItemsCount, "and how many lines there are")
}

func TestUpdatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	anor := addProduct(t, pool, m.company, "Anor", ptr("kg"), true)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, At: on, Payments: []ledger.PaymentLine{pay(m.cash, "5000")},
		Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")},
	})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "5", "1000")}})
	require.NoError(t, err)

	// Olma down to 4 (−6), Nok out (−3), Anor in (+2); another supplier,
	// another moment, more paid.
	later := "2026-10-09T18:00:00+05:00"
	saved, err := s.UpdatePurchase(ctx, m.scope(), vali, p.ID, PurchaseInput{
		SupplierID: dehqon.ID, At: later, Note: ptr("Qayta"), Payments: []ledger.PaymentLine{pay(m.cash, "7000")},
		Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number, "the number stays")
	assert.Equal(t, m.asosiy, saved.LocationID, "the location stays")
	assert.Equal(t, dehqon.ID, saved.SupplierID)
	assert.Equal(t, "Dehqon", saved.SupplierName)
	assert.Equal(t, time.Date(2026, 10, 9, 13, 0, 0, 0, time.UTC), saved.At)
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.Equal(t, "10400.00", saved.Total, "2 × 3000 + 4 × 1100")
	assert.Equal(t, "7000.00", saved.Paid)
	assert.EqualValues(t, 2, saved.ItemsCount)
	assert.Equal(t, []int64{anor, m.olma}, []int64{saved.Items[0].ProductID, saved.Items[1].ProductID}, "the new order")
	assert.Equal(t, ptr("Ali aka"), saved.CreatedByName, "who entered it stays")
	assert.True(t, saved.UpdatedAt.After(p.UpdatedAt))
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "15 − 6: written anew")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok), "taken back")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, anor), "added")
	bozor, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "5000.00", bozor.PurchasesTotal, "the other purchase alone")
	assert.Equal(t, "0.00", bozor.PaymentsTotal, "the payment went with the purchase")
	theirs, err := s.GetSupplier(ctx, m.company, dehqon.ID)
	require.NoError(t, err)
	assert.Equal(t, "10400.00", theirs.PurchasesTotal)
	assert.Equal(t, "7000.00", theirs.PaymentsTotal)
	payments, err := s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Equal(t, saved.At, payments.Items[0].At, "at the purchase's new moment")
	assert.Nil(t, payments.Items[0].CreatedByName, "the payments are written anew by whoever saves (Vali)")
	assert.NotEqual(t, p.Payments[0].ID, payments.Items[0].ID)
	old, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.Empty(t, old.Items, "the old payment is hidden")

	// Paid nothing: the linked payments go; then back: new ones.
	saved, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, At: later, Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "0.00", saved.Paid)
	assert.Empty(t, saved.Payments)
	payments, err = s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	assert.Empty(t, payments.Items)
	saved, err = s.UpdatePurchase(ctx, m.scope(), vali, p.ID, PurchaseInput{SupplierID: dehqon.ID, At: later, Payments: []ledger.PaymentLine{pay(m.cash, "100")}, Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "100.00", saved.Paid)
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "the same lines: the stock is as it was")

	// An inactive supplier, product or account already in the purchase
	// stays; a new one has to be active.
	_, err = s.SetSupplierActive(ctx, m.company, dehqon.ID, false)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE products SET is_active = false WHERE id = $1", anor)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE bank_accounts SET is_active = false WHERE id = $1", m.cash)
	require.NoError(t, err)
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, At: later, Payments: []ledger.PaymentLine{pay(m.cash, "200")}, Items: []ItemInput{line(anor, "3", "3000")}})
	assert.NoError(t, err, "what the purchase already names is kept, changed quantity and amount and all")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, anor))
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "Olma out of this purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: later, Items: []ItemInput{line(anor, "3", "3000"), line(m.nok, "1", "1")}})
	assert.NoError(t, err, "Nok is active, Bozor too")
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: later, Items: []ItemInput{line(eski, "1", "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Mahsulot nofaol", "a product new to the purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, At: later, Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.Invalid, "validation_error", "Ta'minotchi nofaol", "a supplier new to the purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: later, Payments: []ledger.PaymentLine{pay(m.cash, "1")}, Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.Invalid, "validation_error", "Akkaunt nofaol", "an account the purchase no longer pays from")

	_, err = s.UpdatePurchase(ctx, m.scope(m.chilonzor), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: later, Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, 999999, PurchaseInput{})
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "the record before its fields")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: later})
	refused(t, err, apperr.Invalid, "validation_error", "Kamida bitta mahsulot qo'shing")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, anor), "a refused edit changes nothing")
}

func TestAnEditThatWouldTakeMoreThanTheStockHasIsRefused(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "10", "1000")}})
	require.NoError(t, err)
	// Something else took 8 of the 10 (a sale, one day).
	sold(t, pool, m.shop, m.olma, "8")

	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1000")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "1 − 8 would be below zero")
	got, err := s.GetPurchase(ctx, m.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, "10.000", got.Items[0].Quantity, "nothing changed")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.olma))
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.nok, "1", "1000")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "Olma out of the purchase altogether")
	err = s.DeletePurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	_, err = s.GetPurchase(ctx, m.scope(), p.ID)
	assert.NoError(t, err, "the purchase stays")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "12", "1000")}})
	assert.NoError(t, err, "+2 is fine")
	assert.Equal(t, "4.000", stockOf(t, pool, m.asosiy, m.olma))
}

func TestDeletePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Payments: []ledger.PaymentLine{pay(m.cash, "500")}, Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")}})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "5", "1000")}})
	require.NoError(t, err)

	err = s.DeletePurchase(ctx, m.scope(m.chilonzor), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	require.NoError(t, s.DeletePurchase(ctx, m.scope(), p.ID))
	_, err = s.GetPurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi")
	err = s.DeletePurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "deleted already")
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "its quantity taken back")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok))
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "5000.00", sup.PurchasesTotal)
	assert.Equal(t, "0.00", sup.PaymentsTotal, "its payment went with it")
	assert.Equal(t, "5000.00", sup.Balance)
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.Empty(t, payments.Items)
	next, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 3, next.Number, "a deleted purchase keeps its number")
}

func TestAPurchasesPaymentIsChangedThroughThePurchaseAlone(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Payments: []ledger.PaymentLine{pay(m.cash, "500")}, Items: []ItemInput{line(m.olma, "1", "1000")}})
	require.NoError(t, err)
	linked := p.Payments[0].ID

	_, err = s.UpdatePayment(ctx, m.company, ali, m.bozor, linked, PaymentInput{BankAccountID: m.cash, Amount: ptr("1"), At: on})
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	err = s.DeletePayment(ctx, m.company, m.bozor, linked)
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	got, err := s.GetPurchase(ctx, m.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, "500.00", got.Paid, "it stays")
}

func TestTwoPurchasesEnteredAtOnceTakeTwoNumbers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	// Another write holds the company: the purchases wait for it.
	other, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = other.Rollback(context.Background()) })
	_, err = other.Exec(ctx, "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", m.company)
	require.NoError(t, err)
	in := PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}}

	done := make(chan error, 2)
	for range 2 {
		go func() {
			_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, in)
			done <- err
		}()
	}
	pgtest.WaitForLockWait(t, pool)
	select {
	case err := <-done:
		t.Fatalf("a purchase did not wait: %v", err)
	default:
	}
	require.NoError(t, other.Commit(ctx))
	require.NoError(t, <-done)
	require.NoError(t, <-done)

	page, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int32{2, 1}, []int32{page.Items[0].Number, page.Items[1].Number}, "in turn, two numbers")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.olma))
}
