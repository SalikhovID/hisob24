package ledger

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestMovesOf(t *testing.T) {
	line := func(product int64, quantity string) Line { return Line{ProductID: product, Quantity: n(t, quantity)} }
	counted := func(product int64, quantity, expected string) Line {
		return Line{ProductID: product, Quantity: n(t, quantity), Expected: n(t, expected)}
	}
	for name, tc := range map[string]struct {
		kind  Kind
		lines []Line
		want  []string
	}{
		"a purchase adds":                   {Purchase, []Line{line(1, "12.5"), line(2, "3")}, []string{"10:1:12.500", "10:2:3.000"}},
		"an opening stock adds":             {OpeningStock, []Line{line(1, "1")}, []string{"10:1:1.000"}},
		"a sale takes":                      {Sale, []Line{line(1, "2.5")}, []string{"10:1:-2.500"}},
		"a transfer takes and adds":         {Transfer, []Line{line(1, "2"), line(2, "1")}, []string{"10:1:-2.000", "20:1:2.000", "10:2:-1.000", "20:2:1.000"}},
		"an inventory moves the difference": {Inventory, []Line{counted(1, "9", "10"), counted(2, "5", "5"), counted(3, "7.25", "0")}, []string{"10:1:-1.000", "10:3:7.250"}},
		"a line of nothing moves nothing":   {Purchase, []Line{line(1, "0")}, nil},
		"a money document moves nothing":    {Expense, []Line{line(1, "1")}, nil},
	} {
		got := MovesOf(tc.kind, 10, 20, tc.lines)
		texts := make([]string, 0, len(got))
		for _, m := range got {
			texts = append(texts, formatMove(m))
		}
		if tc.want == nil {
			assert.Empty(t, texts, name)
		} else {
			assert.Equal(t, tc.want, texts, name)
		}
	}
}

func formatMove(m Move) string {
	return join(m.LocationID, m.ProductID, text(m.Quantity))
}

func TestWriteMovesAndCheckStock(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	purchase := addDocument(t, q, pool, s, Purchase, 1)
	sale := addDocument(t, q, pool, s, Sale, 1)

	require.NoError(t, WriteMoves(ctx, q, s.company, purchase.ID, MovesOf(Purchase, s.asosiy, 0, []Line{{ProductID: s.olma, Quantity: n(t, "10")}, {ProductID: s.nok, Quantity: n(t, "3")}})))
	assert.Equal(t, "10.000", stockOf(t, pool, s.asosiy, s.olma))
	assert.Equal(t, "3.000", stockOf(t, pool, s.asosiy, s.nok))
	require.NoError(t, WriteMoves(ctx, q, s.company, purchase.ID, MovesOf(Purchase, s.asosiy, 0, []Line{{ProductID: s.olma, Quantity: n(t, "4")}})), "written anew: the old moves go")
	assert.Equal(t, "4.000", stockOf(t, pool, s.asosiy, s.olma))
	assert.Equal(t, "0", stockOf(t, pool, s.asosiy, s.nok))

	require.NoError(t, WriteMoves(ctx, q, s.company, sale.ID, MovesOf(Sale, s.asosiy, 0, []Line{{ProductID: s.olma, Quantity: n(t, "4")}})))
	assert.NoError(t, CheckStock(ctx, q, []int64{s.asosiy}, []int64{s.olma, s.nok}), "nothing below zero: 4 − 4")
	require.NoError(t, WriteMoves(ctx, q, s.company, sale.ID, MovesOf(Sale, s.asosiy, 0, []Line{{ProductID: s.olma, Quantity: n(t, "5")}})))
	refused(t, CheckStock(ctx, q, []int64{s.asosiy}, []int64{s.olma, s.nok}), apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q", "one product below zero is enough")
	require.NoError(t, WriteMoves(ctx, q, s.company, sale.ID, MovesOf(Sale, s.asosiy, 0, []Line{{ProductID: s.olma, Quantity: n(t, "5")}, {ProductID: s.nok, Quantity: n(t, "1")}})))
	err := CheckStock(ctx, q, []int64{s.asosiy}, []int64{s.olma, s.nok})
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Nok» uchun omborda yetarli qoldiq yo'q", "the first product below zero, by name")
	assert.NoError(t, CheckStock(ctx, q, []int64{s.chilonzor}, []int64{s.olma, s.nok}), "another location is fine")
	assert.NoError(t, CheckStock(ctx, q, []int64{s.asosiy}, nil), "no product to check")
	require.NoError(t, WriteMoves(ctx, q, s.company, sale.ID, nil), "no moves: the document's old ones go")
	assert.Equal(t, "4.000", stockOf(t, pool, s.asosiy, s.olma))
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM stock_moves WHERE transaction_id = $1", sale.ID).Scan(&count))
	assert.Zero(t, count)
	_ = gen.Transaction{}
}
