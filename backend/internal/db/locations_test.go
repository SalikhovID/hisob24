package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestSeedLocation(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))

	l, err := q.SeedLocation(ctx, olma.ID)

	require.NoError(t, err)
	assert.Equal(t, "Asosiy", l.Name, "the ready location")
	assert.Equal(t, olma.ID, l.CompanyID)
	assert.Nil(t, l.DeletedAt)
	_, err = q.SeedLocation(ctx, olma.ID)
	assert.Equal(t, "23505", sqlState(err), "a company has one ready location") // unique_violation
}

func TestGetLocation(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	gone := addLocation(t, pool, olma.ID, "Yopilgan")
	mustExec(t, pool, "UPDATE locations SET deleted_at = now() WHERE id = $1", gone)

	l, err := q.GetLocation(ctx, gen.GetLocationParams{ID: asosiy, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Asosiy", l.Name)

	_, err = q.GetLocation(ctx, gen.GetLocationParams{ID: asosiy, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's location")
	_, err = q.GetLocation(ctx, gen.GetLocationParams{ID: gone, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted location")
	_, err = q.GetLocation(ctx, gen.GetLocationParams{ID: 999999, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "no such location")
}

// named is the names of the locations listed, in their order.
func named(rows []gen.ListMemberLocationsRow) []string {
	names := make([]string, 0, len(rows))
	for _, r := range rows {
		names = append(names, r.Name)
	}
	return names
}

func TestListMemberLocations(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	chilonzor := addLocation(t, pool, olma.ID, "Chilonzor")
	yunusobod := addLocation(t, pool, olma.ID, "Yunusobod")
	mustExec(t, pool, "UPDATE locations SET deleted_at = now() WHERE id = $1", yunusobod)
	addLocation(t, pool, nok.ID, "Asosiy")
	addMember(t, q, olma.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	addMember(t, q, olma.ID, "998903333333", "Cheklangan", "user")
	addMember(t, q, olma.ID, "998904444444", "Lokatsiyasiz", "user")
	addMember(t, q, nok.ID, "998905555555", "Begona", "owner")
	restrictTo(t, pool, "998903333333", olma.ID, chilonzor, yunusobod)
	restrictTo(t, pool, "998904444444", olma.ID, yunusobod)
	of := func(phone string) []string {
		rows, err := q.ListMemberLocations(ctx, gen.ListMemberLocationsParams{UserPhone: phone, CompanyID: olma.ID})
		require.NoError(t, err)
		return named(rows)
	}

	assert.Equal(t, []string{"Asosiy", "Chilonzor"}, of("998901111111"), "the owner: every live location, in the order they were added")
	assert.Equal(t, []string{"Asosiy", "Chilonzor"}, of("998902222222"), "a member without a restriction: the same")
	assert.Equal(t, []string{"Chilonzor"}, of("998903333333"), "a restricted member: the live ones of the restriction")
	assert.Equal(t, []string{}, of("998904444444"), "a member whose restriction's locations are all deleted: none")
	assert.Equal(t, []string{}, of("998905555555"), "not a member of this company")
	rows, err := q.ListMemberLocations(ctx, gen.ListMemberLocationsParams{UserPhone: "998901111111", CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, asosiy, rows[0].ID)
}

func TestListCompanyMemberLocations(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	olma, nok := createCompany(t, q, "Olma", d), createCompany(t, q, "Nok", d)
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	chilonzor := addLocation(t, pool, olma.ID, "Chilonzor")
	yunusobod := addLocation(t, pool, olma.ID, "Yunusobod")
	mustExec(t, pool, "UPDATE locations SET deleted_at = now() WHERE id = $1", yunusobod)
	noksAsosiy := addLocation(t, pool, nok.ID, "Asosiy")
	addMember(t, q, olma.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	addMember(t, q, olma.ID, "998903333333", "Cheklangan", "user")
	addMember(t, q, olma.ID, "998904444444", "Ikkinchi", "user")
	addMember(t, q, nok.ID, "998905555555", "Begona", "user")
	restrictTo(t, pool, "998904444444", olma.ID, chilonzor, asosiy, yunusobod)
	restrictTo(t, pool, "998903333333", olma.ID, chilonzor)
	restrictTo(t, pool, "998905555555", nok.ID, noksAsosiy)

	rows, err := q.ListCompanyMemberLocations(ctx, olma.ID)

	require.NoError(t, err)
	described := make([]string, 0, len(rows))
	for _, r := range rows {
		described = append(described, r.UserPhone+" "+r.Name)
	}
	assert.Equal(t, []string{"998903333333 Chilonzor", "998904444444 Asosiy", "998904444444 Chilonzor"}, described,
		"the restricted members' live locations, by member and in the order the locations were added; nobody else's")
}

func TestDeleteMemberLocations(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	addMember(t, q, olma.ID, "998902222222", "Xodim", "user")
	addMember(t, q, olma.ID, "998903333333", "Ikkinchi", "user")
	restrictTo(t, pool, "998902222222", olma.ID, asosiy)
	restrictTo(t, pool, "998903333333", olma.ID, asosiy)

	require.NoError(t, q.DeleteMemberLocations(ctx, gen.DeleteMemberLocationsParams{UserPhone: "998902222222", CompanyID: olma.ID}))

	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations WHERE user_phone = '998902222222'").Scan(&rows))
	assert.Zero(t, rows, "the member's restriction is gone")
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations").Scan(&rows))
	assert.Equal(t, 1, rows, "the other member's stays")
}
