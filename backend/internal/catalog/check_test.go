package catalog

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCheck(t *testing.T) {
	t.Parallel()
	long := strings.Repeat("a", 121)
	for name, tc := range map[string]struct {
		kind string
		in   Input
		want checked
		err  string
	}{
		"a product, trimmed, with its optional fields": {
			KindProduct, Input{Name: " Olma ", Unit: ptr("kg"), SKU: ptr(" A-1 "), Price: ptr("12000.5"), Note: ptr(" Qizil ")},
			checked{Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1"), Note: ptr("Qizil")}, ""},
		"a product with nothing optional": {KindProduct, Input{Name: "Olma", Unit: ptr("dona"), SKU: ptr(" "), Price: ptr(""), Note: nil}, checked{Name: "Olma", Unit: ptr("dona")}, ""},
		"a service":                       {KindService, Input{Name: "Yetkazish", Price: ptr("50000")}, checked{Name: "Yetkazish"}, ""},
		"a service with an empty unit":    {KindService, Input{Name: "Yetkazish", Unit: ptr("")}, checked{Name: "Yetkazish"}, ""},
		"no kind":                         {"", Input{Name: "Olma"}, checked{}, "Turni tanlang"},
		"a kind not of the two":           {"thing", Input{Name: "Olma"}, checked{}, "Turni tanlang"},
		"no name":                         {KindProduct, Input{Name: "  ", Unit: ptr("kg")}, checked{}, "Nomni kiriting"},
		"a long name":                     {KindProduct, Input{Name: long, Unit: ptr("kg")}, checked{}, "Nom 120 belgidan oshmasin"},
		"a product without a unit":        {KindProduct, Input{Name: "Olma"}, checked{}, "Birlikni tanlang"},
		"a unit not in the list":          {KindProduct, Input{Name: "Olma", Unit: ptr("tonna")}, checked{}, "Birlikni tanlang"},
		"a service with a unit":           {KindService, Input{Name: "Yetkazish", Unit: ptr("dona")}, checked{}, "Xizmatga birlik berilmaydi"},
		"a service with a SKU":            {KindService, Input{Name: "Yetkazish", SKU: ptr("S-1")}, checked{}, "Xizmatga artikul berilmaydi"},
		"a long SKU":                      {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), SKU: ptr(strings.Repeat("1", 61))}, checked{}, "Artikul 60 belgidan oshmasin"},
		"a bad price":                     {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), Price: ptr("abc")}, checked{}, "Narx noto'g'ri"},
		"a long note":                     {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), Note: ptr(strings.Repeat("x", 501))}, checked{}, "Izoh 500 belgidan oshmasin"},
		"the name before the unit":        {KindProduct, Input{Name: "", Unit: nil}, checked{}, "Nomni kiriting"},
	} {
		got, err := check(tc.kind, tc.in)
		if tc.err != "" {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, apperr.Invalid, e.Kind, name)
			assert.Equal(t, tc.err, e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, tc.want.Name, got.Name, name)
		assert.Equal(t, tc.want.Unit, got.Unit, name)
		assert.Equal(t, tc.want.SKU, got.SKU, name)
		assert.Equal(t, tc.want.Note, got.Note, name)
		assert.Equal(t, tc.in.Price != nil && *tc.in.Price != "", got.Price.Valid, name)
	}
}
