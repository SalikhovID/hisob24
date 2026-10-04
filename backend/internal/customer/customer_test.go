package customer

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

// addCompany inserts a company with no customer types and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	return id
}

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}
