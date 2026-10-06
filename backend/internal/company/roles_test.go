package company

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// addRole makes a company role with permissions and returns its id.
func addRole(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, permissions ...string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(),
		"INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3) RETURNING id",
		companyID, name, append([]string{}, permissions...)).Scan(&id))
	return id
}

// giveRole hands the member with phone the role.
func giveRole(t *testing.T, pool *pgxpool.Pool, phone string, roleID int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), "UPDATE user_companies SET role_id = $1 WHERE user_phone = $2", roleID, phone)
	require.NoError(t, err)
}

func TestMembersTellTheRole(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	addEmployee(t, pool, c.ID, "998903334455", "Rolsiz")
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	giveRole(t, pool, "998902223344", sotuvchi)

	members, err := s.Members(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, members, 3)
	assert.Nil(t, members[0].RoleID, "the owner has no role")
	assert.Nil(t, members[0].RoleName)
	require.NotNil(t, members[1].RoleID)
	assert.Equal(t, sotuvchi, *members[1].RoleID)
	require.NotNil(t, members[1].RoleName)
	assert.Equal(t, "Sotuvchi", *members[1].RoleName, "the role the member holds, by name")
	assert.Nil(t, members[2].RoleName, "a user with no role")
}

func TestRenameEmployeeKeepsTheRole(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	giveRole(t, pool, "998902223344", sotuvchi)

	m, err := s.RenameEmployee(t.Context(), c.ID, "998902223344", "Xodim Sotuvchi")

	require.NoError(t, err)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim Sotuvchi", *m.FullName)
	require.NotNil(t, m.RoleID)
	assert.Equal(t, sotuvchi, *m.RoleID, "the role stays")
	require.NotNil(t, m.RoleName)
	assert.Equal(t, "Sotuvchi", *m.RoleName, "and the answer names it")
}
