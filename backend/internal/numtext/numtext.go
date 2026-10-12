// Package numtext writes stored numbers as the API shows them. It depends
// on nothing of the app, so every package may use it.
package numtext

import (
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

// Text is a stored number as the database writes it ("150000.50"), nil
// when there is none.
func Text(n pgtype.Numeric) *string {
	if !n.Valid {
		return nil
	}
	v, err := n.Value()
	if err != nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	return &s
}

// Zero tells whether the number is nothing: none, or 0 however written.
func Zero(n pgtype.Numeric) bool {
	return !n.Valid || n.Int == nil || n.Int.Sign() == 0
}

// Amount is a stored amount as the API shows it: with two decimals
// ("150000.50"), nil when there is none.
func Amount(n pgtype.Numeric) *string { return Padded(n, 2) }

// Quantity is a stored quantity as the API shows it: with three decimals
// ("12.500"), nil when there is none.
func Quantity(n pgtype.Numeric) *string { return Padded(n, 3) }

// Padded is the number as the database writes it, padded to scale
// decimals: pgx decodes a zero numeric without its scale ("0"), and the
// columns keep theirs.
func Padded(n pgtype.Numeric, scale int) *string {
	s := Text(n)
	if s == nil {
		return nil
	}
	whole, decimals, _ := strings.Cut(*s, ".")
	if len(decimals) < scale {
		decimals += strings.Repeat("0", scale-len(decimals))
	}
	out := whole + "." + decimals
	return &out
}
