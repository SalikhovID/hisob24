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

func TestAddAdminValidation(t *testing.T) {
	a, pool := newAdminAuth(t)
	for name, tc := range map[string]struct {
		id       int64
		fullName string
	}{
		"no telegram id":       {0, "Ism"},
		"negative telegram id": {-5, "Ism"},
		"no name":              {43, "  "},
	} {
		_, err := a.AddAdmin(t.Context(), tc.id, tc.fullName)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, apperr.Invalid, e.Kind, name)
		}
	}
	var admins int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM admins").Scan(&admins))
	assert.Equal(t, 1, admins, "only the owner")
}

func TestDeactivateAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name) VALUES (42, 'Ikkinchi')")
	issued, err := a.IssueLoginCode(ctx, 42)
	require.NoError(t, err)
	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)

	require.NoError(t, a.DeactivateAdmin(ctx, ownerID, 42))

	active, err := a.IsActiveAdmin(ctx, 42)
	require.NoError(t, err)
	assert.False(t, active)
	var sessions int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM admin_sessions WHERE admin_id = 42").Scan(&sessions))
	assert.Zero(t, sessions, "the sessions are deleted")
	_, err = a.Authenticate(ctx, s.ID.String())
	assert.ErrorIs(t, err, ErrUnauthenticated)
}
