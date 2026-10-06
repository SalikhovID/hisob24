package customer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// The form of this test: a text, a number and a choice, with the dropdown
// the choice comes from. What the answers may be is internal/fields's to
// check; here the phone comes first.
var (
	manba       int64 = 10
	formOptions       = map[int64][]Option{manba: {{ID: 11, Label: "Instagram", Active: true}, {ID: 12, Label: "LinkedIn", Active: true}}}
	form              = []Field{
		{ID: 1, Label: "F.I.Sh.", Kind: KindString},
		{ID: 2, Label: "Yoshi", Kind: KindInt},
		{ID: 3, Label: "Manba", Kind: KindDropdown, DropdownID: &manba},
	}
)

func TestDiff(t *testing.T) {
	const phone = "998901234567"
	was := Values{1: "Ali", 2: int64(30), 3: int64(11)}

	for _, tt := range []struct {
		name  string
		phone string
		now   Values
		want  []Change
	}{
		{name: "nothing", phone: phone, now: Values{1: "Ali", 2: int64(30), 3: int64(11)}, want: nil},
		{name: "the phone, as people write it", phone: "998907654321", now: Values{1: "Ali", 2: int64(30), 3: int64(11)},
			want: []Change{{Label: "Telefon", Old: "+998 90 123 45 67", New: "+998 90 765 43 21"}}},
		{name: "a field", phone: phone, now: Values{1: "Vali", 2: int64(30), 3: int64(11)},
			want: []Change{{Label: "F.I.Sh.", Old: "Ali", New: "Vali"}}},
		{name: "the phone first, then the fields in their order", phone: "998907654321", now: Values{1: "Vali", 2: int64(0), 3: int64(12)},
			want: []Change{
				{Label: "Telefon", Old: "+998 90 123 45 67", New: "+998 90 765 43 21"},
				{Label: "F.I.Sh.", Old: "Ali", New: "Vali"},
				{Label: "Yoshi", Old: "30", New: "0"},
				{Label: "Manba", Old: "Instagram", New: "LinkedIn"},
			}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, diff(form, formOptions, phone, tt.phone, was, tt.now))
		})
	}
}
