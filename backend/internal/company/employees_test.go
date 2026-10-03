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

func TestAddEmployeeWhoWorksInAnotherCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	olma := mustCreate(t, s, "Olma", d)
	nok, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998902223344", OwnerFullName: "Vali Aliyev"}, ownerID)
	require.NoError(t, err)

	m, err := s.AddEmployee(ctx, olma.ID, "998902223344", "Vali (hisobchi)")

	require.NoError(t, err)
	assert.Equal(t, "user", m.Role, "an owner elsewhere is a user here")
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Vali (hisobchi)", *m.FullName, "the answer a new phone would get: the name given, nothing of the other company")
	assert.Equal(t, map[string]string{"998902223344": "owner"}, rolesOf(t, pool, nok.ID), "the other company is left alone")
	assert.Equal(t, "Vali Aliyev", nameIn(t, pool, nok.ID, "998902223344"))
	var userName string
	var companies int
	require.NoError(t, pool.QueryRow(ctx, `SELECT full_name, (SELECT count(*) FROM user_companies WHERE user_phone = phone)
		FROM users WHERE phone = '998902223344'`).Scan(&userName, &companies))
	assert.Equal(t, "Vali Aliyev", userName, "the user's own name stays")
	assert.Equal(t, 2, companies, "one user, a member of both companies")
}

func TestRenameEmployee(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	c := mustCreate(t, s, "Olma", d)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	other, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998909999999", OwnerFullName: "Begona"}, ownerID)
	require.NoError(t, err)
	addEmployee(t, pool, other.ID, "998902223344", "Xodim (Nok)")

	m, err := s.RenameEmployee(ctx, c.ID, "+998 90 222 33 44", " Xodim (hisobchi) ")

	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim (hisobchi)", *m.FullName)
	assert.Equal(t, "user", m.Role)
	assert.Equal(t, "Xodim (hisobchi)", nameIn(t, pool, c.ID, "998902223344"))
	assert.Equal(t, "Xodim (Nok)", nameIn(t, pool, other.ID, "998902223344"), "the name in another company stays")
}

func TestRenameEmployeeRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	c := mustCreate(t, s, "Olma", d)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	other, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998909999999", OwnerFullName: "Begona"}, ownerID)
	require.NoError(t, err)
	addEmployee(t, pool, other.ID, "998903334455", "Begona Xodim")
	for name, tc := range map[string]struct {
		phone, fullName string
		kind            apperr.Kind
		code, message   string
	}{
		"the owner":         {"998900000001", "Boshqa", apperr.Conflict, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"},
		"another company's": {"998903334455", "Boshqa", apperr.NotFound, "not_found", "Xodim topilmadi"},
		"no such user":      {"998907777777", "Boshqa", apperr.NotFound, "not_found", "Xodim topilmadi"},
		"not a phone":       {"12ab", "Boshqa", apperr.NotFound, "not_found", "Xodim topilmadi"},
		"no name":           {"998902223344", " ", apperr.Invalid, "validation_error", "Ismni kiriting"},
	} {
		_, err := s.RenameEmployee(ctx, c.ID, tc.phone, tc.fullName)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	assert.Equal(t, "Egasi", nameIn(t, pool, c.ID, "998900000001"), "the owner keeps the name")
	assert.Equal(t, "Xodim", nameIn(t, pool, c.ID, "998902223344"))
	assert.Equal(t, "Begona Xodim", nameIn(t, pool, other.ID, "998903334455"), "another company's employee is out of reach")
}
