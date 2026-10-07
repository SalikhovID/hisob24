package catalog

import (
	"regexp"

	"github.com/jackc/pgx/v5/pgtype"
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
