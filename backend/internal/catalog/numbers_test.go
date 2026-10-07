package catalog

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func ptr[T any](v T) *T { return &v }

func TestMoney(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  *string
		want string // "" for no amount
		bad  bool
	}{
		"none":            {nil, "", false},
		"empty":           {ptr(""), "", false},
		"whole":           {ptr("150000"), "150000", false},
		"two decimals":    {ptr("150000.50"), "150000.50", false},
		"one decimal":     {ptr("0.5"), "0.5", false},
		"three decimals":  {ptr("1.005"), "", true},
		"a comma":         {ptr("1,5"), "", true},
		"a sign":          {ptr("-1"), "", true},
		"letters":         {ptr("abc"), "", true},
		"thirteen digits": {ptr("1234567890123"), "", true},
		"spaces":          {ptr("1 000"), "", true},
	} {
		n, err := Money(tc.raw, "Narx noto'g'ri")
		if tc.bad {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, "Narx noto'g'ri", e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		if tc.want == "" {
			assert.False(t, n.Valid, name)
			assert.Nil(t, Text(n), name)
			continue
		}
		assert.Equal(t, ptr(tc.want), Text(n), name)
	}
}

func TestTextIsTheAmountAsTheDatabaseWritesIt(t *testing.T) {
	t.Parallel()
	var n pgtype.Numeric
	require.NoError(t, n.Scan("1200.50"))
	assert.Equal(t, ptr("1200.50"), Text(n))
	assert.Nil(t, Text(pgtype.Numeric{}), "no amount")
}

func TestUnits(t *testing.T) {
	t.Parallel()
	assert.Len(t, Units, 10)
	assert.Equal(t, Unit{Code: "dona", Name: "dona"}, Units[0])
	assert.Equal(t, Unit{Code: "m2", Name: "m²"}, Units[6])
	assert.True(t, unitKnown("kg"))
	assert.False(t, unitKnown("tonna"))
	assert.False(t, unitKnown(""))
}

func TestQuantity(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  *string
		want string
		bad  bool
	}{
		"whole":          {ptr("12"), "12", false},
		"three decimals": {ptr("0.125"), "0.125", false},
		"nine digits":    {ptr("123456789.999"), "123456789.999", false},
		"nil":            {nil, "", true},
		"empty":          {ptr(""), "", true},
		"zero":           {ptr("0"), "", true},
		"zero decimals":  {ptr("0.000"), "", true},
		"negative":       {ptr("-1"), "", true},
		"four decimals":  {ptr("1.0001"), "", true},
		"ten digits":     {ptr("1234567890"), "", true},
		"comma":          {ptr("1,5"), "", true},
		"spaces":         {ptr(" 1"), "", true},
	} {
		n, err := Quantity(tc.raw, "Miqdor noto'g'ri")
		if tc.bad {
			refused(t, err, apperr.Invalid, "validation_error", "Miqdor noto'g'ri", name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, ptr(tc.want), Text(n), name)
	}
}

func TestZero(t *testing.T) {
	t.Parallel()
	assert.True(t, Zero(pgtype.Numeric{}), "no amount")
	zero, err := Money(ptr("0.00"), "x")
	require.NoError(t, err)
	assert.True(t, Zero(zero))
	some, err := Money(ptr("0.01"), "x")
	require.NoError(t, err)
	assert.False(t, Zero(some))
}

// pgx decodes a zero numeric without its scale ("0"): the amounts and the
// quantities the API shows are padded to their columns' decimals.
func TestAmountAndQuantityTextPadAZero(t *testing.T) {
	t.Parallel()
	for raw, want := range map[string]string{"0": "0.00", "0.00": "0.00", "12000.5": "12000.50", "12000.50": "12000.50", "7": "7.00"} {
		n, err := Money(ptr(raw), "x")
		require.NoError(t, err)
		assert.Equal(t, ptr(want), Amount(n), raw)
	}
	assert.Nil(t, Amount(pgtype.Numeric{}), "no amount is none")
	for raw, want := range map[string]string{"0": "0.000", "12.5": "12.500", "12.500": "12.500", "3": "3.000"} {
		var n pgtype.Numeric
		require.NoError(t, n.Scan(raw))
		assert.Equal(t, ptr(want), QuantityText(n), raw)
	}
	assert.Nil(t, QuantityText(pgtype.Numeric{}), "no quantity is none")
}
