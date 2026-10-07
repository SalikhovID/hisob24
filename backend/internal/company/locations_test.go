package company

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// addLocation makes a location of the company and returns its id.
func addLocation(t *testing.T, pool *pgxpool.Pool, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(),
		"INSERT INTO locations (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id))
	return id
}

// hideLocation deletes the location the way the admin does.
func hideLocation(t *testing.T, pool *pgxpool.Pool, id int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), "UPDATE locations SET deleted_at = now() WHERE id = $1", id)
	require.NoError(t, err)
}

// restrictTo restricts the member to the locations: they may work in these
// alone (logic/locations.md, section 5).
func restrictTo(t *testing.T, pool *pgxpool.Pool, phone string, companyID int64, locationIDs ...int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(), "UPDATE user_companies SET all_locations = false WHERE user_phone = $1 AND company_id = $2", phone, companyID)
	require.NoError(t, err)
	for _, id := range locationIDs {
		_, err := pool.Exec(context.Background(), "INSERT INTO member_locations (user_phone, company_id, location_id) VALUES ($1, $2, $3)", phone, companyID, id)
		require.NoError(t, err)
	}
}

// Every company starts with the ready location (logic/locations.md, section
// 3), the same one migration 00010 gave the companies there were.
func TestCreateGivesTheReadyLocation(t *testing.T) {
	s, pool := newService(t)

	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	locations, err := s.MemberLocations(t.Context(), c.ID, "998900000001")
	require.NoError(t, err)
	require.Len(t, locations, 1)
	assert.Equal(t, "Asosiy", locations[0].Name)
	assert.Positive(t, locations[0].ID)
}

func TestMemberLocations(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	yunusobod := addLocation(t, pool, c.ID, "Yunusobod")
	hideLocation(t, pool, yunusobod)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	addEmployee(t, pool, c.ID, "998903334455", "Cheklangan")
	restrictTo(t, pool, "998903334455", c.ID, chilonzor, yunusobod)
	names := func(phone string) []string {
		locations, err := s.MemberLocations(ctx, c.ID, phone)
		require.NoError(t, err)
		list := make([]string, 0, len(locations))
		for _, l := range locations {
			list = append(list, l.Name)
		}
		return list
	}

	assert.Equal(t, []string{"Asosiy", "Chilonzor"}, names("998900000001"), "the owner: every live location")
	assert.Equal(t, []string{"Asosiy", "Chilonzor"}, names("998902223344"), "a member without a restriction: the same")
	assert.Equal(t, []string{"Chilonzor"}, names("998903334455"), "a restricted member: the live ones of the restriction")
	assert.Equal(t, []string{}, names("998909999999"), "not a member: none, and no error")
}

func TestMembersTellTheirLocations(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	yunusobod := addLocation(t, pool, c.ID, "Yunusobod")
	hideLocation(t, pool, yunusobod)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	addEmployee(t, pool, c.ID, "998903334455", "Cheklangan")
	addEmployee(t, pool, c.ID, "998904445566", "Lokatsiyasiz")
	restrictTo(t, pool, "998903334455", c.ID, chilonzor, yunusobod)
	restrictTo(t, pool, "998904445566", c.ID, yunusobod)

	members, err := s.Members(ctx, c.ID)

	require.NoError(t, err)
	require.Len(t, members, 4)
	assert.True(t, members[0].AllLocations, "the owner works in every location")
	assert.Nil(t, members[0].Locations)
	assert.True(t, members[1].AllLocations, "a member without a restriction")
	assert.Nil(t, members[1].Locations)
	assert.False(t, members[2].AllLocations, "a restricted member")
	assert.Equal(t, []Location{{ID: chilonzor, Name: "Chilonzor"}}, members[2].Locations, "the live locations of the restriction")
	assert.False(t, members[3].AllLocations)
	assert.Equal(t, []Location{}, members[3].Locations, "a member whose restriction's locations are all deleted: none, not nil")

	m, err := s.RenameEmployee(ctx, c.ID, "998903334455", "Cheklangan Xodim")
	require.NoError(t, err)
	assert.False(t, m.AllLocations, "a member's answer tells the restriction too")
	assert.Equal(t, []Location{{ID: chilonzor, Name: "Chilonzor"}}, m.Locations)
	m, err = s.RenameEmployee(ctx, c.ID, "998904445566", "Lokatsiyasiz Xodim")
	require.NoError(t, err)
	assert.Equal(t, []Location{}, m.Locations, "none, not nil")
	m, err = s.RenameEmployee(ctx, c.ID, "998902223344", "Xodim Xodimov")
	require.NoError(t, err)
	assert.True(t, m.AllLocations)
	assert.Nil(t, m.Locations)
}

func TestReplaceOwnerLiftsTheRestriction(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	restrictTo(t, pool, "998902223344", c.ID, chilonzor)

	m, err := s.ReplaceOwner(ctx, c.ID, "998902223344", "Yangi Egasi")

	require.NoError(t, err)
	assert.Equal(t, "owner", m.Role)
	assert.True(t, m.AllLocations, "the owner works in every location")
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations WHERE user_phone = '998902223344'").Scan(&rows))
	assert.Zero(t, rows, "the restriction's rows are gone")
	members, err := s.Members(ctx, c.ID)
	require.NoError(t, err)
	for _, member := range members {
		assert.True(t, member.AllLocations, "%s works in every location", member.Phone)
	}
}
