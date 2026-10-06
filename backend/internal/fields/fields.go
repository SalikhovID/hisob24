// Package fields is what a form of fields the owner sets up shares between
// the customers and the tasks: the kinds a field may be of, the rules of a
// name, and the checking and the history of the answers to the fields.
package fields

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// The kinds a field may be of.
const (
	KindString        = "string"
	KindInt           = "int"
	KindDropdown      = "dropdown"
	KindMultiDropdown = "multi_dropdown"
	KindRadio         = "radio"
	KindCheckbox      = "checkbox"
)

// KindOf tells whether kind is one of the six and, if so, whether it is a
// choice: a field that takes its options from a dropdown.
func KindOf(kind string) (choice, known bool) {
	switch kind {
	case KindString, KindInt:
		return false, true
	case KindDropdown, KindMultiDropdown, KindRadio, KindCheckbox:
		return true, true
	}
	return false, false
}

// Field is one question of a type. The choice kinds take their options from
// a dropdown; only text and whole numbers may be told not to repeat.
type Field struct {
	ID         int64
	Label      string
	Kind       string
	Required   bool
	Unique     bool
	DropdownID *int64
}

// Option is one choice of a dropdown. An option that is not active is no
// longer offered, but stays where it was chosen.
type Option struct {
	ID     int64
	Label  string
	Active bool
}

// MaxName is how long the name of a type, a field, a dropdown, an option or
// a stage may be, in characters.
const MaxName = 60

// Invalid is a refusal of a request that breaks a rule, with the message the
// client shows.
func Invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}

// CleanName is a name as it is kept: without the spaces around it, not empty
// and not longer than MaxName.
func CleanName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	switch {
	case name == "":
		return "", Invalid("Nomni kiriting")
	case utf8.RuneCountInString(name) > MaxName:
		return "", Invalid("Nom 60 belgidan oshmasin")
	}
	return name, nil
}

// Taken tells that a name is in use already: its unique index refused it.
func Taken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ErrOrderChanged refuses a new order that does not name what is there now:
// the list was changed elsewhere since the client read it.
var ErrOrderChanged = apperr.New(apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

// SameIDs tells whether ids names each of live once and nothing else.
func SameIDs(ids, live []int64) bool {
	if len(ids) != len(live) {
		return false
	}
	left := make(map[int64]bool, len(live))
	for _, id := range live {
		left[id] = true
	}
	for _, id := range ids {
		if !left[id] {
			return false
		}
		delete(left, id)
	}
	return true
}
