package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func TestGetIsTheUserAndTheirCompanies(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	var olma, nok int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ('Olma', '2026-11-01') RETURNING id").Scan(&olma))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date, is_active) VALUES ('Nok', '2026-09-01', false) RETURNING id").Scan(&nok))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone, full_name) VALUES ('998901234567', 'Ali Valiyev')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role, full_name)
		VALUES ('998901234567', $1, 'owner', 'Ali Valiyev'), ('998901234567', $2, 'user', 'Ali (hisobchi)')`, olma, nok)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `WITH r AS (INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'Hisobchi', '{customers.view}') RETURNING id)
		UPDATE user_companies SET role_id = r.id FROM r WHERE user_phone = '998901234567' AND company_id = $1`, nok)
	require.NoError(t, err)

	profile, err := NewProfiles(pool).Get(ctx, "998901234567")

	require.NoError(t, err)
	assert.Equal(t, "998901234567", profile.Phone)
	require.NotNil(t, profile.FullName)
	assert.Equal(t, "Ali Valiyev", *profile.FullName)
	require.Len(t, profile.Companies, 2)
	assert.Equal(t, "Nok", profile.Companies[0].Name, "by name")
	assert.Equal(t, "user", profile.Companies[0].Role)
	require.NotNil(t, profile.Companies[0].FullName)
	assert.Equal(t, "Ali (hisobchi)", *profile.Companies[0].FullName, "the name the user goes by in that company")
	require.NotNil(t, profile.Companies[0].RoleName)
	assert.Equal(t, "Hisobchi", *profile.Companies[0].RoleName, "the role the user holds there")
	assert.False(t, profile.Companies[0].IsActive)
	assert.Equal(t, olma, profile.Companies[1].CompanyID)
	assert.Equal(t, "2026-11-01", profile.Companies[1].EndDate.Format("2006-01-02"))
	assert.Nil(t, profile.Companies[1].RoleName, "the owner has no role")
}

func TestGetCountsTheDaysLeftFromTheDatabasesToday(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901234567')")
	require.NoError(t, err)
	for _, c := range []struct{ name, endDate string }{
		{"A ahead", "CURRENT_DATE + 10"},
		{"B today", "CURRENT_DATE"},
		{"C past", "CURRENT_DATE - 5"},
	} {
		_, err := pool.Exec(ctx, `WITH c AS (INSERT INTO companies (name, end_date) VALUES ($1, `+c.endDate+`) RETURNING id)
			INSERT INTO user_companies (user_phone, company_id, role) SELECT '998901234567', id, 'owner' FROM c`, c.name)
		require.NoError(t, err)
	}

	profile, err := NewProfiles(pool).Get(ctx, "998901234567")

	require.NoError(t, err)
	require.Len(t, profile.Companies, 3)
	assert.Equal(t, 10, profile.Companies[0].DaysLeft)
	assert.Equal(t, 0, profile.Companies[1].DaysLeft, "the last day still counts")
	assert.Equal(t, -5, profile.Companies[2].DaysLeft)
}

func TestAccess(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901234567'), ('998909999999')")
	require.NoError(t, err)
	// company makes 998901234567 a member of a new company and returns its id.
	company := func(endDate string, active bool, role string) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `WITH c AS (INSERT INTO companies (name, end_date, is_active) VALUES ('X', `+endDate+`, $1) RETURNING id)
			INSERT INTO user_companies (user_phone, company_id, role) SELECT '998901234567', id, $2 FROM c RETURNING company_id`, active, role).Scan(&id))
		return id
	}
	profiles := NewProfiles(pool)

	for name, tc := range map[string]struct {
		id   int64
		want Access
	}{
		"the owner, paid up": {company("CURRENT_DATE + 30", true, "owner"), Access{Role: "owner", Permissions: access.NewSet(access.All), Active: true}},
		"a user, ends today": {company("CURRENT_DATE", true, "user"), Access{Role: "user", Permissions: access.NewSet(access.Default), Active: true}},
		"expired":            {company("CURRENT_DATE - 1", true, "user"), Access{Role: "user", Permissions: access.NewSet(access.Default)}},
		"blocked":            {company("CURRENT_DATE + 30", false, "owner"), Access{Role: "owner", Permissions: access.NewSet(access.All)}},
	} {
		got, err := profiles.Access(ctx, "998901234567", tc.id)
		require.NoError(t, err, name)
		assert.Equal(t, tc.want, got, name)
	}

	withRole := company("CURRENT_DATE + 30", true, "user")
	_, err = pool.Exec(ctx, `WITH r AS (INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'Kuzatuvchi', '{tasks.view,customers.view}') RETURNING id)
		UPDATE user_companies SET role_id = r.id FROM r WHERE user_phone = '998901234567' AND company_id = $1`, withRole)
	require.NoError(t, err)
	got, err := profiles.Access(ctx, "998901234567", withRole)
	require.NoError(t, err)
	assert.Equal(t, Access{Role: "user", Permissions: access.NewSet([]access.Permission{access.CustomersView, access.TasksView}), Active: true}, got,
		"a user with a role has what the role holds, nothing of the default")

	paidUp := company("CURRENT_DATE + 30", true, "owner")
	_, err = profiles.Access(ctx, "998909999999", paidUp)
	assert.ErrorIs(t, err, ErrNotMember, "someone else's company")
	_, err = profiles.Access(ctx, "998901234567", 999999)
	assert.ErrorIs(t, err, ErrNotMember, "no such company")
}
