package pgtest

import (
	"context"
	"fmt"
	"io/fs"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/migrations"
)

func TestNewGivesEachTestAMigratedDatabase(t *testing.T) {
	pool := New(t)
	other := New(t)

	name := currentDatabase(t, pool)
	assert.True(t, strings.HasPrefix(name, "hisob24_it_"), name)
	assert.NotEqual(t, name, currentDatabase(t, other), "every call gets its own database")

	var version int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT max(version_id) FROM goose_db_version").Scan(&version))
	assert.Equal(t, latestMigration(t), version)
}

func TestNewDropsTheDatabaseWhenTheTestEnds(t *testing.T) {
	var name string
	t.Run("inner", func(t *testing.T) {
		name = currentDatabase(t, New(t))
	})

	assert.False(t, databaseExists(t, name))
}

func TestDropLeftovers(t *testing.T) {
	srv, err := connect()
	require.NoError(t, err)
	ctx := t.Context()
	now := time.Now()
	stale := fmt.Sprintf("%s%d_%s", prefix, now.Add(-2*time.Hour).Unix(), randomHex(4))
	fresh := fmt.Sprintf("%s%d_%s", prefix, now.Unix(), randomHex(4))
	oldTemplate := templatePrefix + "000000000000"
	for _, name := range []string{stale, fresh, oldTemplate} {
		_, err := srv.admin.Exec(ctx, "CREATE DATABASE "+ident(name))
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = srv.admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+ident(name)) })
	}
	conn, err := pgx.Connect(ctx, srv.base.String())
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close(context.Background()) })
	// Hold the template lock as ensureTemplate does, so a template that a
	// parallel test process is building is never dropped half-way.
	_, err = conn.Exec(ctx, "SELECT pg_advisory_lock($1)", lockKey)
	require.NoError(t, err)

	require.NoError(t, dropLeftovers(ctx, conn, srv.template, now))

	assert.False(t, databaseExists(t, stale), "a test database older than an hour")
	assert.False(t, databaseExists(t, oldTemplate), "a template of other migrations")
	assert.True(t, databaseExists(t, fresh), "the database of a running test")
	assert.True(t, databaseExists(t, srv.template), "the current template")
}

func databaseExists(t *testing.T, name string) bool {
	t.Helper()
	srv, err := connect()
	require.NoError(t, err)
	var exists bool
	require.NoError(t, srv.admin.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", name).Scan(&exists))
	return exists
}

func currentDatabase(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var name string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT current_database()").Scan(&name))
	return name
}

// latestMigration is the version of the newest migration file (goose -s
// numbers them 00001, 00002, ...).
func latestMigration(t *testing.T) int64 {
	t.Helper()
	names, err := fs.Glob(migrations.FS, "*.sql")
	require.NoError(t, err)
	require.NotEmpty(t, names)
	prefix, _, _ := strings.Cut(names[len(names)-1], "_")
	version, err := strconv.ParseInt(prefix, 10, 64)
	require.NoError(t, err)
	return version
}

func TestFailInsertsRefusesInsertsIntoTheTable(t *testing.T) {
	pool := New(t)
	FailInserts(t, pool, "users")

	_, err := pool.Exec(t.Context(), "INSERT INTO users (phone) VALUES ('998901234567')")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "pgtest: insert into users refused")
	_, err = pool.Exec(t.Context(), "INSERT INTO companies (name, end_date) VALUES ('Olma', CURRENT_DATE)")
	assert.NoError(t, err, "other tables still take inserts")
}
