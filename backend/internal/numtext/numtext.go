// Package numtext writes stored numbers as the API shows them. It depends
// on nothing of the app, so every package may use it.
package numtext

import (
	"math/big"
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

// Ratio is a divided by b, with four decimals, rounded half up
// ("12800.0000"); "0.0000" when either is none or b is 0.
func Ratio(a, b pgtype.Numeric) string {
	ra, rb := ratOf(a), ratOf(b)
	if ra == nil || rb == nil || rb.Sign() == 0 {
		return "0.0000"
	}
	return new(big.Rat).Quo(ra, rb).FloatString(4)
}

// ratOf is the number as a rational, nil when it is none or not finite.
func ratOf(n pgtype.Numeric) *big.Rat {
	if !n.Valid || n.NaN || n.InfinityModifier != pgtype.Finite || n.Int == nil {
		return nil
	}
	r := new(big.Rat).SetInt(n.Int)
	scale := new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(absExp(n.Exp))), nil))
	if n.Exp > 0 {
		return r.Mul(r, scale)
	}
	return r.Quo(r, scale)
}

func absExp(e int32) int32 {
	if e < 0 {
		return -e
	}
	return e
}
