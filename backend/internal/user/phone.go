// Package user holds the user domain helpers.
package user

import (
	"errors"
	"strings"
	"unicode"
)

// ErrInvalidPhone means the input cannot be a phone number.
var ErrInvalidPhone = errors.New("invalid phone number")

// NormalizePhone turns user input into the stored phone form: digits only,
// such as 998901234567. "+", spaces, "-" and parentheses are dropped and a
// 9-digit local number gets the 998 country code. Other characters, or a
// number outside 9-15 digits (the users.phone check), give ErrInvalidPhone.
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
	if n := len(digits); n < 9 || n > 15 {
		return "", ErrInvalidPhone
	}
	if len(digits) == 9 {
		digits = "998" + digits
	}
	return digits, nil
}

// FormatPhone writes a stored phone for people to read: an Uzbek number as
// +998 90 123 45 67, any other as + and its digits.
func FormatPhone(phone string) string {
	if len(phone) != 12 || !strings.HasPrefix(phone, "998") {
		return "+" + phone
	}
	return "+998 " + phone[3:5] + " " + phone[5:8] + " " + phone[8:10] + " " + phone[10:]
}
