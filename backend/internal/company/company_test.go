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

	m, err := s.AddUser(t.Context(), c.ID, "90 222 33 44", " Xodim ", "staff")
	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim", *m.FullName)
	assert.Equal(t, "staff", m.Role)

	m, err = s.AddUser(t.Context(), c.ID, "998902223344", "Boshqa Ism", "manager")
	require.NoError(t, err)
	assert.Equal(t, "manager", m.Role, "a member gets the new role")
	require.NotNil(t, m.FullName)
	assert.Equal(t, "Xodim", *m.FullName, "and keeps the name")
}

func TestAddUserIsAtomic(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	pgtest.FailInserts(t, pool, "user_companies")

	_, err := s.AddUser(t.Context(), c.ID, "998902223344", "Xodim", "staff")

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
		"unknown company": {c.ID + 1, "998902223344", "Xodim", "staff", apperr.NotFound},
		"bad role":        {c.ID, "998902223344", "Xodim", "boss", apperr.Invalid},
		"bad phone":       {c.ID, "12ab", "Xodim", "staff", apperr.Invalid},
		"no name":         {c.ID, "998902223344", " ", "staff", apperr.Invalid},
	} {
		_, err := s.AddUser(t.Context(), tc.companyID, tc.phone, tc.fullName, tc.role)
		var e *apperr.Error
		if assert.ErrorAs(t, err, &e, name) {
			assert.Equal(t, tc.kind, e.Kind, name)
		}
	}
}
