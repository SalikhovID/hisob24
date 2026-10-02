// Package user holds the user domain helpers.
package user

import (
	"errors"
	"strings"
	"unicode"
)

// ErrInvalidPhone means the input cannot be a phone number.
var ErrInvalidPhone = errors.New("invalid phone number")

// NormalizePhone turns user input into the stored phone form.
func NormalizePhone(raw string) (string, error) {
	var b strings.Builder
	for _, r := range raw {
		if r == '+' || r == '-' || r == '(' || r == ')' || unicode.IsSpace(r) {
			continue
		}
		if r < '0' || r > '9' {
			return "", ErrInvalidPhone
		}
		b.WriteRune(r)
	}
	digits := b.String()
	if len(digits) == 9 {
		digits = "998" + digits
	}
	return digits, nil
}
