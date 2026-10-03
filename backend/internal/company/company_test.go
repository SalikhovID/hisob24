package company

import (
	"testing"
	"time"

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
	var role, name string
	require.NoError(t, pool.QueryRow(ctx, `SELECT uc.role, u.full_name FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1 AND uc.user_phone = '998901234567'`, c.ID).Scan(&role, &name))
	assert.Equal(t, "owner", role)
	assert.Equal(t, "Ali Valiyev", name)

	second, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: "Boshqa Ism"}, ownerID)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, `SELECT u.full_name FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1`, second.ID).Scan(&name))
	assert.Equal(t, "Ali Valiyev", name, "an existing user is reused unchanged")
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

func TestAddUser(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	m, err := s.AddUser(t.Context(), c.ID, "90 222 33 44", " Xodim ", "user")
	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim", *m.FullName)
	assert.Equal(t, "user", m.Role)

	m, err = s.AddUser(t.Context(), c.ID, "998902223344", "Boshqa Ism", "user")
	require.NoError(t, err)
	assert.Equal(t, "user", m.Role)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim", *m.FullName, "a member keeps the name")
}

func TestAddUserIsAtomic(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	pgtest.FailInserts(t, pool, "user_companies")

	_, err := s.AddUser(t.Context(), c.ID, "998902223344", "Xodim", "user")

	require.Error(t, err)
	var exists bool
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM users WHERE phone = '998902223344')").Scan(&exists))
	assert.False(t, exists, "no user without the membership")
}

func TestAddUserRefusals(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	for name, tc := range map[string]struct {
		companyID             int64
		phone, fullName, role string
		kind                  apperr.Kind
	}{
		"unknown company": {c.ID + 1, "998902223344", "Xodim", "user", apperr.NotFound},
		"bad role":        {c.ID, "998902223344", "Xodim", "boss", apperr.Invalid},
		"bad phone":       {c.ID, "12ab", "Xodim", "user", apperr.Invalid},
		"no name":         {c.ID, "998902223344", " ", "user", apperr.Invalid},
	} {
		_, err := s.AddUser(t.Context(), tc.companyID, tc.phone, tc.fullName, tc.role)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
		}
	}
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
	_, err := s.AddUser(t.Context(), c.ID, "998902223344", "Xodim", "user")
	require.NoError(t, err)

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
