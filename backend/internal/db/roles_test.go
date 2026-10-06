package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateRole(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))

	r, err := q.CreateRole(ctx, gen.CreateRoleParams{CompanyID: c.ID, Name: "Sotuvchi", Permissions: []string{"customers.view", "customers.create"}})
	require.NoError(t, err)
	assert.Equal(t, "Sotuvchi", r.Name)
	assert.Equal(t, []string{"customers.view", "customers.create"}, r.Permissions)
	assert.Equal(t, c.ID, r.CompanyID)
	assert.False(t, r.CreatedAt.IsZero())

	empty, err := q.CreateRole(ctx, gen.CreateRoleParams{CompanyID: c.ID, Name: "Bo'sh", Permissions: []string{}})
	require.NoError(t, err)
	assert.Equal(t, []string{}, empty.Permissions, "a role may hold nothing")

	_, err = q.CreateRole(ctx, gen.CreateRoleParams{CompanyID: c.ID, Name: "sotuvchi", Permissions: []string{}})
	assert.Equal(t, "23505", sqlState(err), "a name is one role's in a company, whatever the case") // unique_violation
}

func TestListRoles(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	sotuvchi := addRole(t, pool, olma.ID, "Sotuvchi", "customers.view")
	addRole(t, pool, olma.ID, "admin", "settings.view")
	addRole(t, pool, nok.ID, "Begona")
	addMember(t, q, olma.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	addMember(t, q, olma.ID, "998903333333", "Ikkinchi", "user")
	mustExec(t, pool, "UPDATE user_companies SET role_id = $1 WHERE role = 'user' AND company_id = $2", sotuvchi, olma.ID)

	roles, err := q.ListRoles(ctx, olma.ID)

	require.NoError(t, err)
	require.Len(t, roles, 2, "this company's roles only")
	assert.Equal(t, "admin", roles[0].Name, "by name, whatever the case")
	assert.EqualValues(t, 0, roles[0].MembersCount)
	assert.Equal(t, "Sotuvchi", roles[1].Name)
	assert.Equal(t, []string{"customers.view"}, roles[1].Permissions)
	assert.EqualValues(t, 2, roles[1].MembersCount, "how many members hold it")
}

func TestGetRole(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	sotuvchi := addRole(t, pool, olma.ID, "Sotuvchi", "customers.view")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	mustExec(t, pool, "UPDATE user_companies SET role_id = $1 WHERE user_phone = '998902222222'", sotuvchi)

	r, err := q.GetRole(ctx, gen.GetRoleParams{ID: sotuvchi, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Sotuvchi", r.Name)
	assert.Equal(t, []string{"customers.view"}, r.Permissions)
	assert.EqualValues(t, 1, r.MembersCount)

	_, err = q.GetRole(ctx, gen.GetRoleParams{ID: sotuvchi, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's role")
	_, err = q.GetRole(ctx, gen.GetRoleParams{ID: 999999, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "no such role")
}

func TestUpdateRole(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	sotuvchi := addRole(t, pool, olma.ID, "Sotuvchi", "customers.view")
	addRole(t, pool, olma.ID, "Kassir", "tasks.view")

	r, err := q.UpdateRole(ctx, gen.UpdateRoleParams{ID: sotuvchi, CompanyID: olma.ID, Name: "Katta sotuvchi", Permissions: []string{"customers.view", "tasks.view"}})
	require.NoError(t, err)
	assert.Equal(t, "Katta sotuvchi", r.Name)
	assert.Equal(t, []string{"customers.view", "tasks.view"}, r.Permissions, "the permissions are replaced")
	assert.True(t, r.UpdatedAt.After(r.CreatedAt), "updated_at moves")

	_, err = q.UpdateRole(ctx, gen.UpdateRoleParams{ID: sotuvchi, CompanyID: nok.ID, Name: "Begona", Permissions: []string{}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's role")
	_, err = q.UpdateRole(ctx, gen.UpdateRoleParams{ID: sotuvchi, CompanyID: olma.ID, Name: "kassir", Permissions: []string{}})
	assert.Equal(t, "23505", sqlState(err), "another role's name") // unique_violation
}

func TestDeleteRole(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	sotuvchi := addRole(t, pool, olma.ID, "Sotuvchi", "customers.view")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	mustExec(t, pool, "UPDATE user_companies SET role_id = $1 WHERE user_phone = '998902222222'", sotuvchi)

	_, err := q.DeleteRole(ctx, gen.DeleteRoleParams{ID: sotuvchi, CompanyID: olma.ID})
	assert.Equal(t, "23503", sqlState(err), "a role someone holds is not deleted") // foreign_key_violation
	_, err = q.DeleteRole(ctx, gen.DeleteRoleParams{ID: sotuvchi, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's role")

	mustExec(t, pool, "UPDATE user_companies SET role_id = NULL WHERE user_phone = '998902222222'")
	id, err := q.DeleteRole(ctx, gen.DeleteRoleParams{ID: sotuvchi, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, sotuvchi, id)
	_, err = q.DeleteRole(ctx, gen.DeleteRoleParams{ID: sotuvchi, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "gone")
}

func TestCountRoleMembers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")
	addMember(t, q, c.ID, "998902222222", "Xodim", "user")
	addMember(t, q, c.ID, "998903333333", "Ikkinchi", "user")

	n, err := q.CountRoleMembers(ctx, &sotuvchi)
	require.NoError(t, err)
	assert.EqualValues(t, 0, n)

	mustExec(t, pool, "UPDATE user_companies SET role_id = $1 WHERE company_id = $2", sotuvchi, c.ID)
	n, err = q.CountRoleMembers(ctx, &sotuvchi)
	require.NoError(t, err)
	assert.EqualValues(t, 2, n)
}
