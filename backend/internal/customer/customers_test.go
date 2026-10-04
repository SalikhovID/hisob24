package customer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCustomerPhone(t *testing.T) {
	for raw, want := range map[string]string{
		"998901234567":        "998901234567",
		"+998 90 123 45 67":   "998901234567",
		"+998 (90) 123-45-67": "998901234567",
		"901234567":           "998901234567", // a local number is an Uzbek one
		" 90 123 45 67 ":      "998901234567",
	} {
		got, err := customerPhone(raw)
		require.NoError(t, err, raw)
		assert.Equal(t, want, got, raw)
	}
	for _, raw := range []string{
		"", "   ", "12345", "90123456", "9989012345678", // too short or too long
		"+7 900 123 45 67", "79001234567", "449012345678", // not an Uzbek number
		"99890123456a", "ali", // not a number
	} {
		_, err := customerPhone(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri", raw)
	}
}
