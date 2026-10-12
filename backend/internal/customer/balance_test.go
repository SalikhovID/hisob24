package customer

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// addDocument enters a live document of the customer in the journal, the
// way the sales section does: a sale out of a location, a payment into
// the cash, or an opening debt, each of total so'm.
func addDocument(t *testing.T, pool *pgxpool.Pool, companyID int64, kind string, customerID *int64, total string) int64 {
	t.Helper()
	ctx := t.Context()
	// The company's rate row, location and cash: made on the first ask.
	var rate, location, cash int64
	if err := pool.QueryRow(ctx, "SELECT id FROM currency_rates WHERE company_id = $1 AND status = 2 ORDER BY id LIMIT 1", companyID).Scan(&rate); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, status, set_by) VALUES ($1, 2, $2) RETURNING id", companyID, owner).Scan(&rate))
	}
	if err := pool.QueryRow(ctx, "SELECT id FROM locations WHERE company_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1", companyID).Scan(&location); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", companyID).Scan(&location))
	}
	if err := pool.QueryRow(ctx, "SELECT id FROM bank_accounts WHERE company_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1", companyID).Scan(&cash); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", companyID).Scan(&cash))
	}
	var number int32
	require.NoError(t, pool.QueryRow(ctx, "SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = $2", companyID, kind).Scan(&number))
	var locationID, accountID *int64
	if kind == "sale" {
		locationID = &location
	}
	if kind == "customer_payment" {
		accountID = &cash
	}
	var id int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, customer_id, bank_account_id, currency_id, currency_rate_id, total, created_by)
		VALUES ($1, $2, $3, now(), $4, $5, $6, 1, $7, $8::numeric, $9) RETURNING id`, companyID, kind, number, locationID, customerID, accountID, rate, total, owner).Scan(&id))
	return id
}

func TestACustomersBalanceIsToldAndTheirDocumentsHoldThem(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali"})
	// Ali bought for 10 000, paid 4 000 and owed 300 000 before the books;
	// a retail sale is nobody's; a deleted payment counts for nothing.
	sale := addDocument(t, pool, olma.id, "sale", &ali.ID, "10000")
	addDocument(t, pool, olma.id, "customer_payment", &ali.ID, "4000")
	debt := addDocument(t, pool, olma.id, "customer_debt", &ali.ID, "300000")
	addDocument(t, pool, olma.id, "sale", nil, "5000")
	gone := addDocument(t, pool, olma.id, "customer_payment", &ali.ID, "1")
	_, err := pool.Exec(ctx, "UPDATE transactions SET deleted_at = now() WHERE id = $1", gone)
	require.NoError(t, err)

	got, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err)
	assert.Equal(t, "306000.00", got.Balance, "10 000 + 300 000 − 4 000")
	assert.Equal(t, []BalanceLine{{CurrencyID: 1, Amount: "306000.00"}}, got.BalanceByCurrency)
	other, err := s.Get(ctx, olma.id, vali.ID)
	require.NoError(t, err)
	assert.Equal(t, "0.00", other.Balance)
	assert.Empty(t, other.BalanceByCurrency)
	page, err := s.List(ctx, olma.id, ListInput{Page: 1})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	assert.Equal(t, "306000.00", page.Items[1].Balance, "the list carries the balance")
	assert.Nil(t, page.Items[1].BalanceByCurrency, "but not by currency")

	err = s.Delete(ctx, olma.id, ali.ID, owner)
	refused(t, err, apperr.Conflict, "customer_in_use", "Bu mijozda 3 ta hujjat bor")
	_, err = s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err, "the customer stays")
	_, err = pool.Exec(ctx, "UPDATE transactions SET deleted_at = now() WHERE id IN ($1, $2) OR (customer_id = $3 AND kind = 'customer_payment')", sale, debt, ali.ID)
	require.NoError(t, err)
	assert.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner), "the deleted documents do not hold the customer")
}
