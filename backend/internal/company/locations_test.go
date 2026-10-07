package company

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
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

// addTask enters a task of the company in the location, for a customer
// entered with it, as the task service would (that package is built on this
// one, so it cannot be called here). The company's ready settings are used.
func addTask(t *testing.T, pool *pgxpool.Pool, companyID, locationID int64, deleted bool) int64 {
	t.Helper()
	ctx := context.Background()
	var customer, task int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO customers (company_id, type_id, phone, created_by)
		SELECT $1, id, '99890' || lpad((random() * 9999999)::int::text, 7, '0'), '998900000001' FROM customer_types WHERE company_id = $1 LIMIT 1
		RETURNING id`, companyID).Scan(&customer))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, created_by, deleted_at)
		SELECT $1, (SELECT id FROM task_types WHERE company_id = $1 LIMIT 1), (SELECT id FROM task_stages WHERE company_id = $1 LIMIT 1), $2, $3,
		       'Qo''ng''iroq', CURRENT_DATE, '998900000001', CASE WHEN $4 THEN now() END
		RETURNING id`, companyID, customer, locationID, deleted).Scan(&task))
	return task
}

// addPurchaseIn enters a purchase standing in the location, from a supplier
// made for it; deleted hides it.
func addPurchaseIn(t *testing.T, pool *pgxpool.Pool, companyID, locationID int64, deleted bool) {
	t.Helper()
	ctx := context.Background()
	var supplier int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor ' || gen_random_uuid()::text, '998900000001') RETURNING id", companyID).Scan(&supplier))
	var number int
	require.NoError(t, pool.QueryRow(ctx, "SELECT COALESCE(max(number), 0) + 1 FROM purchases WHERE company_id = $1", companyID).Scan(&number))
	_, err := pool.Exec(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, CURRENT_DATE, '998900000001', CASE WHEN $5 THEN now() END)`, companyID, number, locationID, supplier, deleted)
	require.NoError(t, err)
}

// describe is the admin's list of locations as "name (N)".
func describe(locations []AdminLocation) []string {
	list := make([]string, 0, len(locations))
	for _, l := range locations {
		list = append(list, fmt.Sprintf("%s (%d)", l.Name, l.TasksCount))
	}
	return list
}

func TestLocations(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	nok := mustCreate(t, s, "Nok", dbToday(t, pool))
	asosiy := addLocation(t, pool, nok.ID, "Chilonzor") // Nok's: not Olma's
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	hideLocation(t, pool, addLocation(t, pool, c.ID, "Yopilgan"))
	addTask(t, pool, c.ID, chilonzor, false)
	addTask(t, pool, c.ID, chilonzor, false)
	addTask(t, pool, c.ID, chilonzor, true)
	_ = asosiy

	locations, err := s.Locations(ctx, c.ID)

	require.NoError(t, err)
	assert.Equal(t, []string{"Asosiy (0)", "Chilonzor (2)"}, describe(locations), "the live locations in the order they were added, each with its tasks (the deleted not counted)")
	assert.Equal(t, chilonzor, locations[1].ID)
	assert.False(t, locations[1].CreatedAt.IsZero())
}

func TestAddLocation(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	l, err := s.AddLocation(ctx, c.ID, "  Chilonzor ")

	require.NoError(t, err)
	assert.Equal(t, "Chilonzor", l.Name, "the name without the spaces around it")
	assert.Positive(t, l.ID)
	assert.Zero(t, l.TasksCount)
	assert.False(t, l.CreatedAt.IsZero())
	locations, err := s.Locations(ctx, c.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"Asosiy (0)", "Chilonzor (0)"}, describe(locations))

	for name, tc := range map[string]struct {
		name    string
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":      {"  ", apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a long name":  {strings.Repeat("a", 61), apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"a name taken": {"chilonzor", apperr.Conflict, "name_taken", "Bu nomli lokatsiya allaqachon bor"},
	} {
		_, err := s.AddLocation(ctx, c.ID, tc.name)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	_, err = s.AddLocation(ctx, c.ID+1000, "Yunusobod")
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "not_found", e.Code, "no such company")
	assert.Equal(t, "Kompaniya topilmadi", e.Message)

	hideLocation(t, pool, l.ID)
	_, err = s.AddLocation(ctx, c.ID, "Chilonzor")
	assert.NoError(t, err, "a deleted location's name is free again")
}

func TestRenameLocation(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	nok := mustCreate(t, s, "Nok", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	gone := addLocation(t, pool, c.ID, "Yopilgan")
	hideLocation(t, pool, gone)

	l, err := s.RenameLocation(ctx, c.ID, chilonzor, " Chilonzor filiali ")
	require.NoError(t, err)
	assert.Equal(t, "Chilonzor filiali", l.Name)
	assert.Equal(t, chilonzor, l.ID)
	l, err = s.RenameLocation(ctx, c.ID, chilonzor, "chilonzor FILIALI")
	require.NoError(t, err, "its own name, in another case")
	assert.Equal(t, "chilonzor FILIALI", l.Name)

	var e *apperr.Error
	_, err = s.RenameLocation(ctx, c.ID, chilonzor, "asosiy")
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "name_taken", e.Code, "another location's name")
	for name, id := range map[string]int64{"no such location": chilonzor + 1000, "a deleted location": gone, "another company's location": nokLocation(t, pool, nok.ID)} {
		_, err = s.RenameLocation(ctx, c.ID, id, "X")
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, apperr.NotFound, e.Kind, name)
			assert.Equal(t, "Lokatsiya topilmadi", e.Message, name)
		}
	}
	_, err = s.RenameLocation(ctx, c.ID, chilonzor, " ")
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "Nomni kiriting", e.Message)
}

// nokLocation is the ready location of the company.
func nokLocation(t *testing.T, pool *pgxpool.Pool, companyID int64) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT id FROM locations WHERE company_id = $1 ORDER BY id LIMIT 1", companyID).Scan(&id))
	return id
}

func TestDeleteLocation(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	asosiy := nokLocation(t, pool, c.ID)
	var e *apperr.Error

	err := s.DeleteLocation(ctx, c.ID, asosiy)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Conflict, e.Kind)
	assert.Equal(t, "last_location", e.Code, "the company's only location")
	assert.Equal(t, "Kompaniyaning yagona lokatsiyasi o'chirilmaydi", e.Message)

	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	addTask(t, pool, c.ID, chilonzor, false)
	addTask(t, pool, c.ID, chilonzor, true)
	err = s.DeleteLocation(ctx, c.ID, chilonzor)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Conflict, e.Kind)
	assert.Equal(t, "location_in_use", e.Code, "a location with a task standing in it")
	assert.Equal(t, "Bu lokatsiyada 1 ta vazifa bor", e.Message, "the deleted task not counted")

	// A location with a purchase standing in it is kept too (checked after
	// the tasks).
	qoyliq := addLocation(t, pool, c.ID, "Qo'yliq")
	addPurchaseIn(t, pool, c.ID, qoyliq, false)
	addPurchaseIn(t, pool, c.ID, qoyliq, true)
	err = s.DeleteLocation(ctx, c.ID, qoyliq)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Conflict, e.Kind)
	assert.Equal(t, "location_in_use", e.Code, "a location with a purchase standing in it")
	assert.Equal(t, "Bu lokatsiyada 1 ta xarid bor", e.Message, "the deleted purchase not counted")
	addTask(t, pool, c.ID, qoyliq, false)
	err = s.DeleteLocation(ctx, c.ID, qoyliq)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "Bu lokatsiyada 1 ta vazifa bor", e.Message, "the tasks come first")

	yunusobod := addLocation(t, pool, c.ID, "Yunusobod")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	restrictTo(t, pool, "998902223344", c.ID, yunusobod)
	require.NoError(t, s.DeleteLocation(ctx, c.ID, yunusobod), "a location with no task")
	locations, err := s.Locations(ctx, c.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"Asosiy (0)", "Chilonzor (1)", "Qo'yliq (1)"}, describe(locations), "hidden")
	_, err = s.AddLocation(ctx, c.ID, "Yunusobod")
	assert.NoError(t, err, "its name is free again")
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations WHERE location_id = $1", yunusobod).Scan(&rows))
	assert.Equal(t, 1, rows, "a member's restriction keeps naming it (logic/locations.md, section 5)")
	members, err := s.Members(ctx, c.ID)
	require.NoError(t, err)
	assert.Equal(t, []Location{}, members[1].Locations, "and the member is left with none")

	err = s.DeleteLocation(ctx, c.ID, yunusobod)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "Lokatsiya topilmadi", e.Message, "deleted already")
	nok := mustCreate(t, s, "Nok", dbToday(t, pool))
	err = s.DeleteLocation(ctx, nok.ID, chilonzor)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "Lokatsiya topilmadi", e.Message, "another company's location")
}

// A location is deleted while no task is being entered into it: the delete
// holds the company the way a write of its tasks does, so the count it
// checks cannot change under it.
func TestDeleteLocationWaitsForAWriteOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	// A task is being entered: it holds the company, not committed yet.
	other, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = other.Rollback(context.Background()) })
	_, err = other.Exec(ctx, "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", c.ID)
	require.NoError(t, err)

	done := make(chan error, 1)
	go func() { done <- s.DeleteLocation(ctx, c.ID, chilonzor) }()
	pgtest.WaitForLockWait(t, pool)
	select {
	case err := <-done:
		t.Fatalf("the delete did not wait: %v", err)
	default:
	}
	require.NoError(t, other.Commit(ctx))

	require.NoError(t, <-done, "the delete runs once the write is over")
}

// namesOf is the names of a member's locations, in their order.
func namesOf(locations []Location) []string {
	names := make([]string, 0, len(locations))
	for _, l := range locations {
		names = append(names, l.Name)
	}
	return names
}

func TestSetEmployeeLocations(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	nok := mustCreate(t, s, "Nok", dbToday(t, pool))
	asosiy := nokLocation(t, pool, c.ID)
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	gone := addLocation(t, pool, c.ID, "Yopilgan")
	hideLocation(t, pool, gone)
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")

	m, err := s.SetEmployeeLocations(ctx, c.ID, "+998 90 222 33 44", &[]int64{chilonzor, asosiy, chilonzor})
	require.NoError(t, err)
	assert.False(t, m.AllLocations, "restricted")
	assert.Equal(t, []string{"Asosiy", "Chilonzor"}, namesOf(m.Locations), "the restriction's locations, in the order they were added, each once")
	assert.Equal(t, "998902223344", m.Phone)

	m, err = s.SetEmployeeLocations(ctx, c.ID, "998902223344", &[]int64{chilonzor})
	require.NoError(t, err)
	assert.Equal(t, []string{"Chilonzor"}, namesOf(m.Locations), "another restriction replaces the one before")
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations WHERE user_phone = '998902223344'").Scan(&rows))
	assert.Equal(t, 1, rows)

	m, err = s.SetEmployeeLocations(ctx, c.ID, "998902223344", nil)
	require.NoError(t, err)
	assert.True(t, m.AllLocations, "every location again")
	assert.Nil(t, m.Locations)
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM member_locations WHERE user_phone = '998902223344'").Scan(&rows))
	assert.Zero(t, rows, "the restriction's rows are gone")

	var e *apperr.Error
	for name, tc := range map[string]struct {
		phone   string
		ids     *[]int64
		kind    apperr.Kind
		code    string
		message string
	}{
		"no location":                  {"998902223344", &[]int64{}, apperr.Invalid, "validation_error", "Kamida bitta lokatsiyani tanlang"},
		"a deleted location":           {"998902223344", &[]int64{gone}, apperr.NotFound, "not_found", "Lokatsiya topilmadi"},
		"another company's location":   {"998902223344", &[]int64{nokLocation(t, pool, nok.ID)}, apperr.NotFound, "not_found", "Lokatsiya topilmadi"},
		"a location that is not there": {"998902223344", &[]int64{chilonzor + 1000}, apperr.NotFound, "not_found", "Lokatsiya topilmadi"},
		"the owner":                    {"998900000001", &[]int64{chilonzor}, apperr.Conflict, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"},
		"not a member":                 {"998909999999", &[]int64{chilonzor}, apperr.NotFound, "not_found", "Xodim topilmadi"},
		"no phone":                     {"vali", &[]int64{chilonzor}, apperr.NotFound, "not_found", "Xodim topilmadi"},
	} {
		_, err := s.SetEmployeeLocations(ctx, c.ID, tc.phone, tc.ids)
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.code, e.Code, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	members, err := s.Members(ctx, c.ID)
	require.NoError(t, err)
	assert.True(t, members[1].AllLocations, "a refused change changes nothing")
	_, err = s.SetEmployeeLocations(ctx, c.ID, "998900000001", nil)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "cannot_change_owner", e.Code, "the owner, even to every location")
}

func TestSetEmployeeLocationsIsAtomic(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	pgtest.FailInserts(t, pool, "member_locations")

	_, err := s.SetEmployeeLocations(ctx, c.ID, "998902223344", &[]int64{chilonzor})

	require.Error(t, err)
	var all bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT all_locations FROM user_companies WHERE user_phone = '998902223344'").Scan(&all))
	assert.True(t, all, "no restriction without its locations")
}

// A role given or taken away leaves the restriction as it was, and the
// answer tells it.
func TestSetEmployeeRoleTellsTheLocations(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	chilonzor := addLocation(t, pool, c.ID, "Chilonzor")
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")
	addEmployee(t, pool, c.ID, "998903334455", "Hamma Yerda")
	restrictTo(t, pool, "998902223344", c.ID, chilonzor)
	sotuvchi := addRole(t, pool, c.ID, "Sotuvchi", "customers.view")

	m, err := s.SetEmployeeRole(ctx, c.ID, "998902223344", &sotuvchi)
	require.NoError(t, err)
	assert.False(t, m.AllLocations)
	assert.Equal(t, []string{"Chilonzor"}, namesOf(m.Locations), "a restricted employee's locations")
	m, err = s.SetEmployeeRole(ctx, c.ID, "998903334455", &sotuvchi)
	require.NoError(t, err)
	assert.True(t, m.AllLocations, "an unrestricted employee works in every location")
	assert.Nil(t, m.Locations)
}
