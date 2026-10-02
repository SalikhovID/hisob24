package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
