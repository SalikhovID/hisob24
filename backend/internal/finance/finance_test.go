package finance

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali     = "998901111111"
	adminID = 461603558
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

// addCompany makes a company the way company.Create leaves one: Ali its
// owner, the so'm on, cash in so'm; and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	ctx := t.Context()
	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", ali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka')", ali, id)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1)", id)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1)", id)
	require.NoError(t, err)
	return id
}

// turnOn turns a currency on for the company, as the admin does.
func turnOn(t *testing.T, pool *pgxpool.Pool, companyID, currencyID int64) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, $2)", companyID, currencyID)
	require.NoError(t, err)
}

// refused checks that err is the API error of kind with the code and the message.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	require.ErrorAs(t, err, &e, about...)
	assert.Equal(t, kind, e.Kind, about...)
	assert.Equal(t, code, e.Code, about...)
	assert.Equal(t, message, e.Message, about...)
}

func ptr[T any](v T) *T { return &v }
