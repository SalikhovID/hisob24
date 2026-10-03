package company

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMembers(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	c := mustCreate(t, s, "Olma", d)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	addEmployee(t, pool, c.ID, "998903334455", "Ikkinchi Xodim")
	other, err := s.Create(t.Context(), CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998909999999", OwnerFullName: "Begona"}, ownerID)
	require.NoError(t, err)
	addEmployee(t, pool, other.ID, "998902223344", "Xodim (Nok)")

	members, err := s.Members(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, members, 3, "this company's members only")
	assert.Equal(t, "998900000001", members[0].Phone, "the owner first")
	assert.Equal(t, "owner", members[0].Role)
	assert.Equal(t, "998902223344", members[1].Phone, "then the users as they joined")
	assert.Equal(t, "user", members[1].Role)
	require.NotNil(t, members[1].FullName)
	assert.Equal(t, "Xodim", *members[1].FullName, "under the name in this company")
	assert.False(t, members[1].CreatedAt.IsZero())
	assert.Equal(t, "998903334455", members[2].Phone)
}

func TestAddEmployee(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	m, err := s.AddEmployee(ctx, c.ID, "90 222 33 44", " Vali ")

	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Vali", *m.FullName)
	assert.Equal(t, "user", m.Role, "whoever the owner adds is a user")
	assert.False(t, m.CreatedAt.IsZero())
	assert.Equal(t, map[string]string{"998900000001": "owner", "998902223344": "user"}, rolesOf(t, pool, c.ID))
	var userName string
	require.NoError(t, pool.QueryRow(ctx, "SELECT full_name FROM users WHERE phone = '998902223344'").Scan(&userName))
	assert.Equal(t, "Vali", userName, "a phone that was no user becomes one")
}
