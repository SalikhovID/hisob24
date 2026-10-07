package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestNavSections(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []string{"home", "customers", "tasks", "products", "warehouse", "employees", "settings"}, NavSections)
}

func TestParseNavOrder(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  []string
		want []string
		err  string
	}{
		"an order":              {[]string{"tasks", "home", "settings"}, []string{"tasks", "home", "settings"}, ""},
		"a repeated key once":   {[]string{"tasks", "tasks", "home"}, []string{"tasks", "home"}, ""},
		"nothing is an order":   {[]string{}, []string{}, ""},
		"a key not in the list": {[]string{"tasks", "reports"}, nil, "Bo'lim noto'g'ri"},
	} {
		got, err := ParseNavOrder(tc.raw)
		if tc.err != "" {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, apperr.Invalid, e.Kind, name)
			assert.Equal(t, "validation_error", e.Code, name)
			assert.Equal(t, tc.err, e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, tc.want, got, name)
	}
}
