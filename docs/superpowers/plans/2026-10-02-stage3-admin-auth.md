# 3-bosqich: Admin auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adminlar ikki yo'l bilan kiradi:
1. Bot `/login` buyrug'iga OTP beradi → `POST /admin/auth/otp`.
2. Mini App `initData` yuboradi → `POST /admin/auth/telegram`.

Ikkalasi ham `admin_session` cookie (12 soat) ochadi. Shu bosqichda qo'shiladi: `/admin/me`, logout, IP rate limit, webhook secret tekshiruvi, menu button va `make otp`.

**Architecture:**
- `internal/auth`: kod generatsiyasi va HMAC, `ValidateInitData`, `AdminAuth` servisi (sqlc so'rovlari ustida).
- `internal/httpx`: router mount'lari, `ClientIP`, `RateLimiter`/`RateLimit`, `TelegramSecret`, `DecodeJSON`, `InternalError`.
- `internal/admin`: `/admin/*` handlerlari va session middleware.
- `internal/bot/adminbot`: update handler, `SetMenuButton`, `RegisterWebhook`. Telegram API `API` interfeysi orqali beriladi, testlarda fake ishlatiladi.
- `cmd/api` hammasini ulaydi. `cmd/otp` lokal dev uchun CLI.

**Tech Stack:** Go 1.27, chi, pgx v5, sqlc (2-bosqich so'rovlari), go-telegram/bot v1.27.0, testify, pgtest.

**Oldindan tekshirilgan faktlar (2026-10-02):**
- go-telegram/bot v1.27.0:
  - `New(token, ...Option)`, `Start(ctx)` (polling), `StartWebhook(ctx)`, `WebhookHandler()`.
  - `SendMessage(ctx, *SendMessageParams) (*models.Message, error)`.
  - `SetChatMenuButton(ctx, *SetChatMenuButtonParams) (bool, error)`, `SetWebhook(ctx, *SetWebhookParams) (bool, error)`.
  - `models.MenuButtonWebApp{Type, Text, WebApp: models.WebAppInfo{URL}}`, `models.ParseModeHTML`.
  - `WithDefaultHandler`, `WithErrorsHandler`.
  - Kutubxonaning `WebhookHandler` i noto'g'ri secret kelganda faqat log yozadi va **200 qaytaradi**. Shuning uchun 401 qaytaradigan o'z `TelegramSecret` middleware'imiz kerak.
- Next 16 rewrites:
  - Mijozning `X-Forwarded-For` ini o'zgarishsiz uzatadi. Header bo'lmasa, o'zi qo'shmaydi.
  - Go uchun `RemoteAddr` = 127.0.0.1.
  - Demak `ClientIP` = eng o'ngdagi loopback/private bo'lmagan XFF manzili. Bu faqat tashqi proksi (nginx `$proxy_add_x_forwarded_for`) IP qo'shganda ishonchli. Bu README'ga yoziladi.
- initData vektori: token `5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8`, hash `c501b71e…e2b2`. Telegram hujjatidagi algoritm bo'yicha mustaqil Python hisobi bilan tasdiqlandi.
- HMAC vektori: `printf '%s' 123456 | openssl dgst -sha256 -hmac test-otp-secret` = `4a7b809c723367f2500a1ba602464843b95f82215d47397e24058a5b8c2bd397`.

**Buyruqlar:**
- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test -count=1 <pkg> -run '^TestX$')`.
- `$SCRATCH/tdd2.sh red|green <pkg> <TestRegex> "<label>" ["commit msg"]`: test, TDD jurnali, GREEN'da `go test ./...` guard va commit. Guard yiqilsa, chiqish saqlanadi.

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `internal/config/config.go` | + webhook rejimi talablari |
| `internal/auth/code.go` | `NewCode`, `HashCode` |
| `internal/auth/initdata.go` | `ValidateInitData`, `WebAppUser`, xatolar |
| `internal/auth/admin_otp.go` | `AdminAuth`, `IsActiveAdmin`, `IssueLoginCode`, `DiscardLoginCode`, `LoginWithCode` |
| `internal/auth/admin_session.go` | `Session`, `LoginWithInitData`, `Authenticate`, `Logout` |
| `internal/testutil/telegramtest/initdata.go` | testlar uchun `SignInitData` |
| `internal/httpx/{clientip,ratelimit,secret,request}.go` | IP, limiter, webhook secret, `DecodeJSON`, `InternalError` |
| `internal/httpx/router.go` | `NewRouter(mounts ...func(chi.Router))` |
| `internal/admin/{handler,session}.go` | `/admin` routes, cookie, middleware |
| `internal/bot/adminbot/{handler,setup}.go` | update handler, menu button, webhook |
| `cmd/otp/main.go` | `make otp` |
| `cmd/api/main.go` | wiring |
| `openapi.yaml`, `packages/api-client/src/schema.d.ts` | auth endpointlari |
| `Makefile`, `CLAUDE.md`, dizayn hujjati | `otp` target, eslatmalar |

---

### Task 1: config — webhook rejimi talablari (1 sikl)

- [ ] RED (`config_test.go` jadvaliga):
```go
		{
			name:    "webhook mode needs the secret and the public URL",
			env:     with(requiredEnv(), map[string]string{"BOT_MODE": "webhook"}),
			wantErr: []string{"TELEGRAM_WEBHOOK_SECRET", "PUBLIC_API_URL"},
		},
```
→ FAIL `An error is expected but got nil.`
- [ ] GREEN (`SMS_DRIVER` tekshiruvidan keyin):
```go
	if cfg.BotMode == "webhook" {
		for _, req := range []struct{ key, val string }{
			{"TELEGRAM_WEBHOOK_SECRET", cfg.TelegramWebhookSecret},
			{"PUBLIC_API_URL", cfg.PublicAPIURL},
		} {
			if req.val == "" {
				errs = append(errs, fmt.Errorf("%s is required when BOT_MODE=webhook", req.key))
			}
		}
	}
```
Commit: `feat(config): webhook mode needs TELEGRAM_WEBHOOK_SECRET and PUBLIC_API_URL`

---

### Task 2: `auth.NewCode`, `auth.HashCode` (2 sikl)

`backend/internal/auth/code.go` (yakuniy):
```go
// Package auth logs people in: platform admins (bot codes, Mini App initData,
// sessions) and, later, company users.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
)

// NewCode draws a 6-digit one-time code, 000000-999999, from r
// (crypto/rand.Reader outside tests).
func NewCode(r io.Reader) (string, error) {
	n, err := rand.Int(r, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("draw code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HashCode is the form a one-time code is stored in:
// hex(HMAC-SHA256(code, secret)).
func HashCode(secret []byte, code string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
}
```
- [ ] **Sikl 1 NewCode** — test:
```go
func TestNewCode(t *testing.T) {
	t.Run("six digits", func(t *testing.T) {
		for range 100 {
			code, err := NewCode(rand.Reader)
			require.NoError(t, err)
			assert.Regexp(t, `^\d{6}$`, code)
		}
	})
	t.Run("zero padded", func(t *testing.T) {
		code, err := NewCode(bytes.NewReader(make([]byte, 64)))
		require.NoError(t, err)
		assert.Equal(t, "000000", code)
	})
}
```
Stub: `return "", errors.New("not implemented")`. RED: `not implemented`. Commit: `feat(auth): 6-digit one-time codes from crypto/rand`
- [ ] **Sikl 2 HashCode** — test:
```go
func TestHashCode(t *testing.T) {
	// printf '%s' 123456 | openssl dgst -sha256 -hmac test-otp-secret
	want := "4a7b809c723367f2500a1ba602464843b95f82215d47397e24058a5b8c2bd397"
	assert.Equal(t, want, HashCode([]byte("test-otp-secret"), "123456"))
}
```
Stub: `return ""`. RED: `expected: "4a7b…" actual: ""`. Commit: `feat(auth): codes are stored as HMAC-SHA256`

---

### Task 3: `auth.ValidateInitData` (3 sikl)

`backend/internal/auth/initdata.go` (yakuniy):
```go
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
)

// WebAppUser is the user object inside Mini App initData.
type WebAppUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
}

var (
	// ErrInvalidInitData means initData is malformed or not signed by the bot.
	ErrInvalidInitData = errors.New("invalid init data")
	// ErrInitDataExpired means the signature holds but auth_date is too old.
	ErrInitDataExpired = fmt.Errorf("%w: expired", ErrInvalidInitData)
)

// ValidateInitData checks Mini App initData the way Telegram documents it
// (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
// every field but hash, sorted by key and joined with "\n", must carry the
// HMAC-SHA256 under the key HMAC-SHA256("WebAppData", botToken), and
// auth_date may be at most maxAge old.
func ValidateInitData(initData, botToken string, maxAge time.Duration, now time.Time) (WebAppUser, error) {
	values, err := url.ParseQuery(initData)
	if err != nil || botToken == "" {
		return WebAppUser{}, ErrInvalidInitData
	}
	hash := values.Get("hash")
	values.Del("hash")
	lines := make([]string, 0, len(values))
	for _, key := range slices.Sorted(maps.Keys(values)) {
		lines = append(lines, key+"="+values.Get(key))
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(botToken))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	want, err := hex.DecodeString(hash)
	if err != nil || hash == "" || !hmac.Equal(mac.Sum(nil), want) {
		return WebAppUser{}, ErrInvalidInitData
	}

	authDate, err := strconv.ParseInt(values.Get("auth_date"), 10, 64)
	if err != nil {
		return WebAppUser{}, ErrInvalidInitData
	}
	if now.Sub(time.Unix(authDate, 0)) > maxAge {
		return WebAppUser{}, ErrInitDataExpired
	}

	var user WebAppUser
	if err := json.Unmarshal([]byte(values.Get("user")), &user); err != nil || user.ID == 0 {
		return WebAppUser{}, ErrInvalidInitData
	}
	return user, nil
}
```
Test konstantalari (`initdata_test.go`):
```go
// sampleToken and sampleInitData are the example of the telegram-mini-apps
// docs; the hash was re-computed with the algorithm from
// core.telegram.org/bots/webapps before it went in here.
const (
	sampleToken    = "5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8"
	sampleInitData = "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2"
)

var sampleSigned = time.Unix(1662771648, 0)
```
- [ ] **Sikl 1: namuna qabul qilinadi.** Test:
```go
func TestValidateInitDataAcceptsTheDocsSample(t *testing.T) {
	user, err := ValidateInitData(sampleInitData, sampleToken, 24*time.Hour, sampleSigned.Add(time.Hour))

	require.NoError(t, err)
	assert.Equal(t, WebAppUser{ID: 279058397, FirstName: "Vladislav", LastName: "Kibenko", Username: "vdkfrost"}, user)
}
```
Stub: `return WebAppUser{}, ErrInvalidInitData`. RED: `Received unexpected error: invalid init data`.
GREEN (minimal): query'ni parse qilish va `user` JSON'ini o'qish. Imzo va muddat tekshiruvi hali yo'q.
Commit: `feat(auth): read the user from Mini App initData`
- [ ] **Sikl 2: imzo.** Test:
```go
func TestValidateInitDataRejectsUnsignedData(t *testing.T) {
	tampered := strings.Replace(sampleInitData, "Vladislav", "Vlad", 1)
	noHash, _, _ := strings.Cut(sampleInitData, "&hash=")
	for name, tc := range map[string]struct{ initData, token string }{
		"another bot":   {sampleInitData, "123456:other-token"},
		"tampered user": {tampered, sampleToken},
		"no hash":       {noHash, sampleToken},
		"hash not hex":  {noHash + "&hash=zz", sampleToken},
		"no bot token":  {sampleInitData, ""},
	} {
		_, err := ValidateInitData(tc.initData, tc.token, 24*time.Hour, sampleSigned.Add(time.Hour))
		assert.ErrorIs(t, err, ErrInvalidInitData, name)
	}
}
```
RED: `… but got nil` (imzo tekshirilmaydi). GREEN: HMAC bloki. Commit: `feat(auth): initData must carry the bot's HMAC signature`
- [ ] **Sikl 3: muddat.** Test:
```go
func TestValidateInitDataRejectsOldData(t *testing.T) {
	_, err := ValidateInitData(sampleInitData, sampleToken, 24*time.Hour, sampleSigned.Add(25*time.Hour))

	assert.ErrorIs(t, err, ErrInitDataExpired)
	assert.ErrorIs(t, err, ErrInvalidInitData, "an expired login is an invalid login")
}
```
RED: `… but got nil`. GREEN: `auth_date` bloki. Commit: `feat(auth): initData older than the allowed age is refused`

---

### Task 4: `httpx` yordamchilari (6 sikl)

- [ ] **Sikl H1: `ClientIP` — to'g'ridan-to'g'ri mijoz.** `clientip_test.go`:
```go
func TestClientIP(t *testing.T) {
	tests := []struct {
		name, remote, xff, want string
	}{
		{name: "direct client ignores a forged header", remote: "203.0.113.5:4100", xff: "198.51.100.7", want: "203.0.113.5"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
			r.RemoteAddr = tt.remote
			if tt.xff != "" {
				r.Header.Set("X-Forwarded-For", tt.xff)
			}
			assert.Equal(t, tt.want, ClientIP(r))
		})
	}
}
```
Stub: `return ""`. GREEN: `RemoteAddr` dan host olinadi.
- [ ] **Sikl H2: proksi ortidagi mijoz** — jadvalga qo'shiladi:
```go
		{name: "behind proxies: rightmost public entry", remote: "127.0.0.1:52000", xff: "198.51.100.7, 10.0.0.2", want: "198.51.100.7"},
		{name: "a forged leftmost entry is skipped", remote: "127.0.0.1:52000", xff: "6.6.6.6, 198.51.100.7", want: "198.51.100.7"},
		{name: "proxy without the header", remote: "127.0.0.1:52000", want: "127.0.0.1"},
		{name: "private network proxy", remote: "10.1.2.3:52000", xff: "198.51.100.7", want: "198.51.100.7"},
```
RED: `expected "198.51.100.7" actual "127.0.0.1"`. Yakuniy `clientip.go`:
```go
package httpx

import (
	"net/http"
	"net/netip"
	"strings"
)

// ClientIP is the address rate limits key on. The API sits behind proxies
// (Next.js rewrites, nginx in production), so a request from a loopback or
// private address is a proxy hop and the client is the rightmost
// X-Forwarded-For entry that is not one. Next.js passes the header on as it
// arrives, so this holds only when the outermost proxy appends the address
// it sees (nginx: $proxy_add_x_forwarded_for).
func ClientIP(r *http.Request) string {
	remote, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	addr := remote.Addr().Unmap()
	if !isProxy(addr) {
		return addr.String()
	}
	hops := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(hops) - 1; i >= 0; i-- {
		hop, err := netip.ParseAddr(strings.TrimSpace(hops[i]))
		if err != nil {
			break
		}
		if hop = hop.Unmap(); !isProxy(hop) {
			return hop.String()
		}
	}
	return addr.String()
}

func isProxy(a netip.Addr) bool { return a.IsLoopback() || a.IsPrivate() }
```
Commit'lar: `feat(httpx): ClientIP of a direct client` va `feat(httpx): ClientIP behind proxies`.

- [ ] **Sikl H3: `RateLimiter` — limit.** `ratelimit_test.go`:
```go
func TestRateLimiterAllowsLimitPerKey(t *testing.T) {
	l := NewRateLimiter(5, time.Minute)

	for i := range 5 {
		assert.True(t, l.Allow("a"), "request %d", i+1)
	}
	assert.False(t, l.Allow("a"), "the sixth request within the minute")
	assert.True(t, l.Allow("b"), "keys are independent")
}
```
Stub `Allow`: `return false`.
- [ ] **Sikl H4: sliding window.**
```go
func TestRateLimiterWindowSlides(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	l := NewRateLimiter(2, time.Minute)
	l.now = func() time.Time { return now }

	assert.True(t, l.Allow("a"))
	now = now.Add(30 * time.Second)
	assert.True(t, l.Allow("a"))
	assert.False(t, l.Allow("a"))
	now = now.Add(31 * time.Second) // the first request left the window
	assert.True(t, l.Allow("a"))
	assert.False(t, l.Allow("a"))
}
```
- [ ] **Sikl H5: bo'sh kalitlar tozalanadi.**
```go
func TestRateLimiterForgetsIdleKeys(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	l := NewRateLimiter(5, time.Minute)
	l.now = func() time.Time { return now }
	l.Allow("a")

	now = now.Add(2 * time.Minute)
	l.Allow("b")

	assert.NotContains(t, l.hits, "a")
	assert.Contains(t, l.hits, "b")
}
```
Yakuniy `ratelimit.go`:
```go
package httpx

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter allows each key at most limit requests in any window: a
// sliding-window log of the key's recent requests.
type RateLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu        sync.Mutex
	hits      map[string][]time.Time
	lastSweep time.Time
}

// NewRateLimiter allows limit requests per key in any window.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{limit: limit, window: window, now: time.Now, hits: map[string][]time.Time{}}
}

// Allow records a request for key and reports whether it is within the limit.
func (l *RateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	since := now.Add(-l.window)
	l.sweep(now, since)

	recent := l.hits[key][:0]
	for _, at := range l.hits[key] {
		if at.After(since) {
			recent = append(recent, at)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}

// sweep drops keys with no request in the window, at most once a window, so
// clients that never come back do not pile up.
func (l *RateLimiter) sweep(now, since time.Time) {
	if now.Sub(l.lastSweep) < l.window {
		return
	}
	l.lastSweep = now
	for key, hits := range l.hits {
		if len(hits) == 0 || !hits[len(hits)-1].After(since) {
			delete(l.hits, key)
		}
	}
}
```
- [ ] **Sikl H6: `RateLimit` middleware.**
```go
func TestRateLimitAnswers429(t *testing.T) {
	h := RateLimit(NewRateLimiter(5, time.Minute))(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	call := func(remote string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", nil)
		req.RemoteAddr = remote
		h.ServeHTTP(rec, req)
		return rec
	}

	for range 5 {
		assert.Equal(t, http.StatusNoContent, call("203.0.113.5:1").Code)
	}
	rec := call("203.0.113.5:1")
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.JSONEq(t, `{"error":"too_many_requests","message":"Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring"}`, rec.Body.String())
	assert.Equal(t, http.StatusNoContent, call("203.0.113.6:1").Code, "another client")
}
```
```go
// RateLimit answers 429 once the client IP is over the limiter's budget.
func RateLimit(l *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !l.Allow(ClientIP(r)) {
				Error(w, http.StatusTooManyRequests, "too_many_requests", "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```
Commit'lar (har sikldan keyin): `feat(httpx): sliding-window rate limiter`, `… slides`, `… forgets idle keys`, `feat(httpx): RateLimit middleware answers 429`.

---

### Task 5: `httpx` — secret, JSON so'rov, router (4 sikl)

- [ ] **Sikl S1: `TelegramSecret`** (`secret_test.go`):
```go
func TestTelegramSecret(t *testing.T) {
	h := TelegramSecret("s3cret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for name, tc := range map[string]struct {
		header string
		want   int
	}{
		"right secret": {"s3cret", http.StatusOK},
		"wrong secret": {"guess", http.StatusUnauthorized},
		"no secret":    {"", http.StatusUnauthorized},
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/webhooks/admin-bot", nil)
		if tc.header != "" {
			req.Header.Set("X-Telegram-Bot-Api-Secret-Token", tc.header)
		}
		h.ServeHTTP(rec, req)
		assert.Equal(t, tc.want, rec.Code, name)
	}
}
```
```go
// TelegramSecret lets a webhook call through only with the secret given to
// setWebhook. The bot library would accept anything with 200 and drop it.
func TelegramSecret(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(secret)) != 1 {
				Error(w, http.StatusUnauthorized, "invalid_secret_token", "Webhook secret noto'g'ri")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```
- [ ] **Sikl S2: `DecodeJSON`** (`request_test.go`):
```go
func TestDecodeJSON(t *testing.T) {
	var body struct{ Code string `json:"code"` }

	rec := httptest.NewRecorder()
	ok := DecodeJSON(rec, httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(`{"code":"123456"}`)), &body)
	assert.True(t, ok)
	assert.Equal(t, "123456", body.Code)

	rec = httptest.NewRecorder()
	ok = DecodeJSON(rec, httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(`{"code":`)), &body)
	assert.False(t, ok)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"bad_request","message":"So'rov noto'g'ri"}`, rec.Body.String())
}
```
```go
// DecodeJSON reads a JSON request body into v. On a malformed body it answers
// 400 and returns false.
func DecodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v); err != nil {
		Error(w, http.StatusBadRequest, "bad_request", "So'rov noto'g'ri")
		return false
	}
	return true
}
```
- [ ] **Sikl S3: `InternalError`**
```go
func TestInternalError(t *testing.T) {
	rec := httptest.NewRecorder()

	InternalError(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/x", nil), errors.New("db down"))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.JSONEq(t, `{"error":"internal_error","message":"Ichki xatolik. Birozdan keyin qayta urinib ko'ring"}`, rec.Body.String())
}
```
```go
// InternalError logs err and answers 500 without exposing it.
func InternalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.ErrorContext(r.Context(), "request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	Error(w, http.StatusInternalServerError, "internal_error", "Ichki xatolik. Birozdan keyin qayta urinib ko'ring")
}
```
- [ ] **Sikl S4: router mount'lari** (`router_test.go` ga):
```go
func TestNewRouterMountsRoutes(t *testing.T) {
	r := NewRouter(func(r chi.Router) {
		r.Get("/ping", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	})
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/ping", nil))

	assert.Equal(t, http.StatusTeapot, rec.Code)
}
```
RED compile bo'lishi uchun: avval signatura `NewRouter(mounts ...func(chi.Router))` qilinadi, mount'lar e'tiborsiz qoldiriladi → 404. GREEN:
```go
// NewRouter builds the API router: /healthz plus every mounted feature.
func NewRouter(mounts ...func(chi.Router)) http.Handler {
	r := chi.NewRouter()
	r.Get("/healthz", healthz)
	for _, mount := range mounts {
		mount(r)
	}
	return r
}
```
Har sikldan keyin commit.

---

### Task 6: `AdminAuth` servisi (11 sikl, real Postgres)

`backend/internal/auth/admin_otp.go` (yakuniy):
```go
package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

const (
	loginCodeTTL    = 60 * time.Second
	loginCodeDraws  = 5
	adminSessionTTL = 12 * time.Hour
	initDataMaxAge  = 24 * time.Hour
)

var (
	// ErrNotAdmin means the Telegram user is not an active admin.
	ErrNotAdmin = errors.New("not an active admin")
	// ErrInvalidCode means a wrong, used or expired login code.
	ErrInvalidCode = errors.New("invalid login code")
	// ErrUnauthenticated means no live session stands behind the cookie.
	ErrUnauthenticated = errors.New("no live admin session")
)

// AdminAuth logs platform admins in with codes from the admin bot or with
// Mini App initData, and keeps the sessions both open.
type AdminAuth struct {
	pool     *pgxpool.Pool
	q        *gen.Queries
	secret   []byte // OTP_HMAC_SECRET
	botToken string // ADMIN_BOT_TOKEN, signs Mini App initData
	now      func() time.Time
	newCode  func() (string, error)
}

// NewAdminAuth wires the service; botToken may be empty when the bot is off.
func NewAdminAuth(pool *pgxpool.Pool, otpSecret, botToken string) *AdminAuth {
	return &AdminAuth{
		pool:     pool,
		q:        gen.New(pool),
		secret:   []byte(otpSecret),
		botToken: botToken,
		now:      time.Now,
		newCode:  func() (string, error) { return NewCode(rand.Reader) },
	}
}

// IsActiveAdmin reports whether telegramID belongs to an active admin.
func (a *AdminAuth) IsActiveAdmin(ctx context.Context, telegramID int64) (bool, error) {
	_, err := a.q.GetActiveAdmin(ctx, telegramID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// LoginCode is a code for the admin bot to send; ID discards it when the
// message cannot be delivered.
type LoginCode struct {
	ID   int64
	Code string
}

// IssueLoginCode replaces the admin's unused codes with a new one that lives
// loginCodeTTL; expired codes of every admin go too. ErrNotAdmin when
// telegramID is not an active admin.
func (a *AdminAuth) IssueLoginCode(ctx context.Context, telegramID int64) (LoginCode, error) {
	var issued LoginCode
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if _, err := q.GetActiveAdmin(ctx, telegramID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotAdmin
			}
			return err
		}
		if err := q.DeleteStaleAdminLoginCodes(ctx, telegramID); err != nil {
			return err
		}
		// The hash of another admin's live code is taken (unique index): draw
		// again, inside a savepoint so the transaction survives the failure.
		for range loginCodeDraws {
			code, err := a.newCode()
			if err != nil {
				return err
			}
			var id int64
			err = pgx.BeginFunc(ctx, tx, func(sp pgx.Tx) error {
				var err error
				id, err = a.q.WithTx(sp).CreateAdminLoginCode(ctx, gen.CreateAdminLoginCodeParams{
					AdminID:   telegramID,
					CodeHash:  HashCode(a.secret, code),
					ExpiresAt: a.now().Add(loginCodeTTL),
				})
				return err
			})
			if isUniqueViolation(err) {
				continue
			}
			if err != nil {
				return err
			}
			issued = LoginCode{ID: id, Code: code}
			return nil
		}
		return fmt.Errorf("no free login code after %d draws", loginCodeDraws)
	})
	return issued, err
}

// DiscardLoginCode drops a code the bot could not deliver.
func (a *AdminAuth) DiscardLoginCode(ctx context.Context, id int64) error {
	return a.q.DeleteAdminLoginCode(ctx, id)
}

// LoginWithCode spends a code from the admin bot and opens a session.
// ErrInvalidCode for a wrong, used or expired code and for an admin who was
// deactivated after the code went out.
func (a *AdminAuth) LoginWithCode(ctx context.Context, code string) (Session, error) {
	var s Session
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		adminID, err := q.ConsumeAdminLoginCode(ctx, HashCode(a.secret, code))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidCode
		}
		if err != nil {
			return err
		}
		s, err = a.openSession(ctx, q, adminID, "otp")
		if errors.Is(err, ErrNotAdmin) {
			return ErrInvalidCode
		}
		return err
	})
	return s, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
```
`backend/internal/auth/admin_session.go` (yakuniy):
```go
package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Session is an open admin session; ID is the admin_session cookie value.
type Session struct {
	ID        uuid.UUID
	ExpiresAt time.Time
	Admin     gen.Admin
}

// openSession starts an adminSessionTTL session for an active admin;
// ErrNotAdmin otherwise. source is "otp" or "miniapp".
func (a *AdminAuth) openSession(ctx context.Context, q *gen.Queries, adminID int64, source string) (Session, error) {
	admin, err := q.GetActiveAdmin(ctx, adminID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotAdmin
	}
	if err != nil {
		return Session{}, err
	}
	row, err := q.CreateAdminSession(ctx, gen.CreateAdminSessionParams{
		AdminID:   adminID,
		Source:    source,
		ExpiresAt: a.now().Add(adminSessionTTL),
	})
	if err != nil {
		return Session{}, err
	}
	return Session{ID: row.ID, ExpiresAt: row.ExpiresAt, Admin: admin}, nil
}

// LoginWithInitData opens a session for the admin who opened the Mini App.
// ErrInvalidInitData (or ErrInitDataExpired) unless the admin bot signed it in
// the last 24 hours; ErrNotAdmin unless its user is an active admin.
func (a *AdminAuth) LoginWithInitData(ctx context.Context, initData string) (Session, error) {
	user, err := ValidateInitData(initData, a.botToken, initDataMaxAge, a.now())
	if err != nil {
		return Session{}, err
	}
	return a.openSession(ctx, a.q, user.ID, "miniapp")
}

// Authenticate returns the admin behind a session cookie value;
// ErrUnauthenticated for a malformed, unknown or expired session and for a
// deactivated admin.
func (a *AdminAuth) Authenticate(ctx context.Context, sessionID string) (gen.Admin, error) {
	id, err := uuid.Parse(sessionID)
	if err != nil {
		return gen.Admin{}, ErrUnauthenticated
	}
	admin, err := a.q.GetAdminBySession(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.Admin{}, ErrUnauthenticated
	}
	return admin, err
}

// Logout ends a session; a malformed or unknown id is not an error.
func (a *AdminAuth) Logout(ctx context.Context, sessionID string) error {
	id, err := uuid.Parse(sessionID)
	if err != nil {
		return nil
	}
	return a.q.DeleteAdminSession(ctx, id)
}
```
Test helperlari (`admin_auth_test.go`, `package auth`):
```go
const (
	ownerID       int64 = 461603558
	testOTPSecret       = "test-otp-secret"
	testBotToken        = "123456:test-bot-token"
)

func newAdminAuth(t *testing.T) (*AdminAuth, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewAdminAuth(pool, testOTPSecret, testBotToken), pool
}

// codes makes newCode hand out the given codes in order.
func codes(list ...string) func() (string, error) {
	next := 0
	return func() (string, error) {
		if next == len(list) {
			return "", errors.New("the test ran out of codes")
		}
		next++
		return list[next-1], nil
	}
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	_, err := pool.Exec(context.Background(), sql, args...)
	require.NoError(t, err)
}
```
Har sikl: test → stub (metod `errors.New("not implemented")` qaytaradi; `IsActiveAdmin` stub `false, errors.New(...)`) → RED → yakuniy kodning tegishli qismi → GREEN → commit.

- [ ] **S1 IsActiveAdmin**
```go
func TestIsActiveAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")

	for id, want := range map[int64]bool{ownerID: true, 42: false, 999: false} {
		got, err := a.IsActiveAdmin(t.Context(), id)
		require.NoError(t, err)
		assert.Equal(t, want, got, "admin %d", id)
	}
}
```
- [ ] **S2 IssueLoginCode saqlaydi**
```go
func TestIssueLoginCodeStoresOnlyTheHash(t *testing.T) {
	a, pool := newAdminAuth(t)

	issued, err := a.IssueLoginCode(t.Context(), ownerID)

	require.NoError(t, err)
	assert.Regexp(t, `^\d{6}$`, issued.Code)
	var hash string
	var ttl time.Duration
	require.NoError(t, pool.QueryRow(t.Context(),
		"SELECT code_hash, expires_at - now() FROM admin_login_codes WHERE id = $1", issued.ID).Scan(&hash, &ttl))
	assert.Equal(t, HashCode([]byte(testOTPSecret), issued.Code), hash)
	assert.InDelta(t, 60, ttl.Seconds(), 2, "a code lives 60 seconds")

	for _, id := range []int64{42, 999} {
		mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false) ON CONFLICT DO NOTHING")
		_, err := a.IssueLoginCode(t.Context(), id)
		assert.ErrorIs(t, err, ErrNotAdmin, "telegram id %d", id)
	}
}
```
- [ ] **S3 eski kodlar o'chadi**
```go
func TestIssueLoginCodeReplacesUnusedCodes(t *testing.T) {
	a, pool := newAdminAuth(t)
	first, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	second, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	var ids []int64
	rows, err := pool.Query(t.Context(), "SELECT id FROM admin_login_codes WHERE admin_id = $1", ownerID)
	require.NoError(t, err)
	ids, err = pgx.CollectRows(rows, pgx.RowTo[int64])
	require.NoError(t, err)
	assert.Equal(t, []int64{second.ID}, ids)
	assert.NotEqual(t, first.ID, second.ID)
}
```
- [ ] **S4 to'qnashuvda qayta tortadi**
```go
func TestIssueLoginCodeDrawsAgainOnACollision(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	a.newCode = codes("111111")
	_, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)

	a.newCode = codes("111111", "222222")
	issued, err := a.IssueLoginCode(t.Context(), ownerID)

	require.NoError(t, err)
	assert.Equal(t, "222222", issued.Code)
}
```
(RED S4 ga: S2'dagi GREEN kodida savepoint/qayta urinish hali yo'q → `duplicate key value violates unique constraint "admin_login_codes_active"`. Savepoint va loop shu siklda qo'shiladi.)
- [ ] **S5 5 urinishdan keyin to'xtaydi**
```go
func TestIssueLoginCodeGivesUpAfterFiveCollisions(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	a.newCode = codes("111111")
	_, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)

	a.newCode = codes("111111", "111111", "111111", "111111", "111111", "222222")
	_, err = a.IssueLoginCode(t.Context(), ownerID)

	assert.ErrorContains(t, err, "no free login code after 5 draws")
}
```
(RED: S4 loop chegarasi bo'lmasa `222222` qaytadi.)
- [ ] **S6 LoginWithCode**
```go
func TestLoginWithCode(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	issued, err := a.IssueLoginCode(ctx, ownerID)
	require.NoError(t, err)

	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)
	assert.Equal(t, ownerID, s.Admin.TelegramID)
	assert.WithinDuration(t, time.Now().Add(12*time.Hour), s.ExpiresAt, 5*time.Second)
	var source string
	require.NoError(t, pool.QueryRow(ctx, "SELECT source FROM admin_sessions WHERE id = $1", s.ID).Scan(&source))
	assert.Equal(t, "otp", source)

	_, err = a.LoginWithCode(ctx, issued.Code)
	assert.ErrorIs(t, err, ErrInvalidCode, "a code works once")
	_, err = a.LoginWithCode(ctx, "000000")
	assert.ErrorIs(t, err, ErrInvalidCode, "a wrong code")

	mustExec(t, pool, "INSERT INTO admin_login_codes (admin_id, code_hash, expires_at) VALUES ($1, $2, now() - interval '1 second')",
		ownerID, HashCode([]byte(testOTPSecret), "654321"))
	_, err = a.LoginWithCode(ctx, "654321")
	assert.ErrorIs(t, err, ErrInvalidCode, "an expired code")
}
```
- [ ] **S7 o'chirilgan admin**
```go
func TestLoginWithCodeOfADeactivatedAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id) VALUES (42)")
	issued, err := a.IssueLoginCode(t.Context(), 42)
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")

	_, err = a.LoginWithCode(t.Context(), issued.Code)

	assert.ErrorIs(t, err, ErrInvalidCode)
}
```
- [ ] **S8 DiscardLoginCode**
```go
func TestDiscardLoginCode(t *testing.T) {
	a, _ := newAdminAuth(t)
	issued, err := a.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)

	require.NoError(t, a.DiscardLoginCode(t.Context(), issued.ID))

	_, err = a.LoginWithCode(t.Context(), issued.Code)
	assert.ErrorIs(t, err, ErrInvalidCode)
}
```
- [ ] **S9 LoginWithInitData** — `internal/testutil/telegramtest/initdata.go` (test yordamchisi; to'g'riligi namuna-vektor bilan tasdiqlangan `ValidateInitData` qabul qilishi orqali isbotlanadi):
```go
// Package telegramtest builds Telegram data for tests.
package telegramtest

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"
	"time"
)

// SignInitData returns Mini App initData for user telegramID, signed for
// botToken at signedAt, as Telegram would build it.
func SignInitData(botToken string, telegramID int64, signedAt time.Time) string {
	fields := map[string]string{
		"auth_date": fmt.Sprint(signedAt.Unix()),
		"query_id":  "AAHtest",
		"user":      fmt.Sprintf(`{"id":%d,"first_name":"Test"}`, telegramID),
	}
	lines := make([]string, 0, len(fields))
	for _, key := range slices.Sorted(maps.Keys(fields)) {
		lines = append(lines, key+"="+fields[key])
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(botToken))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))

	values := url.Values{}
	for key, value := range fields {
		values.Set(key, value)
	}
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return values.Encode()
}
```
Test:
```go
func TestLoginWithInitData(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()

	s, err := a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, ownerID, time.Now()))
	require.NoError(t, err)
	assert.Equal(t, ownerID, s.Admin.TelegramID)
	var source string
	require.NoError(t, pool.QueryRow(ctx, "SELECT source FROM admin_sessions WHERE id = $1", s.ID).Scan(&source))
	assert.Equal(t, "miniapp", source)

	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, 42, time.Now()))
	assert.ErrorIs(t, err, ErrNotAdmin, "a Telegram user who is not an admin")
	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData("999:other-bot", ownerID, time.Now()))
	assert.ErrorIs(t, err, ErrInvalidInitData, "signed by another bot")
	_, err = a.LoginWithInitData(ctx, telegramtest.SignInitData(testBotToken, ownerID, time.Now().Add(-25*time.Hour)))
	assert.ErrorIs(t, err, ErrInvalidInitData, "older than a day")
}
```
- [ ] **S10 Authenticate**
```go
func TestAuthenticate(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	issued, err := a.IssueLoginCode(ctx, ownerID)
	require.NoError(t, err)
	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)

	admin, err := a.Authenticate(ctx, s.ID.String())
	require.NoError(t, err)
	assert.Equal(t, ownerID, admin.TelegramID)

	for name, id := range map[string]string{"malformed": "not-a-uuid", "unknown": uuid.NewString()} {
		_, err := a.Authenticate(ctx, id)
		assert.ErrorIs(t, err, ErrUnauthenticated, name)
	}
	mustExec(t, pool, "UPDATE admin_sessions SET expires_at = now() - interval '1 second' WHERE id = $1", s.ID)
	_, err = a.Authenticate(ctx, s.ID.String())
	assert.ErrorIs(t, err, ErrUnauthenticated, "expired")
}
```
- [ ] **S11 Logout**
```go
func TestLogout(t *testing.T) {
	a, _ := newAdminAuth(t)
	ctx := t.Context()
	issued, err := a.IssueLoginCode(ctx, ownerID)
	require.NoError(t, err)
	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)

	require.NoError(t, a.Logout(ctx, s.ID.String()))

	_, err = a.Authenticate(ctx, s.ID.String())
	assert.ErrorIs(t, err, ErrUnauthenticated)
	assert.NoError(t, a.Logout(ctx, "not-a-uuid"))
}
```

---

### Task 7: `/admin` HTTP API (7 sikl, httptest + real Postgres)

`backend/internal/admin/handler.go` (yakuniy):
```go
// Package admin serves the /admin API of the platform admin panel.
package admin

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// Handler serves /admin.
type Handler struct {
	auth         *auth.AdminAuth
	cookieSecure bool
	otpLimiter   *httpx.RateLimiter
}

// NewHandler wires the /admin API. otpLimiter caps code attempts per IP.
func NewHandler(a *auth.AdminAuth, cookieSecure bool, otpLimiter *httpx.RateLimiter) *Handler {
	return &Handler{auth: a, cookieSecure: cookieSecure, otpLimiter: otpLimiter}
}

// Routes mounts /admin.
func (h *Handler) Routes(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.With(httpx.RateLimit(h.otpLimiter)).Post("/auth/otp", h.loginWithCode)
		r.Post("/auth/telegram", h.loginWithInitData)
		r.Post("/auth/logout", h.logout)
		r.Group(func(r chi.Router) {
			r.Use(h.requireSession)
			r.Get("/me", h.me)
		})
	})
}

type adminJSON struct {
	TelegramID int64   `json:"telegram_id"`
	FullName   *string `json:"full_name"`
}

func toAdminJSON(a gen.Admin) adminJSON {
	return adminJSON{TelegramID: a.TelegramID, FullName: a.FullName}
}

func (h *Handler) loginWithCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.auth.LoginWithCode(r.Context(), body.Code)
	if errors.Is(err, auth.ErrInvalidCode) {
		httpx.Error(w, http.StatusUnauthorized, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")
		return
	}
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	h.setSessionCookie(w, s)
	httpx.JSON(w, http.StatusOK, toAdminJSON(s.Admin))
}

func (h *Handler) loginWithInitData(w http.ResponseWriter, r *http.Request) {
	var body struct {
		InitData string `json:"initData"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	s, err := h.auth.LoginWithInitData(r.Context(), body.InitData)
	switch {
	case errors.Is(err, auth.ErrInvalidInitData):
		httpx.Error(w, http.StatusUnauthorized, "invalid_init_data", "Telegram ma'lumotlari tasdiqlanmadi")
		return
	case errors.Is(err, auth.ErrNotAdmin):
		httpx.Error(w, http.StatusForbidden, "not_admin", "Sizda ruxsat yo'q")
		return
	case err != nil:
		httpx.InternalError(w, r, err)
		return
	}
	h.setSessionCookie(w, s)
	httpx.JSON(w, http.StatusOK, toAdminJSON(s.Admin))
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if err := h.auth.Logout(r.Context(), c.Value); err != nil {
			httpx.InternalError(w, r, err)
			return
		}
	}
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, toAdminJSON(currentAdmin(r.Context())))
}
```
`backend/internal/admin/session.go` (yakuniy):
```go
package admin

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// sessionCookie carries the admin session id; the admin panel's proxy.ts
// checks for it too.
const sessionCookie = "admin_session"

type adminKey struct{}

// requireSession lets a request through only with a live admin session and
// puts the admin into its context.
func (h *Handler) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			unauthorized(w)
			return
		}
		admin, err := h.auth.Authenticate(r.Context(), c.Value)
		if errors.Is(err, auth.ErrUnauthenticated) {
			unauthorized(w)
			return
		}
		if err != nil {
			httpx.InternalError(w, r, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminKey{}, admin)))
	})
}

// currentAdmin is the admin requireSession let through.
func currentAdmin(ctx context.Context) gen.Admin {
	admin, _ := ctx.Value(adminKey{}).(gen.Admin)
	return admin
}

func unauthorized(w http.ResponseWriter) {
	httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Avval tizimga kiring")
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, s auth.Session) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    s.ID.String(),
		Path:     "/",
		Expires:  s.ExpiresAt,
		MaxAge:   int(time.Until(s.ExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}
```
Test helperlari (`handler_test.go`, `package admin`):
```go
const (
	ownerID       int64 = 461603558
	testOTPSecret       = "test-otp-secret"
	testBotToken        = "123456:test-bot-token"
)

type testAPI struct {
	router http.Handler
	auth   *auth.AdminAuth
	pool   *pgxpool.Pool
}

func newTestAPI(t *testing.T, cookieSecure bool) testAPI {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	a := auth.NewAdminAuth(pool, testOTPSecret, testBotToken)
	h := NewHandler(a, cookieSecure, httpx.NewRateLimiter(5, time.Minute))
	return testAPI{router: httpx.NewRouter(h.Routes), auth: a, pool: pool}
}

func (api testAPI) do(t *testing.T, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	api.router.ServeHTTP(rec, req)
	return rec
}

func (api testAPI) code(t *testing.T) string {
	t.Helper()
	issued, err := api.auth.IssueLoginCode(t.Context(), ownerID)
	require.NoError(t, err)
	return issued.Code
}

func sessionCookieOf(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			return c
		}
	}
	t.Fatalf("no admin_session cookie in %v", rec.Result().Header["Set-Cookie"])
	return nil
}
```
Har sikl: test → stub handler (`w.WriteHeader(http.StatusNotImplemented)`) → RED `expected: 200 actual: 501` → yakuniy kod → GREEN → commit.

- [ ] **E1 OTP bilan login**
```go
func TestLoginWithCodeSetsTheSessionCookie(t *testing.T) {
	api := newTestAPI(t, true)

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"telegram_id":461603558,"full_name":"Owner"}`, rec.Body.String())
	c := sessionCookieOf(t, rec)
	assert.True(t, c.HttpOnly)
	assert.True(t, c.Secure)
	assert.Equal(t, http.SameSiteLaxMode, c.SameSite)
	assert.Equal(t, "/", c.Path)
	assert.InDelta(t, 12*60*60, c.MaxAge, 5, "the session lasts 12 hours")
}
```
- [ ] **E2 xatolar**
```go
func TestLoginWithCodeErrors(t *testing.T) {
	api := newTestAPI(t, true)

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"000000"}`)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"invalid_code","message":"Kod noto'g'ri yoki muddati o'tgan"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
```
- [ ] **E3 rate limit**
```go
func TestLoginWithCodeIsRateLimitedPerIP(t *testing.T) {
	api := newTestAPI(t, true)
	for range 5 {
		api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"000000"}`)
	}

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "even a right code waits once the budget is spent")
}
```
- [ ] **E4 /admin/me va middleware**
```go
func TestMe(t *testing.T) {
	api := newTestAPI(t, true)
	login := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	rec := api.do(t, http.MethodGet, "/admin/me", "", sessionCookieOf(t, login))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"telegram_id":461603558,"full_name":"Owner"}`, rec.Body.String())

	rec = api.do(t, http.MethodGet, "/admin/me", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"unauthorized","message":"Avval tizimga kiring"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/admin/me", "", &http.Cookie{Name: "admin_session", Value: "forged"})
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
```
- [ ] **E5 Mini App login**
```go
func TestLoginWithInitData(t *testing.T) {
	api := newTestAPI(t, true)
	body := func(initData string) string { return `{"initData":"` + initData + `"}` }

	rec := api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData(testBotToken, ownerID, time.Now())))
	assert.Equal(t, http.StatusOK, rec.Code)
	sessionCookieOf(t, rec)

	rec = api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData("999:other-bot", ownerID, time.Now())))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"invalid_init_data","message":"Telegram ma'lumotlari tasdiqlanmadi"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/admin/auth/telegram", body(telegramtest.SignInitData(testBotToken, 42, time.Now())))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, `{"error":"not_admin","message":"Sizda ruxsat yo'q"}`, rec.Body.String())
}
```
- [ ] **E6 logout**
```go
func TestLogout(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := sessionCookieOf(t, api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`))

	rec := api.do(t, http.MethodPost, "/admin/auth/logout", "", cookie)

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, -1, sessionCookieOf(t, rec).MaxAge, "the browser drops the cookie")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/admin/me", "", cookie).Code)
}
```
- [ ] **E7 COOKIE_SECURE=false**
```go
func TestSessionCookieWithoutSecureForLocalHTTP(t *testing.T) {
	api := newTestAPI(t, false)

	rec := api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`)

	assert.False(t, sessionCookieOf(t, rec).Secure)
}
```
(RED: E1 GREEN'da `Secure: true` qattiq yozilgan bo'lsa, shu sikl uni `h.cookieSecure` ga almashtiradi.)

---

### Task 8: `adminbot` (8 sikl, fake Telegram API)

`backend/internal/bot/adminbot/handler.go` (yakuniy):
```go
// Package adminbot is the admin Telegram bot: it hands out login codes and
// opens the admin panel as a Mini App.
package adminbot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
)

// API is the part of the Telegram Bot API the admin bot uses. *bot.Bot
// implements it; tests use a fake.
type API interface {
	SendMessage(ctx context.Context, params *bot.SendMessageParams) (*models.Message, error)
	SetChatMenuButton(ctx context.Context, params *bot.SetChatMenuButtonParams) (bool, error)
	SetWebhook(ctx context.Context, params *bot.SetWebhookParams) (bool, error)
}

// Auth is what the bot needs from the admin auth service.
type Auth interface {
	IsActiveAdmin(ctx context.Context, telegramID int64) (bool, error)
	IssueLoginCode(ctx context.Context, telegramID int64) (auth.LoginCode, error)
	DiscardLoginCode(ctx context.Context, id int64) error
}

const (
	codeText     = "Kod: <code>%s</code> (1 daqiqa amal qiladi)"
	notAdminText = "Sizda ruxsat yo'q.\nTelegram ID: <code>%d</code>"
	hintText     = "Admin panelga kirish uchun /login yozing."
	failText     = "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring."
)

// Handler answers the admin bot's updates.
type Handler struct {
	api  API
	auth Auth
}

// NewHandler wires the bot's answers.
func NewHandler(api API, a Auth) *Handler {
	return &Handler{api: api, auth: a}
}

// Handle answers one update: /login gets a code, everything else a hint for
// admins and "no access" (with the Telegram ID to add) for everyone else.
func (h *Handler) Handle(ctx context.Context, update *models.Update) {
	if update.Message == nil || update.Message.From == nil {
		return
	}
	chatID, from := update.Message.Chat.ID, update.Message.From.ID
	if command(update.Message.Text) == "/login" {
		h.login(ctx, chatID, from)
		return
	}
	admin, err := h.auth.IsActiveAdmin(ctx, from)
	switch {
	case err != nil:
		slog.ErrorContext(ctx, "admin bot: admin lookup", "telegram_id", from, "err", err)
		_ = h.send(ctx, chatID, failText)
	case admin:
		_ = h.send(ctx, chatID, hintText)
	default:
		_ = h.send(ctx, chatID, fmt.Sprintf(notAdminText, from))
	}
}

func (h *Handler) login(ctx context.Context, chatID, telegramID int64) {
	code, err := h.auth.IssueLoginCode(ctx, telegramID)
	if errors.Is(err, auth.ErrNotAdmin) {
		_ = h.send(ctx, chatID, fmt.Sprintf(notAdminText, telegramID))
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "admin bot: issue login code", "telegram_id", telegramID, "err", err)
		_ = h.send(ctx, chatID, failText)
		return
	}
	if err := h.send(ctx, chatID, fmt.Sprintf(codeText, code.Code)); err != nil {
		// The code never reached the admin, so it must not stay usable.
		if err := h.auth.DiscardLoginCode(ctx, code.ID); err != nil {
			slog.ErrorContext(ctx, "admin bot: discard login code", "code_id", code.ID, "err", err)
		}
	}
}

func (h *Handler) send(ctx context.Context, chatID int64, html string) error {
	_, err := h.api.SendMessage(ctx, &bot.SendMessageParams{ChatID: chatID, Text: html, ParseMode: models.ParseModeHTML})
	if err != nil {
		slog.ErrorContext(ctx, "admin bot: send message", "chat_id", chatID, "err", err)
	}
	return err
}

// command is the bot command a message starts with, without an @botname
// suffix: "/login@hisob24_bot now" is "/login".
func command(text string) string {
	fields := strings.Fields(text)
	if len(fields) == 0 || !strings.HasPrefix(fields[0], "/") {
		return ""
	}
	name, _, _ := strings.Cut(fields[0], "@")
	return name
}
```
`backend/internal/bot/adminbot/setup.go` (yakuniy):
```go
package adminbot

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// WebhookPath is where Telegram delivers the admin bot's updates.
const WebhookPath = "/webhooks/admin-bot"

// SetMenuButton points the bot's menu button at the admin panel, so the
// panel opens as a Mini App. An empty panelURL leaves the button alone.
func SetMenuButton(ctx context.Context, api API, panelURL string) error {
	if panelURL == "" {
		return nil
	}
	_, err := api.SetChatMenuButton(ctx, &bot.SetChatMenuButtonParams{
		MenuButton: models.MenuButtonWebApp{
			Type:   models.MenuButtonTypeWebApp,
			Text:   "Admin panel",
			WebApp: models.WebAppInfo{URL: panelURL},
		},
	})
	if err != nil {
		return fmt.Errorf("set menu button: %w", err)
	}
	return nil
}

// RegisterWebhook has Telegram deliver updates to publicURL+WebhookPath with
// secret in the X-Telegram-Bot-Api-Secret-Token header.
func RegisterWebhook(ctx context.Context, api API, publicURL, secret string) error {
	_, err := api.SetWebhook(ctx, &bot.SetWebhookParams{
		URL:         strings.TrimRight(publicURL, "/") + WebhookPath,
		SecretToken: secret,
	})
	if err != nil {
		return fmt.Errorf("set webhook: %w", err)
	}
	return nil
}
```
Fake'lar (`handler_test.go`):
```go
type fakeAPI struct {
	sent    []*bot.SendMessageParams
	sendErr error
	menu    *bot.SetChatMenuButtonParams
	webhook *bot.SetWebhookParams
}

func (f *fakeAPI) SendMessage(_ context.Context, p *bot.SendMessageParams) (*models.Message, error) {
	f.sent = append(f.sent, p)
	return &models.Message{}, f.sendErr
}

func (f *fakeAPI) SetChatMenuButton(_ context.Context, p *bot.SetChatMenuButtonParams) (bool, error) {
	f.menu = p
	return true, nil
}

func (f *fakeAPI) SetWebhook(_ context.Context, p *bot.SetWebhookParams) (bool, error) {
	f.webhook = p
	return true, nil
}

type fakeAuth struct {
	admins    map[int64]bool
	issued    []int64
	discarded []int64
}

func (f *fakeAuth) IsActiveAdmin(_ context.Context, id int64) (bool, error) { return f.admins[id], nil }

func (f *fakeAuth) IssueLoginCode(_ context.Context, id int64) (auth.LoginCode, error) {
	if !f.admins[id] {
		return auth.LoginCode{}, auth.ErrNotAdmin
	}
	f.issued = append(f.issued, id)
	return auth.LoginCode{ID: 7, Code: "123456"}, nil
}

func (f *fakeAuth) DiscardLoginCode(_ context.Context, id int64) error {
	f.discarded = append(f.discarded, id)
	return nil
}

// message is an update with a text message from telegramID in its private chat.
func message(telegramID int64, text string) *models.Update {
	return &models.Update{Message: &models.Message{
		Chat: models.Chat{ID: telegramID},
		From: &models.User{ID: telegramID},
		Text: text,
	}}
}
```
Stub: `Handle` bo'sh, `SetMenuButton`/`RegisterWebhook` `nil` qaytaradi.

- [ ] **B1 /login admin'ga kod**
```go
func TestLoginSendsACode(t *testing.T) {
	for _, text := range []string{"/login", "/login@hisob24_admin_bot"} {
		api, a := &fakeAPI{}, &fakeAuth{admins: map[int64]bool{100: true}}

		NewHandler(api, a).Handle(t.Context(), message(100, text))

		require.Len(t, api.sent, 1, text)
		assert.Equal(t, int64(100), api.sent[0].ChatID)
		assert.Equal(t, "Kod: <code>123456</code> (1 daqiqa amal qiladi)", api.sent[0].Text)
		assert.Equal(t, models.ParseModeHTML, api.sent[0].ParseMode)
		assert.Equal(t, []int64{100}, a.issued)
	}
}
```
- [ ] **B2 /login ruxsatsizga**
```go
func TestLoginRefusesStrangers(t *testing.T) {
	api, a := &fakeAPI{}, &fakeAuth{admins: map[int64]bool{}}

	NewHandler(api, a).Handle(t.Context(), message(42, "/login"))

	require.Len(t, api.sent, 1)
	assert.Equal(t, "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>", api.sent[0].Text)
	assert.Empty(t, a.issued)
}
```
- [ ] **B3 yuborilmagan kod bekor qilinadi**
```go
func TestLoginDiscardsAnUndeliveredCode(t *testing.T) {
	api, a := &fakeAPI{sendErr: errors.New("telegram is down")}, &fakeAuth{admins: map[int64]bool{100: true}}

	NewHandler(api, a).Handle(t.Context(), message(100, "/login"))

	assert.Equal(t, []int64{7}, a.discarded)
}
```
- [ ] **B4 boshqa xabarlar**
```go
func TestOtherMessages(t *testing.T) {
	for name, tc := range map[string]struct {
		from int64
		text string
		want string
	}{
		"admin /start":     {100, "/start", "Admin panelga kirish uchun /login yozing."},
		"admin text":       {100, "salom", "Admin panelga kirish uchun /login yozing."},
		"stranger /start":  {42, "/start", "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>"},
		"stranger text":    {42, "salom", "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>"},
	} {
		api := &fakeAPI{}
		NewHandler(api, &fakeAuth{admins: map[int64]bool{100: true}}).Handle(t.Context(), message(tc.from, tc.text))
		require.Len(t, api.sent, 1, name)
		assert.Equal(t, tc.want, api.sent[0].Text, name)
	}
}
```
- [ ] **B5 xabarsiz update**
```go
func TestUpdatesWithoutAMessageAreIgnored(t *testing.T) {
	api := &fakeAPI{}
	h := NewHandler(api, &fakeAuth{})

	h.Handle(t.Context(), &models.Update{})
	h.Handle(t.Context(), &models.Update{Message: &models.Message{Text: "/login"}})

	assert.Empty(t, api.sent)
}
```
(RED: B1–B4 GREEN'dan keyin `From == nil` panic qiladi → guard shu siklda qo'shiladi.)
- [ ] **B6 menu button** (`setup_test.go`)
```go
func TestSetMenuButton(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, SetMenuButton(t.Context(), api, "https://admin.hisob24.uz"))

	require.NotNil(t, api.menu)
	assert.Equal(t, models.MenuButtonWebApp{
		Type: models.MenuButtonTypeWebApp, Text: "Admin panel", WebApp: models.WebAppInfo{URL: "https://admin.hisob24.uz"},
	}, api.menu.MenuButton)

	api = &fakeAPI{}
	require.NoError(t, SetMenuButton(t.Context(), api, ""))
	assert.Nil(t, api.menu, "no panel URL, no button")
}
```
- [ ] **B7 webhook**
```go
func TestRegisterWebhook(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, RegisterWebhook(t.Context(), api, "https://api.hisob24.uz/", "s3cret"))

	require.NotNil(t, api.webhook)
	assert.Equal(t, "https://api.hisob24.uz/webhooks/admin-bot", api.webhook.URL)
	assert.Equal(t, "s3cret", api.webhook.SecretToken)
}
```
- [ ] **B8 integration: botdagi kod login qiladi** (`flow_test.go`, real `AdminAuth` + pgtest):
```go
func TestACodeFromTheBotLogsIn(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	a := auth.NewAdminAuth(pool, "test-otp-secret", "")
	api := &fakeAPI{}

	NewHandler(api, a).Handle(t.Context(), message(461603558, "/login"))

	require.Len(t, api.sent, 1)
	code := regexp.MustCompile(`<code>(\d{6})</code>`).FindStringSubmatch(api.sent[0].Text)
	require.Len(t, code, 2, api.sent[0].Text)
	s, err := a.LoginWithCode(t.Context(), code[1])
	require.NoError(t, err)
	assert.Equal(t, int64(461603558), s.Admin.TelegramID)
}
```
(B8 B1 bilan **bitta siklda** yoziladi (outside-in): ikkalasi ham stub `Handle` bilan RED bo'ladi va B1 implementatsiyasi bilan GREEN bo'ladi.)

---

### Task 9: `cmd/otp` (2 sikl)

`backend/cmd/otp/main.go` (yakuniy):
```go
// Command otp prints an admin login code for local development, where the
// admin bot may not run. It works only with SMS_DRIVER=log, the mode in
// which one-time codes may show up in logs.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/config"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func main() {
	telegramID := flag.Int64("telegram-id", 0, "admin to log in as (default: the first active admin)")
	flag.Parse()
	if err := run(context.Background(), *telegramID, os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "otp:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, telegramID int64, getenv func(string) string, out io.Writer) error {
	cfg, err := config.Load(getenv)
	if err != nil {
		return err
	}
	if cfg.SMSDriver != "log" {
		return errors.New("only for local development: set SMS_DRIVER=log")
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if telegramID == 0 {
		if telegramID, err = firstActiveAdmin(ctx, gen.New(pool)); err != nil {
			return err
		}
	}
	code, err := auth.NewAdminAuth(pool, cfg.OTPHMACSecret, cfg.AdminBotToken).IssueLoginCode(ctx, telegramID)
	if err != nil {
		return fmt.Errorf("admin %d: %w", telegramID, err)
	}
	_, err = fmt.Fprintf(out, "Kod: %s (1 daqiqa amal qiladi), admin %d\n", code.Code, telegramID)
	return err
}

func firstActiveAdmin(ctx context.Context, q *gen.Queries) (int64, error) {
	admins, err := q.ListAdmins(ctx)
	if err != nil {
		return 0, err
	}
	for _, a := range admins {
		if a.IsActive {
			return a.TelegramID, nil
		}
	}
	return 0, errors.New("no active admin")
}
```
Test (`main_test.go`):
```go
func testEnv(pool *pgxpool.Pool, smsDriver string) func(string) string {
	env := map[string]string{
		"DATABASE_URL":    pool.Config().ConnString(),
		"OTP_HMAC_SECRET": "test-otp-secret",
		"JWT_SECRET":      "test-jwt-secret",
		"SMS_DRIVER":      smsDriver,
	}
	return func(key string) string { return env[key] }
}
```
- [ ] **O1 kod chiqaradi va u ishlaydi**
```go
func TestRunPrintsAWorkingCode(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	var out bytes.Buffer

	require.NoError(t, run(t.Context(), 0, testEnv(pool, "log"), &out))

	m := regexp.MustCompile(`^Kod: (\d{6}) \(1 daqiqa amal qiladi\), admin 461603558\n$`).FindStringSubmatch(out.String())
	require.Len(t, m, 2, out.String())
	_, err := auth.NewAdminAuth(pool, "test-otp-secret", "").LoginWithCode(t.Context(), m[1])
	assert.NoError(t, err)
}
```
Stub `run`: `return errors.New("not implemented")`.
- [ ] **O2 faqat SMS_DRIVER=log**
```go
func TestRunRefusesOutsideLocalDevelopment(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	err := run(t.Context(), 0, testEnv(pool, "eskiz"), io.Discard)

	assert.ErrorContains(t, err, "SMS_DRIVER=log")
}
```
(RED: O1 GREEN'da guard bo'lmasa `nil`.)

Makefile:
```make
otp:
	cd $(BACKEND) && go run ./cmd/otp $(if $(ID),-telegram-id $(ID))
```
(+ `.PHONY`.) Commit'lar: `feat(otp): make otp prints a login code for local development`, `feat(otp): refuse outside SMS_DRIVER=log`.

---

### Task 10: `cmd/api` wiring

```bash
cd backend && go get github.com/go-telegram/bot@v1.27.0
```
`run()` ichida pool ping'dan keyin:
```go
	adminAuth := auth.NewAdminAuth(pool, cfg.OTPHMACSecret, cfg.AdminBotToken)
	adminAPI := admin.NewHandler(adminAuth, cfg.CookieSecure, httpx.NewRateLimiter(5, time.Minute))
	mounts := []func(chi.Router){adminAPI.Routes}

	adminWebhook, err := startAdminBot(ctx, cfg, adminAuth)
	if err != nil {
		return err
	}
	if adminWebhook != nil {
		mounts = append(mounts, func(r chi.Router) {
			r.With(httpx.TelegramSecret(cfg.TelegramWebhookSecret)).Post(adminbot.WebhookPath, adminWebhook)
		})
	}
	// Handler: httpx.NewRouter(mounts...)
```
```go
// startAdminBot runs the admin bot when ADMIN_BOT_TOKEN is set: polling in
// a goroutine, or, in webhook mode, the handler Telegram's calls must reach.
func startAdminBot(ctx context.Context, cfg config.Config, a *auth.AdminAuth) (http.HandlerFunc, error) {
	if cfg.AdminBotToken == "" {
		slog.Warn("ADMIN_BOT_TOKEN is empty: the admin bot is off")
		return nil, nil
	}
	var handler *adminbot.Handler
	b, err := bot.New(cfg.AdminBotToken,
		bot.WithDefaultHandler(func(ctx context.Context, _ *bot.Bot, u *models.Update) { handler.Handle(ctx, u) }),
		bot.WithErrorsHandler(func(err error) { slog.Error("admin bot", "err", err) }),
	)
	if err != nil {
		return nil, fmt.Errorf("admin bot: %w", err)
	}
	handler = adminbot.NewHandler(b, a)
	if err := adminbot.SetMenuButton(ctx, b, cfg.AdminPanelURL); err != nil {
		slog.Warn("admin bot: menu button not set", "err", err) // Telegram wants an https URL
	}
	if cfg.BotMode == "webhook" {
		if err := adminbot.RegisterWebhook(ctx, b, cfg.PublicAPIURL, cfg.TelegramWebhookSecret); err != nil {
			return nil, err
		}
		go b.StartWebhook(ctx)
		return b.WebhookHandler(), nil
	}
	go b.Start(ctx)
	return nil, nil
}
```
Tekshiruv: `go build ./... && go vet ./...`. Commit: `feat(api): admin auth routes and the admin bot`.

---

### Task 11: openapi + api-client

`openapi.yaml` ga qo'shiladi:
- `components.securitySchemes.adminSession` (apiKey, in: cookie, name: admin_session).
- `components.schemas.Error` (`error`, `message`) va `Admin` (`telegram_id` int64, `full_name` string|null).
- Paths:
  - `/admin/auth/otp`: 200 Admin, 400, 401, 429.
  - `/admin/auth/telegram`: 200, 400, 401, 403.
  - `/admin/auth/logout`: 204.
  - `/admin/me`: 200, 401, `security: [adminSession: []]`.
Request body'lar: `{code}` (pattern `^\d{6}$`), `{initData}`.

So'ng `make api-client` → `pnpm --filter @hisob24/api-client test typecheck`. Commit: `feat(api): openapi for admin auth`.

---

### Task 12: Hujjatlar
- `CLAUDE.md`: `make otp` qatoridan "(3-bosqichdan)" olib tashlanadi, `make otp ID=…` qo'shiladi.
- Dizayn hujjatiga "3-bosqich qarorlari" bo'limi qo'shiladi:
  - XFF ishonch modeli va nginx talabi.
  - Webhook secret noto'g'ri bo'lsa 401.
  - Menu button o'rnatilmasa faqat ogohlantirish (Telegram https URL talab qiladi).
  - `make otp` faqat `SMS_DRIVER=log` da ishlaydi.

Commit: `docs: stage 3 notes`.

---

### Task 13: Tekshiruv
- `make lint` → exit 0; `make test` → exit 0; `go test -count=1 ./...`.
- E2E smoke (`./start.sh`, bot tokensiz):
  1. `make otp` → kod.
  2. `curl -c jar -H 'Content-Type: application/json' -d '{"code":"…"}' localhost:3001/api/admin/auth/otp` → 200 va `Set-Cookie: admin_session=…; HttpOnly; SameSite=Lax` (Secure yo'q, chunki COOKIE_SECURE=false).
  3. `curl -b jar localhost:3001/api/admin/me` → 200.
  4. Logout → 204; `/api/admin/me` → 401.
  5. Noto'g'ri kod bilan 6 ta urinish → oxirgisi 429.
  6. `POST /webhooks/admin-bot` → 404 (token yo'q, bot o'chiq).
- Logda `ADMIN_BOT_TOKEN is empty: the admin bot is off`.
- `git push origin main`, so'ng hisobot.
