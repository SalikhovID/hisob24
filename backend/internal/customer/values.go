package customer

import (
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// diff tells what an edit changed: the phone first, then the fields in
// their order. Nothing when the edit changed nothing.
func diff(fs []Field, options map[int64][]Option, oldPhone, newPhone string, was, now Values) []Change {
	var changes []Change
	if oldPhone != newPhone {
		changes = append(changes, Change{Label: "Telefon", Old: user.FormatPhone(oldPhone), New: user.FormatPhone(newPhone)})
	}
	return append(changes, fields.DiffValues(fs, options, was, now)...)
}
