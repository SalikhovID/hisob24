package ledger

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali  = "998901111111"
	vali = "998902222222"
)

// shop is a company with Ali (owner, "Ali aka") and Vali (user), two
// locations, a supplier, two products and its cash in so'm.
type shop struct {
	company, asosiy, chilonzor, bozor, olma, nok, cash int64
}

func newShop(t *testing.T, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	var s shop
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&s.company))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT DO NOTHING", ali, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka'), ($3, $2, 'user', NULL)", ali, s.company, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1)", s.company)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", s.company).Scan(&s.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", s.company).Scan(&s.chilonzor))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', $2) RETURNING id", s.company, ali).Scan(&s.bozor))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', $2) RETURNING id", s.company, ali).Scan(&s.olma))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Nok', 'dona', $2) RETURNING id", s.company, ali).Scan(&s.nok))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", s.company).Scan(&s.cash))
	return s
}

// turnOn turns a currency on for the company.
func turnOn(t *testing.T, pool *pgxpool.Pool, companyID, currencyID int64) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", companyID, currencyID)
	require.NoError(t, err)
}

// standardRate enters a standard rate row (1 USD = usd so'm, 1 EUR = eur
// so'm) set at the moment.
func standardRate(t *testing.T, pool *pgxpool.Pool, companyID int64, usd, eur, setAt string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO currency_rates (company_id, usd, eur, set_by, set_at) VALUES ($1, $2::numeric, $3::numeric, $4, $5::timestamptz) RETURNING id", companyID, usd, eur, ali, setAt).Scan(&id))
	return id
}

// addAccount enters an account of the company in the currency, active or not.
func addAccount(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, currencyID int64, active bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO bank_accounts (company_id, name, currency_id, is_active) VALUES ($1, $2, $3, $4) RETURNING id", companyID, name, currencyID, active).Scan(&id))
	return id
}

// addDocument enters a goods document's head in the location, in so'm by
// the company's zero row.
func addDocument(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, s shop, kind Kind, number int32) gen.Transaction {
	t.Helper()
	ctx := t.Context()
	pricing, err := PriceIn(ctx, q, s.company, PriceInput{}, must(At("2026-10-07T09:00:00+05:00")), ali, nil)
	require.NoError(t, err)
	var supplier *int64
	if kind == Purchase {
		supplier = &s.bozor
	}
	row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
		CompanyID: s.company, Kind: string(kind), Number: number, DocAt: must(At("2026-10-07T09:00:00+05:00")), LocationID: &s.asosiy, SupplierID: supplier,
		CurrencyID: pricing.CurrencyID, CurrencyRateID: pricing.RateID, Total: n(t, "0"), CreatedBy: ali,
	})
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "SELECT 1")
	require.NoError(t, err)
	return row
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func n(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	var v pgtype.Numeric
	require.NoError(t, v.Scan(s))
	return v
}

func text(v pgtype.Numeric) string {
	s, err := v.Value()
	if err != nil {
		return "?"
	}
	return s.(string)
}

func ptr[T any](v T) *T { return &v }

func newQueries(t *testing.T) (*gen.Queries, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return gen.New(pool), pool
}

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

// stockOf is the product's stock in the location, "0" when nothing moved.
func stockOf(t *testing.T, pool *pgxpool.Pool, locationID, productID int64) string {
	t.Helper()
	var s string
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT COALESCE(sum(quantity), 0)::text FROM stock_moves WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s))
	return s
}

func TestTitleAndNumbered(t *testing.T) {
	assert.Equal(t, "Xarid", Title(Purchase))
	assert.Equal(t, "Ko'chirish", Title(Transfer))
	assert.Equal(t, "Boshlang'ich qoldiq", Title(OpeningStock))
	assert.Equal(t, "To'lov", Title(SupplierPayment))
	assert.Equal(t, "Konvertatsiya", Title(Conversion))
	assert.Equal(t, "Hujjat", Title(Kind("refund")), "a kind the journal does not know")
	assert.True(t, Numbered(Purchase))
	assert.True(t, Numbered(Expense))
	assert.False(t, Numbered(SupplierPayment), "a payment's number is not shown")
	assert.False(t, Numbered(CashOpening))
}

func TestAt(t *testing.T) {
	for name, tc := range map[string]struct{ raw, want, message string }{
		"a moment in Tashkent":  {"2026-10-07T09:00:00+05:00", "2026-10-07 04:00:00", ""},
		"a moment in UTC":       {"2026-10-07T04:00:00Z", "2026-10-07 04:00:00", ""},
		"with milliseconds":     {"2026-10-07T04:00:00.250Z", "2026-10-07 04:00:00.25", ""},
		"nothing":               {"", "", "Vaqtni kiriting"},
		"spaces":                {"   ", "", "Vaqtni kiriting"},
		"a day alone":           {"2026-10-07", "", "Vaqt noto'g'ri"},
		"not a moment":          {"kecha", "", "Vaqt noto'g'ri"},
		"a datetime-local text": {"2026-10-07T09:00", "", "Vaqt noto'g'ri"},
	} {
		got, err := At(tc.raw)
		if tc.message != "" {
			refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, tc.want, got.Format("2006-01-02 15:04:05.999"), name)
		assert.Equal(t, "UTC", got.Location().String(), name)
	}
}
