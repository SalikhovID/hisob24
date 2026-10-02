package billing

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
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
	pgtest.WaitForLockWait(t, pool)

	_, err = other.Exec(ctx, "UPDATE companies SET end_date = $2 WHERE id = $1", id, d.AddDate(0, 0, 100))
	require.NoError(t, err)
	require.NoError(t, other.Commit(ctx))

	got := <-extended
	require.NoError(t, got.err)
	assert.True(t, got.b.PrevEndDate.Equal(d.AddDate(0, 0, 100)), "reads the end date the other billing left: prev %s", got.b.PrevEndDate)
	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 110)), "neither billing is lost")
}

func TestExtendRefusals(t *testing.T) {
	s, pool := newService(t)
	id := createCompany(t, pool, dbToday(t, pool))
	for name, tc := range map[string]struct {
		companyID int64
		in        ExtendInput
		kind      apperr.Kind
	}{
		"no days":          {id, ExtendInput{Days: 0}, apperr.Invalid},
		"over ten years":   {id, ExtendInput{Days: 3651}, apperr.Invalid},
		"amount not money": {id, ExtendInput{Days: 1, Amount: "ko'p"}, apperr.Invalid},
		"negative amount":  {id, ExtendInput{Days: 1, Amount: "-5"}, apperr.Invalid},
		"three decimals":   {id, ExtendInput{Days: 1, Amount: "1.234"}, apperr.Invalid},
		"unknown company":  {id + 1, ExtendInput{Days: 1}, apperr.NotFound},
	} {
		_, err := s.Extend(t.Context(), tc.companyID, tc.in, ownerID)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
		}
	}
}

func TestHistory(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d)
	other := createCompany(t, pool, d)
	first, err := s.Extend(t.Context(), id, ExtendInput{Days: 30}, ownerID)
	require.NoError(t, err)
	second, err := s.Extend(t.Context(), id, ExtendInput{Days: 7}, ownerID)
	require.NoError(t, err)
	_, err = s.Extend(t.Context(), other, ExtendInput{Days: 1}, ownerID)
	require.NoError(t, err)

	h, err := s.History(t.Context(), id)

	require.NoError(t, err)
	require.Len(t, h, 2, "only this company's payments")
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{h[0].ID, h[1].ID}, "newest first")

	_, err = s.History(t.Context(), other+1)
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.NotFound, e.Kind)
}

func TestExtendIsAtomic(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))
	pgtest.FailInserts(t, pool, "billings")

	_, err := s.Extend(t.Context(), id, ExtendInput{Days: 30}, ownerID)

	require.Error(t, err)
	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 5)), "the end date stays when the payment is not recorded")
}
