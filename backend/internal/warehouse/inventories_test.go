package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateInventory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	anor := addProduct(t, pool, m.company, "Anor", ptr("kg"), true)

	// Counted on the 7th: 9 Olma (one short), 5 Nok (as expected), 2 Anor
	// (never bought).
	inv, err := s.CreateInventory(ctx, m.scope(), ali, m.asosiy, InventoryInput{At: on, Note: ptr(" Oylik "), Items: []ItemInput{move(m.olma, "9"), move(m.nok, "5"), move(anor, "2")}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, inv.Number)
	assert.Equal(t, m.asosiy, inv.LocationID)
	assert.Equal(t, time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC), inv.At)
	assert.Equal(t, ptr("Oylik"), inv.Note)
	assert.EqualValues(t, 3, inv.ItemsCount)
	assert.Equal(t, []InventoryItem{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Expected: "10.000", Counted: "9.000", Difference: "-1.000"},
		{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Expected: "5.000", Counted: "5.000", Difference: "0.000"},
		{ProductID: anor, Name: "Anor", Unit: ptr("kg"), Expected: "0.000", Counted: "2.000", Difference: "2.000"},
	}, inv.Items, "what the journal expected at the moment, what was counted, the difference")
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "the difference moved the stock")
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.nok), "no difference, no move")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, anor))
	var moves int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM stock_moves WHERE transaction_id = $1", inv.ID).Scan(&moves))
	assert.Equal(t, 2, moves, "a difference of 0 writes no move")

	// A count dated before the purchase expects nothing: the whole count is a surplus.
	early, err := s.CreateInventory(ctx, m.scope(), ali, m.asosiy, InventoryInput{At: "2026-09-30T09:00:00+05:00", Items: []ItemInput{move(m.olma, "1")}})
	require.NoError(t, err)
	assert.Equal(t, InventoryItem{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Expected: "0.000", Counted: "1.000", Difference: "1.000"}, early.Items[0])
	assert.Equal(t, "10.000", stockOf(t, pool, m.asosiy, m.olma), "and the surplus is in the stock now")
	for name, tc := range map[string]struct {
		in      InventoryInput
		message string
	}{
		"no time":          {InventoryInput{Items: []ItemInput{move(m.olma, "1")}}, "Vaqtni kiriting"},
		"no lines":         {InventoryInput{At: on}, "Kamida bitta mahsulot qo'shing"},
		"a negative count": {InventoryInput{At: on, Items: []ItemInput{move(m.olma, "-1")}}, "«Olma» miqdori noto'g'ri"},
		"no count":         {InventoryInput{At: on, Items: []ItemInput{{ProductID: m.olma}}}, "«Olma» miqdori noto'g'ri"},
		"a product twice":  {InventoryInput{At: on, Items: []ItemInput{move(m.olma, "1"), move(m.olma, "2")}}, "«Olma» ikki marta kiritilgan"},
	} {
		_, err := s.CreateInventory(ctx, m.scope(), ali, m.asosiy, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.CreateInventory(ctx, m.scope(), ali, 0, InventoryInput{At: on, Items: []ItemInput{move(m.olma, "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Lokatsiyani tanlang")
	zero, err := s.CreateInventory(ctx, m.scope(), ali, m.asosiy, InventoryInput{At: on, Items: []ItemInput{move(m.nok, "0")}})
	require.NoError(t, err, "nothing counted is a count")
	assert.Equal(t, "-5.000", zero.Items[0].Difference)
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok))
}

func TestInventoriesAreListedEditedAndDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	inv, err := s.CreateInventory(ctx, m.scope(), ali, m.asosiy, InventoryInput{At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{move(m.olma, "8")}})
	require.NoError(t, err)
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma))
	other, err := s.CreateInventory(ctx, m.scope(), ali, m.chilonzor, InventoryInput{At: "2026-10-06T09:00:00+05:00", Items: []ItemInput{move(m.olma, "0")}})
	require.NoError(t, err)

	page, err := s.ListInventories(ctx, m.scope(), DocumentListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{other.ID, inv.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first")
	assert.Empty(t, page.Items[0].Items, "the list carries no lines")
	page, err = s.ListInventories(ctx, m.scope(m.chilonzor), DocumentListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 1, page.Total, "the member's locations")
	got, err := s.GetInventory(ctx, m.scope(), inv.ID)
	require.NoError(t, err)
	assert.Equal(t, inv, got)
	_, err = s.GetInventory(ctx, m.scope(m.chilonzor), inv.ID)
	refused(t, err, apperr.NotFound, "not_found", "Inventarizatsiya topilmadi")

	// A purchase dated before the count arrives late: the count's expected
	// stock is counted anew when it is saved again.
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, At: "2026-10-03T09:00:00+05:00", Items: []ItemInput{line(m.olma, "4", "1")}})
	require.NoError(t, err)
	assert.Equal(t, "12.000", stockOf(t, pool, m.asosiy, m.olma), "the count stands as it was: 8 + 4")
	saved, err := s.UpdateInventory(ctx, m.scope(), inv.ID, InventoryInput{At: "2026-10-05T09:00:00+05:00", Note: ptr("Qayta"), Items: []ItemInput{move(m.olma, "8"), move(m.nok, "4")}})
	require.NoError(t, err)
	assert.Equal(t, InventoryItem{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Expected: "14.000", Counted: "8.000", Difference: "-6.000"}, saved.Items[0], "10 + 4 expected now")
	assert.Equal(t, InventoryItem{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Expected: "5.000", Counted: "4.000", Difference: "-1.000"}, saved.Items[1])
	assert.Equal(t, "8.000", stockOf(t, pool, m.asosiy, m.olma), "back to what was counted")
	assert.Equal(t, "4.000", stockOf(t, pool, m.asosiy, m.nok))
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.EqualValues(t, 1, saved.Number)
	_, err = s.UpdateInventory(ctx, m.scope(), 999999, InventoryInput{})
	refused(t, err, apperr.NotFound, "not_found", "Inventarizatsiya topilmadi")

	// A surplus counted in and sold on: taking the count back would leave
	// the location short.
	saved, err = s.UpdateInventory(ctx, m.scope(), inv.ID, InventoryInput{At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{move(m.olma, "16")}})
	require.NoError(t, err)
	assert.Equal(t, "2.000", saved.Items[0].Difference)
	assert.Equal(t, "16.000", stockOf(t, pool, m.asosiy, m.olma))
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.nok), "the Nok line went, and its move with it")
	sold(t, pool, m.shop, m.olma, "15")
	err = s.DeleteInventory(ctx, m.scope(), inv.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "14 − 15 without the surplus")
	assert.Equal(t, "1.000", stockOf(t, pool, m.asosiy, m.olma), "nothing changed")
	require.NoError(t, s.DeleteInventory(ctx, m.scope(), other.ID))
	_, err = s.GetInventory(ctx, m.scope(), other.ID)
	refused(t, err, apperr.NotFound, "not_found", "Inventarizatsiya topilmadi")
}
