package warehouse

import (
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
)

// paymentAmount reads the amount of a payment: one is needed ("Summani
// kiriting"), an amount above zero ("Summa noto'g'ri").
func paymentAmount(raw *string) (pgtype.Numeric, error) {
	if raw == nil || *raw == "" {
		return pgtype.Numeric{}, invalid("Summani kiriting")
	}
	n, err := catalog.Money(raw, "Summa noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if catalog.Zero(n) {
		return pgtype.Numeric{}, invalid("Summa noto'g'ri")
	}
	return n, nil
}

// day reads a day the client sent, YYYY-MM-DD: one is needed.
func day(raw string) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, invalid("Sanani kiriting")
	}
	d, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, invalid("Sana noto'g'ri")
	}
	return d, nil
}

// amount is a stored amount as the API shows it (two decimals); "" when
// there is none (the columns here are NOT NULL).
func amount(n pgtype.Numeric) string {
	if s := catalog.Amount(n); s != nil {
		return *s
	}
	return ""
}

// quantity is a stored quantity as the API shows it (three decimals).
func quantity(n pgtype.Numeric) string {
	if s := catalog.QuantityText(n); s != nil {
		return *s
	}
	return ""
}
