package catalog

import (
	"regexp"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/numtext"
)

// moneyPattern is an amount as the client writes it: so'm, up to twelve
// digits and two decimals ("150000.50"), the way the admin's billing takes
// one.
var moneyPattern = regexp.MustCompile(`^\d{1,12}(\.\d{1,2})?$`)

// Money reads an amount the client sent; nil or empty is no amount. What
// does not match the pattern is refused with message.
func Money(raw *string, message string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if raw == nil || *raw == "" {
		return n, nil
	}
	if !moneyPattern.MatchString(*raw) || n.Scan(*raw) != nil {
		return pgtype.Numeric{}, invalid(message)
	}
	return n, nil
}

// Text is a stored amount as the database writes it ("150000.50"), nil when
// there is none.
func Text(n pgtype.Numeric) *string { return numtext.Text(n) }

// quantityPattern is a quantity as the client writes it: up to nine digits
// and three decimals ("12.500"), in any unit.
var quantityPattern = regexp.MustCompile(`^\d{1,9}(\.\d{1,3})?$`)

// Quantity reads a quantity the client sent: one is needed, above zero.
// What is missing or does not match is refused with message.
func Quantity(raw *string, message string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if raw == nil || !quantityPattern.MatchString(*raw) || n.Scan(*raw) != nil || Zero(n) {
		return pgtype.Numeric{}, invalid(message)
	}
	return n, nil
}

// Zero tells whether the amount is nothing: no amount, or 0 however written.
func Zero(n pgtype.Numeric) bool { return numtext.Zero(n) }

// Amount is a stored amount as the API shows it: with two decimals
// ("150000.50"), nil when there is none.
func Amount(n pgtype.Numeric) *string { return numtext.Amount(n) }

// QuantityText is a stored quantity as the API shows it: with three
// decimals ("12.500"), nil when there is none.
func QuantityText(n pgtype.Numeric) *string { return numtext.Quantity(n) }
