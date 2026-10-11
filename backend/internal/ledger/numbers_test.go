package ledger

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNextNumberCountsWithinTheKind(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")

	number, err := NextNumber(ctx, q, s.company, Purchase)
	require.NoError(t, err)
	assert.EqualValues(t, 1, number)
	addDocument(t, q, pool, s, Purchase, 1)
	gone := addDocument(t, q, pool, s, Purchase, 2)
	_, err = pool.Exec(ctx, "UPDATE transactions SET deleted_at = now() WHERE id = $1", gone.ID)
	require.NoError(t, err)
	number, err = NextNumber(ctx, q, s.company, Purchase)
	require.NoError(t, err)
	assert.EqualValues(t, 3, number, "a deleted document keeps its number")
	number, err = NextNumber(ctx, q, s.company, Sale)
	require.NoError(t, err)
	assert.EqualValues(t, 1, number, "each kind its own")
}
