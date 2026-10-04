package customer

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func ptr[T any](v T) *T { return &v }

// addCompany inserts a company with no customer types and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	return id
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

// holdCompany holds the company the way a write of its customers or of their
// settings does, until release is called: a write made meanwhile has to wait.
func holdCompany(t *testing.T, pool *pgxpool.Pool, companyID int64) (release func()) {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	_, err = tx.Exec(t.Context(), "SELECT id FROM companies WHERE id = $1 FOR UPDATE", companyID)
	require.NoError(t, err)
	return func() { require.NoError(t, tx.Commit(t.Context())) }
}

// waits asserts that the write waits while the company is held, and goes on
// once it is free.
func waits(t *testing.T, pool *pgxpool.Pool, companyID int64, write func() error) {
	t.Helper()
	release := holdCompany(t, pool, companyID)
	done := make(chan error, 1)
	go func() { done <- write() }()
	pgtest.WaitForLockWait(t, pool)
	select {
	case err := <-done:
		t.Fatalf("the write did not wait: %v", err)
	default:
	}
	release()
	require.NoError(t, <-done, "the write goes on once the company is free")
}

// The writes of a company's customers and of their settings take turns, so
// what one of them checks (a name, a count, an order) cannot change under it.
func TestAWriteWaitsForAnotherWriteOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	manba := mustDropdown(t, s, olma, "Manba")

	waits(t, pool, olma, func() error {
		_, err := s.RenameDropdown(ctx, olma, manba.ID, "Qayerdan")
		return err
	})
}
