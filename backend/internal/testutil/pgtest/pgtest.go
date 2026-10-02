// Package pgtest gives integration tests their own migrated Postgres
// database. Every call clones a template that already holds the migrations,
// so tests never share rows and may run in parallel. The server comes from
// TEST_DATABASE_URL; the databases are named hisob24_it_* and dropped when
// the test ends.
package pgtest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // database/sql driver for goose
	"github.com/pressly/goose/v3"

	"github.com/SalikhovID/hisob24/backend/migrations"
)

const (
	prefix         = "hisob24_it_"
	templatePrefix = prefix + "tpl_"
	// lockKey serialises template building across parallel `go test`
	// processes ("hisob24" in ASCII).
	lockKey int64 = 0x6869736f623234
)

var (
	setupMu sync.Mutex
	shared  *server
)

// server is the state every test in the process shares.
type server struct {
	base     *url.URL      // TEST_DATABASE_URL
	admin    *pgxpool.Pool // runs CREATE and DROP DATABASE
	template string
}

// New returns a pool connected to a fresh database holding every migration.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	srv, err := connect()
	if err != nil {
		t.Fatalf("pgtest: %v", err)
	}

	ctx := context.Background()
	name := fmt.Sprintf("%s%d_%s", prefix, time.Now().Unix(), randomHex(4))
	if _, err := srv.admin.Exec(ctx, "CREATE DATABASE "+ident(name)+" TEMPLATE "+ident(srv.template)); err != nil {
		t.Fatalf("pgtest: create database: %v", err)
	}
	// Registered before the pool's Close, so it runs after it (cleanups run
	// last-in first-out).
	t.Cleanup(func() {
		// t.Context() is already cancelled when cleanups run.
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := srv.admin.Exec(ctx, "DROP DATABASE IF EXISTS "+ident(name)+" WITH (FORCE)"); err != nil {
			t.Errorf("pgtest: drop %s: %v", name, err)
		}
	})

	pool, err := pgxpool.New(ctx, databaseURL(srv.base, name))
	if err != nil {
		t.Fatalf("pgtest: connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// connect prepares the shared state once per test process.
func connect() (*server, error) {
	setupMu.Lock()
	defer setupMu.Unlock()
	if shared != nil {
		return shared, nil
	}

	raw := os.Getenv("TEST_DATABASE_URL")
	if raw == "" {
		return nil, errors.New("TEST_DATABASE_URL is not set: run the tests with make test, or export the variables from .env")
	}
	base, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parse TEST_DATABASE_URL: %w", err)
	}
	ctx := context.Background()
	template, err := ensureTemplate(ctx, raw, base)
	if err != nil {
		return nil, err
	}
	admin, err := pgxpool.New(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("connect to TEST_DATABASE_URL: %w", err)
	}
	shared = &server{base: base, admin: admin, template: template}
	return shared, nil
}

// ensureTemplate builds the template database for the current migrations
// unless an earlier run already did. Its name carries a hash of the
// migration files, so editing a migration builds a new template.
func ensureTemplate(ctx context.Context, rawURL string, base *url.URL) (string, error) {
	sum, err := migrationsHash()
	if err != nil {
		return "", err
	}
	name := templatePrefix + sum[:12]

	// A dedicated session: the advisory lock lasts until it closes, and
	// CREATE DATABASE cannot run inside a transaction.
	conn, err := pgx.Connect(ctx, rawURL)
	if err != nil {
		return "", fmt.Errorf("connect to TEST_DATABASE_URL: %w", err)
	}
	defer func() { _ = conn.Close(context.Background()) }()
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", lockKey); err != nil {
		return "", fmt.Errorf("lock the template: %w", err)
	}

	var exists bool
	if err := conn.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", name).Scan(&exists); err != nil {
		return "", fmt.Errorf("look up the template: %w", err)
	}
	if exists {
		return name, nil
	}

	building := name + "_building"
	for _, stmt := range []string{
		"DROP DATABASE IF EXISTS " + ident(building) + " WITH (FORCE)",
		"CREATE DATABASE " + ident(building),
	} {
		if _, err := conn.Exec(ctx, stmt); err != nil {
			return "", fmt.Errorf("prepare the template: %w", err)
		}
	}
	if err := migrate(ctx, databaseURL(base, building)); err != nil {
		return "", err
	}
	if _, err := conn.Exec(ctx, "ALTER DATABASE "+ident(building)+" RENAME TO "+ident(name)); err != nil {
		return "", fmt.Errorf("publish the template: %w", err)
	}
	return name, nil
}

// migrate applies every embedded migration to the database at dsn.
func migrate(ctx context.Context, dsn string) error {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("open the template: %w", err)
	}
	defer func() { _ = db.Close() }()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS)
	if err != nil {
		return fmt.Errorf("goose: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("migrate the template: %w", err)
	}
	return nil
}

// migrationsHash fingerprints the embedded migration files.
func migrationsHash() (string, error) {
	names, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return "", err
	}
	h := sha256.New()
	for _, name := range names { // fs.Glob returns names in lexical order
		data, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return "", err
		}
		h.Write([]byte(name))
		h.Write([]byte{0})
		h.Write(data)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// databaseURL is base pointed at another database on the same server.
func databaseURL(base *url.URL, name string) string {
	u := *base
	u.Path = "/" + name
	return u.String()
}

func ident(name string) string { return pgx.Identifier{name}.Sanitize() }

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
