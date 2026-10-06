package task

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool, customer.NewService(pool)), pool
}

func ptr[T any](v T) *T { return &v }

// addCompany inserts a company with no stages and no types and returns its id.
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

// count is how many rows a query counts.
func count(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, pool.QueryRow(t.Context(), sql, args...).Scan(&n))
	return n
}

// holdCompany holds the company the way a write of its customers, tasks or
// their settings does, until release is called: a write made meanwhile has
// to wait.
func holdCompany(t *testing.T, pool *pgxpool.Pool, companyID int64) (release func()) {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	_, err = tx.Exec(t.Context(), "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", companyID)
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

// The writes of a company's task settings take turns with each other and
// with the customer writes (the same lock), so what one of them checks (a
// name, an order) cannot change under it.
func TestAWriteWaitsForAnotherWriteOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	yangi := mustStage(t, s, olma, "Yangi", "blue")
	bajarildi := mustStage(t, s, olma, "Bajarildi", "green")
	spare := mustStage(t, s, olma, "Ortiqcha", "slate")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	izoh := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	summa := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Summa", Kind: "int"})

	for _, w := range []struct {
		name  string
		write func() error
	}{
		// A new order names what is there now: the orders go before what
		// adds a stage, a type or a field.
		{"OrderStages", func() error { return s.OrderStages(ctx, olma, []int64{bajarildi.ID, yangi.ID, spare.ID}) }},
		{"CreateStage", func() error {
			_, err := s.CreateStage(ctx, olma, StageInput{Name: "Kutilmoqda", Color: "amber"})
			return err
		}},
		{"UpdateStage", func() error { _, err := s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Name: ptr("Ochiq")}); return err }},
		{"DeleteStage", func() error { return s.DeleteStage(ctx, olma, spare.ID) }},
		{"OrderTypes", func() error { return s.OrderTypes(ctx, olma, []int64{shikoyat.ID, buyurtma.ID}) }},
		{"CreateType", func() error { _, err := s.CreateType(ctx, olma, "Qo'ng'iroq"); return err }},
		{"RenameType", func() error { _, err := s.RenameType(ctx, olma, shikoyat.ID, "Arz"); return err }},
		{"OrderFields", func() error { return s.OrderFields(ctx, olma, buyurtma.ID, []int64{summa.ID, izoh.ID}) }},
		{"AddField", func() error {
			_, err := s.AddField(ctx, olma, buyurtma.ID, FieldInput{Label: "Manzil", Kind: "string"})
			return err
		}},
		{"UpdateField", func() error {
			_, err := s.UpdateField(ctx, olma, buyurtma.ID, izoh.ID, FieldPatch{Required: ptr(true)})
			return err
		}},
		{"DeleteField", func() error { return s.DeleteField(ctx, olma, buyurtma.ID, summa.ID) }},
		{"DeleteType", func() error { return s.DeleteType(ctx, olma, shikoyat.ID) }},
	} {
		t.Run(w.name, func(t *testing.T) { waits(t, pool, olma, w.write) })
	}
}
