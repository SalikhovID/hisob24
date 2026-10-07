package warehouse

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// stockOf is the product's stock in the location, "0.000" when there is
// no row.
func stockOf(t *testing.T, pool *pgxpool.Pool, locationID, productID int64) string {
	t.Helper()
	var s string
	err := pool.QueryRow(t.Context(), "SELECT quantity::text FROM stock WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s)
	if errors.Is(err, pgx.ErrNoRows) {
		return "0.000"
	}
	require.NoError(t, err)
	return s
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

func TestCreatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)

	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, PurchasedOn: "2026-10-07", Note: ptr(" Ertalab "), Paid: ptr("5000"),
		Items: []ItemInput{line(m.olma, "12.5", "1000"), line(m.nok, "3", "2500.5")},
	})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.EqualValues(t, 1, p.Number, "the company's first")
	assert.Equal(t, m.asosiy, p.LocationID)
	assert.Equal(t, "Asosiy", p.LocationName)
	assert.Equal(t, m.bozor, p.SupplierID)
	assert.Equal(t, "Bozor", p.SupplierName)
	assert.Equal(t, "2026-10-07", p.PurchasedOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Ertalab"), p.Note, "trimmed")
	assert.Equal(t, "20001.50", p.Total, "the lines, summed in the database")
	assert.Equal(t, "5000.00", p.Paid)
	assert.EqualValues(t, 2, p.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	assert.Equal(t, p.CreatedAt, p.UpdatedAt)
	assert.Equal(t, []Item{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "12.500", Price: "1000.00", Amount: "12500.00"},
		{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "3.000", Price: "2500.50", Amount: "7501.50"},
	}, p.Items, "in the order entered")
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "into the stock at once")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, m.nok))
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma), "the other location untouched")
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", sup.PurchasesTotal)
	assert.Equal(t, "5000.00", sup.PaymentsTotal, "what was paid with it")
	assert.Equal(t, "15001.50", sup.Balance, "owed")
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Equal(t, &p.ID, payments.Items[0].PurchaseID, "linked to the purchase")
	assert.Equal(t, ptr(int32(1)), payments.Items[0].PurchaseNumber)
	assert.Equal(t, "5000.00", payments.Items[0].Amount)
	assert.Equal(t, "2026-10-07", payments.Items[0].PaidOn.Format(time.DateOnly), "on the purchase's day")
	assert.Equal(t, ptr("Ali aka"), payments.Items[0].CreatedByName)

	second, err := s.CreatePurchase(ctx, m.scope(), vali, m.chilonzor, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-08", Items: []ItemInput{line(m.olma, "1", "900")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, second.Number, "the next number")
	assert.Equal(t, "0.00", second.Paid, "nothing paid: no payment")
	assert.Nil(t, second.Note)
	assert.Nil(t, second.CreatedByName, "Vali goes by no name")
	payments, err = s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.Len(t, payments.Items, 1, "no payment of 0")
	assert.Equal(t, "1.000", stockOf(t, pool, m.chilonzor, m.olma))
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "each location its own")
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
	ok := []ItemInput{line(m.olma, "1", "1000")}
	on := "2026-10-07"

	for name, tc := range map[string]struct {
		location int64
		in       PurchaseInput
		message  string
	}{
		"no location":           {0, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok}, "Lokatsiyani tanlang"},
		"a location outside":    {nok.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok}, "Lokatsiyani tanlang"},
		"no supplier":           {m.asosiy, PurchaseInput{PurchasedOn: on, Items: ok}, "Ta'minotchini tanlang"},
		"another's supplier":    {m.asosiy, PurchaseInput{SupplierID: foreign.ID, PurchasedOn: on, Items: ok}, "Ta'minotchini tanlang"},
		"an inactive supplier":  {m.asosiy, PurchaseInput{SupplierID: off.ID, PurchasedOn: on, Items: ok}, "Ta'minotchi nofaol"},
		"no day":                {m.asosiy, PurchaseInput{SupplierID: m.bozor, Items: ok}, "Sanani kiriting"},
		"a bad day":             {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "7.10.2026", Items: ok}, "Sana noto'g'ri"},
		"a long note":           {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Note: ptr(strings.Repeat("x", 501)), Items: ok}, "Izoh 500 belgidan oshmasin"},
		"no lines":              {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on}, "Kamida bitta mahsulot qo'shing"},
		"no product":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{Quantity: ptr("1"), Price: ptr("1")}}}, "Mahsulotni tanlang"},
		"another's product":     {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(theirs, "1", "1")}}, "Mahsulotni tanlang"},
		"a service":             {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(service, "1", "1")}}, "Xizmat xaridga kiritilmaydi"},
		"an inactive product":   {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(eski, "1", "1")}}, "Mahsulot nofaol"},
		"a product twice":       {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.olma, "1", "1"), line(m.olma, "2", "1")}}, "«Olma» ikki marta kiritilgan"},
		"no quantity":           {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{ProductID: m.olma, Price: ptr("1")}}}, "«Olma» miqdori noto'g'ri"},
		"a zero quantity":       {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.olma, "0", "1")}}, "«Olma» miqdori noto'g'ri"},
		"no price":              {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{ProductID: m.nok, Quantity: ptr("1")}}}, "«Nok» narxi noto'g'ri"},
		"a bad price":           {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.nok, "1", "1,5")}}, "«Nok» narxi noto'g'ri"},
		"a bad paid amount":     {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok, Paid: ptr("-1")}, "To'langan summa noto'g'ri"},
		"the first wrong thing": {m.asosiy, PurchaseInput{SupplierID: off.ID, PurchasedOn: "x", Items: nil}, "Ta'minotchi nofaol"},
	} {
		_, err := s.CreatePurchase(ctx, m.scope(), ali, tc.location, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma), "nothing was written")
	n, err := s.q.NextPurchaseNumber(ctx, m.company)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "no number was taken")
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok, Paid: ptr("99999")})
	assert.NoError(t, err, "paying more than the total is an advance")
	_, err = s.CreatePurchase(ctx, m.scope(m.chilonzor), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok})
	refused(t, err, apperr.Invalid, "validation_error", "Lokatsiyani tanlang", "a restricted member's other location (the handler answers 403 before)")
}

func TestAPurchaseIsWrittenWholeOrNotAtAll(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	pgtest.FailInserts(t, pool, "purchase_items")

	_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1")}, Paid: ptr("1")})

	require.Error(t, err)
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM purchases WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count, "the head is not kept without its lines")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma))
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM supplier_payments WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count)
}

func TestGetAndListPurchases(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-01", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	second, err := s.CreatePurchase(ctx, m.scope(), ali, m.chilonzor, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-05", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	third, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-05", Items: []ItemInput{line(m.olma, "1", "1")}})
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
	assert.Empty(t, page.Items[0].Items, "the list carries no lines")
	assert.EqualValues(t, 1, page.Items[0].ItemsCount, "but says how many there are")
}

func TestUpdatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	anor := addProduct(t, pool, m.company, "Anor", ptr("kg"), true)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("5000"),
		Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")},
	})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "5", "1000")}})
	require.NoError(t, err)

	// Olma down to 4 (−6), Nok out (−3), Anor in (+2); another supplier,
	// another day, more paid.
	saved, err := s.UpdatePurchase(ctx, m.scope(), vali, p.ID, PurchaseInput{
		SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Note: ptr("Qayta"), Paid: ptr("7000"),
		Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number, "the number stays")
	assert.Equal(t, m.asosiy, saved.LocationID, "the location stays")
	assert.Equal(t, dehqon.ID, saved.SupplierID)
	assert.Equal(t, "Dehqon", saved.SupplierName)
	assert.Equal(t, "2026-10-09", saved.PurchasedOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.Equal(t, "10400.00", saved.Total, "2 × 3000 + 4 × 1100")
	assert.Equal(t, "7000.00", saved.Paid)
	assert.EqualValues(t, 2, saved.ItemsCount)
	assert.Equal(t, []int64{anor, m.olma}, []int64{saved.Items[0].ProductID, saved.Items[1].ProductID}, "the new order")
	assert.Equal(t, ptr("Ali aka"), saved.CreatedByName, "who entered it stays")
	assert.True(t, saved.UpdatedAt.After(p.UpdatedAt))
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "15 − 6: by the difference")
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
	assert.Equal(t, "2026-10-09", payments.Items[0].PaidOn.Format(time.DateOnly), "on the purchase's new day")
	assert.Equal(t, ptr("Ali aka"), payments.Items[0].CreatedByName, "the payment is the one entered with the purchase, changed")

	// Paid down to nothing: the linked payment goes; then back: a new one,
	// entered by whoever saves.
	saved, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "0.00", saved.Paid)
	payments, err = s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	assert.Empty(t, payments.Items)
	saved, err = s.UpdatePurchase(ctx, m.scope(), vali, p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Paid: ptr("100"), Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "100.00", saved.Paid)
	payments, err = s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Nil(t, payments.Items[0].CreatedByName, "Vali entered the new one")
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "the same lines: the stock is as it was")

	// An inactive supplier or product already in the purchase stays; a new
	// one has to be active.
	_, err = s.SetSupplierActive(ctx, m.company, dehqon.ID, false)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE products SET is_active = false WHERE id = $1", anor)
	require.NoError(t, err)
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	assert.NoError(t, err, "what the purchase already names is kept, changed quantity and all")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, anor))
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "Olma out of this purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000"), line(m.nok, "1", "1")}})
	assert.NoError(t, err, "Nok is active, Bozor too")
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(eski, "1", "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Mahsulot nofaol", "a product new to the purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.Invalid, "validation_error", "Ta'minotchi nofaol", "a supplier new to the purchase")

	_, err = s.UpdatePurchase(ctx, m.scope(m.chilonzor), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, 999999, PurchaseInput{})
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "the record before its fields")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09"})
	refused(t, err, apperr.Invalid, "validation_error", "Kamida bitta mahsulot qo'shing")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, anor), "a refused edit changes nothing")
}

func TestAnEditThatWouldTakeMoreThanTheStockHasIsRefused(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "10", "1000")}})
	require.NoError(t, err)
	// Something else took 8 of the 10 (a sale, one day).
	_, err = pool.Exec(ctx, "UPDATE stock SET quantity = 2 WHERE location_id = $1 AND product_id = $2", m.asosiy, m.olma)
	require.NoError(t, err)

	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1000")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q", "2 − 9 would be below zero")
	got, err := s.GetPurchase(ctx, m.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, "10.000", got.Items[0].Quantity, "nothing changed")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.olma))
	err = s.DeletePurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q")
	_, err = s.GetPurchase(ctx, m.scope(), p.ID)
	assert.NoError(t, err, "the purchase stays")
	_, err = s.UpdatePurchase(ctx, m.scope(), ali, p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "12", "1000")}})
	assert.NoError(t, err, "+2 is fine")
	assert.Equal(t, "4.000", stockOf(t, pool, m.asosiy, m.olma))
}

func TestDeletePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("500"), Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")}})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "5", "1000")}})
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
	next, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-08", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 3, next.Number, "a deleted purchase keeps its number")
}

func TestAPurchasesPaymentIsChangedThroughThePurchaseAlone(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("500"), Items: []ItemInput{line(m.olma, "1", "1000")}})
	require.NoError(t, err)
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	linked := payments.Items[0].ID

	_, err = s.UpdatePayment(ctx, m.company, m.bozor, linked, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
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
	in := PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1")}}

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
