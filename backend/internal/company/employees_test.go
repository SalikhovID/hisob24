package company

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
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

func TestAddEmployeeRefusals(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	const already = "Bu raqam kompaniyangizga allaqachon qo'shilgan"
	for name, tc := range map[string]struct {
		phone, fullName string
		kind            apperr.Kind
		code, message   string
	}{
		"the owner's own phone": {"998900000001", "Egasi Yana", apperr.Conflict, "already_member", already},
		"an employee already":   {"+998 90 222 33 44", "Boshqa Ism", apperr.Conflict, "already_member", already},
		"bad phone":             {"12ab", "Vali", apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri"},
		"no name":               {"998903334455", " ", apperr.Invalid, "validation_error", "Ismni kiriting"},
	} {
		_, err := s.AddEmployee(t.Context(), c.ID, tc.phone, tc.fullName)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	assert.Equal(t, map[string]string{"998900000001": "owner", "998902223344": "user"}, rolesOf(t, pool, c.ID),
		"nobody is added, the owner is not made a user")
	assert.Equal(t, "Egasi", nameIn(t, pool, c.ID, "998900000001"), "the owner keeps the name")
	assert.Equal(t, "Xodim", nameIn(t, pool, c.ID, "998902223344"), "and so does the employee")
	var users int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&users))
	assert.Equal(t, 2, users, "a refusal adds no user")
}

func TestAddEmployeeIsAtomic(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	pgtest.FailInserts(t, pool, "user_companies")

	_, err := s.AddEmployee(t.Context(), c.ID, "998902223344", "Vali")

	require.Error(t, err)
	var exists bool
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM users WHERE phone = '998902223344')").Scan(&exists))
	assert.False(t, exists, "no user without the membership")
}
