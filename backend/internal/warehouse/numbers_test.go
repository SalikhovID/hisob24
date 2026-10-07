package warehouse

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
)

func ptr[T any](v T) *T { return &v }

func TestPaymentAmountIsNeededAndAboveZero(t *testing.T) {
	t.Parallel()
	n, err := paymentAmount(ptr("1200.5"))
	require.NoError(t, err)
	assert.Equal(t, ptr("1200.50"), catalog.Amount(n))
	for name, raw := range map[string]*string{"nil": nil, "empty": ptr("")} {
		_, err := paymentAmount(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Summani kiriting", name)
	}
	for name, raw := range map[string]*string{"zero": ptr("0"), "zero decimals": ptr("0.00"), "negative": ptr("-5"), "comma": ptr("1,5"), "three decimals": ptr("1.005")} {
		_, err := paymentAmount(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Summa noto'g'ri", name)
	}
}

func TestDayIsNeededAndADate(t *testing.T) {
	t.Parallel()
	d, err := day("2026-10-07")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC), d)
	_, err = day("  ")
	refused(t, err, apperr.Invalid, "validation_error", "Sanani kiriting")
	_, err = day("07.10.2026")
	refused(t, err, apperr.Invalid, "validation_error", "Sana noto'g'ri")
	_, err = day("2026-13-01")
	refused(t, err, apperr.Invalid, "validation_error", "Sana noto'g'ri")
}
