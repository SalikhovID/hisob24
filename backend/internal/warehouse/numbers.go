package warehouse

import (
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// paymentAmount reads an amount of money: one is needed, above zero, two
// decimals at most (the ledger's wording).
func paymentAmount(raw *string) (pgtype.Numeric, error) { return ledger.Amount(raw) }

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

// zero is an amount of nothing: what a goods document starts with.
func zero() pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(0), Valid: true}
}
