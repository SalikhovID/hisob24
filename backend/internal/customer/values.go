package customer

import (
	"bytes"
	"encoding/json"
	"fmt"
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
// in the order of the fields.
func checkValues(fields []Field, options map[int64][]Option, was Values, raw map[string]json.RawMessage) (Values, error) {
	values := Values{}
	for _, f := range fields {
		answer, err := readAnswer(f, raw[strconv.FormatInt(f.ID, 10)])
		if err != nil {
			return nil, err
		}
		if answer != nil {
			values[f.ID] = answer
		}
	}
	return values, nil
}

// readAnswer reads what a client sent for one field; nil when the field is
// left empty.
func readAnswer(f Field, raw json.RawMessage) (any, error) {
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return nil, nil
	}
	if f.Kind == KindInt {
		n, ok := readWhole(raw)
		if !ok {
			return nil, invalid(fmt.Sprintf("«%s» butun son bo'lishi kerak", f.Label))
		}
		return n, nil
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

// readWhole reads a JSON number that is whole and within maxInt: digits with
// or without a minus, no fraction and no exponent.
func readWhole(raw json.RawMessage) (int64, bool) {
	n, err := strconv.ParseInt(string(raw), 10, 64)
	if err != nil || n < -maxInt || n > maxInt {
		return 0, false
	}
	return n, true
}
