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
