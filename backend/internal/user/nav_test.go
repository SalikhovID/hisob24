package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestTabBarPages(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []string{
		"home", "customers", "orders", "products", "services", "sales",
		"warehouse", "purchases", "transfers", "inventories", "opening_stock", "suppliers",
		"accounts", "expenses", "money_transfers", "employees",
	}, TabBarPages)
	assert.Equal(t, 4, TabBarLimit)
}

func TestParseTabBar(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  []string
		want []string
		err  string
	}{
		"a bar":                          {[]string{"sales", "home", "purchases"}, []string{"sales", "home", "purchases"}, ""},
		"four pages":                     {[]string{"home", "customers", "orders", "money_transfers"}, []string{"home", "customers", "orders", "money_transfers"}, ""},
		"a repeated key once":            {[]string{"orders", "orders", "home"}, []string{"orders", "home"}, ""},
		"five with a repeat are four":    {[]string{"home", "customers", "orders", "products", "home"}, []string{"home", "customers", "orders", "products"}, ""},
		"nothing is a bar too":           {[]string{}, []string{}, ""},
		"a key not in the list":          {[]string{"orders", "reports"}, nil, "Sahifa noto'g'ri"},
		"the settings are not the bar's": {[]string{"settings"}, nil, "Sahifa noto'g'ri"},
		"five pages":                     {[]string{"home", "customers", "orders", "products", "sales"}, nil, "Panelda ko'pi bilan 4 ta sahifa"},
	} {
		got, err := ParseTabBar(tc.raw)
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
