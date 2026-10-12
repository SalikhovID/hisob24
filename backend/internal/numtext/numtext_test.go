package numtext

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func scanned(t *testing.T, raw string) pgtype.Numeric {
	t.Helper()
	var n pgtype.Numeric
	require.NoError(t, n.Scan(raw))
	return n
}

func TestNumbersAreWrittenWithTheirDecimals(t *testing.T) {
	ptr := func(s string) *string { return &s }
	assert.Equal(t, ptr("150000.50"), Amount(scanned(t, "150000.5")))
	assert.Equal(t, ptr("0.00"), Amount(scanned(t, "0")), "a zero comes without its scale and is padded")
	assert.Equal(t, ptr("-2.50"), Amount(scanned(t, "-2.5")))
	assert.Equal(t, ptr("12.500"), Quantity(scanned(t, "12.5")))
	assert.Equal(t, ptr("12.5"), Text(scanned(t, "12.5")))
	assert.Nil(t, Amount(pgtype.Numeric{}), "none")
	assert.True(t, Zero(pgtype.Numeric{}))
	assert.True(t, Zero(scanned(t, "0.00")))
	assert.False(t, Zero(scanned(t, "0.01")))
}
