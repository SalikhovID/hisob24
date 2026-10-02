package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateCompany(t *testing.T) {
	q, pool := setup(t)
	end := today(t, pool).AddDate(0, 0, 30)

	c := createCompany(t, q, "Olma MChJ", end)

	assert.NotZero(t, c.ID)
	assert.Equal(t, "Olma MChJ", c.Name)
	assert.True(t, c.EndDate.Equal(end), "end_date %s", c.EndDate)
	assert.True(t, c.IsActive)
	assert.Equal(t, ownerID, *c.CreatedBy)
}

func createCompany(t *testing.T, q *gen.Queries, name string, endDate time.Time) gen.Company {
	t.Helper()
	c, err := q.CreateCompany(context.Background(), gen.CreateCompanyParams{Name: name, EndDate: endDate, CreatedBy: ptr(ownerID)})
	require.NoError(t, err)
	return c
}

func TestGetCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	created := createCompany(t, q, "Olma MChJ", today(t, pool))

	got, err := q.GetCompany(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created, got)

	_, err = q.GetCompany(ctx, created.ID+1)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

// seedCompanies covers every status case: two active (one ends today), one
// past its end_date and one blocked.
func seedCompanies(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) {
	t.Helper()
	d := today(t, pool)
	createCompany(t, q, "Olma Savdo", d.AddDate(0, 0, 10))
	createCompany(t, q, "Nok Market", d)
	createCompany(t, q, "Olcha Servis", d.AddDate(0, 0, -1))
	blocked := createCompany(t, q, "Behi Blok", d.AddDate(0, 0, 30))
	mustExec(t, pool, "UPDATE companies SET is_active = false WHERE id = $1", blocked.ID)
}

func TestListCompanies(t *testing.T) {
	q, pool := setup(t)
	seedCompanies(t, q, pool)

	tests := []struct {
		name          string
		search        *string
		status        *string
		limit, offset int32
		want          []string
	}{
		{name: "everything, newest first", limit: 20, want: []string{"Behi Blok", "Olcha Servis", "Nok Market", "Olma Savdo"}},
		{name: "active", status: ptr("active"), limit: 20, want: []string{"Nok Market", "Olma Savdo"}},
		{name: "expired or blocked", status: ptr("expired"), limit: 20, want: []string{"Behi Blok", "Olcha Servis"}},
		{name: "search ignores case", search: ptr("OL"), limit: 20, want: []string{"Olcha Servis", "Olma Savdo"}},
		{name: "search and status", search: ptr("ol"), status: ptr("expired"), limit: 20, want: []string{"Olcha Servis"}},
		{name: "page", limit: 2, offset: 1, want: []string{"Olcha Servis", "Nok Market"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := q.ListCompanies(t.Context(), gen.ListCompaniesParams{Search: tt.search, Status: tt.status, Limit: tt.limit, Offset: tt.offset})
			require.NoError(t, err)
			assert.Equal(t, tt.want, companyNames(got))
		})
	}
}

func companyNames(cs []gen.Company) []string {
	names := make([]string, 0, len(cs))
	for _, c := range cs {
		names = append(names, c.Name)
	}
	return names
}

func TestCountCompanies(t *testing.T) {
	q, pool := setup(t)
	seedCompanies(t, q, pool)

	tests := []struct {
		name   string
		search *string
		status *string
		want   int64
	}{
		{name: "everything", want: 4},
		{name: "active", status: ptr("active"), want: 2},
		{name: "expired or blocked", status: ptr("expired"), want: 2},
		{name: "search and status", search: ptr("ol"), status: ptr("expired"), want: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := q.CountCompanies(t.Context(), gen.CountCompaniesParams{Search: tt.search, Status: tt.status})
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestUpdateCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))

	renamed, err := q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID, Name: ptr("Olma MChJ")})
	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", renamed.Name)
	assert.True(t, renamed.IsActive, "is_active is kept when not sent")

	blocked, err := q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID, IsActive: ptr(false)})
	require.NoError(t, err)
	assert.False(t, blocked.IsActive)
	assert.Equal(t, "Olma MChJ", blocked.Name, "name is kept when not sent")

	_, err = q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID + 1, Name: ptr("X")})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func TestLockCompanyEndDate(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d.AddDate(0, 0, 5))
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	row, err := q.WithTx(tx).LockCompanyEndDate(ctx, c.ID)

	require.NoError(t, err)
	assert.True(t, row.EndDate.Equal(d.AddDate(0, 0, 5)))
	assert.True(t, row.Today.Equal(d), "today is the database's CURRENT_DATE")
	_, err = pool.Exec(ctx, "SELECT 1 FROM companies WHERE id = $1 FOR UPDATE NOWAIT", c.ID)
	assert.Equal(t, "55P03", sqlState(err), "the row stays locked until the transaction ends")
}

func TestSetCompanyEndDate(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)

	require.NoError(t, q.SetCompanyEndDate(ctx, gen.SetCompanyEndDateParams{ID: c.ID, EndDate: d.AddDate(0, 0, 30)}))

	got, err := q.GetCompany(ctx, c.ID)
	require.NoError(t, err)
	assert.True(t, got.EndDate.Equal(d.AddDate(0, 0, 30)))
}
