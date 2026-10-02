# 1-bosqich: Skelet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo skeleti tayyorlanadi: Go API (`/healthz`), ikkita Next.js ilova (shadcn bilan), `packages/api-client`, `Makefile`, `start.sh`. Natijada `make dev` Postgres, API va ikkala frontendni ishga tushiradi.

**Architecture:**
- `backend/` alohida Go modul: `config` → `httpx` (router + JSON helperlar) → `cmd/api`.
- `apps/admin` (:3001) va `apps/web` (:3000) — Next 16 ilovalar. Ular `/api/*` ni `API_URL` ga rewrite qiladi.
- `packages/api-client` `backend/openapi.yaml` dan generatsiya qilinadi.
- Lokal Postgres — Homebrew `postgresql@17`. `scripts/ensure-db.sh` rol va DB'ni idempotent yaratadi.

**Tech Stack:**
- Backend: Go 1.27.1, chi v5.3.2, pgx v5.11.0, testify.
- Frontend: Next 16.3.8, React 19.2, Tailwind v4, shadcn 4.21.1 (`base-nova`, Base UI), Vitest 5 + RTL 16 + jsdom.
- API client: openapi-typescript 7.13, openapi-fetch 0.17.
- Toollar (`backend/bin`): goose v3.28.0, sqlc v1.31.1, golangci-lint v2.14.0.

**Manbalar:** `docs/SPEC.md`, `docs/superpowers/specs/2026-10-02-hisob24-design.md`, `CLAUDE.md`.

**Trial'da tekshirilgan faktlar** (scratchpad, 2026-10-02):
- `create-next-app@16.3.8` uchun flaglar: `--empty --no-agents-md --no-react-compiler --skip-install --disable-git`. Ilova ichida `pnpm-workspace.yaml` yaratadi, uni o'chirish kerak.
- `shadcn@4.21.1 init -d --no-monorepo`:
  - `components.json`, `components/ui/button.tsx`, `lib/utils.ts` (`cn` paketi) yaratadi.
  - Geist font qo'shadi.
  - Bog'liqliklar: `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css`.
- Vitest 5 vite 8'ni peer sifatida oladi.
  - `resolve.tsconfigPaths: true` native ishlaydi, `vite-tsconfig-paths` plugini kerak emas.
  - `@types/node` ^22 yoki >=24 bo'lishi kerak (scaffold'da ^20 turibdi, ^24 ga o'zgartiriladi).
- `@testing-library/jest-dom` v7 `./vitest` entry'ni eksport qiladi.
- `next typegen && tsc --noEmit` va `eslint` scaffold'da toza o'tadi.
- openapi-fetch Node'da nisbiy baseUrl'ni (`/api`) qabul qilmaydi (`ERR_INVALID_URL`).
  - Shuning uchun testda absolute baseUrl ishlatiladi.
  - `fetch` option turi `(input: Request) => Promise<Response>`.

**TDD jurnali:** har RED va GREEN chiqishi `$SCRATCH/tdd-log.md` ga yoziladi. Bosqich hisoboti shu jurnaldan tuziladi.
`SCRATCH=/private/tmp/claude-501/-Users-salikhov-id-www-hisob24/9bc37ee1-bcd8-434d-9d4b-b765a859464e/scratchpad`

---

## Fayl tuzilmasi (1-bosqich)

| Fayl | Mas'uliyat |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig`, `.nvmrc` | Monorepo root |
| `backend/go.mod` | Go modul `github.com/SalikhovID/hisob24/backend` |
| `backend/internal/config/config.go` (+`_test`) | Env'dan `Config`: default qiymatlar va validatsiya |
| `backend/internal/httpx/json.go` (+`_test`) | `JSON`, `Error`, `ErrorBody` |
| `backend/internal/httpx/router.go` (+`_test`) | `NewRouter()`, `/healthz` |
| `backend/cmd/api/main.go` | Wiring: config, pgxpool ping, HTTP server, graceful shutdown |
| `backend/.air.toml`, `backend/.golangci.yml`, `backend/openapi.yaml` | Hot reload, lint va API kontrakt |
| `apps/admin/*`, `apps/web/*` | Next 16 + shadcn + Vitest, placeholder sahifa |
| `packages/api-client/*` | `schema.d.ts` (generatsiya) + `createApiClient` |
| `.env.example`, `docker-compose.yml`, `scripts/ensure-db.sh`, `Makefile`, `start.sh` | Lokal muhit |

---

### Task 1: Monorepo root fayllari

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig`, `.nvmrc`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "hisob24",
  "private": true,
  "packageManager": "pnpm@10.24.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test"
  }
}
```

- [ ] **Step 2: `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*

# Same as the create-next-app template: these ship prebuilt binaries.
ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

- [ ] **Step 3: `.gitignore`**

```gitignore
# dependencies
node_modules/

# env (only the example is committed)
.env
.env.*
!.env.example

# next.js
.next/
out/
next-env.d.ts
*.tsbuildinfo

# go
backend/bin/
backend/tmp/

# tests
coverage/
playwright-report/
test-results/

# misc
.DS_Store
*.log
*.pem
.idea/
.vscode/
```

- [ ] **Step 4: `.editorconfig` va `.nvmrc`**

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.go]
indent_style = tab

[Makefile]
indent_style = tab
```

`.nvmrc`:
```
24
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .editorconfig .nvmrc
git commit -m "chore: pnpm monorepo root"
```

---

### Task 2: Go modul

**Files:** Create `backend/go.mod`

- [ ] **Step 1: Modulni yaratish**

```bash
mkdir -p backend && cd backend
go mod init github.com/SalikhovID/hisob24/backend
go mod edit -go=1.27.1
go get github.com/stretchr/testify@latest
```
Expected: `go.mod` faylida `go 1.27.1` va `require github.com/stretchr/testify` paydo bo'ladi.

(Commit Task 3'ning birinchi GREEN'i bilan birga qilinadi: hozircha modulda kod yo'q.)

---

### Task 3: `config.Load` (TDD, 5 sikl)

**Files:** Create `backend/internal/config/config.go`, `backend/internal/config/config_test.go`

- [ ] **Step 1 (sikl 1, RED): defaultlar va har bir kalitni o'qish testi**

`backend/internal/config/config_test.go`:
```go
package config

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    Config
		wantErr []string // every substring must appear in the error
	}{
		{
			name: "defaults for optional keys",
			env:  requiredEnv(),
			want: Config{
				DatabaseURL:   "postgres://localhost/hisob24",
				HTTPAddr:      ":8080",
				BotMode:       "polling",
				OTPHMACSecret: "otp-secret",
				JWTSecret:     "jwt-secret",
				CookieSecure:  true,
				SMSDriver:     "log",
				EskizFrom:     "4546",
			},
		},
		{
			name: "every key is read",
			env: with(requiredEnv(), map[string]string{
				"HTTP_ADDR":               ":9090",
				"ADMIN_BOT_TOKEN":         "admin-token",
				"USER_BOT_TOKEN":          "user-token",
				"BOT_MODE":                "webhook",
				"TELEGRAM_WEBHOOK_SECRET": "hook-secret",
				"PUBLIC_API_URL":          "https://api.example.uz",
				"ADMIN_PANEL_URL":         "https://admin.example.uz",
				"SMS_DRIVER":              "eskiz",
				"ESKIZ_EMAIL":             "sms@example.uz",
				"ESKIZ_PASSWORD":          "eskiz-pass",
				"ESKIZ_FROM":              "4545",
			}),
			want: Config{
				DatabaseURL:           "postgres://localhost/hisob24",
				HTTPAddr:              ":9090",
				AdminBotToken:         "admin-token",
				UserBotToken:          "user-token",
				BotMode:               "webhook",
				TelegramWebhookSecret: "hook-secret",
				PublicAPIURL:          "https://api.example.uz",
				AdminPanelURL:         "https://admin.example.uz",
				OTPHMACSecret:         "otp-secret",
				JWTSecret:             "jwt-secret",
				CookieSecure:          true,
				SMSDriver:             "eskiz",
				EskizEmail:            "sms@example.uz",
				EskizPassword:         "eskiz-pass",
				EskizFrom:             "4545",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(func(key string) string { return tt.env[key] })

			if len(tt.wantErr) > 0 {
				require.Error(t, err)
				for _, s := range tt.wantErr {
					assert.ErrorContains(t, err, s)
				}
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func requiredEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":    "postgres://localhost/hisob24",
		"OTP_HMAC_SECRET": "otp-secret",
		"JWT_SECRET":      "jwt-secret",
	}
}

func with(base, extra map[string]string) map[string]string {
	out := maps.Clone(base)
	maps.Copy(out, extra)
	return out
}
```

Stub `backend/internal/config/config.go`:
```go
// Package config reads the API process settings from the environment.
package config

import "errors"

// Config holds every setting the API process reads from the environment.
type Config struct {
	DatabaseURL           string
	HTTPAddr              string
	AdminBotToken         string
	UserBotToken          string
	BotMode               string
	TelegramWebhookSecret string
	PublicAPIURL          string
	AdminPanelURL         string
	OTPHMACSecret         string
	JWTSecret             string
	CookieSecure          bool
	SMSDriver             string
	EskizEmail            string
	EskizPassword         string
	EskizFrom             string
}

// Load builds a Config from getenv (os.Getenv in main).
func Load(getenv func(string) string) (Config, error) {
	return Config{}, errors.New("not implemented")
}
```

- [ ] **Step 2: RED ishga tushirish**

Run: `cd backend && go test ./internal/config/ 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: FAIL. Ikkala subtest `Received unexpected error: not implemented` bilan yiqiladi (kompilyatsiya xatosi emas).

- [ ] **Step 3 (GREEN): o'qish va defaultlar**

`Load` ni almashtirish (`errors` importini olib tashlash):
```go
// Load builds a Config from getenv (os.Getenv in main). Optional keys fall
// back to their defaults.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL:           getenv("DATABASE_URL"),
		HTTPAddr:              orDefault(getenv("HTTP_ADDR"), ":8080"),
		AdminBotToken:         getenv("ADMIN_BOT_TOKEN"),
		UserBotToken:          getenv("USER_BOT_TOKEN"),
		BotMode:               orDefault(getenv("BOT_MODE"), "polling"),
		TelegramWebhookSecret: getenv("TELEGRAM_WEBHOOK_SECRET"),
		PublicAPIURL:          getenv("PUBLIC_API_URL"),
		AdminPanelURL:         getenv("ADMIN_PANEL_URL"),
		OTPHMACSecret:         getenv("OTP_HMAC_SECRET"),
		JWTSecret:             getenv("JWT_SECRET"),
		CookieSecure:          true,
		SMSDriver:             orDefault(getenv("SMS_DRIVER"), "log"),
		EskizEmail:            getenv("ESKIZ_EMAIL"),
		EskizPassword:         getenv("ESKIZ_PASSWORD"),
		EskizFrom:             orDefault(getenv("ESKIZ_FROM"), "4546"),
	}
	return cfg, nil
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
```

- [ ] **Step 4: GREEN ishga tushirish**

Run: `cd backend && go test ./internal/config/ 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: `ok  github.com/SalikhovID/hisob24/backend/internal/config`

- [ ] **Step 5: Commit**

```bash
git add backend/go.mod backend/go.sum backend/internal/config
git commit -m "feat(config): read API settings from env with defaults"
```

- [ ] **Step 6 (sikl 2, RED): majburiy kalitlar**

`tests` slice'ga qo'shish:
```go
		{
			name:    "missing required keys are all reported",
			env:     map[string]string{},
			wantErr: []string{"DATABASE_URL", "OTP_HMAC_SECRET", "JWT_SECRET"},
		},
```
Run: `cd backend && go test ./internal/config/ 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: FAIL `missing_required_keys_are_all_reported`: `An error is expected but got nil.`

- [ ] **Step 7 (GREEN): majburiy kalitlar tekshiruvi**

`config.go` importlari: `"errors"`, `"fmt"`. `return cfg, nil` dan oldin:
```go
	var errs []error
	for _, req := range []struct{ key, val string }{
		{"DATABASE_URL", cfg.DatabaseURL},
		{"OTP_HMAC_SECRET", cfg.OTPHMACSecret},
		{"JWT_SECRET", cfg.JWTSecret},
	} {
		if req.val == "" {
			errs = append(errs, fmt.Errorf("%s is required", req.key))
		}
	}
	if len(errs) > 0 {
		return Config{}, fmt.Errorf("config: %w", errors.Join(errs...))
	}
```
Run: `cd backend && go test ./internal/config/ 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: `ok`

- [ ] **Step 8: Commit** — `git commit -am "feat(config): report every missing required key"`

- [ ] **Step 9 (sikl 3, RED): `BOT_MODE` validatsiyasi**

```go
		{
			name:    "unknown BOT_MODE",
			env:     with(requiredEnv(), map[string]string{"BOT_MODE": "hook"}),
			wantErr: []string{"BOT_MODE", `"hook"`},
		},
```
Run: `go test ./internal/config/` → FAIL `An error is expected but got nil.`

- [ ] **Step 10 (GREEN)** — `if len(errs) > 0` dan oldin:
```go
	if cfg.BotMode != "polling" && cfg.BotMode != "webhook" {
		errs = append(errs, fmt.Errorf("BOT_MODE must be polling or webhook, got %q", cfg.BotMode))
	}
```
Run → `ok`. Commit: `feat(config): BOT_MODE is polling or webhook`

- [ ] **Step 11 (sikl 4, RED): `SMS_DRIVER` validatsiyasi**

```go
		{
			name:    "unknown SMS_DRIVER",
			env:     with(requiredEnv(), map[string]string{"SMS_DRIVER": "sms"}),
			wantErr: []string{"SMS_DRIVER", `"sms"`},
		},
```
Run → FAIL `An error is expected but got nil.`

- [ ] **Step 12 (GREEN)**
```go
	if cfg.SMSDriver != "log" && cfg.SMSDriver != "eskiz" {
		errs = append(errs, fmt.Errorf("SMS_DRIVER must be log or eskiz, got %q", cfg.SMSDriver))
	}
```
Run → `ok`. Commit: `feat(config): SMS_DRIVER is log or eskiz`

- [ ] **Step 13 (sikl 5, RED): `COOKIE_SECURE`**

```go
		{
			name: "COOKIE_SECURE=false turns Secure cookies off",
			env:  with(requiredEnv(), map[string]string{"COOKIE_SECURE": "false"}),
			want: Config{
				DatabaseURL:   "postgres://localhost/hisob24",
				HTTPAddr:      ":8080",
				BotMode:       "polling",
				OTPHMACSecret: "otp-secret",
				JWTSecret:     "jwt-secret",
				CookieSecure:  false,
				SMSDriver:     "log",
				EskizFrom:     "4546",
			},
		},
		{
			name:    "COOKIE_SECURE must be a boolean",
			env:     with(requiredEnv(), map[string]string{"COOKIE_SECURE": "maybe"}),
			wantErr: []string{"COOKIE_SECURE", `"maybe"`},
		},
```
Run → FAIL: birinchisi `CookieSecure: true` (kutilgan false), ikkinchisi `An error is expected but got nil.`

- [ ] **Step 14 (GREEN)** — `"strconv"` importi bilan:
```go
	if v := getenv("COOKIE_SECURE"); v != "" {
		secure, err := strconv.ParseBool(v)
		if err != nil {
			errs = append(errs, fmt.Errorf("COOKIE_SECURE must be true or false, got %q", v))
		} else {
			cfg.CookieSecure = secure
		}
	}
```
Run: `cd backend && go test ./... ` → `ok`. Commit: `feat(config): COOKIE_SECURE switches the Secure cookie flag`

---

### Task 4: `httpx.JSON` (TDD)

**Files:** Create `backend/internal/httpx/json.go`, `backend/internal/httpx/json_test.go`

- [ ] **Step 1 (RED)**

`json_test.go`:
```go
package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestJSON(t *testing.T) {
	rec := httptest.NewRecorder()

	JSON(rec, http.StatusCreated, map[string]int{"id": 7})

	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"id":7}`, rec.Body.String())
}
```
Stub `json.go`:
```go
// Package httpx holds the HTTP router and the JSON response helpers.
package httpx

import "net/http"

// JSON writes v as the JSON response body with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {}
```
Run: `cd backend && go test ./internal/httpx/` → FAIL: `expected: 201 actual: 200`, Content-Type bo'sh.

- [ ] **Step 2 (GREEN)**
```go
import (
	"encoding/json"
	"net/http"
)

// JSON writes v as the JSON response body with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
```
Run → `ok`. Commit: `feat(httpx): JSON response helper`

---

### Task 5: `httpx.Error` (TDD)

**Files:** Modify `backend/internal/httpx/json.go`, `backend/internal/httpx/json_test.go`

- [ ] **Step 1 (RED)**

Testga qo'shish:
```go
func TestError(t *testing.T) {
	rec := httptest.NewRecorder()

	Error(rec, http.StatusTooManyRequests, "too_many_requests", "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring")

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.JSONEq(t,
		`{"error":"too_many_requests","message":"Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring"}`,
		rec.Body.String())
}
```
Stub (`json.go` ga):
```go
// ErrorBody is the API error format from the spec:
// {"error": "<snake_case code>", "message": "<Uzbek text>"}.
type ErrorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Error writes an API error with the given status, code and Uzbek message.
func Error(w http.ResponseWriter, status int, code, message string) {}
```
Run → FAIL `expected: 429 actual: 200`.

- [ ] **Step 2 (GREEN)**
```go
func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorBody{Error: code, Message: message})
}
```
Run → `ok`. Commit: `feat(httpx): API error helper in the spec format`

---

### Task 6: `/healthz` (TDD)

**Files:** Create `backend/internal/httpx/router.go`, `backend/internal/httpx/router_test.go`

- [ ] **Step 1 (RED)**

```bash
cd backend && go get github.com/go-chi/chi/v5@v5.3.2
```
`router_test.go`:
```go
package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/healthz", nil)

	NewRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
}
```
Stub `router.go`:
```go
package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// NewRouter builds the API router.
func NewRouter() http.Handler {
	return chi.NewRouter()
}
```
Run → FAIL `expected: 200 actual: 404`.

- [ ] **Step 2 (GREEN)**
```go
// NewRouter builds the API router.
func NewRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/healthz", healthz)
	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```
Run: `go test ./...` → `ok`. Commit: `feat(httpx): GET /healthz`

---

### Task 7: `cmd/api`, air, golangci, openapi

**Files:** Create `backend/cmd/api/main.go`, `backend/.air.toml`, `backend/.golangci.yml`, `backend/openapi.yaml`

- [ ] **Step 1: `cmd/api/main.go`** (wiring, unit test qilinmaydi; `make dev` bilan tekshiriladi)

```bash
cd backend && go get github.com/jackc/pgx/v5@v5.11.0
```
```go
// Command api runs the Hisob24 HTTP API. The Telegram bots join this process
// in later stages.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/config"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpx.NewRouter(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("api listening", "addr", cfg.HTTPAddr)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve http: %w", err)
	case <-ctx.Done():
	}

	slog.Info("api shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown http: %w", err)
	}
	return nil
}
```
Run: `cd backend && go build ./... && go vet ./...`. Expected: chiqish bo'sh.

- [ ] **Step 2: `.air.toml`**
```toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/api ./cmd/api"
  bin = "./tmp/api"
  delay = 500
  exclude_dir = ["tmp", "bin"]
  exclude_regex = ["_test.go"]
  include_ext = ["go", "sql"]
  kill_delay = "5s"
  send_interrupt = true
  stop_on_error = true

[log]
  time = false

[misc]
  clean_on_exit = true
```

- [ ] **Step 3: `.golangci.yml`**
```yaml
version: "2"

linters:
  default: standard
  enable:
    - bodyclose
    - errorlint
    - misspell
    - noctx
    - unconvert
    - usestdlibvars

formatters:
  enable:
    - gofmt
    - goimports
  settings:
    goimports:
      local-prefixes:
        - github.com/SalikhovID/hisob24
```

- [ ] **Step 4: `openapi.yaml`**
```yaml
openapi: 3.1.0
info:
  title: Hisob24 API
  version: 0.1.0
  description: >
    Asosiy API kontrakti. Frontend uchun TS client shu fayldan generatsiya
    qilinadi (packages/api-client). Brauzer API'ga Next.js rewrites orqali
    /api prefiksi bilan murojaat qiladi.
paths:
  /healthz:
    get:
      operationId: getHealthz
      summary: Liveness tekshiruvi
      responses:
        "200":
          description: API ishlayapti
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Health"
components:
  schemas:
    Health:
      type: object
      required: [status]
      properties:
        status:
          type: string
          enum: [ok]
```

- [ ] **Step 5: Commit**
```bash
git add backend
git commit -m "feat(api): HTTP server with graceful shutdown, air, golangci and openapi"
```

---

### Task 8: `apps/admin` — Next 16 + shadcn + Vitest

**Files:** Create `apps/admin/**`

- [ ] **Step 1: Scaffold**
```bash
cd /Users/salikhov_id/www/hisob24
pnpm dlx create-next-app@16.3.8 apps/admin --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --disable-git --empty --no-agents-md --no-react-compiler --yes
rm -f apps/admin/pnpm-workspace.yaml apps/admin/.gitignore apps/admin/README.md
```

- [ ] **Step 2: `package.json`: nom, skriptlar, `@types/node`**
```bash
node -e '
const fs=require("fs");const p="apps/admin/package.json";const j=JSON.parse(fs.readFileSync(p));
j.name="@hisob24/admin";delete j.packageManager;
j.scripts={dev:"next dev -p 3001",build:"next build",start:"next start -p 3001",lint:"eslint",typecheck:"next typegen && tsc --noEmit",test:"vitest run"};
j.devDependencies["@types/node"]="^24";
fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");'
pnpm install
```

- [ ] **Step 3: shadcn va Vitest**
```bash
pnpm dlx shadcn@4.21.1 init -d --no-monorepo -c apps/admin
pnpm --filter @hisob24/admin add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```
`apps/admin/vitest.config.mts`:
```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
```
`apps/admin/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: `next.config.ts`: rewrites**
```ts
import type { NextConfig } from "next"

// The browser and the Telegram WebView reach the Go API through this origin:
// /api/* is proxied to API_URL, so cookies stay first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }]
  },
}

export default nextConfig
```

- [ ] **Step 5: `app/layout.tsx`: til va metadata**

shadcn qo'shgan Geist importlari saqlanadi. `metadata` va `lang` o'zgaradi:
```tsx
export const metadata: Metadata = {
  title: "Hisob24 Admin",
  description: "Hisob24 platforma admin paneli",
}
```
`<html lang="en" ...>` → `<html lang="uz" ...>`

- [ ] **Step 6 (RED): placeholder sahifa testi**

`apps/admin/app/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import Home from "./page"

test("bosh sahifa ilova nomini ko'rsatadi", () => {
  render(<Home />)

  expect(screen.getByRole("heading", { name: "Hisob24 Admin" })).toBeInTheDocument()
})
```
Run: `pnpm --filter @hisob24/admin test 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: FAIL `Unable to find an accessible element with the role "heading" and name "Hisob24 Admin"` (scaffold `Hello world!` ko'rsatadi).

- [ ] **Step 7 (GREEN)**

`apps/admin/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <h1 className="text-2xl font-semibold">Hisob24 Admin</h1>
    </main>
  )
}
```
Run: `pnpm --filter @hisob24/admin test` → `1 passed`

- [ ] **Step 8: lint va typecheck**

Run: `pnpm --filter @hisob24/admin lint && pnpm --filter @hisob24/admin typecheck`. Expected: xato yo'q.

- [ ] **Step 9: Commit**
```bash
git add apps/admin pnpm-lock.yaml
git commit -m "feat(admin): Next 16 app with shadcn, Vitest and the /api rewrite"
```

---

### Task 9: `apps/web` — Next 16 + shadcn + Vitest

**Files:** Create `apps/web/**`

- [ ] **Step 1: Scaffold**
```bash
pnpm dlx create-next-app@16.3.8 apps/web --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --disable-git --empty --no-agents-md --no-react-compiler --yes
rm -f apps/web/pnpm-workspace.yaml apps/web/.gitignore apps/web/README.md
```

- [ ] **Step 2: `package.json`**
```bash
node -e '
const fs=require("fs");const p="apps/web/package.json";const j=JSON.parse(fs.readFileSync(p));
j.name="@hisob24/web";delete j.packageManager;
j.scripts={dev:"next dev -p 3000",build:"next build",start:"next start -p 3000",lint:"eslint",typecheck:"next typegen && tsc --noEmit",test:"vitest run"};
j.devDependencies["@types/node"]="^24";
fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");'
pnpm install
```

- [ ] **Step 3: shadcn va Vitest**
```bash
pnpm dlx shadcn@4.21.1 init -d --no-monorepo -c apps/web
pnpm --filter @hisob24/web add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```
`apps/web/vitest.config.mts`:
```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
```
`apps/web/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: `next.config.ts`**
```ts
import type { NextConfig } from "next"

// The browser reaches the Go API through this origin: /api/* is proxied to
// API_URL, so the refresh_token cookie stays first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }]
  },
}

export default nextConfig
```

- [ ] **Step 5: `app/layout.tsx`**
```tsx
export const metadata: Metadata = {
  title: "Hisob24",
  description: "Hisob24 — biznesingiz uchun hisob tizimi",
}
```
`lang="en"` → `lang="uz"`

- [ ] **Step 6 (RED)**

`apps/web/app/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import Home from "./page"

test("bosh sahifa ilova nomini ko'rsatadi", () => {
  render(<Home />)

  expect(screen.getByRole("heading", { name: "Hisob24" })).toBeInTheDocument()
})
```
Run: `pnpm --filter @hisob24/web test 2>&1 | tee -a $SCRATCH/tdd-log.md`
Expected: FAIL `Unable to find an accessible element with the role "heading" and name "Hisob24"`

- [ ] **Step 7 (GREEN)**

`apps/web/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <h1 className="text-2xl font-semibold">Hisob24</h1>
    </main>
  )
}
```
Run → `1 passed`. Keyin `pnpm --filter @hisob24/web lint && pnpm --filter @hisob24/web typecheck`.

- [ ] **Step 8: Commit** — `feat(web): Next 16 app with shadcn, Vitest and the /api rewrite`

---

### Task 10: `packages/api-client` (TDD)

**Files:** Create `packages/api-client/{package.json,tsconfig.json,src/index.ts,src/index.test.ts,src/schema.d.ts}`

- [ ] **Step 1: Paket**

`packages/api-client/package.json`:
```json
{
  "name": "@hisob24/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "generate": "openapi-typescript ../../backend/openapi.yaml -o src/schema.d.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```
`packages/api-client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```
```bash
pnpm --filter @hisob24/api-client add openapi-fetch@^0.17.0
pnpm --filter @hisob24/api-client add -D openapi-typescript@^7.13.0 typescript@^5 vitest@^5 @types/node@^24
pnpm --filter @hisob24/api-client generate
```
Expected: `src/schema.d.ts` yaratiladi (`/healthz` va `Health` bilan).

- [ ] **Step 2 (RED)**

`src/index.test.ts`:
```ts
import { expect, test, vi } from "vitest"
import { createApiClient } from "./index"

test("so'rovni baseUrl ostidagi yo'lga yuboradi va JSON javobni qaytaradi", async () => {
  const fetchMock = vi.fn(
    async (_request: Request) =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  )
  const client = createApiClient("http://localhost:3001/api", fetchMock)

  const { data } = await client.GET("/healthz")

  expect(data).toEqual({ status: "ok" })
  expect(fetchMock.mock.calls[0][0].url).toBe("http://localhost:3001/api/healthz")
})
```
Stub `src/index.ts`:
```ts
import createClient from "openapi-fetch"
import type { paths } from "./schema"

export type { components, paths } from "./schema"

// createApiClient returns a typed client for the Go API. In the browser the
// API sits behind the Next.js rewrite on the same origin, hence "/api".
export function createApiClient(
  baseUrl = "/api",
  fetchImpl?: (input: Request) => Promise<Response>,
): ReturnType<typeof createClient<paths>> {
  throw new Error("not implemented")
}
```
Run: `pnpm --filter @hisob24/api-client test 2>&1 | tee -a $SCRATCH/tdd-log.md` → FAIL `Error: not implemented`.

- [ ] **Step 3 (GREEN)**
```ts
export function createApiClient(
  baseUrl = "/api",
  fetchImpl?: (input: Request) => Promise<Response>,
) {
  return createClient<paths>({ baseUrl, fetch: fetchImpl })
}
```
Run → `1 passed`. Keyin `pnpm --filter @hisob24/api-client typecheck` toza o'tishi kerak.

- [ ] **Step 4: Commit** — `feat(api-client): typed client generated from openapi.yaml`

---

### Task 11: Lokal muhit: `.env.example`, `docker-compose.yml`, `ensure-db.sh`, `Makefile`, `start.sh`

**Files:** Create `.env.example`, `docker-compose.yml`, `scripts/ensure-db.sh`, `Makefile`, `start.sh`

- [ ] **Step 1: `.env.example`**
```dotenv
# Lokal Homebrew Postgres: rol va DB'ni `make db` yaratadi.
DATABASE_URL=postgres://hisob24:hisob24@localhost:5432/hisob24?sslmode=disable
# Integration testlar shu ulanish orqali vaqtinchalik hisob24_it_* DB'lar ochadi.
TEST_DATABASE_URL=postgres://hisob24:hisob24@localhost:5432/postgres?sslmode=disable
HTTP_ADDR=:8080
# Next.js rewrites: /api/* shu manzilga proksi qilinadi.
API_URL=http://localhost:8080
# Cookie Secure atributi; start.sh http://localhost uchun false qiladi.
COOKIE_SECURE=true
ADMIN_BOT_TOKEN=
# Admin login sahifasidagi bot havolasi (@ belgisiz).
ADMIN_BOT_USERNAME=
USER_BOT_TOKEN=
BOT_MODE=polling
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_API_URL=
ADMIN_PANEL_URL=
OTP_HMAC_SECRET=
JWT_SECRET=
SMS_DRIVER=log
ESKIZ_EMAIL=
ESKIZ_PASSWORD=
ESKIZ_FROM=4546
```

- [ ] **Step 2: `docker-compose.yml`**
```yaml
# Ixtiyoriy: Docker bor mashinalar uchun. Lokal ish Homebrew Postgres bilan
# (start.sh). Bu konteyner ham 5432 portini oladi, shuning uchun ishga
# tushirishdan oldin brew'dagi Postgres to'xtatilishi kerak.
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: hisob24
      POSTGRES_PASSWORD: hisob24
      POSTGRES_DB: hisob24
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hisob24 -d hisob24"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

- [ ] **Step 3: `scripts/ensure-db.sh`** (`chmod +x`)
```bash
#!/usr/bin/env bash
# Ensures the role and database named in DATABASE_URL exist on the local
# Postgres, and that the role may create databases (integration tests clone
# hisob24_it_* databases). Idempotent. Creating them needs a superuser:
# Homebrew Postgres makes the OS user one, so psql connects as that user.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
: "${DATABASE_URL:?DATABASE_URL is not set: copy .env.example to .env}"

ready=$(psql "$DATABASE_URL" -qtAX -c "SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user" 2>/dev/null || true)
if [[ "$ready" == "t" ]]; then
  exit 0
fi

# postgres://user[:password]@host[:port]/dbname[?params]
rest="${DATABASE_URL#*://}"
userinfo="${rest%%@*}"
rest="${rest#*@}"
hostport="${rest%%/*}"
db_name="${rest#*/}"
db_name="${db_name%%\?*}"
db_user="${userinfo%%:*}"
db_pass=""
[[ "$userinfo" == *:* ]] && db_pass="${userinfo#*:}"
db_host="${hostport%%:*}"
db_port="5432"
[[ "$hostport" == *:* ]] && db_port="${hostport##*:}"

admin_psql() {
  psql -h "$db_host" -p "$db_port" -d postgres -v ON_ERROR_STOP=1 -qtAX "$@"
}

if [[ "$(admin_psql -c "SELECT 1 FROM pg_roles WHERE rolname = '$db_user'")" != "1" ]]; then
  echo "[db] creating role $db_user"
  if [[ -n "$db_pass" ]]; then
    admin_psql -c "CREATE ROLE \"$db_user\" LOGIN CREATEDB PASSWORD '$db_pass'"
  else
    admin_psql -c "CREATE ROLE \"$db_user\" LOGIN CREATEDB"
  fi
else
  admin_psql -c "ALTER ROLE \"$db_user\" CREATEDB"
fi

if [[ "$(admin_psql -c "SELECT 1 FROM pg_database WHERE datname = '$db_name'")" != "1" ]]; then
  echo "[db] creating database $db_name"
  admin_psql -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\""
fi

psql "$DATABASE_URL" -qtAX -c "SELECT 1" >/dev/null
echo "[db] $db_user@$db_host:$db_port/$db_name is ready"
```

- [ ] **Step 4: `Makefile`**
```make
SHELL := /bin/bash

-include .env
export

BACKEND := backend
BIN := $(CURDIR)/$(BACKEND)/bin

GOOSE_VERSION := v3.28.0
SQLC_VERSION := v1.31.1
GOLANGCI_VERSION := v2.14.0

GOOSE := $(BIN)/goose
SQLC := $(BIN)/sqlc
GOLANGCI := $(BIN)/golangci-lint

.PHONY: dev db tools migrate migrate-down migrate-status migrate-create sqlc \
	test test-go test-web lint lint-go lint-web api-client

dev:
	./start.sh

db:
	./scripts/ensure-db.sh

tools: $(GOOSE) $(SQLC) $(GOLANGCI)

$(GOOSE):
	GOBIN=$(BIN) go install github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION)

$(SQLC):
	GOBIN=$(BIN) go install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION)

$(GOLANGCI):
	curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $(BIN) $(GOLANGCI_VERSION)

migrate: db $(GOOSE)
	@if ls $(BACKEND)/migrations/*.sql >/dev/null 2>&1; then \
		$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" up; \
	else \
		echo "[migrate] backend/migrations bo'sh: migratsiya yo'q"; \
	fi

migrate-down: $(GOOSE)
	$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" down

migrate-status: $(GOOSE)
	$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" status

migrate-create: $(GOOSE)
	@test -n "$(name)" || { echo "usage: make migrate-create name=<snake_case>"; exit 1; }
	$(GOOSE) -dir $(BACKEND)/migrations -s create $(name) sql

sqlc: $(SQLC)
	cd $(BACKEND) && $(SQLC) generate

test: test-go test-web

test-go: db
	cd $(BACKEND) && go test ./...

test-web:
	pnpm test

lint: lint-go lint-web

lint-go: $(GOLANGCI)
	cd $(BACKEND) && go vet ./... && $(GOLANGCI) run ./...

lint-web:
	pnpm lint && pnpm typecheck

api-client:
	pnpm --filter @hisob24/api-client generate
```
(`otp` target `cmd/otp` bilan birga 3-bosqichda qo'shiladi.)

- [ ] **Step 5: `start.sh`** (`chmod +x`)
```bash
#!/bin/bash
# ============================================================
#  hisob24 — lokal dev launcher
#  Postgres va hisob24 DB'ni tekshiradi, migratsiya qiladi,
#  keyin api + admin + web'ni rangli, prefiksli loglar bilan
#  ishga tushiradi. To'xtatish: Ctrl+C.
# ============================================================
set +e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

# Homebrew Postgres (psql, pg_isready), loyiha toollari va GOPATH/bin
export PATH="/opt/homebrew/opt/postgresql@17/bin:$ROOT_DIR/backend/bin:$PATH:$(go env GOPATH 2>/dev/null)/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 8080 -> api, 3001 -> admin, 3000 -> web
PORTS=(8080 3001 3000)

info() { printf "${CYAN}[start]${NC}  %s\n" "$1"; }

free_ports() {
  for port in "${PORTS[@]}"; do
    pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
      info "port $port bo'shatilmoqda (kill $pids)"
      kill $pids 2>/dev/null
    fi
  done
}

cleanup() {
  trap - SIGINT SIGTERM  # rekursiyaning oldini olish
  echo
  info "Hamma servislar to'xtatilmoqda…"
  # $! pipeline'da sed'ning PID'i, shuning uchun dev serverlar port orqali to'xtatiladi
  free_ports
  kill 0 2>/dev/null     # qolgan process-group (subshell, sed, air bolalari)
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- .env ---
if [ ! -f .env ]; then
  info ".env topilmadi: .env.example'dan yaratilmoqda, secretlar avtomatik to'ldiriladi"
  cp .env.example .env
  for key in OTP_HMAC_SECRET JWT_SECRET; do
    value=$(openssl rand -hex 32)
    tmp=$(mktemp)
    sed "s|^$key=\$|$key=$value|" .env > "$tmp" && mv "$tmp" .env
  done
fi
set -a
. ./.env
set +a
# http://localhost'da Secure cookie'ni ba'zi brauzerlar (Safari) saqlamaydi
export COOKIE_SECURE=false

free_ports

# --- Postgres ---
if ! pg_isready -h localhost -p 5432 -q; then
  info "Postgres ishlamayapti: brew service yoqilmoqda…"
  brew services start postgresql@17 >/dev/null 2>&1
  for _ in $(seq 1 30); do
    pg_isready -h localhost -p 5432 -q && break
    sleep 1
  done
fi
if ! pg_isready -h localhost -p 5432 -q; then
  info "XATO: Postgres ko'tarilmadi (localhost:5432)"
  exit 1
fi

make db || exit 1
make tools || exit 1
make migrate || exit 1
pnpm install || exit 1

# --- Servislar (rangli prefiks, har biri alohida) ---
if command -v air >/dev/null 2>&1; then
  API_CMD="air -c .air.toml"
else
  info "air topilmadi: 'go run ./cmd/api' (hot-reload yo'q)"
  API_CMD="go run ./cmd/api"
fi
(cd "$ROOT_DIR/backend" && $API_CMD 2>&1 | sed "s/^/$(printf "${RED}[api]${NC}    ")/") &
(pnpm --filter @hisob24/admin dev 2>&1 | sed "s/^/$(printf "${YELLOW}[admin]${NC}  ")/") &
(pnpm --filter @hisob24/web dev 2>&1 | sed "s/^/$(printf "${GREEN}[web]${NC}    ")/") &

printf "\n"
printf "  ${RED}api${NC}    -> http://localhost:8080/healthz\n"
printf "  ${YELLOW}admin${NC}  -> http://localhost:3001\n"
printf "  ${GREEN}web${NC}    -> http://localhost:3000\n"
printf "  ${CYAN}Ctrl+C${NC} — hammasini to'xtatadi.\n\n"

wait
```

- [ ] **Step 6: Commit**
```bash
chmod +x start.sh scripts/ensure-db.sh
git add .env.example docker-compose.yml scripts/ensure-db.sh Makefile start.sh
git commit -m "chore: local env, Makefile and start.sh"
```

---

### Task 12: Bosqich tekshiruvi, push, hisobot

- [ ] **Step 1: toollar va lint**
```bash
make tools
make lint
```
Expected: `go vet` toza, golangci-lint `0 issues.`, eslint toza, typecheck toza (3 paket).

- [ ] **Step 2: testlar**
```bash
make test
```
Expected: `make db` (`[db] hisob24@localhost:5432/hisob24 is ready` yoki jim), Go: `ok` (config, httpx), Vitest: admin 1, web 1, api-client 1 passed.

- [ ] **Step 3: `make dev` (fonda)**
```bash
./start.sh > $SCRATCH/start.log 2>&1 &   # PID saqlanadi
# portlar ochilguncha kutish (curl retry), keyin:
curl -fsS localhost:8080/healthz          # {"status":"ok"}
curl -fsS localhost:3001/api/healthz      # {"status":"ok"} (rewrite)
curl -fsS -o /dev/null -w '%{http_code}\n' localhost:3001   # 200
curl -fsS -o /dev/null -w '%{http_code}\n' localhost:3000   # 200
psql "postgres://hisob24:hisob24@localhost:5432/hisob24" -tAc "select current_database()"  # hisob24
kill -TERM <start.sh PID>; sleep 3
lsof -nP -iTCP:8080 -iTCP:3000 -iTCP:3001 -sTCP:LISTEN   # bo'sh
```

- [ ] **Step 4: Push**
```bash
git status --short   # toza
git push -u origin main
```

- [ ] **Step 5: Hisobot** — nima qilindi, tekshiruv natijalari, TDD jurnalidan RED→GREEN, keyin foydalanuvchi tasdig'i kutiladi.
