# 2-bosqich: Baza — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec'dagi sxema goose migratsiyasi sifatida qo'shiladi. Integration testlar real Postgres'da ishlaydi (`pgtest`). sqlc sozlanadi va spec'dagi barcha oqimlar uchun 37 ta so'rov yoziladi, har birining o'z testi bor. `user.NormalizePhone` ham shu bosqichda.

**Architecture:**
- `backend/migrations` SQL fayllarni `embed.FS` orqali beradi. `pgtest` shu fayllardan bitta template DB quradi; template nomi migratsiyalar hash'iga bog'liq. Har bir test template'dan o'z DB klonini oladi va test tugagach u o'chiriladi.
- sqlc `migrations/` ni sxema sifatida o'qiydi va `internal/db/gen` ga pgx/v5 kodini generatsiya qiladi.
- So'rov testlari `internal/db/*_test.go` da (`db_test` paketi) turadi.

**Tech Stack:** goose v3.28.0 (CLI va kutubxona), sqlc v1.31.1, pgx v5.11.0 (+ `stdlib`), google/uuid, testify.

**Foydalanuvchi qarorlari (2026-10-02):**
1. 37 ta so'rov hozir yoziladi, har biriga alohida integration test.
2. Shu telegram_id bilan `POST /admin/admins` qayta yuborilsa: faol bo'lmagan admin qayta faollashtiriladi va `full_name` yangilanadi; faol admin uchun so'rov hech narsa qaytarmaydi, servis buni 409 ga aylantiradi.
3. `status` filtri: `active` = `end_date >= CURRENT_DATE AND is_active`, `expired` = `end_date < CURRENT_DATE OR NOT is_active`.
4. Takroriy a'zolikda rol yangilanadi (`ON CONFLICT … DO UPDATE SET role`).

**Scratch'da tekshirilgan faktlar:**
- sqlc 1.31.1 quyidagilarni tasdiqladi:
  - goose formatidagi sxemani o'qiydi, `embed.go` ni e'tiborsiz qoldiradi.
  - `SELECT a.*` join `Admin` modelini qaytaradi; `sqlc.narg` pointer bo'ladi.
  - `INSERT … SELECT $1,$2 WHERE false` stub haqiqiy `VALUES` so'rovi bilan bir xil Params struct beradi.
  - `:execrows` → `int64`; `CURRENT_DATE::date` → `time.Time`; uuid → `uuid.UUID`; numeric → `pgtype.Numeric`.
- goose CLI `migrations/embed.go` ni e'tiborsiz qoldiradi.
- Postgres tomonida:
  - Bir template'dan 5 ta parallel `CREATE DATABASE … TEMPLATE` 0.55 soniyada bajarildi.
  - `hisob24` roli (superuser emas) pgcrypto'ni yaratadi va `DROP DATABASE … WITH (FORCE)` qila oladi.
- Lokal Postgres `TimeZone=Asia/Tashkent`.
- goose v3.28.0: `NewProvider(dialect, *sql.DB, fs.FS)`, `Up`, `DownTo`. pgx: `stdlib.OpenDBFromPool`.

**Buyruqlar** (repo ildizidan):
- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. Bu `.env` dagi `TEST_DATABASE_URL` ni beradi.
- `make sqlc`: `backend/bin/sqlc generate`.
- TDD jurnali: `$SCRATCH/tdd-log.md` (RED va GREEN chiqishlari).

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `backend/internal/user/phone.go` (+`_test`) | `NormalizePhone`, `ErrInvalidPhone` |
| `backend/migrations/00001_init.sql` | Spec sxemasi (Up) va teskari tartibda DROP (Down) |
| `backend/migrations/embed.go` | `migrations.FS` |
| `backend/migrations/migrations_test.go` | Up owner'ni seed qilishi va Down sxemani olib tashlashi |
| `backend/internal/testutil/pgtest/pgtest.go` (+`_test`) | `New(t)`, template, klon, leftover tozalash |
| `backend/sqlc.yaml` | pgx/v5, override'lar |
| `backend/internal/db/doc.go` | `db` paketi hujjati |
| `backend/internal/db/queries/<jadval>.sql` | Qo'lda yoziladigan so'rovlar |
| `backend/internal/db/gen/*` | sqlc generatsiyasi (qo'lda tahrirlanmaydi) |
| `backend/internal/db/<jadval>_test.go`, `helpers_test.go` | Har bir so'rov uchun integration test |

---

### Task 1: `user.NormalizePhone` (TDD, 4 sikl)

**Files:** Create `backend/internal/user/phone.go`, `backend/internal/user/phone_test.go`

Test fayli (har sikl `tests` jadvaliga qatorlar qo'shadi):
```go
package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr error
	}{
		// sikl 1 qatorlari shu yerda, keyin 2-4 sikllar qatorlari
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePhone(tt.raw)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
```

- [ ] **Sikl 1 RED: ajratuvchilar olib tashlanadi**
```go
		{name: "already normalized", raw: "998901234567", want: "998901234567"},
		{name: "plus and spaces", raw: "+998 90 123 45 67", want: "998901234567"},
		{name: "parentheses and dashes", raw: "+998 (90) 123-45-67", want: "998901234567"},
		{name: "surrounding spaces", raw: "  998901234567 ", want: "998901234567"},
		{name: "foreign number", raw: "+7 (912) 345-67-89", want: "79123456789"},
```
Stub `phone.go`:
```go
// Package user holds the user domain helpers.
package user

import "errors"

// ErrInvalidPhone means the input cannot be a phone number.
var ErrInvalidPhone = errors.New("invalid phone number")

// NormalizePhone turns user input into the stored phone form.
func NormalizePhone(raw string) (string, error) {
	return "", errors.New("not implemented")
}
```
`GOTEST ./internal/user/` → FAIL `Received unexpected error: not implemented`.

- [ ] **Sikl 1 GREEN**
```go
import (
	"errors"
	"strings"
	"unicode"
)

func NormalizePhone(raw string) (string, error) {
	var b strings.Builder
	for _, r := range raw {
		if r == '+' || r == '-' || r == '(' || r == ')' || unicode.IsSpace(r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String(), nil
}
```
→ `ok`. Commit: `feat(user): NormalizePhone drops +, spaces, dashes and parentheses`

- [ ] **Sikl 2 RED: 9 xonali raqamga 998 qo'shiladi**
```go
		{name: "local number", raw: "901234567", want: "998901234567"},
		{name: "formatted local number", raw: "(90) 123-45-67", want: "998901234567"},
```
→ FAIL `expected: "998901234567" actual: "901234567"`.
- [ ] **Sikl 2 GREEN** — `return` o'rniga:
```go
	digits := b.String()
	if len(digits) == 9 {
		digits = "998" + digits
	}
	return digits, nil
```
Commit: `feat(user): a 9-digit local number gets the 998 country code`

- [ ] **Sikl 3 RED: boshqa belgilar rad etiladi**
```go
		{name: "letter", raw: "99890123456a", wantErr: ErrInvalidPhone},
		{name: "dots", raw: "998.90.123.45.67", wantErr: ErrInvalidPhone},
```
→ FAIL `Expected error with "invalid phone number" in chain but got nil.`
- [ ] **Sikl 3 GREEN** — tsikl ichida `continue` dan keyin:
```go
		if r < '0' || r > '9' {
			return "", ErrInvalidPhone
		}
```
Commit: `feat(user): NormalizePhone rejects characters other than digits`

- [ ] **Sikl 4 RED: uzunlik 9–15**
```go
		{name: "empty", raw: "", wantErr: ErrInvalidPhone},
		{name: "only separators", raw: "+ ( ) -", wantErr: ErrInvalidPhone},
		{name: "too short", raw: "90123456", wantErr: ErrInvalidPhone},
		{name: "too long", raw: "9989012345678901", wantErr: ErrInvalidPhone},
```
→ FAIL `… but got nil.`
- [ ] **Sikl 4 GREEN** — `digits := b.String()` dan keyin:
```go
	if n := len(digits); n < 9 || n > 15 {
		return "", ErrInvalidPhone
	}
```
Hujjat kommentini yakunlash:
```go
// NormalizePhone turns user input into the stored phone form: digits only,
// such as 998901234567. "+", spaces, "-" and parentheses are dropped and a
// 9-digit local number gets the 998 country code. Other characters, or a
// number outside 9-15 digits (the users.phone check), give ErrInvalidPhone.
```
Commit: `feat(user): NormalizePhone keeps the users.phone length of 9-15 digits`

---

### Task 2: goose migratsiya stub'i va `embed`

**Files:** Create `backend/migrations/00001_init.sql` (goose shabloni), `backend/migrations/embed.go`

- [ ] **Step 1:** `make migrate-create name=init`. Natijada `backend/migrations/00001_init.sql` goose shabloni bilan yaratiladi (`SELECT 'up SQL query';`). Bu RED uchun stub bo'lib xizmat qiladi.
- [ ] **Step 2:** `backend/migrations/embed.go`
```go
// Package migrations embeds the goose SQL migrations so that tests can apply
// them without depending on the working directory.
package migrations

import "embed"

// FS holds every migration file.
//
//go:embed *.sql
var FS embed.FS
```
(Commit Task 3'ning birinchi GREEN'i bilan birga.)

---

### Task 3: `pgtest` (TDD, 3 sikl)

**Files:** Create `backend/internal/testutil/pgtest/pgtest.go`, `pgtest_test.go`

```bash
cd backend && go get github.com/pressly/goose/v3@v3.28.0
```

- [ ] **Sikl P1 RED: har chaqiruv o'z migratsiyalangan DB'sini beradi**

`pgtest_test.go`:
```go
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
```
Stub `pgtest.go`:
```go
// Package pgtest gives integration tests their own migrated Postgres
// database. Every call clones a template that already holds the migrations,
// so tests never share rows and may run in parallel. The server comes from
// TEST_DATABASE_URL; the databases are named hisob24_it_*.
package pgtest

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New returns a pool connected to a fresh database holding every migration.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	t.Fatal("pgtest: not implemented")
	return nil
}
```
`GOTEST ./internal/testutil/pgtest/` → FAIL `pgtest: not implemented`.

- [ ] **Sikl P1 GREEN** — `pgtest.go` to'liq (DB'ni o'chirish hali yo'q):
```go
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
```
→ `ok`. Commit: `feat(pgtest): each test clones a migrated template database` (+ `migrations/`, go.mod/go.sum).

- [ ] **Sikl P2 RED: test tugagach DB o'chiriladi**
```go
func TestNewDropsTheDatabaseWhenTheTestEnds(t *testing.T) {
	var name string
	t.Run("inner", func(t *testing.T) {
		name = currentDatabase(t, New(t))
	})

	assert.False(t, databaseExists(t, name))
}

func databaseExists(t *testing.T, name string) bool {
	t.Helper()
	srv, err := connect()
	require.NoError(t, err)
	var exists bool
	require.NoError(t, srv.admin.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", name).Scan(&exists))
	return exists
}
```
→ FAIL `Should be false`.
- [ ] **Sikl P2 GREEN** — `New` ichida `CREATE DATABASE` dan keyin (pool'dan oldin; cleanup'lar LIFO, shuning uchun avval pool yopiladi):
```go
	t.Cleanup(func() {
		// t.Context() is already cancelled when cleanups run.
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := srv.admin.Exec(ctx, "DROP DATABASE IF EXISTS "+ident(name)+" WITH (FORCE)"); err != nil {
			t.Errorf("pgtest: drop %s: %v", name, err)
		}
	})
```
Paket kommentiga qo'shiladi: `…named hisob24_it_* and dropped when the test ends.`
Commit: `feat(pgtest): drop each test database when its test ends`

- [ ] **Sikl P3 RED: qolib ketgan DB'lar tozalanadi**
```go
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
```
(test importlari: `context`, `fmt`, `time`, `github.com/jackc/pgx/v5`)
Stub (`pgtest.go`):
```go
// dropLeftovers drops what killed runs left behind.
func dropLeftovers(ctx context.Context, conn *pgx.Conn, keepTemplate string, now time.Time) error {
	return nil
}
```
→ FAIL `a test database older than an hour`.

- [ ] **Sikl P3 GREEN**
```go
// staleAfter is how old a test database must be before a later run drops it
// as the leftover of a killed run.
const staleAfter = time.Hour

// dropLeftovers drops what earlier runs left behind: templates of other
// migrations and test databases older than staleAfter. The caller holds the
// template lock.
func dropLeftovers(ctx context.Context, conn *pgx.Conn, keepTemplate string, now time.Time) error {
	rows, err := conn.Query(ctx, "SELECT datname FROM pg_database WHERE starts_with(datname, $1)", prefix)
	if err != nil {
		return fmt.Errorf("list test databases: %w", err)
	}
	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return fmt.Errorf("list test databases: %w", err)
	}
	for _, name := range names {
		if !isLeftover(name, keepTemplate, now) {
			continue
		}
		if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+ident(name)+" WITH (FORCE)"); err != nil {
			return fmt.Errorf("drop leftover %s: %w", name, err)
		}
	}
	return nil
}

// isLeftover reads the creation time from a test database name
// (hisob24_it_<unix>_<random>); names it cannot read are left alone.
func isLeftover(name, keepTemplate string, now time.Time) bool {
	if strings.HasPrefix(name, templatePrefix) {
		return name != keepTemplate
	}
	stamp, _, ok := strings.Cut(strings.TrimPrefix(name, prefix), "_")
	if !ok {
		return false
	}
	unix, err := strconv.ParseInt(stamp, 10, 64)
	if err != nil {
		return false
	}
	return now.Sub(time.Unix(unix, 0)) > staleAfter
}
```
(`strconv`, `strings` importlari.) `ensureTemplate` ichida lock'dan keyin:
```go
	if err := dropLeftovers(ctx, conn, name, time.Now()); err != nil {
		return "", err
	}
```
→ `ok`. Commit: `feat(pgtest): drop databases that killed runs left behind`

---

### Task 4: Migratsiya (TDD, 2 sikl)

**Files:** Modify `backend/migrations/00001_init.sql`; Create `backend/migrations/migrations_test.go`

- [ ] **Sikl M1 RED: Up owner admin'ni seed qiladi**
```go
package migrations_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func TestInitSeedsTheOwnerAdmin(t *testing.T) {
	pool := pgtest.New(t)

	var fullName string
	var active bool
	err := pool.QueryRow(t.Context(), "SELECT full_name, is_active FROM admins WHERE telegram_id = 461603558").Scan(&fullName, &active)

	require.NoError(t, err)
	assert.Equal(t, "Owner", fullName)
	assert.True(t, active)
}
```
→ FAIL `relation "admins" does not exist (SQLSTATE 42P01)`.
- [ ] **Sikl M1 GREEN** — `-- +goose Up` bo'limiga spec'ning 4-bo'limidagi SQL so'zma-so'z qo'yiladi (Down hali shablon). Commit: `feat(db): first migration creates the spec schema`
- [ ] **Sikl M2 RED: Down sxemani olib tashlaydi**
```go
func TestInitDownRemovesTheSchema(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	db := stdlib.OpenDBFromPool(pool)
	t.Cleanup(func() { _ = db.Close() })
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS)
	require.NoError(t, err)

	_, err = provider.DownTo(ctx, 0)
	require.NoError(t, err)

	rows, err := pool.Query(ctx, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'goose_db_version'")
	require.NoError(t, err)
	tables, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Empty(t, tables)
}
```
→ FAIL `Should be empty, but was [admins …]`.
- [ ] **Sikl M2 GREEN** — Down:
```sql
-- +goose Down
-- pgcrypto stays: other objects in the database may use it.
DROP TABLE telegram_contacts;
DROP TABLE refresh_tokens;
DROP TABLE sms_codes;
DROP TABLE billings;
DROP TABLE user_companies;
DROP TABLE users;
DROP TABLE companies;
DROP TABLE admin_sessions;
DROP TABLE admin_login_codes;
DROP TABLE admins;
```
Commit: `feat(db): the first migration rolls back`

---

### Task 5: sqlc sozlamasi

**Files:** Create `backend/sqlc.yaml`, `backend/internal/db/doc.go`, `backend/internal/db/helpers_test.go`

`backend/sqlc.yaml`:
```yaml
version: "2"
sql:
  - engine: postgresql
    schema: migrations
    queries: internal/db/queries
    gen:
      go:
        package: gen
        out: internal/db/gen
        sql_package: pgx/v5
        emit_interface: true
        emit_empty_slices: true
        emit_pointers_for_null_types: true
        overrides:
          - db_type: uuid
            go_type: github.com/google/uuid.UUID
          - db_type: timestamptz
            go_type: time.Time
          - db_type: timestamptz
            nullable: true
            go_type:
              type: time.Time
              pointer: true
          - db_type: date
            go_type: time.Time
```
`backend/internal/db/doc.go`:
```go
// Package db is the sqlc layer. queries/*.sql are the hand-written queries
// and gen/ is the code sqlc generates from them (never edited by hand). The
// tests in this directory run every query against a real Postgres.
package db
```
`backend/internal/db/helpers_test.go`:
```go
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
```
Birinchi `make sqlc` dan keyin: `cd backend && go get github.com/google/uuid@latest && go mod tidy`.
(Commit birinchi so'rov sikli bilan birga.)

---

### Task 6: So'rovlar (TDD, 37 sikl)

**Har sikl uchun bir xil protsedura:**
1. Testni `internal/db/<jadval>_test.go` ga qo'shish (birinchi sikldagi import bloki ko'rsatilgan; keyingi sikllarda kerak bo'lgan importlar qo'shiladi).
2. Stub so'rovni `internal/db/queries/<jadval>.sql` ga qo'shish va `make sqlc` ishga tushirish. Stub haqiqiy so'rov bilan bir xil parametrlarga ega, lekin `false` sharti tufayli hech narsa qilmaydi, shuning uchun kod kompilyatsiya bo'ladi.
3. RED: `GOTEST ./internal/db/ -run '^TestX$'` va jurnalga yozish. Kutilgan yiqilish har sikl ostida berilgan.
4. Stub haqiqiy SQL bilan almashtiriladi, `make sqlc`.
5. GREEN: `GOTEST ./internal/db/ -run '^TestX$'`, keyin `GOTEST ./...`.
6. Commit: `feat(db): <QueryName> query` (test, `.sql`, `gen/`).

#### admins.sql / admins_test.go

Import bloki (`admins_test.go`):
```go
package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)
```
(`context` 4-siklda, `gen` 3-siklda kerak bo'ladi va o'sha paytda qo'shiladi.)

**1. GetActiveAdmin**
```go
func TestGetActiveAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active) VALUES (42, 'Off', false)")

	owner, err := q.GetActiveAdmin(ctx, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "Owner", *owner.FullName)
	assert.True(t, owner.IsActive)

	_, err = q.GetActiveAdmin(ctx, 42)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an inactive admin is not returned")
}
```
Stub: `-- name: GetActiveAdmin :one` / `SELECT * FROM admins WHERE telegram_id = $1 AND false;`
Real:
```sql
-- name: GetActiveAdmin :one
SELECT * FROM admins
WHERE telegram_id = $1 AND is_active;
```
RED: `no rows in result set`.

**2. ListAdmins**
```go
func TestListAdmins(t *testing.T) {
	q, pool := setup(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active, created_at) VALUES (42, 'Ikkinchi', false, now() + interval '1 minute')")

	admins, err := q.ListAdmins(t.Context())

	require.NoError(t, err)
	require.Len(t, admins, 2)
	assert.Equal(t, ownerID, admins[0].TelegramID)
	assert.Equal(t, int64(42), admins[1].TelegramID)
	assert.False(t, admins[1].IsActive, "inactive admins are listed too")
}
```
Stub: `SELECT * FROM admins WHERE false ORDER BY created_at, telegram_id;`
Real:
```sql
-- name: ListAdmins :many
SELECT * FROM admins
ORDER BY created_at, telegram_id;
```
RED: `should have 2 item(s), but has 0`.

**3. CreateOrReactivateAdmin**
```go
func TestCreateOrReactivateAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	created, err := q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: 42, FullName: ptr("Yangi")})
	require.NoError(t, err)
	assert.True(t, created.IsActive)
	assert.Equal(t, "Yangi", *created.FullName)

	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")
	revived, err := q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: 42, FullName: ptr("Qaytgan")})
	require.NoError(t, err)
	assert.True(t, revived.IsActive)
	assert.Equal(t, "Qaytgan", *revived.FullName)

	_, err = q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: ownerID, FullName: ptr("Boshqa")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an active admin is not overwritten")
	owner, err := q.GetActiveAdmin(ctx, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "Owner", *owner.FullName)
}
```
Stub: `INSERT INTO admins (telegram_id, full_name) SELECT $1, $2 WHERE false RETURNING *;`
Real:
```sql
-- name: CreateOrReactivateAdmin :one
-- Adds an admin or reactivates a deactivated one. An admin who is already
-- active is left as is and no row comes back (pgx.ErrNoRows → 409).
INSERT INTO admins (telegram_id, full_name)
VALUES ($1, $2)
ON CONFLICT (telegram_id) DO UPDATE
SET is_active = true, full_name = EXCLUDED.full_name
WHERE NOT admins.is_active
RETURNING *;
```
RED: `no rows in result set`.

**4. LockActiveAdmins**
```go
func TestLockActiveAdmins(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, true), (43, false)")
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	ids, err := q.WithTx(tx).LockActiveAdmins(ctx)

	require.NoError(t, err)
	assert.Equal(t, []int64{42, ownerID}, ids)
	_, err = pool.Exec(ctx, "SELECT 1 FROM admins WHERE telegram_id = $1 FOR UPDATE NOWAIT", ownerID)
	assert.Equal(t, "55P03", sqlState(err), "the rows stay locked until the transaction ends") // lock_not_available
}
```
Stub: `SELECT telegram_id FROM admins WHERE is_active AND false ORDER BY telegram_id FOR UPDATE;`
Real:
```sql
-- name: LockActiveAdmins :many
-- Locks every active admin row, so "keep at least one active admin" holds
-- under concurrent deactivations.
SELECT telegram_id FROM admins
WHERE is_active
ORDER BY telegram_id
FOR UPDATE;
```
RED: `expected: []int64{42, 461603558} actual: []int64{}`.

**5. DeactivateAdmin**
```go
func TestDeactivateAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")

	n, err := q.DeactivateAdmin(ctx, 42)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	_, err = q.GetActiveAdmin(ctx, 42)
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	n, err = q.DeactivateAdmin(ctx, 42)
	require.NoError(t, err)
	assert.Zero(t, n, "an inactive admin is not touched again")
	n, err = q.DeactivateAdmin(ctx, 999)
	require.NoError(t, err)
	assert.Zero(t, n)
}
```
Stub: `UPDATE admins SET is_active = false WHERE telegram_id = $1 AND is_active AND false;`
Real:
```sql
-- name: DeactivateAdmin :execrows
UPDATE admins SET is_active = false
WHERE telegram_id = $1 AND is_active;
```
RED: `expected: 1 actual: 0`.

#### admin_login_codes.sql / admin_login_codes_test.go

Import bloki: `context`, `testing`, `time`, `pgx`, `pgxpool` (8-sikl), `assert`, `require`, `gen`.

**6. CreateAdminLoginCode**
```go
func TestCreateAdminLoginCode(t *testing.T) {
	q, pool := setup(t)
	expires := time.Now().Add(time.Minute)

	id := createCode(t, q, ownerID, "hash-1", expires)

	var adminID int64
	var usedAt *time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT admin_id, used_at FROM admin_login_codes WHERE id = $1", id).Scan(&adminID, &usedAt))
	assert.Equal(t, ownerID, adminID)
	assert.Nil(t, usedAt)

	_, err := q.CreateAdminLoginCode(t.Context(), gen.CreateAdminLoginCodeParams{AdminID: ownerID, CodeHash: "hash-1", ExpiresAt: expires})
	assert.Equal(t, "23505", sqlState(err), "an unused code hash is unique") // unique_violation
}

func createCode(t *testing.T, q *gen.Queries, adminID int64, hash string, expiresAt time.Time) int64 {
	t.Helper()
	id, err := q.CreateAdminLoginCode(context.Background(), gen.CreateAdminLoginCodeParams{AdminID: adminID, CodeHash: hash, ExpiresAt: expiresAt})
	require.NoError(t, err)
	return id
}
```
Stub: `INSERT INTO admin_login_codes (admin_id, code_hash, expires_at) SELECT $1, $2, $3 WHERE false RETURNING id;`
Real:
```sql
-- name: CreateAdminLoginCode :one
-- A unique violation (23505) means the hash of another unused code: the
-- caller draws a new code.
INSERT INTO admin_login_codes (admin_id, code_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;
```
RED: `no rows in result set`.

**7. ConsumeAdminLoginCode**
```go
func TestConsumeAdminLoginCode(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createCode(t, q, ownerID, "fresh", time.Now().Add(time.Minute))
	createCode(t, q, ownerID, "stale", time.Now().Add(-time.Second))

	adminID, err := q.ConsumeAdminLoginCode(ctx, "fresh")
	require.NoError(t, err)
	assert.Equal(t, ownerID, adminID)

	_, err = q.ConsumeAdminLoginCode(ctx, "fresh")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a code works once")
	_, err = q.ConsumeAdminLoginCode(ctx, "stale")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired code does not work")
	_, err = q.ConsumeAdminLoginCode(ctx, "unknown")
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub: `UPDATE admin_login_codes SET used_at = now() WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() AND false RETURNING admin_id;`
Real:
```sql
-- name: ConsumeAdminLoginCode :one
-- Spends a live code in one statement, so a code opens one session only.
UPDATE admin_login_codes
SET used_at = now()
WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
RETURNING admin_id;
```
RED: `no rows in result set`.

**8. DeleteStaleAdminLoginCodes**
```go
func TestDeleteStaleAdminLoginCodes(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	soon, past := time.Now().Add(time.Minute), time.Now().Add(-time.Second)
	createCode(t, q, ownerID, "own-unused", soon)
	createCode(t, q, ownerID, "own-used", soon)
	_, err := q.ConsumeAdminLoginCode(ctx, "own-used")
	require.NoError(t, err)
	createCode(t, q, 42, "other-unused", soon)
	createCode(t, q, 42, "other-expired", past)

	require.NoError(t, q.DeleteStaleAdminLoginCodes(ctx, ownerID))

	assert.ElementsMatch(t, []string{"own-used", "other-unused"}, codeHashes(t, pool))
}

func codeHashes(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()
	rows, err := pool.Query(context.Background(), "SELECT code_hash FROM admin_login_codes ORDER BY code_hash")
	require.NoError(t, err)
	hashes, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return hashes
}
```
Stub: `DELETE FROM admin_login_codes WHERE ((admin_id = $1 AND used_at IS NULL) OR expires_at <= now()) AND false;`
Real:
```sql
-- name: DeleteStaleAdminLoginCodes :exec
-- Before a new code: this admin's unused codes and everyone's expired ones.
DELETE FROM admin_login_codes
WHERE (admin_id = $1 AND used_at IS NULL) OR expires_at <= now();
```
RED: `ElementsMatch` 4 ta elementni ko'rsatadi.

**9. DeleteAdminLoginCode**
```go
func TestDeleteAdminLoginCode(t *testing.T) {
	q, pool := setup(t)
	soon := time.Now().Add(time.Minute)
	first := createCode(t, q, ownerID, "first", soon)
	createCode(t, q, ownerID, "second", soon)

	require.NoError(t, q.DeleteAdminLoginCode(t.Context(), first))

	assert.Equal(t, []string{"second"}, codeHashes(t, pool))
}
```
Stub: `DELETE FROM admin_login_codes WHERE id = $1 AND false;`
Real:
```sql
-- name: DeleteAdminLoginCode :exec
-- Drops a code the bot could not deliver.
DELETE FROM admin_login_codes WHERE id = $1;
```
RED: `expected: []string{"second"} actual: []string{"first", "second"}`.

#### admin_sessions.sql / admin_sessions_test.go

Import bloki: `context`, `testing`, `time`, `github.com/google/uuid`, `pgx`, `assert`, `require`, `gen`.

```go
func createSession(t *testing.T, q *gen.Queries, adminID int64, expiresAt time.Time) gen.AdminSession {
	t.Helper()
	s, err := q.CreateAdminSession(context.Background(), gen.CreateAdminSessionParams{AdminID: adminID, Source: "otp", ExpiresAt: expiresAt})
	require.NoError(t, err)
	return s
}
```

**10. CreateAdminSession**
```go
func TestCreateAdminSession(t *testing.T) {
	q, _ := setup(t)
	expires := time.Now().Add(12 * time.Hour)

	s := createSession(t, q, ownerID, expires)

	assert.NotEqual(t, uuid.Nil, s.ID)
	assert.Equal(t, ownerID, s.AdminID)
	assert.Equal(t, "otp", s.Source)
	assert.WithinDuration(t, expires, s.ExpiresAt, time.Millisecond)

	_, err := q.CreateAdminSession(t.Context(), gen.CreateAdminSessionParams{AdminID: ownerID, Source: "web", ExpiresAt: expires})
	assert.Equal(t, "23514", sqlState(err), "source is otp or miniapp") // check_violation
}
```
Stub: `INSERT INTO admin_sessions (admin_id, source, expires_at) SELECT $1, $2, $3 WHERE false RETURNING *;`
Real:
```sql
-- name: CreateAdminSession :one
INSERT INTO admin_sessions (admin_id, source, expires_at)
VALUES ($1, $2, $3)
RETURNING *;
```
RED: `no rows in result set`.

**11. GetAdminBySession**
```go
func TestGetAdminBySession(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")
	live := createSession(t, q, ownerID, time.Now().Add(time.Hour))
	expired := createSession(t, q, ownerID, time.Now().Add(-time.Second))
	ofInactive := createSession(t, q, 42, time.Now().Add(time.Hour))

	admin, err := q.GetAdminBySession(ctx, live.ID)
	require.NoError(t, err)
	assert.Equal(t, ownerID, admin.TelegramID)

	for name, id := range map[string]uuid.UUID{"expired": expired.ID, "inactive admin": ofInactive.ID, "unknown": uuid.New()} {
		_, err := q.GetAdminBySession(ctx, id)
		assert.ErrorIs(t, err, pgx.ErrNoRows, name)
	}
}
```
Stub: `SELECT a.* FROM admin_sessions s JOIN admins a ON a.telegram_id = s.admin_id WHERE s.id = $1 AND s.expires_at > now() AND a.is_active AND false;`
Real:
```sql
-- name: GetAdminBySession :one
-- The admin behind a live session; an expired session or a deactivated
-- admin gives pgx.ErrNoRows.
SELECT a.*
FROM admin_sessions s
JOIN admins a ON a.telegram_id = s.admin_id
WHERE s.id = $1 AND s.expires_at > now() AND a.is_active;
```
RED: `no rows in result set`.

**12. DeleteAdminSession**
```go
func TestDeleteAdminSession(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	gone := createSession(t, q, ownerID, time.Now().Add(time.Hour))
	kept := createSession(t, q, ownerID, time.Now().Add(time.Hour))

	require.NoError(t, q.DeleteAdminSession(ctx, gone.ID))

	_, err := q.GetAdminBySession(ctx, gone.ID)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
	_, err = q.GetAdminBySession(ctx, kept.ID)
	assert.NoError(t, err)
}
```
Stub: `DELETE FROM admin_sessions WHERE id = $1 AND false;` Real: `DELETE FROM admin_sessions WHERE id = $1;`
RED: `An error is expected but got nil` (gone hali bor).

**13. DeleteAdminSessionsByAdmin**
```go
func TestDeleteAdminSessionsByAdmin(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	createSession(t, q, ownerID, time.Now().Add(time.Hour))
	createSession(t, q, ownerID, time.Now().Add(time.Hour))
	other := createSession(t, q, 42, time.Now().Add(time.Hour))

	require.NoError(t, q.DeleteAdminSessionsByAdmin(ctx, ownerID))

	rows, err := pool.Query(ctx, "SELECT id FROM admin_sessions")
	require.NoError(t, err)
	left, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{other.ID}, left)
}
```
Stub: `DELETE FROM admin_sessions WHERE admin_id = $1 AND false;`
Real:
```sql
-- name: DeleteAdminSessionsByAdmin :exec
-- Logs a deactivated admin out everywhere.
DELETE FROM admin_sessions WHERE admin_id = $1;
```
RED: 3 ta sessiya qolgan.

#### companies.sql / companies_test.go

Import bloki: `context`, `testing`, `time`, `pgx`, `pgxpool`, `assert`, `require`, `gen`.

```go
func createCompany(t *testing.T, q *gen.Queries, name string, endDate time.Time) gen.Company {
	t.Helper()
	c, err := q.CreateCompany(context.Background(), gen.CreateCompanyParams{Name: name, EndDate: endDate, CreatedBy: ptr(ownerID)})
	require.NoError(t, err)
	return c
}
```

**14. CreateCompany**
```go
func TestCreateCompany(t *testing.T) {
	q, pool := setup(t)
	end := today(t, pool).AddDate(0, 0, 30)

	c := createCompany(t, q, "Olma MChJ", end)

	assert.NotZero(t, c.ID)
	assert.Equal(t, "Olma MChJ", c.Name)
	assert.True(t, c.EndDate.Equal(end), "end_date %s", c.EndDate)
	assert.True(t, c.IsActive)
	assert.Equal(t, ownerID, *c.CreatedBy)
}
```
Stub: `INSERT INTO companies (name, end_date, created_by) SELECT $1, $2, $3 WHERE false RETURNING *;`
Real:
```sql
-- name: CreateCompany :one
INSERT INTO companies (name, end_date, created_by)
VALUES ($1, $2, $3)
RETURNING *;
```
RED: `no rows in result set`.

**15. GetCompany**
```go
func TestGetCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	created := createCompany(t, q, "Olma MChJ", today(t, pool))

	got, err := q.GetCompany(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created, got)

	_, err = q.GetCompany(ctx, created.ID+1)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub: `SELECT * FROM companies WHERE id = $1 AND false;` Real: `SELECT * FROM companies WHERE id = $1;`
RED: `no rows in result set`.

**16. ListCompanies**
```go
// seedCompanies covers every status case: two active (one ends today), one
// past its end_date and one blocked.
func seedCompanies(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) {
	t.Helper()
	d := today(t, pool)
	createCompany(t, q, "Olma Savdo", d.AddDate(0, 0, 10))
	createCompany(t, q, "Nok Market", d)
	createCompany(t, q, "Olcha Servis", d.AddDate(0, 0, -1))
	blocked := createCompany(t, q, "Behi Blok", d.AddDate(0, 0, 30))
	mustExec(t, pool, "UPDATE companies SET is_active = false WHERE id = $1", blocked.ID)
}

func TestListCompanies(t *testing.T) {
	q, pool := setup(t)
	seedCompanies(t, q, pool)

	tests := []struct {
		name          string
		search        *string
		status        *string
		limit, offset int32
		want          []string
	}{
		{name: "everything, newest first", limit: 20, want: []string{"Behi Blok", "Olcha Servis", "Nok Market", "Olma Savdo"}},
		{name: "active", status: ptr("active"), limit: 20, want: []string{"Nok Market", "Olma Savdo"}},
		{name: "expired or blocked", status: ptr("expired"), limit: 20, want: []string{"Behi Blok", "Olcha Servis"}},
		{name: "search ignores case", search: ptr("OL"), limit: 20, want: []string{"Olcha Servis", "Olma Savdo"}},
		{name: "search and status", search: ptr("ol"), status: ptr("expired"), limit: 20, want: []string{"Olcha Servis"}},
		{name: "page", limit: 2, offset: 1, want: []string{"Olcha Servis", "Nok Market"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := q.ListCompanies(t.Context(), gen.ListCompaniesParams{Search: tt.search, Status: tt.status, Limit: tt.limit, Offset: tt.offset})
			require.NoError(t, err)
			assert.Equal(t, tt.want, companyNames(got))
		})
	}
}

func companyNames(cs []gen.Company) []string {
	names := make([]string, 0, len(cs))
	for _, c := range cs {
		names = append(names, c.Name)
	}
	return names
}
```
Stub — haqiqiy so'rov, lekin `WHERE false AND (` bilan boshlanadi.
Real:
```sql
-- name: ListCompanies :many
-- status: "active" = end_date not passed and not blocked, "expired" = past
-- end_date or blocked, NULL = everything. search matches the name in any case.
SELECT * FROM companies
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('status')::text IS NULL
       OR (sqlc.narg('status')::text = 'active' AND end_date >= CURRENT_DATE AND is_active)
       OR (sqlc.narg('status')::text = 'expired' AND (end_date < CURRENT_DATE OR NOT is_active)))
ORDER BY id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');
```
RED: `actual: []string{}`.

**17. CountCompanies**
```go
func TestCountCompanies(t *testing.T) {
	q, pool := setup(t)
	seedCompanies(t, q, pool)

	tests := []struct {
		name   string
		search *string
		status *string
		want   int64
	}{
		{name: "everything", want: 4},
		{name: "active", status: ptr("active"), want: 2},
		{name: "expired or blocked", status: ptr("expired"), want: 2},
		{name: "search and status", search: ptr("ol"), status: ptr("expired"), want: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := q.CountCompanies(t.Context(), gen.CountCompaniesParams{Search: tt.search, Status: tt.status})
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
```
Stub — `WHERE false AND (…)`.
Real:
```sql
-- name: CountCompanies :one
-- The same filter as ListCompanies, for the page count.
SELECT count(*) FROM companies
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('status')::text IS NULL
       OR (sqlc.narg('status')::text = 'active' AND end_date >= CURRENT_DATE AND is_active)
       OR (sqlc.narg('status')::text = 'expired' AND (end_date < CURRENT_DATE OR NOT is_active)));
```
RED: `expected: 4 actual: 0`.

**18. UpdateCompany**
```go
func TestUpdateCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))

	renamed, err := q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID, Name: ptr("Olma MChJ")})
	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", renamed.Name)
	assert.True(t, renamed.IsActive, "is_active is kept when not sent")

	blocked, err := q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID, IsActive: ptr(false)})
	require.NoError(t, err)
	assert.False(t, blocked.IsActive)
	assert.Equal(t, "Olma MChJ", blocked.Name, "name is kept when not sent")

	_, err = q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: c.ID + 1, Name: ptr("X")})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub — haqiqiy so'rov, `WHERE id = sqlc.arg('id') AND false`.
Real:
```sql
-- name: UpdateCompany :one
-- PATCH: a NULL argument leaves its column as it is.
UPDATE companies
SET name = COALESCE(sqlc.narg('name'), name),
    is_active = COALESCE(sqlc.narg('is_active'), is_active)
WHERE id = sqlc.arg('id')
RETURNING *;
```
RED: `no rows in result set`.

**19. LockCompanyEndDate**
```go
func TestLockCompanyEndDate(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d.AddDate(0, 0, 5))
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	row, err := q.WithTx(tx).LockCompanyEndDate(ctx, c.ID)

	require.NoError(t, err)
	assert.True(t, row.EndDate.Equal(d.AddDate(0, 0, 5)))
	assert.True(t, row.Today.Equal(d), "today is the database's CURRENT_DATE")
	_, err = pool.Exec(ctx, "SELECT 1 FROM companies WHERE id = $1 FOR UPDATE NOWAIT", c.ID)
	assert.Equal(t, "55P03", sqlState(err), "the row stays locked until the transaction ends")
}
```
Stub: `SELECT end_date, CURRENT_DATE::date AS today FROM companies WHERE id = $1 AND false FOR UPDATE;`
Real:
```sql
-- name: LockCompanyEndDate :one
-- Locks the company for a billing transaction. today is the database's
-- CURRENT_DATE, so the new end_date follows the same clock as the checks.
SELECT end_date, CURRENT_DATE::date AS today
FROM companies
WHERE id = $1
FOR UPDATE;
```
RED: `no rows in result set`.

**20. SetCompanyEndDate**
```go
func TestSetCompanyEndDate(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)

	require.NoError(t, q.SetCompanyEndDate(ctx, gen.SetCompanyEndDateParams{ID: c.ID, EndDate: d.AddDate(0, 0, 30)}))

	got, err := q.GetCompany(ctx, c.ID)
	require.NoError(t, err)
	assert.True(t, got.EndDate.Equal(d.AddDate(0, 0, 30)))
}
```
Stub: `UPDATE companies SET end_date = $2 WHERE id = $1 AND false;` Real: `UPDATE companies SET end_date = $2 WHERE id = $1;`
RED: `Should be true`.

**21. IsCompanySubscriptionActive**
```go
func TestIsCompanySubscriptionActive(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	endsToday := createCompany(t, q, "Bugun", d)
	endedYesterday := createCompany(t, q, "Kecha", d.AddDate(0, 0, -1))
	blocked := createCompany(t, q, "Blok", d.AddDate(0, 0, 30))
	mustExec(t, pool, "UPDATE companies SET is_active = false WHERE id = $1", blocked.ID)

	for name, tc := range map[string]struct {
		id   int64
		want bool
	}{
		"ends today":      {endsToday.ID, true},
		"ended yesterday": {endedYesterday.ID, false},
		"blocked":         {blocked.ID, false},
	} {
		got, err := q.IsCompanySubscriptionActive(t.Context(), tc.id)
		require.NoError(t, err, name)
		assert.Equal(t, tc.want, got, name)
	}
	_, err := q.IsCompanySubscriptionActive(t.Context(), blocked.ID+1)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub: `SELECT (end_date >= CURRENT_DATE AND is_active)::boolean AS active FROM companies WHERE id = $1 AND false;`
Real:
```sql
-- name: IsCompanySubscriptionActive :one
-- The user middleware's check: false means 402 subscription_expired.
SELECT (end_date >= CURRENT_DATE AND is_active)::boolean AS active
FROM companies
WHERE id = $1;
```
RED: `no rows in result set`.

#### billings.sql / billings_test.go

Import bloki: `context`, `testing`, `time`, `pgtype`, `assert`, `require`, `gen`.

**22. CreateBilling**
```go
func TestCreateBilling(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	var amount pgtype.Numeric
	require.NoError(t, amount.Scan("150000.50"))

	b, err := q.CreateBilling(ctx, gen.CreateBillingParams{
		CompanyID: c.ID, Days: 30, Amount: amount, PrevEndDate: d, NewEndDate: d.AddDate(0, 0, 30),
		Note: ptr("Naqd"), CreatedBy: ptr(ownerID),
	})
	require.NoError(t, err)
	assert.NotZero(t, b.ID)
	assert.Equal(t, int32(30), b.Days)
	got, err := b.Amount.Float64Value()
	require.NoError(t, err)
	assert.InDelta(t, 150000.50, got.Float64, 0.001)
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 30)))
	assert.Equal(t, "Naqd", *b.Note)

	noAmount, err := q.CreateBilling(ctx, gen.CreateBillingParams{CompanyID: c.ID, Days: 1, PrevEndDate: d, NewEndDate: d.AddDate(0, 0, 1)})
	require.NoError(t, err)
	assert.False(t, noAmount.Amount.Valid, "amount is optional")

	_, err = q.CreateBilling(ctx, gen.CreateBillingParams{CompanyID: c.ID, Days: 0, PrevEndDate: d, NewEndDate: d})
	assert.Equal(t, "23514", sqlState(err), "days must be positive") // check_violation
}
```
Stub: `INSERT INTO billings (company_id, days, amount, prev_end_date, new_end_date, note, created_by) SELECT $1, $2, $3, $4, $5, $6, $7 WHERE false RETURNING *;`
Real:
```sql
-- name: CreateBilling :one
INSERT INTO billings (company_id, days, amount, prev_end_date, new_end_date, note, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
```
RED: `no rows in result set`.

**23. ListBillings**
```go
func TestListBillings(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	other := createCompany(t, q, "Nok", d)
	first := createBilling(t, q, c.ID, 30)
	second := createBilling(t, q, c.ID, 7)
	createBilling(t, q, other.ID, 1)

	got, err := q.ListBillings(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{got[0].ID, got[1].ID}, "newest first")
}

func createBilling(t *testing.T, q *gen.Queries, companyID int64, days int32) gen.Billing {
	t.Helper()
	d := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	b, err := q.CreateBilling(context.Background(), gen.CreateBillingParams{CompanyID: companyID, Days: days, PrevEndDate: d, NewEndDate: d.AddDate(0, 0, int(days))})
	require.NoError(t, err)
	return b
}
```
Stub: `SELECT * FROM billings WHERE company_id = $1 AND false ORDER BY created_at DESC, id DESC;`
Real:
```sql
-- name: ListBillings :many
SELECT * FROM billings
WHERE company_id = $1
ORDER BY created_at DESC, id DESC;
```
RED: `should have 2 item(s), but has 0`.

#### users.sql / users_test.go

Import bloki: `context`, `testing`, `pgx`, `assert`, `require`, `gen`.

```go
func createUser(t *testing.T, q *gen.Queries, phone, name string) {
	t.Helper()
	require.NoError(t, q.UpsertUser(context.Background(), gen.UpsertUserParams{Phone: phone, FullName: ptr(name)}))
}

func addMember(t *testing.T, q *gen.Queries, companyID int64, phone, name, role string) {
	t.Helper()
	createUser(t, q, phone, name)
	_, err := q.UpsertCompanyUser(context.Background(), gen.UpsertCompanyUserParams{UserPhone: phone, CompanyID: companyID, Role: role})
	require.NoError(t, err)
}
```
(`createUser` 24-siklda, `addMember` 28-siklda qo'shiladi.)

**24. UpsertUser**
```go
func TestUpsertUser(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	require.NoError(t, q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "998901234567", FullName: ptr("Ali Valiyev")}))
	require.NoError(t, q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "998901234567", FullName: ptr("Boshqa Ism")}))

	var name string
	require.NoError(t, pool.QueryRow(ctx, "SELECT full_name FROM users WHERE phone = '998901234567'").Scan(&name))
	assert.Equal(t, "Ali Valiyev", name, "an existing user keeps its name")

	err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: "+998901234567"})
	assert.Equal(t, "23514", sqlState(err), "the phone is digits only") // check_violation
}
```
Stub: `INSERT INTO users (phone, full_name) SELECT $1, $2 WHERE false;`
Real:
```sql
-- name: UpsertUser :exec
-- A phone that is already a user keeps its row and name.
INSERT INTO users (phone, full_name)
VALUES ($1, $2)
ON CONFLICT (phone) DO NOTHING;
```
RED: `no rows in result set`.

**25. GetUser**
```go
func TestGetUser(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")

	u, err := q.GetUser(ctx, "998901234567")
	require.NoError(t, err)
	assert.Equal(t, "Ali", *u.FullName)

	_, err = q.GetUser(ctx, "998900000000")
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub: `SELECT * FROM users WHERE phone = $1 AND false;` Real: `SELECT * FROM users WHERE phone = $1;`
RED: `no rows in result set`.

**26. UserExists**
```go
func TestUserExists(t *testing.T) {
	q, _ := setup(t)
	createUser(t, q, "998901234567", "Ali")

	exists, err := q.UserExists(t.Context(), "998901234567")
	require.NoError(t, err)
	assert.True(t, exists)

	exists, err = q.UserExists(t.Context(), "998900000000")
	require.NoError(t, err)
	assert.False(t, exists)
}
```
Stub: `SELECT EXISTS (SELECT 1 FROM users WHERE phone = $1 AND false);`
Real: `SELECT EXISTS (SELECT 1 FROM users WHERE phone = $1);`
RED: `Should be true`.

**27. UpsertCompanyUser**
```go
func TestUpsertCompanyUser(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, "998901234567", "Ali")

	m, err := q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "staff"})
	require.NoError(t, err)
	assert.Equal(t, "staff", m.Role)

	m, err = q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "manager"})
	require.NoError(t, err)
	assert.Equal(t, "manager", m.Role, "a member gets the new role")
	var members int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM user_companies WHERE company_id = $1", c.ID).Scan(&members))
	assert.Equal(t, 1, members)

	_, err = q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: "998901234567", CompanyID: c.ID, Role: "boss"})
	assert.Equal(t, "23514", sqlState(err), "role is owner, manager or staff") // check_violation
}
```
Stub: `INSERT INTO user_companies (user_phone, company_id, role) SELECT $1, $2, $3 WHERE false RETURNING *;`
Real:
```sql
-- name: UpsertCompanyUser :one
-- Adds the user to the company; a member already there gets the new role.
INSERT INTO user_companies (user_phone, company_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (user_phone, company_id) DO UPDATE SET role = EXCLUDED.role
RETURNING *;
```
RED: `no rows in result set`.

**28. ListCompanyUsers**
```go
func TestListCompanyUsers(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	other := createCompany(t, q, "Nok", d)
	addMember(t, q, c.ID, "998901111111", "Egasi", "owner")
	addMember(t, q, c.ID, "998902222222", "Xodim", "staff")
	addMember(t, q, other.ID, "998903333333", "Begona", "owner")

	users, err := q.ListCompanyUsers(t.Context(), c.ID)

	require.NoError(t, err)
	require.Len(t, users, 2)
	assert.Equal(t, "998901111111", users[0].Phone)
	assert.Equal(t, "Egasi", *users[0].FullName)
	assert.Equal(t, "owner", users[0].Role)
	assert.Equal(t, "998902222222", users[1].Phone)
	assert.Equal(t, "staff", users[1].Role)
}
```
Stub — haqiqiy so'rov, `WHERE uc.company_id = $1 AND false`.
Real:
```sql
-- name: ListCompanyUsers :many
SELECT u.phone, u.full_name, uc.role, uc.created_at
FROM user_companies uc
JOIN users u ON u.phone = uc.user_phone
WHERE uc.company_id = $1
ORDER BY uc.created_at, u.phone;
```
RED: `should have 2 item(s), but has 0`.

**29. ListUserCompanies**
```go
func TestListUserCompanies(t *testing.T) {
	q, pool := setup(t)
	d := today(t, pool)
	olma := createCompany(t, q, "Olma", d)
	behi := createCompany(t, q, "Behi", d.AddDate(0, 0, -1))
	nok := createCompany(t, q, "Nok", d)
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	addMember(t, q, behi.ID, "998901234567", "Ali", "staff")
	addMember(t, q, nok.ID, "998909999999", "Vali", "owner")

	got, err := q.ListUserCompanies(t.Context(), "998901234567")

	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "Behi", got[0].Name, "ordered by name")
	assert.Equal(t, "staff", got[0].Role)
	assert.True(t, got[0].EndDate.Equal(d.AddDate(0, 0, -1)))
	assert.Equal(t, "Olma", got[1].Name)
	assert.Equal(t, "owner", got[1].Role)
	assert.True(t, got[1].IsActive)
}
```
Stub — haqiqiy so'rov, `WHERE uc.user_phone = $1 AND false`.
Real:
```sql
-- name: ListUserCompanies :many
-- The user's companies for /app/me and for choosing one at login.
SELECT c.id, c.name, c.end_date, c.is_active, uc.role
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1
ORDER BY c.name, c.id;
```
RED: `should have 2 item(s), but has 0`.

**30. GetUserCompany**
```go
func TestGetUserCompany(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, c.ID, "998901234567", "Ali", "manager")
	createUser(t, q, "998909999999", "Vali")

	m, err := q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998901234567", CompanyID: c.ID})
	require.NoError(t, err)
	assert.Equal(t, "Olma", m.Name)
	assert.Equal(t, "manager", m.Role)

	_, err = q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: "998909999999", CompanyID: c.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "not a member")
}
```
Stub — haqiqiy so'rov, `… AND false`.
Real:
```sql
-- name: GetUserCompany :one
-- The membership behind switch-company; pgx.ErrNoRows when not a member.
SELECT c.id, c.name, c.end_date, c.is_active, uc.role
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;
```
RED: `no rows in result set`.

#### sms_codes.sql / sms_codes_test.go

Import bloki: `context`, `testing`, `time`, `pgx`, `pgxpool`, `assert`, `require`, `gen`.

```go
func storeSMSCode(t *testing.T, q *gen.Queries, phone, hash string, expiresAt time.Time) {
	t.Helper()
	n, err := q.UpsertSMSCode(context.Background(), gen.UpsertSMSCodeParams{Phone: phone, CodeHash: hash, ExpiresAt: expiresAt, CooldownSeconds: 60})
	require.NoError(t, err)
	require.Equal(t, int64(1), n)
}

func smsCodeHash(t *testing.T, pool *pgxpool.Pool, phone string) string {
	t.Helper()
	var hash string
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT code_hash FROM sms_codes WHERE phone = $1", phone).Scan(&hash))
	return hash
}
```

**31. UpsertSMSCode**
```go
func TestUpsertSMSCode(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	const phone = "998901234567"
	send := func(hash string) int64 {
		t.Helper()
		n, err := q.UpsertSMSCode(ctx, gen.UpsertSMSCodeParams{Phone: phone, CodeHash: hash, ExpiresAt: time.Now().Add(2 * time.Minute), CooldownSeconds: 60})
		require.NoError(t, err)
		return n
	}

	assert.Equal(t, int64(1), send("first"))
	assert.Zero(t, send("second"), "a second code within the cooldown is refused")
	assert.Equal(t, "first", smsCodeHash(t, pool, phone))

	mustExec(t, pool, "UPDATE sms_codes SET sent_at = now() - interval '61 seconds', attempts = 3 WHERE phone = $1", phone)
	assert.Equal(t, int64(1), send("third"))
	assert.Equal(t, "third", smsCodeHash(t, pool, phone))
	var attempts int
	require.NoError(t, pool.QueryRow(ctx, "SELECT attempts FROM sms_codes WHERE phone = $1", phone).Scan(&attempts))
	assert.Zero(t, attempts, "a new code starts with no failed attempts")
}
```
Stub: `INSERT INTO sms_codes (phone, code_hash, expires_at) SELECT $1, $2, $3 WHERE false AND sqlc.arg(cooldown_seconds)::int IS NOT NULL;`
Real:
```sql
-- name: UpsertSMSCode :execrows
-- Stores a new code unless the last one went out less than cooldown_seconds
-- ago: 0 rows affected means "too soon" (429).
INSERT INTO sms_codes (phone, code_hash, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (phone) DO UPDATE
SET code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    sent_at = now()
WHERE sms_codes.sent_at <= now() - make_interval(secs => sqlc.arg(cooldown_seconds)::int);
```
RED: `expected: 1 actual: 0`.

**32. ConsumeSMSCode**
```go
func TestConsumeSMSCode(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	storeSMSCode(t, q, "998901111111", "right", time.Now().Add(2*time.Minute))
	storeSMSCode(t, q, "998902222222", "late", time.Now().Add(-time.Second))

	_, err := q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "wrong"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a wrong code")
	phone, err := q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "right"})
	require.NoError(t, err)
	assert.Equal(t, "998901111111", phone)
	_, err = q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "right"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a code works once")
	_, err = q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998902222222", CodeHash: "late"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired code")
}
```
Stub: `DELETE FROM sms_codes WHERE phone = $1 AND code_hash = $2 AND expires_at > now() AND false RETURNING phone;`
Real:
```sql
-- name: ConsumeSMSCode :one
-- Deletes a matching live code: a code logs in once.
DELETE FROM sms_codes
WHERE phone = $1 AND code_hash = $2 AND expires_at > now()
RETURNING phone;
```
RED: `no rows in result set`.

**33. IncrementSMSCodeAttempts**
```go
func TestIncrementSMSCodeAttempts(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	storeSMSCode(t, q, "998901234567", "code", time.Now().Add(2*time.Minute))

	for want := int32(1); want <= 2; want++ {
		got, err := q.IncrementSMSCodeAttempts(ctx, "998901234567")
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
	_, err := q.IncrementSMSCodeAttempts(ctx, "998900000000")
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```
Stub: `UPDATE sms_codes SET attempts = attempts + 1 WHERE phone = $1 AND false RETURNING attempts;`
Real:
```sql
-- name: IncrementSMSCodeAttempts :one
UPDATE sms_codes SET attempts = attempts + 1
WHERE phone = $1
RETURNING attempts;
```
RED: `no rows in result set`.

**34. DeleteSMSCode**
```go
func TestDeleteSMSCode(t *testing.T) {
	q, pool := setup(t)
	storeSMSCode(t, q, "998901111111", "a", time.Now().Add(time.Minute))
	storeSMSCode(t, q, "998902222222", "b", time.Now().Add(time.Minute))

	require.NoError(t, q.DeleteSMSCode(t.Context(), "998901111111"))

	rows, err := pool.Query(t.Context(), "SELECT phone FROM sms_codes")
	require.NoError(t, err)
	phones, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"998902222222"}, phones)
}
```
Stub: `DELETE FROM sms_codes WHERE phone = $1 AND false;`
Real:
```sql
-- name: DeleteSMSCode :exec
-- Drops a code after the fifth wrong attempt.
DELETE FROM sms_codes WHERE phone = $1;
```
RED: 2 ta telefon qolgan.

#### refresh_tokens.sql / refresh_tokens_test.go

Import bloki: `context`, `testing`, `time`, `pgx`, `assert`, `require`, `gen`.

**35. CreateRefreshToken**
```go
func TestCreateRefreshToken(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")

	id, err := q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{UserPhone: "998901234567", TokenHash: "hash", ExpiresAt: time.Now().Add(30 * 24 * time.Hour)})
	require.NoError(t, err)
	var revokedAt *time.Time
	require.NoError(t, pool.QueryRow(ctx, "SELECT revoked_at FROM refresh_tokens WHERE id = $1", id).Scan(&revokedAt))
	assert.Nil(t, revokedAt)

	_, err = q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{UserPhone: "998900000000", TokenHash: "x", ExpiresAt: time.Now().Add(time.Hour)})
	assert.Equal(t, "23503", sqlState(err), "the user must exist") // foreign_key_violation
}

func createRefreshToken(t *testing.T, q *gen.Queries, phone, hash string, expiresAt time.Time) {
	t.Helper()
	_, err := q.CreateRefreshToken(context.Background(), gen.CreateRefreshTokenParams{UserPhone: phone, TokenHash: hash, ExpiresAt: expiresAt})
	require.NoError(t, err)
}
```
Stub: `INSERT INTO refresh_tokens (user_phone, token_hash, expires_at) SELECT $1, $2, $3 WHERE false RETURNING id;`
Real:
```sql
-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_phone, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;
```
RED: `no rows in result set`.

**36. RevokeRefreshToken**
```go
func TestRevokeRefreshToken(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	createUser(t, q, "998901234567", "Ali")
	createRefreshToken(t, q, "998901234567", "live", time.Now().Add(time.Hour))
	createRefreshToken(t, q, "998901234567", "old", time.Now().Add(-time.Second))

	phone, err := q.RevokeRefreshToken(ctx, "live")
	require.NoError(t, err)
	assert.Equal(t, "998901234567", phone)
	_, err = q.RevokeRefreshToken(ctx, "live")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a token is used once")
	_, err = q.RevokeRefreshToken(ctx, "old")
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired token")
}
```
Stub: `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() AND false RETURNING user_phone;`
Real:
```sql
-- name: RevokeRefreshToken :one
-- Revokes a live token and returns its owner: the first step of rotation
-- and of logout. A revoked, expired or unknown token gives pgx.ErrNoRows.
UPDATE refresh_tokens
SET revoked_at = now()
WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
RETURNING user_phone;
```
RED: `no rows in result set`.

#### telegram_contacts.sql / telegram_contacts_test.go

Import bloki: `testing`, `assert`, `require`, `gen`.

**37. UpsertTelegramContact**
```go
func TestUpsertTelegramContact(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	require.NoError(t, q.UpsertTelegramContact(ctx, gen.UpsertTelegramContactParams{ChatID: 777, Phone: "998901234567", Username: ptr("ali"), FirstName: ptr("Ali")}))
	mustExec(t, pool, "UPDATE telegram_contacts SET created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'")
	require.NoError(t, q.UpsertTelegramContact(ctx, gen.UpsertTelegramContactParams{ChatID: 777, Phone: "998909999999", FirstName: ptr("Ali")}))

	var phone string
	var username *string
	var newer bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT phone, username, updated_at > created_at FROM telegram_contacts WHERE chat_id = 777").Scan(&phone, &username, &newer))
	assert.Equal(t, "998909999999", phone, "the chat's latest contact wins")
	assert.Nil(t, username)
	assert.True(t, newer, "updated_at moves on every upsert")
}
```
Stub: `INSERT INTO telegram_contacts (chat_id, phone, username, first_name) SELECT $1, $2, $3, $4 WHERE false;`
Real:
```sql
-- name: UpsertTelegramContact :exec
-- Phones that are not users yet are stored too (no foreign key on purpose).
INSERT INTO telegram_contacts (chat_id, phone, username, first_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (chat_id) DO UPDATE
SET phone = EXCLUDED.phone,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    updated_at = now();
```
RED: `no rows in result set`.

---

### Task 7: Hujjatlar

- [ ] `docs/superpowers/specs/2026-10-02-hisob24-design.md` ga "2-bosqich qarorlari" bo'limi qo'shiladi:
  - 4 ta foydalanuvchi qarori.
  - `CURRENT_DATE` DB sessiyasining TimeZone sozlamasiga bog'liq. Lokal muhitda `Asia/Tashkent`; prod uchun README'da (8-bosqich) eslatiladi.
- [ ] Commit: `docs: stage 2 decisions`

---

### Task 8: Bosqich tekshiruvi

- [ ] `make migrate` → `OK 00001_init.sql`; `make migrate-status` → `Applied`.
- [ ] `psql "$DATABASE_URL" -c "SELECT * FROM admins"` → `461603558 | Owner | t`.
- [ ] Round-trip: `make migrate-down && make migrate` (dev DB bo'sh).
- [ ] `make sqlc && git diff --exit-code backend/internal/db/gen` → diff yo'q.
- [ ] `make lint` (exit 0), `make test` (exit 0), `GOTEST -count=1 ./...`.
- [ ] `psql "$TEST_DATABASE_URL" -tAc "SELECT datname FROM pg_database WHERE starts_with(datname, 'hisob24_it_')"` → faqat joriy template qoladi.
- [ ] `./start.sh` qisqa smoke: migratsiya `no migrations to run`, `/healthz` 200, to'xtatish.
- [ ] `git push origin main`, so'ng hisobot va tasdiq kutiladi.
