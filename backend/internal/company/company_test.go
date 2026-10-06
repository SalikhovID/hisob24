package company

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const ownerID int64 = 461603558

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func dbToday(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}

func mustCreate(t *testing.T, s *Service, name string, endDate time.Time) Company {
	t.Helper()
	c, err := s.Create(t.Context(), CreateInput{Name: name, EndDate: endDate, OwnerPhone: "998900000001", OwnerFullName: "Egasi"}, ownerID)
	require.NoError(t, err)
	return c
}

func TestCreate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	end := dbToday(t, pool).AddDate(0, 0, 30)

	c, err := s.Create(ctx, CreateInput{Name: "  Olma MChJ ", EndDate: end, OwnerPhone: "+998 90 123 45 67", OwnerFullName: " Ali Valiyev "}, ownerID)

	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", c.Name)
	assert.True(t, c.EndDate.Equal(end), "end date %s", c.EndDate)
	assert.True(t, c.IsActive)
	assert.Equal(t, 30, c.DaysLeft)
	require.NotNil(t, c.CreatedBy)
	assert.Equal(t, ownerID, *c.CreatedBy)
	var role, name, memberName string
	require.NoError(t, pool.QueryRow(ctx, `SELECT uc.role, u.full_name, COALESCE(uc.full_name, '') FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1 AND uc.user_phone = '998901234567'`, c.ID).Scan(&role, &name, &memberName))
	assert.Equal(t, "owner", role)
	assert.Equal(t, "Ali Valiyev", name)
	assert.Equal(t, "Ali Valiyev", memberName, "the owner's name in the company")

	second, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: "Boshqa Ism"}, ownerID)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, `SELECT u.full_name, COALESCE(uc.full_name, '') FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1`, second.ID).Scan(&name, &memberName))
	assert.Equal(t, "Ali Valiyev", name, "an existing user is reused unchanged")
	assert.Equal(t, "Boshqa Ism", memberName, "and goes by the new name in the new company")
}

func TestCreateIsAtomic(t *testing.T) {
	s, pool := newService(t)
	pgtest.FailInserts(t, pool, "user_companies")

	_, err := s.Create(t.Context(), CreateInput{Name: "Olma", EndDate: dbToday(t, pool), OwnerPhone: "998901234567", OwnerFullName: "Ali"}, ownerID)

	require.Error(t, err)
	var companies, users int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT (SELECT count(*) FROM companies), (SELECT count(*) FROM users)").Scan(&companies, &users))
	assert.Zero(t, companies, "no company without its owner")
	assert.Zero(t, users, "no user without the membership")
}

func TestCreateValidation(t *testing.T) {
	s, pool := newService(t)
	end := dbToday(t, pool)
	for name, tc := range map[string]struct {
		in      CreateInput
		message string
	}{
		"no name":       {CreateInput{Name: "  ", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: "Ali"}, "Kompaniya nomini kiriting"},
		"bad phone":     {CreateInput{Name: "Olma", EndDate: end, OwnerPhone: "12ab", OwnerFullName: "Ali"}, "Egasining telefon raqami noto'g'ri"},
		"no owner name": {CreateInput{Name: "Olma", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: " "}, "Egasining ismini kiriting"},
	} {
		_, err := s.Create(t.Context(), tc.in, ownerID)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, apperr.Invalid, e.Kind, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	var companies int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM companies").Scan(&companies))
	assert.Zero(t, companies, "nothing is written")
}

// rolesOf is each member's role in the company, by phone.
func rolesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) map[string]string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT user_phone, role FROM user_companies WHERE company_id = $1", companyID)
	require.NoError(t, err)
	roles := map[string]string{}
	var phone, role string
	_, err = pgx.ForEachRow(rows, []any{&phone, &role}, func() error {
		roles[phone] = role
		return nil
	})
	require.NoError(t, err)
	return roles
}

// nameIn is the name phone goes by in the company.
func nameIn(t *testing.T, pool *pgxpool.Pool, companyID int64, phone string) string {
	t.Helper()
	var name string
	require.NoError(t, pool.QueryRow(t.Context(),
		"SELECT COALESCE(full_name, '') FROM user_companies WHERE company_id = $1 AND user_phone = $2", companyID, phone).Scan(&name))
	return name
}

func TestReplaceOwner(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	m, err := s.ReplaceOwner(t.Context(), c.ID, "90 222 33 44", " Yangi Egasi ")

	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Yangi Egasi", *m.FullName)
	assert.Equal(t, "owner", m.Role)
	assert.Equal(t, map[string]string{"998900000001": "user", "998902223344": "owner"}, rolesOf(t, pool, c.ID),
		"the owner before stays as a user")
	assert.Equal(t, "Egasi", nameIn(t, pool, c.ID, "998900000001"), "under the same name")
}

// addEmployee makes phone a user of the company under name.
func addEmployee(t *testing.T, pool *pgxpool.Pool, companyID int64, phone, name string) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO users (phone, full_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", phone, name)
	require.NoError(t, err)
	_, err = pool.Exec(t.Context(),
		"INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', $3)", phone, companyID, name)
	require.NoError(t, err)
}

func TestReplaceOwnerPromotesAMember(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")

	m, err := s.ReplaceOwner(t.Context(), c.ID, "998902223344", "Yangi Egasi")

	require.NoError(t, err)
	assert.Equal(t, "owner", m.Role)
	assert.Equal(t, map[string]string{"998900000001": "user", "998902223344": "owner"}, rolesOf(t, pool, c.ID),
		"the member is promoted, not added again")
	assert.Equal(t, "Yangi Egasi", nameIn(t, pool, c.ID, "998902223344"), "under the name given")
}

func TestReplaceOwnerWithTheOwnersOwnPhone(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	m, err := s.ReplaceOwner(t.Context(), c.ID, "998900000001", "Egasining Yangi Ismi")

	require.NoError(t, err)
	assert.Equal(t, "owner", m.Role)
	assert.Equal(t, map[string]string{"998900000001": "owner"}, rolesOf(t, pool, c.ID), "the owner stays the owner")
	assert.Equal(t, "Egasining Yangi Ismi", nameIn(t, pool, c.ID, "998900000001"), "only the name changes")
}

func TestReplaceOwnerWithAUserOfAnotherCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	olma := mustCreate(t, s, "Olma", d)
	nok, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: d, OwnerPhone: "998902223344", OwnerFullName: "Vali Aliyev"}, ownerID)
	require.NoError(t, err)

	_, err = s.ReplaceOwner(ctx, olma.ID, "998902223344", "Vali (Olma)")

	require.NoError(t, err)
	assert.Equal(t, "Vali (Olma)", nameIn(t, pool, olma.ID, "998902223344"), "the name in this company")
	assert.Equal(t, map[string]string{"998902223344": "owner"}, rolesOf(t, pool, nok.ID), "the other company is left alone")
	assert.Equal(t, "Vali Aliyev", nameIn(t, pool, nok.ID, "998902223344"))
	var userName string
	require.NoError(t, pool.QueryRow(ctx, "SELECT full_name FROM users WHERE phone = '998902223344'").Scan(&userName))
	assert.Equal(t, "Vali Aliyev", userName, "the user's own name stays")
}

func TestReplaceOwnerRefusals(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	for name, tc := range map[string]struct {
		companyID       int64
		phone, fullName string
		kind            apperr.Kind
		message         string
	}{
		"unknown company": {c.ID + 1, "998902223344", "Yangi Egasi", apperr.NotFound, "Kompaniya topilmadi"},
		"bad phone":       {c.ID, "12ab", "Yangi Egasi", apperr.Invalid, "Telefon raqami noto'g'ri"},
		"no name":         {c.ID, "998902223344", " ", apperr.Invalid, "Ismni kiriting"},
	} {
		_, err := s.ReplaceOwner(t.Context(), tc.companyID, tc.phone, tc.fullName)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
			assert.Equal(t, tc.message, e.Message, name)
		}
	}
	assert.Equal(t, map[string]string{"998900000001": "owner"}, rolesOf(t, pool, c.ID), "a refusal changes nothing")
	var users int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM users").Scan(&users))
	assert.Equal(t, 1, users, "and adds no user")
}

func TestReplaceOwnerIsAtomic(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	pgtest.FailInserts(t, pool, "user_companies")

	_, err := s.ReplaceOwner(t.Context(), c.ID, "998902223344", "Yangi Egasi")

	require.Error(t, err)
	assert.Equal(t, map[string]string{"998900000001": "owner"}, rolesOf(t, pool, c.ID), "the owner is not demoted for nothing")
	var exists bool
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM users WHERE phone = '998902223344')").Scan(&exists))
	assert.False(t, exists, "no user without the membership")
}

func TestReplaceOwnerWaitsForAnotherChangeOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	// Another change of the owner is under way: it holds the company and has
	// put its own owner in, not committed yet.
	other, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = other.Rollback(context.Background()) })
	_, err = other.Exec(ctx, "SELECT id FROM companies WHERE id = $1 FOR UPDATE", c.ID)
	require.NoError(t, err)
	_, err = other.Exec(ctx, "UPDATE user_companies SET role = 'user' WHERE company_id = $1", c.ID)
	require.NoError(t, err)
	_, err = other.Exec(ctx, "INSERT INTO users (phone) VALUES ('998903333333')")
	require.NoError(t, err)
	_, err = other.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role, full_name)
		VALUES ('998903333333', $1, 'owner', 'Oraliq Egasi')`, c.ID)
	require.NoError(t, err)

	type result struct {
		m   Member
		err error
	}
	replaced := make(chan result, 1)
	go func() {
		m, err := s.ReplaceOwner(ctx, c.ID, "998902223344", "Yangi Egasi")
		replaced <- result{m, err}
	}()
	pgtest.WaitForLockWait(t, pool)
	require.NoError(t, other.Commit(ctx))

	got := <-replaced
	require.NoError(t, got.err, "the second change runs after the first, not into it")
	assert.Equal(t, "owner", got.m.Role)
	assert.Equal(t, map[string]string{"998900000001": "user", "998903333333": "user", "998902223344": "owner"},
		rolesOf(t, pool, c.ID), "the last change wins and the company has one owner")
}

func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	mustCreate(t, s, "Olma Savdo", d.AddDate(0, 0, 10))
	mustCreate(t, s, "Nok Market", d)
	mustCreate(t, s, "Olcha Servis", d.AddDate(0, 0, -1))
	blocked := mustCreate(t, s, "Behi Blok", d.AddDate(0, 0, 30))
	_, err := pool.Exec(ctx, "UPDATE companies SET is_active = false WHERE id = $1", blocked.ID)
	require.NoError(t, err)

	page, err := s.List(ctx, ListInput{Status: "expired", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, int64(2), page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	require.Len(t, page.Items, 2)
	assert.Equal(t, "Behi Blok", page.Items[0].Name, "newest first")
	assert.Equal(t, 30, page.Items[0].DaysLeft, "blocked, though paid")
	assert.Equal(t, "Olcha Servis", page.Items[1].Name)
	assert.Equal(t, -1, page.Items[1].DaysLeft)

	page, err = s.List(ctx, ListInput{Search: " OL ", Status: "active", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total)
	require.Len(t, page.Items, 1)
	assert.Equal(t, "Olma Savdo", page.Items[0].Name)
	assert.Equal(t, 10, page.Items[0].DaysLeft)
}

func TestListPages(t *testing.T) {
	s, pool := newService(t)
	_, err := pool.Exec(t.Context(), "INSERT INTO companies (name, end_date) SELECT 'Kompaniya ' || n, CURRENT_DATE FROM generate_series(1, 21) n")
	require.NoError(t, err)

	first, err := s.List(t.Context(), ListInput{Page: 1})
	require.NoError(t, err)
	second, err := s.List(t.Context(), ListInput{Page: 2})
	require.NoError(t, err)

	require.Len(t, first.Items, 20)
	assert.Equal(t, "Kompaniya 21", first.Items[0].Name)
	require.Len(t, second.Items, 1)
	assert.Equal(t, "Kompaniya 1", second.Items[0].Name)
	assert.Equal(t, int64(21), second.Total)
	assert.Equal(t, 2, second.Page)
}

func TestListSearchIsLiteral(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	mustCreate(t, s, "Behi 50% Chegirma", d)
	mustCreate(t, s, "Olma_Savdo", d)
	mustCreate(t, s, `Nok\Savdo`, d)

	for term, want := range map[string]string{"%": "Behi 50% Chegirma", "_": "Olma_Savdo", `\`: `Nok\Savdo`} {
		page, err := s.List(t.Context(), ListInput{Search: term, Page: 1})
		require.NoError(t, err)
		if assert.Len(t, page.Items, 1, term) {
			assert.Equal(t, want, page.Items[0].Name, term)
		}
	}
}

func TestListValidation(t *testing.T) {
	s, _ := newService(t)
	for name, in := range map[string]ListInput{
		"unknown status": {Status: "deleted", Page: 1},
		"page zero":      {Page: 0},
		"page too far":   {Page: 1_000_001},
	} {
		_, err := s.List(t.Context(), in)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, apperr.Invalid, e.Kind, name)
		}
	}
}

func kindOf(t *testing.T, err error) apperr.Kind {
	t.Helper()
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	return e.Kind
}

func TestGet(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool).AddDate(0, 0, 3))
	addEmployee(t, pool, c.ID, "998902223344", "Xodim")

	d, err := s.Get(t.Context(), c.ID)

	require.NoError(t, err)
	assert.Equal(t, c.ID, d.ID)
	assert.Equal(t, "Olma", d.Name)
	assert.Equal(t, 3, d.DaysLeft)
	require.Len(t, d.Users, 2)
	assert.Equal(t, "998900000001", d.Users[0].Phone)
	assert.Equal(t, "owner", d.Users[0].Role)
	assert.Equal(t, "998902223344", d.Users[1].Phone)
	assert.Equal(t, "user", d.Users[1].Role)
	require.NotNil(t, d.Users[1].FullName)
	assert.Equal(t, "Xodim", *d.Users[1].FullName)

	_, err = s.ReplaceOwner(t.Context(), c.ID, "998902223344", "Yangi Egasi")
	require.NoError(t, err)
	d, err = s.Get(t.Context(), c.ID)
	require.NoError(t, err)
	require.Len(t, d.Users, 2)
	assert.Equal(t, "998902223344", d.Users[0].Phone, "the owner leads the list")
	require.NotNil(t, d.Users[0].FullName)
	assert.Equal(t, "Yangi Egasi", *d.Users[0].FullName, "under the name in the company")
	assert.Equal(t, "user", d.Users[1].Role)

	_, err = s.Get(t.Context(), c.ID+1)
	assert.Equal(t, apperr.NotFound, kindOf(t, err))
}

func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	u, err := s.Update(t.Context(), c.ID, new("  Olma MChJ "), nil)
	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", u.Name)
	assert.True(t, u.IsActive, "untouched")

	u, err = s.Update(t.Context(), c.ID, nil, new(false))
	require.NoError(t, err)
	assert.False(t, u.IsActive)
	assert.Equal(t, "Olma MChJ", u.Name, "untouched")
	assert.Equal(t, 0, u.DaysLeft)

	_, err = s.Update(t.Context(), c.ID, new(" "), nil)
	assert.Equal(t, apperr.Invalid, kindOf(t, err))
	_, err = s.Update(t.Context(), c.ID+1, new("X"), nil)
	assert.Equal(t, apperr.NotFound, kindOf(t, err))
}

func TestCreateGivesTheCompanyTheReadyCustomerTypes(t *testing.T) {
	s, pool := newService(t)

	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	rows, err := pool.Query(t.Context(), `SELECT t.name || ': ' || string_agg(f.label || ' ' || f.kind, ', ' ORDER BY f.position)
		FROM customer_types t JOIN customer_fields f ON f.type_id = t.id
		WHERE t.company_id = $1 GROUP BY t.id ORDER BY t.position`, c.ID)
	require.NoError(t, err)
	types, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"Jismoniy: F.I.Sh. string", "Yuridik: Nomi string, INN int"}, types,
		"a new company starts with the two types every company has")
}

// Every company starts with the ready stages and task type (logic/tasks.md,
// 3.4), the same ones migration 00007 gave the companies there were.
func TestCreateGivesTheReadyTaskSettings(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()

	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	rows, err := pool.Query(ctx, `SELECT name || ' ' || color || CASE WHEN is_done THEN ' done' ELSE '' END
		FROM task_stages WHERE company_id = $1 AND deleted_at IS NULL ORDER BY position`, c.ID)
	require.NoError(t, err)
	stages, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"Yangi blue", "Jarayonda amber", "Bajarildi green done"}, stages)
	rows, err = pool.Query(ctx, `SELECT t.name || ': ' || (SELECT count(*) FROM task_fields f WHERE f.type_id = t.id)
		FROM task_types t WHERE t.company_id = $1 AND t.deleted_at IS NULL ORDER BY t.position`, c.ID)
	require.NoError(t, err)
	types, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"Vazifa: 0"}, types, "one type with no fields")
}
