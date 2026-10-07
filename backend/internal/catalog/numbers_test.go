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
