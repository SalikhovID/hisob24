package pgtest

import (
	"io/fs"
	"strconv"
	"strings"
	"testing"

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
