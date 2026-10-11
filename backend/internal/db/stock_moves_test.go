package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestStockIsTheSumOfTheMovesAndWhatIsBelowZeroIsNamed(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addDocument(t, pool, w.company, doc{kind: "purchase", number: 1, location: &w.asosiy, supplier: &w.bozor})
	sale := addDocument(t, pool, w.company, doc{kind: "sale", number: 1, location: &w.asosiy})
	move := func(txID, locationID, productID int64, quantity string) error {
		return q.AddStockMove(ctx, gen.AddStockMoveParams{TransactionID: txID, CompanyID: w.company, LocationID: locationID, ProductID: productID, Quantity: numeric(t, quantity)})
	}
	stock := func(locationID, productID int64) string {
		s, err := q.StockOf(ctx, gen.StockOfParams{LocationID: locationID, ProductID: productID})
		require.NoError(t, err)
		return numericText(t, s)
	}

	assert.Equal(t, "0", stock(w.asosiy, w.olma), "nothing yet")
	require.NoError(t, move(purchase, w.asosiy, w.olma, "12.5"))
	require.NoError(t, move(purchase, w.asosiy, w.nok, "3"))
	require.NoError(t, move(sale, w.asosiy, w.olma, "-2.5"))
	assert.Equal(t, "10.000", stock(w.asosiy, w.olma), "in less out")
	assert.Equal(t, "0", stock(w.chilonzor, w.olma), "each location its own")
	assert.Equal(t, "23514", sqlState(move(sale, w.asosiy, w.olma, "0")), "a move of nothing")

	below, err := q.NegativeStock(ctx, gen.NegativeStockParams{LocationIds: []int64{w.asosiy}, ProductIds: []int64{w.olma, w.nok}})
	require.NoError(t, err)
	assert.Empty(t, below, "nothing below zero")
	require.NoError(t, move(sale, w.asosiy, w.olma, "-11"))
	require.NoError(t, move(sale, w.asosiy, w.nok, "-4"))
	below, err = q.NegativeStock(ctx, gen.NegativeStockParams{LocationIds: []int64{w.asosiy}, ProductIds: []int64{w.olma, w.nok}})
	require.NoError(t, err)
	assert.Equal(t, []gen.NegativeStockRow{{ID: w.nok, Name: "Nok"}, {ID: w.olma, Name: "Olma"}}, below, "the products below zero, by name")
	below, err = q.NegativeStock(ctx, gen.NegativeStockParams{LocationIds: []int64{w.asosiy}, ProductIds: []int64{w.nok}})
	require.NoError(t, err)
	assert.Len(t, below, 1, "among the products asked about")
	below, err = q.NegativeStock(ctx, gen.NegativeStockParams{LocationIds: []int64{w.chilonzor}, ProductIds: []int64{w.olma, w.nok}})
	require.NoError(t, err)
	assert.Empty(t, below, "in the locations asked about")

	require.NoError(t, q.DeleteStockMoves(ctx, sale))
	assert.Equal(t, "12.500", stock(w.asosiy, w.olma), "the sale's moves are gone, the purchase's stay")
	assert.Equal(t, "3.000", stock(w.asosiy, w.nok))
}
