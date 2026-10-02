package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestGetActiveAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active) VALUES (42, 'Off', false)")

	owner, err := q.GetActiveAdmin(ctx, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "Owner", *owner.FullName)
	assert.True(t, owner.IsActive)

	_, err = q.GetActiveAdmin(ctx, 42)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an inactive admin is not returned")
}

func TestListAdmins(t *testing.T) {
	q, pool := setup(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active, created_at) VALUES (42, 'Ikkinchi', false, now() + interval '1 minute')")

	admins, err := q.ListAdmins(t.Context())

	require.NoError(t, err)
	require.Len(t, admins, 2)
	assert.Equal(t, ownerID, admins[0].TelegramID)
	assert.Equal(t, int64(42), admins[1].TelegramID)
	assert.False(t, admins[1].IsActive, "inactive admins are listed too")
}

func TestCreateOrReactivateAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	created, err := q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: 42, FullName: ptr("Yangi")})
	require.NoError(t, err)
	assert.True(t, created.IsActive)
	assert.Equal(t, "Yangi", *created.FullName)

	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")
	revived, err := q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: 42, FullName: ptr("Qaytgan")})
	require.NoError(t, err)
	assert.True(t, revived.IsActive)
	assert.Equal(t, "Qaytgan", *revived.FullName)

	_, err = q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: ownerID, FullName: ptr("Boshqa")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an active admin is not overwritten")
	owner, err := q.GetActiveAdmin(ctx, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "Owner", *owner.FullName)
}

func TestLockActiveAdmins(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, true), (43, false)")
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	ids, err := q.WithTx(tx).LockActiveAdmins(ctx)

	require.NoError(t, err)
	assert.Equal(t, []int64{42, ownerID}, ids)
	_, err = pool.Exec(ctx, "SELECT 1 FROM admins WHERE telegram_id = $1 FOR UPDATE NOWAIT", ownerID)
	assert.Equal(t, "55P03", sqlState(err), "the rows stay locked until the transaction ends") // lock_not_available
}

func TestDeactivateAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")

	n, err := q.DeactivateAdmin(ctx, 42)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	_, err = q.GetActiveAdmin(ctx, 42)
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	n, err = q.DeactivateAdmin(ctx, 42)
	require.NoError(t, err)
	assert.Zero(t, n, "an inactive admin is not touched again")
	n, err = q.DeactivateAdmin(ctx, 999)
	require.NoError(t, err)
	assert.Zero(t, n)
}
