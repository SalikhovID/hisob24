package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestStockAtAMoment(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	_, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{move(m.olma, "10")}})
	require.NoError(t, err)
	at := func(raw string) *time.Time {
		v, err := time.Parse(time.RFC3339, raw)
		require.NoError(t, err)
		return &v
	}

	rows, err := s.StockAt(ctx, m.scope(), m.asosiy, nil)
	require.NoError(t, err)
	assert.Equal(t, []StockRow{{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "5.000"}}, rows, "now: Olma is all in Chilonzor")
	rows, err = s.StockAt(ctx, m.scope(), m.asosiy, at("2026-10-03T00:00:00+05:00"))
	require.NoError(t, err)
	assert.Equal(t, []StockRow{{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "5.000"}, {ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "10.000"}}, rows, "before the transfer, by name")
	rows, err = s.StockAt(ctx, m.scope(), m.chilonzor, at("2026-10-03T00:00:00+05:00"))
	require.NoError(t, err)
	assert.Empty(t, rows)
	_, err = s.StockAt(ctx, m.scope(m.chilonzor), m.asosiy, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Lokatsiyani tanlang", "outside the scope (the handler answers 403 before)")
}

func TestAProductsMovesInTheJournal(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	stocked(t, s, m)
	tr, err := s.CreateTransfer(ctx, m.scope(), ali, m.asosiy, TransferInput{ToLocationID: m.chilonzor, At: "2026-10-05T09:00:00+05:00", Items: []ItemInput{move(m.olma, "4")}})
	require.NoError(t, err)
	inv, err := s.CreateInventory(ctx, m.scope(), ali, m.chilonzor, InventoryInput{At: "2026-10-06T09:00:00+05:00", Items: []ItemInput{move(m.olma, "3")}})
	require.NoError(t, err)

	page, err := s.ProductMoves(ctx, m.scope(), m.olma, 0, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 4, page.Total)
	rows := page.Items
	assert.Equal(t, inv.ID, rows[0].TransactionID, "the newest document first")
	assert.Equal(t, "inventory", rows[0].Kind)
	assert.Equal(t, "-1.000", rows[0].Quantity)
	assert.Nil(t, rows[0].Counterpart)
	assert.Equal(t, tr.ID, rows[1].TransactionID)
	assert.Equal(t, "transfer", rows[1].Kind)
	assert.Equal(t, m.chilonzor, rows[1].LocationID, "the transfer's later move first")
	assert.Equal(t, "4.000", rows[1].Quantity)
	assert.Equal(t, ptr("Asosiy"), rows[1].Counterpart)
	assert.Equal(t, "-4.000", rows[2].Quantity)
	assert.Equal(t, ptr("Chilonzor"), rows[2].Counterpart)
	assert.Equal(t, "purchase", rows[3].Kind)
	assert.EqualValues(t, 1, rows[3].Number)
	assert.Equal(t, time.Date(2026, 10, 1, 4, 0, 0, 0, time.UTC), rows[3].At)
	assert.Equal(t, "10.000", rows[3].Quantity)
	assert.Equal(t, ptr("Bozor"), rows[3].Counterpart, "the supplier")
	page, err = s.ProductMoves(ctx, m.scope(), m.olma, m.chilonzor, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total, "one location")
	page, err = s.ProductMoves(ctx, m.scope(m.asosiy), m.olma, m.chilonzor, 1)
	require.NoError(t, err)
	assert.Zero(t, page.Total, "a location outside the scope counts as none")
	_, err = s.ProductMoves(ctx, m.scope(), 999999, 0, 1)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi")
	_, err = s.ProductMoves(ctx, m.scope(), m.olma, 0, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
}
