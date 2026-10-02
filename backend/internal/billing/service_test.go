package billing

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
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

func TestExtendReadsTheEndDateUnderTheLock(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))

	// Another billing holds the company row.
	other, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = other.Rollback(context.WithoutCancel(ctx)) })
	_, err = other.Exec(ctx, "SELECT end_date FROM companies WHERE id = $1 FOR UPDATE", id)
	require.NoError(t, err)

	type result struct {
		b   gen.Billing
		err error
	}
	extended := make(chan result, 1)
	go func() {
		b, err := s.Extend(ctx, id, ExtendInput{Days: 10}, ownerID)
		extended <- result{b, err}
	}()
	waitForLockWait(t, pool)

	_, err = other.Exec(ctx, "UPDATE companies SET end_date = $2 WHERE id = $1", id, d.AddDate(0, 0, 100))
	require.NoError(t, err)
	require.NoError(t, other.Commit(ctx))

	got := <-extended
	require.NoError(t, got.err)
	assert.True(t, got.b.PrevEndDate.Equal(d.AddDate(0, 0, 100)), "reads the end date the other billing left: prev %s", got.b.PrevEndDate)
	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 110)), "neither billing is lost")
}

// waitForLockWait returns once a session of the test database waits on a lock.
func waitForLockWait(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	require.Eventually(t, func() bool {
		var waiting int
		err := pool.QueryRow(t.Context(), `SELECT count(*) FROM pg_stat_activity
			WHERE datname = current_database() AND wait_event_type = 'Lock'`).Scan(&waiting)
		return err == nil && waiting > 0
	}, 5*time.Second, 10*time.Millisecond)
}
