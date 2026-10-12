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

func TestRatioHasFourDecimals(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct{ a, b, want string }{
		"so'm per dollar":    {"128000.00", "10.00", "12800.0000"},
		"a fraction":         {"9.00", "10.00", "0.9000"},
		"rounded half up":    {"1.00", "3.00", "0.3333"},
		"rounded up":         {"2.00", "3.00", "0.6667"},
		"a whole number":     {"100", "4", "25.0000"},
		"divided by nothing": {"5.00", "0", "0.0000"},
	} {
		assert.Equal(t, tc.want, Ratio(scanned(t, tc.a), scanned(t, tc.b)), name)
	}
	assert.Equal(t, "0.0000", Ratio(pgtype.Numeric{}, scanned(t, "1")), "none over something")
}
