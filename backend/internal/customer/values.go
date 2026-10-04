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
