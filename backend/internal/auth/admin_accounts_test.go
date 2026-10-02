package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestListAdmins(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active, created_at) VALUES (42, 'Ikkinchi', false, now() + interval '1 minute')")

	admins, err := a.ListAdmins(t.Context())

	require.NoError(t, err)
	require.Len(t, admins, 2, "inactive admins too")
	assert.Equal(t, ownerID, admins[0].TelegramID)
	assert.Equal(t, int64(42), admins[1].TelegramID)
	assert.False(t, admins[1].IsActive)
}

func TestAddAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()

	added, err := a.AddAdmin(ctx, 42, "  Yangi Admin ")
	require.NoError(t, err)
	assert.Equal(t, int64(42), added.TelegramID)
	assert.True(t, added.IsActive)
	require.NotNil(t, added.FullName)
	assert.Equal(t, "Yangi Admin", *added.FullName)

	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")
	back, err := a.AddAdmin(ctx, 42, "Qaytgan")
	require.NoError(t, err)
	assert.True(t, back.IsActive, "a deactivated admin comes back")
	require.NotNil(t, back.FullName)
	assert.Equal(t, "Qaytgan", *back.FullName)

	_, err = a.AddAdmin(ctx, ownerID, "Boshqa")
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Conflict, e.Kind)
	assert.Equal(t, "admin_exists", e.Code)
}
