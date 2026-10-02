package company

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
