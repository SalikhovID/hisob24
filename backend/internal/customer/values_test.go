package customer

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// The form of these tests: a field of each kind, none of them required, and
// the two dropdowns the choices come from. YouTube is turned off; the
// languages are in an order that is not the order of their ids.
var (
	manba, til  int64 = 10, 20
	formOptions       = map[int64][]Option{
		manba: {{ID: 11, Label: "Instagram", Active: true}, {ID: 12, Label: "LinkedIn", Active: true}, {ID: 13, Label: "YouTube"}},
		til:   {{ID: 22, Label: "Rus", Active: true}, {ID: 21, Label: "O'zbek", Active: true}, {ID: 23, Label: "Ingliz", Active: true}},
	}
	form = []Field{
		{ID: 1, Label: "F.I.Sh.", Kind: KindString},
		{ID: 2, Label: "Yoshi", Kind: KindInt},
		{ID: 3, Label: "Manba", Kind: KindDropdown, DropdownID: &manba},
		{ID: 4, Label: "Holati", Kind: KindRadio, DropdownID: &manba},
		{ID: 5, Label: "Tillar", Kind: KindCheckbox, DropdownID: &til},
		{ID: 6, Label: "Kanallar", Kind: KindMultiDropdown, DropdownID: &manba},
	}
)

// check runs checkValues over the answers a client sent as JSON.
func check(t *testing.T, fields []Field, was Values, body string) (Values, error) {
	t.Helper()
	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal([]byte(body), &raw))
	return checkValues(fields, formOptions, was, raw)
}

// checkCase is answers a client sent and what becomes of them: the answers
// as they are kept, or the message they are refused with.
type checkCase struct {
	name    string
	body    string
	want    Values
	refusal string
}

func runCheckCases(t *testing.T, fields []Field, cases []checkCase) {
	t.Helper()
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got, err := check(t, fields, nil, tt.body)
			if tt.refusal != "" {
				refused(t, err, apperr.Invalid, "validation_error", tt.refusal)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCheckValuesText(t *testing.T) {
	long := strings.Repeat("ў", 500) // 500 characters, 1000 bytes
	runCheckCases(t, form, []checkCase{
		{name: "a text is kept without the spaces around it", body: `{"1": "  Ali Valiyev "}`, want: Values{1: "Ali Valiyev"}},
		{name: "no answer", body: `{}`, want: Values{}},
		{name: "null is no answer", body: `{"1": null}`, want: Values{}},
		{name: "an empty text is no answer", body: `{"1": ""}`, want: Values{}},
		{name: "spaces alone are no answer", body: `{"1": "   "}`, want: Values{}},
		{name: "500 characters", body: `{"1": "` + long + `"}`, want: Values{1: long}},
		{name: "501 characters", body: `{"1": "` + long + `a"}`, refusal: "«F.I.Sh.» 500 belgidan oshmasin"},
		{name: "a number is no text", body: `{"1": 5}`, refusal: "«F.I.Sh.» matn bo'lishi kerak"},
		{name: "a list is no text", body: `{"1": ["Ali"]}`, refusal: "«F.I.Sh.» matn bo'lishi kerak"},
	})
}

func TestCheckValuesNumbers(t *testing.T) {
	const notWhole = "«Yoshi» butun son bo'lishi kerak"
	runCheckCases(t, form, []checkCase{
		{name: "a whole number", body: `{"2": 30}`, want: Values{2: int64(30)}},
		{name: "zero is an answer", body: `{"2": 0}`, want: Values{2: int64(0)}},
		{name: "a negative number", body: `{"2": -5}`, want: Values{2: int64(-5)}},
		{name: "the largest", body: `{"2": 9007199254740991}`, want: Values{2: int64(9007199254740991)}},
		{name: "the smallest", body: `{"2": -9007199254740991}`, want: Values{2: int64(-9007199254740991)}},
		{name: "null is no answer", body: `{"2": null}`, want: Values{}},
		{name: "past the largest", body: `{"2": 9007199254740992}`, refusal: notWhole},
		{name: "past the smallest", body: `{"2": -9007199254740992}`, refusal: notWhole},
		{name: "far past what fits", body: `{"2": 99999999999999999999}`, refusal: notWhole},
		{name: "a fraction", body: `{"2": 30.5}`, refusal: notWhole},
		{name: "a fraction that is whole", body: `{"2": 30.0}`, refusal: notWhole},
		{name: "an exponent", body: `{"2": 3e1}`, refusal: notWhole},
		{name: "digits as a text", body: `{"2": "30"}`, refusal: notWhole},
		{name: "an empty text", body: `{"2": ""}`, refusal: notWhole},
		{name: "true", body: `{"2": true}`, refusal: notWhole},
		{name: "a list", body: `{"2": [30]}`, refusal: notWhole},
	})
}

func TestCheckValuesOneChoice(t *testing.T) {
	const wrong = "«Manba» uchun variant noto'g'ri"
	runCheckCases(t, form, []checkCase{
		{name: "an option of the field's dropdown", body: `{"3": 11}`, want: Values{3: int64(11)}},
		{name: "a radio takes one option too", body: `{"4": 12}`, want: Values{4: int64(12)}},
		{name: "null is no choice", body: `{"3": null}`, want: Values{}},
		{name: "an option of another dropdown", body: `{"3": 21}`, refusal: wrong},
		{name: "an option that is not there", body: `{"3": 999}`, refusal: wrong},
		{name: "an option that is turned off", body: `{"3": 13}`, refusal: wrong},
		{name: "the option's name", body: `{"3": "Instagram"}`, refusal: wrong},
		{name: "the id as a text", body: `{"3": "11"}`, refusal: wrong},
		{name: "a list", body: `{"3": [11]}`, refusal: wrong},
		{name: "a fraction", body: `{"3": 11.5}`, refusal: wrong},
		{name: "a radio's wrong option", body: `{"4": 21}`, refusal: "«Holati» uchun variant noto'g'ri"},
	})
}
