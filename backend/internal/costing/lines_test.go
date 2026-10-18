package costing

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const ali = "998901111111"

// journal is a company with a location, a supplier, two products and a
// rate row: what the cost moves are read from.
type journal struct {
	company, asosiy, chilonzor, bozor, olma, nok, rate int64
}

func newJournal(t *testing.T, pool *pgxpool.Pool) journal {
	t.Helper()
	ctx := t.Context()
	var j journal
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ('Olma', CURRENT_DATE) RETURNING id").Scan(&j.company))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", ali)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", j.company).Scan(&j.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", j.company).Scan(&j.chilonzor))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', $2) RETURNING id", j.company, ali).Scan(&j.bozor))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', $2) RETURNING id", j.company, ali).Scan(&j.olma))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Nok', 'dona', $2) RETURNING id", j.company, ali).Scan(&j.nok))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, $2) RETURNING id", j.company, ali).Scan(&j.rate))
	return j
}

// document enters a document of the kind at the moment in the location,
// in the currency, numbered next.
func (j journal) document(t *testing.T, pool *pgxpool.Pool, kind, at string, locationID int64, currency int64) int64 {
	t.Helper()
	var supplier *int64
	if kind == "purchase" {
		supplier = &j.bozor
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, supplier_id, currency_id, currency_rate_id, created_by)
		VALUES ($1, $2, (SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = $2), $3, $4, $5, $6, $7, $8) RETURNING id`,
		j.company, kind, at, locationID, supplier, currency, j.rate, ali).Scan(&id))
	return id
}

// line enters a line of the document with its move into (quantity above
// zero) or out of (below) the location.
func (j journal) line(t *testing.T, pool *pgxpool.Pool, txID, locationID, productID int64, quantity string, price *string) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, abs($3::numeric), $4::numeric, (SELECT count(*) + 1 FROM transaction_items WHERE transaction_id = $1))", txID, productID, quantity, price)
	require.NoError(t, err)
	_, err = pool.Exec(t.Context(), "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5::numeric)", txID, j.company, locationID, productID, quantity)
	require.NoError(t, err)
}

func ptr[T any](v T) *T { return &v }

// The lines of a document are costed from the journal: a product bought
// in dollars at one price and in so'm at another, taken by FIFO; a
// product the document did not move costs nothing.
func TestLinesCostsTheDocumentsProductsFromTheJournal(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	q := gen.New(pool)
	ctx := t.Context()
	j := newJournal(t, pool)
	// The 1st: 10 Olma at 1 USD (12 800). The 2nd: 10 Olma at 15 000 so'm.
	// The 3rd: 4 Nok at 2 000. The 5th: an order takes 12 Olma and 1 Nok.
	first := j.document(t, pool, "purchase", "2026-10-01 09:00+05", j.asosiy, 2)
	j.line(t, pool, first, j.asosiy, j.olma, "10", ptr("1"))
	second := j.document(t, pool, "purchase", "2026-10-02 09:00+05", j.asosiy, 1)
	j.line(t, pool, second, j.asosiy, j.olma, "10", ptr("15000"))
	j.line(t, pool, second, j.asosiy, j.nok, "4", ptr("2000"))
	order := j.document(t, pool, "sale", "2026-10-05 09:00+05", j.asosiy, 1)
	j.line(t, pool, order, j.asosiy, j.olma, "-12", nil)
	j.line(t, pool, order, j.asosiy, j.nok, "-1", nil)

	costs, err := Lines(ctx, q, j.company, order, []int64{j.olma, j.nok, j.nok + 1000})

	require.NoError(t, err)
	assert.Equal(t, "158000.00", costs[j.olma].FloatString(2), "10 at 12 800 and 2 at 15 000")
	assert.Equal(t, "2000.00", costs[j.nok].FloatString(2))
	assert.Equal(t, "0.00", costs[j.nok+1000].FloatString(2), "a product the document did not move")
	costs, err = Lines(ctx, q, j.company, order, nil)
	require.NoError(t, err)
	assert.Empty(t, costs, "no products asked about")
}
