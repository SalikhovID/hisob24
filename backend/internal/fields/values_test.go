package fields

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

// check runs CheckValues over the answers a client sent as JSON.
func check(t *testing.T, fields []Field, was Values, body string) (Values, error) {
	t.Helper()
	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal([]byte(body), &raw))
	return CheckValues(fields, formOptions, was, raw)
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

func TestCheckValuesSeveralChoices(t *testing.T) {
	const wrong = "«Tillar» uchun variant noto'g'ri"
	runCheckCases(t, form, []checkCase{
		{name: "the options chosen, in the order of the dropdown", body: `{"5": [21, 23, 22]}`, want: Values{5: []int64{22, 21, 23}}},
		{name: "one option", body: `{"5": [21]}`, want: Values{5: []int64{21}}},
		{name: "a dropdown of several takes a list too", body: `{"6": [12, 11]}`, want: Values{6: []int64{11, 12}}},
		{name: "an option chosen twice counts once", body: `{"5": [21, 21, 22]}`, want: Values{5: []int64{22, 21}}},
		{name: "an empty list is no choice", body: `{"5": []}`, want: Values{}},
		{name: "null is no choice", body: `{"5": null}`, want: Values{}},
		{name: "one option outside a list", body: `{"5": 21}`, refusal: wrong},
		{name: "an option of another dropdown", body: `{"5": [21, 11]}`, refusal: wrong},
		{name: "an option that is not there", body: `{"5": [999]}`, refusal: wrong},
		{name: "an option that is turned off", body: `{"6": [11, 13]}`, refusal: "«Kanallar» uchun variant noto'g'ri"},
		{name: "a name in the list", body: `{"5": ["Rus"]}`, refusal: wrong},
		{name: "null in the list", body: `{"5": [null]}`, refusal: wrong},
		{name: "a text", body: `{"5": "21"}`, refusal: wrong},
	})
}

// YouTube (13) is turned off: it is offered no more, but a customer who has
// it keeps it through an edit.
func TestCheckValuesKeepsATurnedOffOptionWhereTheCustomerHasIt(t *testing.T) {
	for _, tt := range []struct {
		name    string
		was     Values
		body    string
		want    Values
		refusal string
	}{
		{name: "the one option the customer has", was: Values{3: int64(13)}, body: `{"3": 13}`, want: Values{3: int64(13)}},
		{name: "one of the several the customer has", was: Values{6: []int64{11, 13}}, body: `{"6": [13, 12]}`, want: Values{6: []int64{12, 13}}},
		{name: "the customer has it in another field", was: Values{3: int64(13)}, body: `{"4": 13}`, refusal: "«Holati» uchun variant noto'g'ri"},
		{name: "the customer has another option", was: Values{3: int64(11)}, body: `{"3": 13}`, refusal: "«Manba» uchun variant noto'g'ri"},
		{name: "the customer has other options", was: Values{6: []int64{11}}, body: `{"6": [11, 13]}`, refusal: "«Kanallar» uchun variant noto'g'ri"},
		{name: "an option that is not there stays wrong", was: Values{3: int64(999)}, body: `{"3": 999}`, refusal: "«Manba» uchun variant noto'g'ri"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := check(t, form, tt.was, tt.body)
			if tt.refusal != "" {
				refused(t, err, apperr.Invalid, "validation_error", tt.refusal)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

// filled is a body that answers every field of the form, with the answer to
// one field replaced; an empty answer leaves the field out.
func filled(field, answer string) string {
	answers := map[string]string{"1": `"Ali"`, "2": `30`, "3": `11`, "4": `12`, "5": `[21]`, "6": `[11]`}
	answers[field] = answer
	var parts []string
	for _, id := range []string{"1", "2", "3", "4", "5", "6"} {
		if answers[id] != "" {
			parts = append(parts, `"`+id+`": `+answers[id])
		}
	}
	return "{" + strings.Join(parts, ", ") + "}"
}

func TestCheckValuesRequired(t *testing.T) {
	must := make([]Field, len(form))
	for i, f := range form {
		f.Required = true
		must[i] = f
	}
	everything := Values{1: "Ali", 2: int64(30), 3: int64(11), 4: int64(12), 5: []int64{21}, 6: []int64{11}}
	runCheckCases(t, must, []checkCase{
		{name: "every field filled in", body: filled("", ""), want: everything},
		{name: "zero fills a number in", body: filled("2", "0"),
			want: Values{1: "Ali", 2: int64(0), 3: int64(11), 4: int64(12), 5: []int64{21}, 6: []int64{11}}},
		{name: "a text left out", body: filled("1", ""), refusal: "«F.I.Sh.» maydonini to'ldiring"},
		{name: "a text of spaces", body: filled("1", `"  "`), refusal: "«F.I.Sh.» maydonini to'ldiring"},
		{name: "a number left out", body: filled("2", ""), refusal: "«Yoshi» maydonini to'ldiring"},
		{name: "a number that is null", body: filled("2", "null"), refusal: "«Yoshi» maydonini to'ldiring"},
		{name: "a dropdown with nothing chosen", body: filled("3", "null"), refusal: "«Manba» ni tanlang"},
		{name: "a radio left out", body: filled("4", ""), refusal: "«Holati» ni tanlang"},
		{name: "checkboxes with none ticked", body: filled("5", "[]"), refusal: "«Tillar» ni tanlang"},
		{name: "a dropdown of several left out", body: filled("6", ""), refusal: "«Kanallar» ni tanlang"},
	})
}

func TestCheckValuesRefusesAFieldTheTypeHasNot(t *testing.T) {
	const unknown = "Bu turda bunday maydon yo'q"
	runCheckCases(t, form, []checkCase{
		{name: "a field of another type", body: `{"1": "Ali", "99": "x"}`, refusal: unknown},
		{name: "even with no answer", body: `{"99": null}`, refusal: unknown},
		{name: "a key that is no id", body: `{"ism": "Ali"}`, refusal: unknown},
		{name: "an id written another way", body: `{"01": "Ali"}`, refusal: unknown},
		{name: "said before what is wrong with an answer", body: `{"2": "x", "99": 1}`, refusal: unknown},
	})
}

func TestCheckValuesTellsTheFirstFieldThatIsWrong(t *testing.T) {
	must := make([]Field, len(form))
	for i, f := range form {
		f.Required = true
		must[i] = f
	}
	runCheckCases(t, must, []checkCase{
		{name: "in the order of the fields, not of the answers", body: `{"3": 999, "2": "x", "1": "Ali"}`, refusal: "«Yoshi» butun son bo'lishi kerak"},
		{name: "an empty field before a wrong one", body: `{"2": "x"}`, refusal: "«F.I.Sh.» maydonini to'ldiring"},
		{name: "a wrong field before an empty one", body: `{"1": "Ali", "2": 30, "3": 21}`, refusal: "«Manba» uchun variant noto'g'ri"},
	})
}

func TestDiffValues(t *testing.T) {
	was := Values{1: "Ali", 2: int64(30), 3: int64(11), 5: []int64{22, 21}}
	// edited is was with one answer replaced; nil takes the answer away.
	edited := func(fieldID int64, answer any) Values {
		now := Values{}
		for id, v := range was {
			now[id] = v
		}
		if answer == nil {
			delete(now, fieldID)
		} else {
			now[fieldID] = answer
		}
		return now
	}

	for _, tt := range []struct {
		name string
		now  Values
		want []Change
	}{
		{name: "nothing", now: edited(1, "Ali"), want: nil},
		{name: "a text", now: edited(1, "Vali"), want: []Change{{Label: "F.I.Sh.", Old: "Ali", New: "Vali"}}},
		{name: "a number", now: edited(2, int64(31)), want: []Change{{Label: "Yoshi", Old: "30", New: "31"}}},
		{name: "an option, by its name", now: edited(3, int64(12)),
			want: []Change{{Label: "Manba", Old: "Instagram", New: "LinkedIn"}}},
		{name: "an option that is turned off has a name too", now: edited(3, int64(13)),
			want: []Change{{Label: "Manba", Old: "Instagram", New: "YouTube"}}},
		{name: "several options, by their names", now: edited(5, []int64{22, 21, 23}),
			want: []Change{{Label: "Tillar", Old: "Rus, O'zbek", New: "Rus, O'zbek, Ingliz"}}},
		{name: "an answer where there was none", now: edited(4, int64(12)),
			want: []Change{{Label: "Holati", Old: "", New: "LinkedIn"}}},
		{name: "an answer taken away", now: edited(2, nil), want: []Change{{Label: "Yoshi", Old: "30", New: ""}}},
		{name: "a field that stays empty", now: edited(6, nil), want: nil},
		{name: "the fields in their order",
			now: Values{1: "Vali", 2: int64(0), 4: int64(11), 5: []int64{22, 21}},
			want: []Change{
				{Label: "F.I.Sh.", Old: "Ali", New: "Vali"},
				{Label: "Yoshi", Old: "30", New: "0"},
				{Label: "Manba", Old: "Instagram", New: ""},
				{Label: "Holati", Old: "", New: "Instagram"},
			}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, DiffValues(form, formOptions, was, tt.now))
		})
	}
}
