package db_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// ownerID is the admin the first migration seeds.
const ownerID int64 = 461603558

// setup gives the test its own migrated database: queries for the code under
// test and the pool for fixture SQL that no query covers.
func setup(t *testing.T) (*gen.Queries, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return gen.New(pool), pool
}

// mustExec runs fixture SQL.
func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	_, err := pool.Exec(context.Background(), sql, args...)
	require.NoError(t, err)
}

// today is the database's CURRENT_DATE, so date assertions follow the same
// clock and time zone as the queries.
func today(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}

// sqlState is the SQLSTATE of a Postgres error, "" for any other error.
func sqlState(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func ptr[T any](v T) *T { return &v }

// addRole makes a company role with permissions and returns its id.
func addRole(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, permissions ...string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(),
		"INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3) RETURNING id",
		companyID, name, append([]string{}, permissions...)).Scan(&id))
	return id
}

// addLocation makes a location of the company and returns its id.
func addLocation(t *testing.T, pool *pgxpool.Pool, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(),
		"INSERT INTO locations (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id))
	return id
}

// restrictTo restricts the member to the locations: they may work in these
// alone (logic/locations.md, section 5).
func restrictTo(t *testing.T, pool *pgxpool.Pool, phone string, companyID int64, locationIDs ...int64) {
	t.Helper()
	mustExec(t, pool, "UPDATE user_companies SET all_locations = false WHERE user_phone = $1 AND company_id = $2", phone, companyID)
	for _, id := range locationIDs {
		mustExec(t, pool, "INSERT INTO member_locations (user_phone, company_id, location_id) VALUES ($1, $2, $3)", phone, companyID, id)
	}
}
