package company

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/apperr"
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

func TestRoles(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	roles, err := s.Roles(ctx, c.ID)
	require.NoError(t, err)
	assert.Equal(t, []Role{}, roles, "a company starts with no role")

	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view", "customers.create")
	addRole(t, pool, c.ID, "admin", "settings.view")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	giveRole(t, pool, "998902223344", sotuvchi)

	roles, err = s.Roles(ctx, c.ID)
	require.NoError(t, err)
	require.Len(t, roles, 2)
	assert.Equal(t, "admin", roles[0].Name, "by name, whatever the case")
	assert.Equal(t, Role{ID: sotuvchi, Name: "Sotuvchi", Permissions: []access.Permission{access.CustomersView, access.CustomersCreate}, MembersCount: 1}, roles[1])
}

func TestCreateRole(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	r, err := s.CreateRole(ctx, c.ID, "  Sotuvchi ", []string{"tasks.view", "customers.view", "customers.view"})

	require.NoError(t, err)
	assert.Equal(t, "Sotuvchi", r.Name, "trimmed")
	assert.Equal(t, []access.Permission{access.CustomersView, access.TasksView}, r.Permissions, "in the catalog's order, once each")
	assert.EqualValues(t, 0, r.MembersCount)
	assert.NotZero(t, r.ID)

	for name, tc := range map[string]struct {
		role          string
		perms         []string
		kind          apperr.Kind
		code, message string
	}{
		"no name":                    {" ", nil, apperr.Invalid, "validation_error", "Nomni kiriting"},
		"too long":                   {strings.Repeat("a", 61), nil, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"taken, whatever the case":   {"sotuvchi", nil, apperr.Conflict, "name_taken", "Bu nomli rol allaqachon bor"},
		"unknown permission":         {"Kassir", []string{"customers.fly"}, apperr.Invalid, "validation_error", "Ruxsat noto'g'ri"},
		"an action without the view": {"Kassir", []string{"tasks.create"}, apperr.Invalid, "validation_error", "«Vazifalar» bo'limida avval «Ko'rish» ni belgilang"},
	} {
		_, err := s.CreateRole(ctx, c.ID, tc.role, tc.perms)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	roles, err := s.Roles(ctx, c.ID)
	require.NoError(t, err)
	assert.Len(t, roles, 1, "nothing else was made")
}

func TestUpdateRole(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	c := mustCreate(t, s, "Olma", d)
	nok, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998909999999", OwnerFullName: "Begona"}, ownerID)
	require.NoError(t, err)
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	addRole(t, pool, c.ID, "Kassir", "tasks.view")

	r, err := s.UpdateRole(ctx, c.ID, sotuvchi, " Katta sotuvchi ", []string{"customers.create", "customers.view"})
	require.NoError(t, err)
	assert.Equal(t, Role{ID: sotuvchi, Name: "Katta sotuvchi", Permissions: []access.Permission{access.CustomersView, access.CustomersCreate}}, r)

	r, err = s.UpdateRole(ctx, c.ID, sotuvchi, "katta sotuvchi", []string{})
	require.NoError(t, err, "its own name in another case is not taken")
	assert.Equal(t, "katta sotuvchi", r.Name)
	assert.Equal(t, []access.Permission{}, r.Permissions, "a role may be left with nothing")

	for name, tc := range map[string]struct {
		company, id   int64
		role          string
		perms         []string
		kind          apperr.Kind
		code, message string
	}{
		"another role's name": {c.ID, sotuvchi, "kassir", nil, apperr.Conflict, "name_taken", "Bu nomli rol allaqachon bor"},
		"no such role":        {c.ID, 999999, "X", nil, apperr.NotFound, "not_found", "Rol topilmadi"},
		"another company's":   {nok.ID, sotuvchi, "X", nil, apperr.NotFound, "not_found", "Rol topilmadi"},
		"a bad permission":    {c.ID, sotuvchi, "Sotuvchi", []string{"customers.edit"}, apperr.Invalid, "validation_error", "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"},
		"no name":             {c.ID, sotuvchi, "", nil, apperr.Invalid, "validation_error", "Nomni kiriting"},
	} {
		_, err := s.UpdateRole(ctx, tc.company, tc.id, tc.role, tc.perms)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
}

func TestDeleteRole(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	giveRole(t, pool, "998902223344", sotuvchi)

	err := s.DeleteRole(ctx, c.ID, sotuvchi)
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Conflict, e.Kind)
	assert.Equal(t, "role_in_use", e.Code)
	assert.Equal(t, "Bu rol 1 ta xodimga biriktirilgan", e.Message)
	roles, err := s.Roles(ctx, c.ID)
	require.NoError(t, err)
	assert.Len(t, roles, 1, "the role someone holds stays")

	_, err = pool.Exec(ctx, "UPDATE user_companies SET role_id = NULL WHERE user_phone = '998902223344'")
	require.NoError(t, err)
	require.NoError(t, s.DeleteRole(ctx, c.ID, sotuvchi), "a role nobody holds")
	roles, err = s.Roles(ctx, c.ID)
	require.NoError(t, err)
	assert.Empty(t, roles)
	_, err = s.CreateRole(ctx, c.ID, "Sotuvchi", nil)
	assert.NoError(t, err, "the name is free again")

	err = s.DeleteRole(ctx, c.ID, sotuvchi)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "not_found", e.Code)
	assert.Equal(t, "Rol topilmadi", e.Message)
}

func TestSetEmployeeRole(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	c := mustCreate(t, s, "Olma", d)
	nok, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998909999999", OwnerFullName: "Begona"}, ownerID)
	require.NoError(t, err)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	begona := addRole(t, pool, nok.ID, "Begona")
	missing := int64(999999)

	m, err := s.SetEmployeeRole(ctx, c.ID, "+998 90 222 33 44", &sotuvchi)
	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.RoleID)
	assert.Equal(t, sotuvchi, *m.RoleID, "the employee holds the role")
	require.NotNil(t, m.RoleName)
	assert.Equal(t, "Sotuvchi", *m.RoleName, "and the answer names it")

	m, err = s.SetEmployeeRole(ctx, c.ID, "998902223344", nil)
	require.NoError(t, err)
	assert.Nil(t, m.RoleID, "taken away")
	assert.Nil(t, m.RoleName)

	for name, tc := range map[string]struct {
		phone         string
		role          *int64
		kind          apperr.Kind
		code, message string
	}{
		"the owner":              {"998900000001", &sotuvchi, apperr.Conflict, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"},
		"not a member":           {"998909999999", &sotuvchi, apperr.NotFound, "not_found", "Xodim topilmadi"},
		"bad phone":              {"12ab", &sotuvchi, apperr.NotFound, "not_found", "Xodim topilmadi"},
		"another company's role": {"998902223344", &begona, apperr.NotFound, "not_found", "Rol topilmadi"},
		"no such role":           {"998902223344", &missing, apperr.NotFound, "not_found", "Rol topilmadi"},
	} {
		_, err := s.SetEmployeeRole(ctx, c.ID, tc.phone, tc.role)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	var held *int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT role_id FROM user_companies WHERE user_phone = '998902223344'").Scan(&held))
	assert.Nil(t, held, "nothing was given")
}
