package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
	_, err = pool.Exec(ctx, `INSERT INTO user_companies (user_phone, company_id, role)
		VALUES ('998901234567', $1, 'owner'), ('998901234567', $2, 'staff')`, olma, nok)
	require.NoError(t, err)

	profile, err := NewProfiles(pool).Get(ctx, "998901234567")

	require.NoError(t, err)
	assert.Equal(t, "998901234567", profile.Phone)
	require.NotNil(t, profile.FullName)
	assert.Equal(t, "Ali Valiyev", *profile.FullName)
	require.Len(t, profile.Companies, 2)
	assert.Equal(t, "Nok", profile.Companies[0].Name, "by name")
	assert.Equal(t, "staff", profile.Companies[0].Role)
	assert.False(t, profile.Companies[0].IsActive)
	assert.Equal(t, olma, profile.Companies[1].CompanyID)
	assert.Equal(t, "2026-11-01", profile.Companies[1].EndDate.Format("2006-01-02"))
}
