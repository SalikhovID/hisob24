package customer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Values is a customer's answers by the id of the field. What an answer is
// follows the field's kind: a string for a text, an int64 for a whole number
// and for the one option of a dropdown or a radio, a []int64 for the options
// of a choice of several, in the order of their dropdown. A field left empty
// has no entry.
type Values map[int64]any

// maxText is how long a text answer may be, in characters.
const maxText = 500

// maxInt bounds a whole number answer on both sides: 9 007 199 254 740 991,
// the largest whole number that JSON carries to a browser and back exactly.
const maxInt = 1<<53 - 1

// checkValues reads the answers a client sent for the fields of a type and
// gives them as they are kept, or the first thing that is wrong with them,
// in the order of the fields. options is the options of each dropdown, in
// its order. was is the customer's answers before the edit, nil for a new
// customer: an option that is turned off is taken only where the customer
// has it already.
func checkValues(fields []Field, options map[int64][]Option, was Values, raw map[string]json.RawMessage) (Values, error) {
	values := Values{}
	for _, f := range fields {
		var offered []Option
		if f.DropdownID != nil {
			offered = options[*f.DropdownID]
		}
		answer, err := readAnswer(f, offered, chosen(was[f.ID]), raw[strconv.FormatInt(f.ID, 10)])
		if err != nil {
			return nil, err
		}
		switch {
		case answer != nil:
			values[f.ID] = answer
		case f.Required:
			return nil, errEmpty(f)
		}
	}
	return values, nil
}

// errEmpty refuses a required field left empty: a text or a number has to
// be filled in, a choice made.
func errEmpty(f Field) error {
	if choice, _ := kindOf(f.Kind); choice {
		return invalid(fmt.Sprintf("«%s» ni tanlang", f.Label))
	}
	return invalid(fmt.Sprintf("«%s» maydonini to'ldiring", f.Label))
}

// chosen is the options of an answer to a choice field.
func chosen(answer any) []int64 {
	switch a := answer.(type) {
	case int64:
		return []int64{a}
	case []int64:
		return a
	}
	return nil
}

// readAnswer reads what a client sent for one field; nil when the field is
// left empty. offered is the options of the field's dropdown, has the ones
// the customer has in the field already.
func readAnswer(f Field, offered []Option, has []int64, raw json.RawMessage) (any, error) {
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return nil, nil
	}
	switch f.Kind {
	case KindInt:
		n, ok := readWhole(raw)
		if !ok {
			return nil, invalid(fmt.Sprintf("«%s» butun son bo'lishi kerak", f.Label))
		}
		return n, nil
	case KindDropdown, KindRadio:
		id, ok := readWhole(raw)
		if !ok || !offers(offered, has, id) {
			return nil, invalid(fmt.Sprintf("«%s» uchun variant noto'g'ri", f.Label))
		}
		return id, nil
	case KindMultiDropdown, KindCheckbox:
		ids, ok := readChoices(offered, has, raw)
		switch {
		case !ok:
			return nil, invalid(fmt.Sprintf("«%s» uchun variant noto'g'ri", f.Label))
		case len(ids) == 0:
			return nil, nil
		}
		return ids, nil
	}
	var text string
	if json.Unmarshal(raw, &text) != nil {
		return nil, invalid(fmt.Sprintf("«%s» matn bo'lishi kerak", f.Label))
	}
	text = strings.TrimSpace(text)
	switch {
	case text == "":
		return nil, nil
	case utf8.RuneCountInString(text) > maxText:
		return nil, invalid(fmt.Sprintf("«%s» %d belgidan oshmasin", f.Label, maxText))
	}
	return text, nil
}

// offers tells whether the option may be chosen: it is in the dropdown, and
// not turned off unless the customer has it in the field already.
func offers(offered []Option, has []int64, id int64) bool {
	for _, o := range offered {
		if o.ID == id {
			return o.Active || slices.Contains(has, id)
		}
	}
	return false
}

// readChoices reads a list of the options a client chose and gives each
// once, in the order of the dropdown that offers them.
func readChoices(offered []Option, has []int64, raw json.RawMessage) ([]int64, bool) {
	var items []json.RawMessage
	if json.Unmarshal(raw, &items) != nil {
		return nil, false
	}
	picked := make(map[int64]bool, len(items))
	for _, item := range items {
		id, ok := readWhole(item)
		if !ok || !offers(offered, has, id) {
			return nil, false
		}
		picked[id] = true
	}
	var ids []int64
	for _, o := range offered {
		if picked[o.ID] {
			ids = append(ids, o.ID)
		}
	}
	return ids, true
}

// readWhole reads a JSON number that is whole and within maxInt: digits with
// or without a minus, no fraction and no exponent.
func readWhole(raw json.RawMessage) (int64, bool) {
	n, err := strconv.ParseInt(string(raw), 10, 64)
	if err != nil || n < -maxInt || n > maxInt {
		return 0, false
	}
	return n, true
}
