package warehouse

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// stocked gives the market's Asosiy 10 Olma and 5 Nok through a purchase.
func stocked(t *testing.T, s *Service, m market) {
	t.Helper()
	_, err := s.CreatePurchase(t.Context(), m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-01T09:00:00+05:00", Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "5", "2000")}})
	require.NoError(t, err)
}

func move(productID int64, quantity string) ItemInput {
	return ItemInput{ProductID: productID, Quantity: ptr(quantity)}
}

func TestCreateTransfer(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)

	tr, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Note: ptr(" Filialga "), Items: []ItemInput{move(m.olma, "4"), move(m.nok, "1.5")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, tr.Number, "the first transfer")
	assert.Equal(t, m.asosiy, tr.LocationID)
	assert.Equal(t, "Asosiy", tr.LocationName)
	assert.Equal(t, m.chilonzor, tr.ToLocationID)
	assert.Equal(t, "Chilonzor", tr.ToLocationName)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), tr.At)
	assert.Equal(t, ptr("Filialga"), tr.Note)
	assert.EqualValues(t, 2, tr.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), tr.CreatedByName)
	assert.Equal(t, []TransferItem{{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "4.000"}, {ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "1.500"}}, tr.Items)
	assert.Equal(t, "6.000", stockOf(t, pool, m.asosiy, m.olma), "out of the one")
	assert.Equal(t, "4.000", stockOf(t, pool, m.chilonzor, m.olma), "into the other, at once")
	assert.Equal(t, "1.500", stockOf(t, pool, m.chilonzor, m.nok))
	next, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, next.Number, "numbered among the transfers")
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: on, Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	purchases, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 2, purchases.Items[0].Number, "the purchases count on their own")
}

func TestCreateTransferRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	nok := newShop(t, pool, "Nok")
	service := addProduct(t, pool, m.company, "Yetkazish", nil, true)
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	ok := []ItemInput{move(m.olma, "1")}
	var gone int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name, deleted_at) VALUES ($1, 'Yopiq', now()) RETURNING id", m.company).Scan(&gone))

	for name, tc := range map[string]struct {
		location int64
		in       TransferInput
		message  string
	}{
		"no location":           {0, TransferInput{ToLocationID: m.chilonzor, At: on, Items: ok}, "Lokatsiyani tanlang"},
		"a location outside":    {nok.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: ok}, "Lokatsiyani tanlang"},
		"no destination":        {m.asosiy, TransferInput{At: on, Items: ok}, "Maqsad lokatsiyani tanlang"},
		"another's destination": {m.asosiy, TransferInput{ToLocationID: nok.asosiy, At: on, Items: ok}, "Maqsad lokatsiyani tanlang"},
		"a deleted destination": {m.asosiy, TransferInput{ToLocationID: gone, At: on, Items: ok}, "Maqsad lokatsiyani tanlang"},
		"the same location":     {m.asosiy, TransferInput{ToLocationID: m.asosiy, At: on, Items: ok}, "Maqsad lokatsiya boshqa bo'lsin"},
		"no time":               {m.asosiy, TransferInput{ToLocationID: m.chilonzor, Items: ok}, "Vaqtni kiriting"},
		"a long note":           {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Note: ptr(strings.Repeat("x", 501)), Items: ok}, "Izoh 500 belgidan oshmasin"},
		"no lines":              {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on}, "Kamida bitta mahsulot qo'shing"},
		"a service":             {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(service, "1")}}, "Xizmat ombor hujjatiga kiritilmaydi"},
		"an inactive product":   {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(eski, "1")}}, "Mahsulot nofaol"},
		"a product twice":       {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "1"), move(m.olma, "1")}}, "«Olma» ikki marta kiritilgan"},
		"a quantity of nothing": {m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "0")}}, "«Olma» miqdori noto'g'ri"},
		"the destination first": {m.asosiy, TransferInput{ToLocationID: m.asosiy, At: "x"}, "Maqsad lokatsiya boshqa bo'lsin"},
	} {
		_, err := s.CreateTransfer(ctx, m.scope(), ali, tc.location, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "11")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "more than the location has")
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma), "nothing moved")
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma))
	_, err = s.CreateTransfer(ctx, m.scope(m.chilonzor), ali, m.chilonzor, TransferInput{ToLocationID: m.asosiy, At: on, Items: ok})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "a restricted member may move out of their location alone, and it is empty")
}

func TestListGetUpdateAndDeleteTransfers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	var qoyliq int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Qo''yliq') RETURNING id", m.company).Scan(&qoyliq))
	first, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: "2026-10-02T09:00:00+05:00", Items: []ItemInput{move(m.olma, "4"), move(m.nok, "1")}})
	require.NoError(t, err)
	second, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: qoyliq, At: "2026-10-03T09:00:00+05:00", Items: []ItemInput{move(m.olma, "1")}})
	require.NoError(t, err)
	numbers := func(scope Scope, locationID int64) []int32 {
		page, err := s.ListTransfers(ctx, scope, DocumentListInput{LocationID: locationID, Page: 1})
		require.NoError(t, err)
		out := make([]int32, 0, len(page.Items))
		for _, tr := range page.Items {
			out = append(out, tr.Number)
		}
		return out
	}

	assert.Equal(t, []int32{2, 1}, numbers(m.scope(), 0), "the newest first")
	assert.Equal(t, []int32{1}, numbers(m.scope(), m.chilonzor), "by either end")
	assert.Equal(t, []int32{1}, numbers(m.scope(m.chilonzor), 0), "a member of the destination alone sees it")
	assert.Empty(t, numbers(m.scope(m.chilonzor), m.asosiy), "a location outside the scope counts as none")
	got, err := s.GetTransfer(ctx, m.scope(m.chilonzor), first.ID)
	require.NoError(t, err)
	assert.Equal(t, first, got)
	assert.Empty(t, numbers(m.nowhere(), 0))
	_, err = s.GetTransfer(ctx, m.scope(m.chilonzor), second.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ko'chirish topilmadi", "neither end is theirs")
	_, err = s.ListTransfers(ctx, m.scope(), DocumentListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")

	// An edit: another destination, fewer Olma, Nok out; the moves follow in
	// all three locations.
	saved, err := s.UpdateTransfer(ctx, m.scope(), first.ID, TransferInput{ToLocationID: qoyliq, At: "2026-10-04T09:00:00+05:00", Note: ptr("Qayta"), Items: []ItemInput{move(m.olma, "2")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, m.asosiy, saved.LocationID, "where it comes out of stays")
	assert.Equal(t, qoyliq, saved.ToLocationID)
	assert.Equal(t, "Qo'yliq", saved.ToLocationName)
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.Len(t, saved.Items, 1)
	assert.Equal(t, "7.000", stockOf(t, pool, m.asosiy, m.olma), "10 − 2 − 1")
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma), "taken back from the old destination")
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.nok))
	assert.Equal(t, "3.000", stockOf(t, pool, qoyliq, m.olma), "2 + 1")
	_, err = s.UpdateTransfer(ctx, m.scope(m.chilonzor), first.ID, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "1")}})
	refused(t, err, apperr.NotFound, "not_found", "Ko'chirish topilmadi", "no longer seen from Chilonzor")
	_, err = s.UpdateTransfer(ctx, m.scope(qoyliq), first.ID, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "1")}})
	refused(t, err, apperr.Forbidden, "forbidden", "Bu amal uchun ruxsatingiz yo'q", "seen from its destination alone: not theirs to change")
	err = s.DeleteTransfer(ctx, m.scope(qoyliq), first.ID)
	refused(t, err, apperr.Forbidden, "forbidden", "Bu amal uchun ruxsatingiz yo'q")
	// The second transfer goes: its Olma comes back to Asosiy.
	require.NoError(t, s.DeleteTransfer(ctx, m.scope(), second.ID))
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma), "its Olma back")
	assert.Equal(t, "2.000", stockOf(t, pool, qoyliq, m.olma))
	_, err = s.GetTransfer(ctx, m.scope(), second.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ko'chirish topilmadi")
	// What went into Qo'yliq with the first was sold there: the transfer
	// cannot shrink, go elsewhere or go.
	sold(t, pool, shop{company: m.company, asosiy: qoyliq}, m.olma, "2")
	_, err = s.UpdateTransfer(ctx, m.scope(), first.ID, TransferInput{ToLocationID: qoyliq, At: on, Items: []ItemInput{move(m.olma, "1")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	_, err = s.UpdateTransfer(ctx, m.scope(), first.ID, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "2")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "moving it elsewhere takes it out of Qo'yliq")
	err = s.DeleteTransfer(ctx, m.scope(), first.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	assert.Equal(t, "0.000", stockOf(t, pool, qoyliq, m.olma), "nothing changed")
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma))

	third, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: on, Items: []ItemInput{move(m.olma, "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 3, third.Number, "a deleted transfer keeps its number")
}
