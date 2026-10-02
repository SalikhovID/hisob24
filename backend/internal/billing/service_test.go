package billing

import (
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const ownerID int64 = 461603558

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func dbToday(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}

func createCompany(t *testing.T, pool *pgxpool.Pool, endDate time.Time) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO companies (name, end_date) VALUES ('Olma', $1) RETURNING id", endDate).Scan(&id))
	return id
}

func endDateOf(t *testing.T, pool *pgxpool.Pool, id int64) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT end_date FROM companies WHERE id = $1", id).Scan(&d))
	return d
}

func amountText(t *testing.T, n pgtype.Numeric) string {
	t.Helper()
	v, err := n.Value()
	require.NoError(t, err)
	s, _ := v.(string)
	return s
}

func TestExtendFromTheEndDate(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))

	b, err := s.Extend(t.Context(), id, ExtendInput{Days: 30, Amount: "150000.50", Note: " Naqd "}, ownerID)

	require.NoError(t, err)
	assert.True(t, b.PrevEndDate.Equal(d.AddDate(0, 0, 5)), "prev %s", b.PrevEndDate)
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 35)), "new %s", b.NewEndDate)
	assert.Equal(t, "150000.50", amountText(t, b.Amount))
	require.NotNil(t, b.Note)
	assert.Equal(t, "Naqd", *b.Note)
	require.NotNil(t, b.CreatedBy)
	assert.Equal(t, ownerID, *b.CreatedBy)
	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 35)), "the company's end date moves too")
}

func TestExtendAnExpiredCompanyFromToday(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, -10))

	b, err := s.Extend(t.Context(), id, ExtendInput{Days: 30}, ownerID)

	require.NoError(t, err)
	assert.True(t, b.PrevEndDate.Equal(d.AddDate(0, 0, -10)), "prev %s", b.PrevEndDate)
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 30)), "new %s", b.NewEndDate)
	assert.False(t, b.Amount.Valid, "no amount")
	assert.Nil(t, b.Note)
}

func TestConcurrentExtensionsChain(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))

	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Go(func() {
			_, err := s.Extend(t.Context(), id, ExtendInput{Days: 10}, ownerID)
			errs <- err
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 25)), "both payments count")
	// The row lock orders the payments, and so do their ids; created_at is
	// each transaction's start and may not.
	var payments int
	var firstNew, secondPrev time.Time
	require.NoError(t, pool.QueryRow(t.Context(), `
		SELECT count(*),
		       (SELECT new_end_date FROM billings WHERE company_id = $1 ORDER BY id LIMIT 1),
		       (SELECT prev_end_date FROM billings WHERE company_id = $1 ORDER BY id DESC LIMIT 1)
		FROM billings WHERE company_id = $1`, id).Scan(&payments, &firstNew, &secondPrev))
	assert.Equal(t, 2, payments)
	assert.True(t, secondPrev.Equal(firstNew), "the second payment starts where the first ended")
}
