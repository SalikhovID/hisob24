# 4-bosqich: Admin API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panel uchun spec 5.3, 5.4, 5.7 va 6-bo'limdagi endpointlar: companylar, ularning userlari, billing va adminlarni boshqarish. Har bir endpoint `openapi.yaml` da tavsiflanadi va real Postgres'da testlanadi.

**Architecture:**
- Biznes qoidalari servislarda:
  - `internal/company` (yaratish, a'zolar, ro'yxat, tafsilot, PATCH);
  - `internal/billing` (`NewEndDate` sof funksiya, `Extend`, `History`);
  - `internal/auth` (admin hisoblari: list, add/reactivate, deactivate).
- Servislar rad etishlarni `internal/apperr.Error` (Kind + code + o'zbekcha matn) bilan qaytaradi. `httpx.WriteError` ularni 400, 404 yoki 409 ga aylantiradi, qolgan xatolar 500.
- Handlerlar `internal/admin` da faqat parse va JSON bilan shug'ullanadi.

**Tech Stack:** Go 1.27, chi, pgx v5, sqlc (2-bosqich so'rovlari + `CurrentDate`), testify, pgtest.

**Spec'da aniq aytilmagan, shu rejada belgilangan API tafsilotlari** (hisobotda aytiladi):
- Ro'yxat sahifasi 20 ta. `page` 1 dan boshlanadi, 1–1 000 000 oralig'ida. Javob: `{items, total, page, page_size}`.
- Company JSON'ida `days_left` bor: `end_date − CURRENT_DATE` (DB soati). Muddati o'tgan bo'lsa manfiy. Frontend badge'i va billing preview (`today = end_date − days_left`) shundan hisoblanadi.
- Summa JSON'da satr (`"150000.50"`), bazada `NUMERIC(14,2)`. Format: `^\d{1,12}(\.\d{1,2})?$`.
- `days` 1–3650 oralig'ida (DB'da `days > 0`; yuqori chegara sana to'lib ketishidan himoya).
- Validatsiya xatosi: 400 `validation_error` va aniq o'zbekcha matn.
  - Topilmadi: 404 `not_found`.
  - To'qnashuvlar: 409 `admin_exists`, `cannot_delete_self`, `last_admin`.
- Majburiy maydonlar spec belgisidan olinadi: spec ixtiyoriylarni `?` bilan yozadi (`{days, amount?, note?}`). Demak `owner_full_name`, user `full_name` va `role`, admin `full_name` majburiy. Bo'sh yoki faqat bo'shliqdan iborat qiymat → 400.
- Muvaffaqiyatli yaratish → 201. DELETE → 204.

**Buyruqlar:** `$SCRATCH/tdd2.sh red|green <pkg> <TestRegex> "<label>" ["commit"]` (3-bosqichdan). `make sqlc` yangi so'rovdan keyin.

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `internal/apperr/apperr.go` | `Kind` (Invalid/NotFound/Conflict), `Error`, `New` |
| `internal/httpx/request.go` | + `WriteError` |
| `internal/db/queries/clock.sql`, `internal/db/clock_test.go` | `CurrentDate` |
| `internal/billing/billing.go` (+`_test`) | `NewEndDate` |
| `internal/billing/service.go` (+`_test`) | `Service.Extend`, `Service.History` |
| `internal/company/company.go` | `Service`, `Company`, `Member`, yordamchilar |
| `internal/company/{create,members,list,detail}.go` (+`company_test.go`) | `Create`, `AddUser`, `List`, `Get`, `Update` |
| `internal/auth/admin_accounts.go` (+`_test`) | `ListAdmins`, `AddAdmin`, `DeactivateAdmin` |
| `internal/admin/{companies,billings,admins,json}.go` (+testlar) | `/admin` endpointlari |
| `cmd/api/main.go` | servislar wiring |
| `openapi.yaml`, `packages/api-client/src/schema.d.ts` | kontrakt |

---

### Task 1: `apperr` + `httpx.WriteError` (1 sikl)

`backend/internal/apperr/apperr.go`:
```go
// Package apperr carries refusals from the services to the API: what kind
// of refusal it is, a snake_case code and the Uzbek message the client shows.
package apperr

// Kind decides the HTTP status a refusal maps to.
type Kind int

const (
	// Invalid is a request that breaks a rule (400).
	Invalid Kind = iota + 1
	// NotFound is a missing resource (404).
	NotFound
	// Conflict clashes with the current state (409).
	Conflict
)

// Error is a refusal the client should see.
type Error struct {
	Kind    Kind
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// New builds a refusal.
func New(kind Kind, code, message string) *Error {
	return &Error{Kind: kind, Code: code, Message: message}
}
```
- [ ] **W1 RED** (`request_test.go`):
```go
func TestWriteError(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		code int
		body string
	}{
		"invalid":   {apperr.New(apperr.Invalid, "validation_error", "Nomi kiritilmagan"), 400, `{"error":"validation_error","message":"Nomi kiritilmagan"}`},
		"not found": {apperr.New(apperr.NotFound, "not_found", "Topilmadi"), 404, `{"error":"not_found","message":"Topilmadi"}`},
		"conflict":  {fmt.Errorf("deactivate: %w", apperr.New(apperr.Conflict, "last_admin", "Kamida bitta")), 409, `{"error":"last_admin","message":"Kamida bitta"}`},
		"other":     {errors.New("db down"), 500, `{"error":"internal_error","message":"Ichki xatolik. Birozdan keyin qayta urinib ko'ring"}`},
	} {
		rec := httptest.NewRecorder()
		WriteError(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil), tc.err)
		assert.Equal(t, tc.code, rec.Code, name)
		assert.JSONEq(t, tc.body, rec.Body.String(), name)
	}
}
```
Stub: `func WriteError(w http.ResponseWriter, r *http.Request, err error) {}` → RED `expected: 400 actual: 200`.
- [ ] **W1 GREEN:**
```go
// WriteError answers err: an *apperr.Error with its status, code and
// message, anything else with a logged 500.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var e *apperr.Error
	if !errors.As(err, &e) {
		InternalError(w, r, err)
		return
	}
	status := map[apperr.Kind]int{
		apperr.Invalid:  http.StatusBadRequest,
		apperr.NotFound: http.StatusNotFound,
		apperr.Conflict: http.StatusConflict,
	}[e.Kind]
	if status == 0 {
		InternalError(w, r, err)
		return
	}
	Error(w, status, e.Code, e.Message)
}
```
Commit: `feat(httpx): WriteError turns service refusals into 400, 404 and 409`

---

### Task 2: `CurrentDate` so'rovi (1 sikl)

- [ ] RED. `internal/db/clock_test.go`:
```go
package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCurrentDate(t *testing.T) {
	q, pool := setup(t)

	got, err := q.CurrentDate(t.Context())

	require.NoError(t, err)
	assert.True(t, got.Equal(today(t, pool)), "got %s", got)
}
```
`internal/db/queries/clock.sql` stub: `-- name: CurrentDate :one` / `SELECT (CURRENT_DATE - 1)::date AS today;`. RED: `got <kecha>`.
- [ ] GREEN:
```sql
-- name: CurrentDate :one
-- The database's today: every end_date check counts from it.
SELECT CURRENT_DATE::date AS today;
```
Commit: `feat(db): CurrentDate query`

---

### Task 3: `billing.NewEndDate` (2 sikl, spec talabi: alohida testlar)

`internal/billing/billing_test.go`:
```go
package billing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestNewEndDate(t *testing.T) {
	today := day("2026-10-02")
	tests := []struct {
		name    string
		endDate time.Time
		days    int
		want    time.Time
	}{
		// N1 qatorlari:
		{"not expired: the days follow the end date", day("2026-10-20"), 30, day("2026-11-19")},
		{"ends today: still counts from the end date", day("2026-10-02"), 1, day("2026-10-03")},
		// N2 qatori:
		{"expired: the days start today", day("2026-09-01"), 30, day("2026-11-01")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, NewEndDate(tt.endDate, today, tt.days))
		})
	}
}
```
- [ ] **N1** (birinchi ikki qator). Stub `return time.Time{}` → RED. GREEN: `return endDate.AddDate(0, 0, days)`. Commit: `feat(billing): paid days follow a running end date`.
- [ ] **N2** (uchinchi qator). RED: `2026-10-01` (kutilgan `2026-11-01`). GREEN:
```go
// Package billing extends a company's paid period.
package billing

import "time"

// NewEndDate is a company's end date after paying for days more: the paid
// days follow the current end date, or start today once that has passed
// (GREATEST(end_date, CURRENT_DATE) + days).
func NewEndDate(endDate, today time.Time, days int) time.Time {
	start := endDate
	if today.After(endDate) {
		start = today
	}
	return start.AddDate(0, 0, days)
}
```
Commit: `feat(billing): an expired company's paid days start today`

---

### Task 4: `billing.Service` (3 sikl, real Postgres)

`internal/billing/service.go` (yakuniy):
```go
package billing

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// MaxDays bounds one payment: ten years, well inside the date range.
const MaxDays = 3650

var amountPattern = regexp.MustCompile(`^\d{1,12}(\.\d{1,2})?$`)

// Service records payments.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the billing service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// ExtendInput is one payment: Amount and Note may be empty.
type ExtendInput struct {
	Days   int
	Amount string
	Note   string
}

// Extend pays for in.Days more in one transaction: the company row is
// locked, the new end date computed with NewEndDate from the database's
// today, the company updated and the payment recorded.
func (s *Service) Extend(ctx context.Context, companyID int64, in ExtendInput, adminID int64) (gen.Billing, error) {
	if in.Days < 1 || in.Days > MaxDays {
		return gen.Billing{}, apperr.New(apperr.Invalid, "validation_error", "Kunlar soni 1 dan 3650 gacha bo'lishi kerak")
	}
	var amount pgtype.Numeric
	if in.Amount != "" {
		if !amountPattern.MatchString(in.Amount) {
			return gen.Billing{}, apperr.New(apperr.Invalid, "validation_error", "Summa noto'g'ri")
		}
		if err := amount.Scan(in.Amount); err != nil {
			return gen.Billing{}, apperr.New(apperr.Invalid, "validation_error", "Summa noto'g'ri")
		}
	}
	var note *string
	if n := strings.TrimSpace(in.Note); n != "" {
		note = &n
	}

	var b gen.Billing
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		row, err := q.LockCompanyEndDate(ctx, companyID)
		if errors.Is(err, pgx.ErrNoRows) {
			return errCompanyNotFound
		}
		if err != nil {
			return err
		}
		newEnd := NewEndDate(row.EndDate, row.Today, in.Days)
		if err := q.SetCompanyEndDate(ctx, gen.SetCompanyEndDateParams{ID: companyID, EndDate: newEnd}); err != nil {
			return err
		}
		b, err = q.CreateBilling(ctx, gen.CreateBillingParams{
			CompanyID:   companyID,
			Days:        int32(in.Days),
			Amount:      amount,
			PrevEndDate: row.EndDate,
			NewEndDate:  newEnd,
			Note:        note,
			CreatedBy:   &adminID,
		})
		return err
	})
	return b, err
}

// History lists a company's payments, newest first.
func (s *Service) History(ctx context.Context, companyID int64) ([]gen.Billing, error) {
	if _, err := s.q.GetCompany(ctx, companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errCompanyNotFound
		}
		return nil, err
	}
	return s.q.ListBillings(ctx, companyID)
}

var errCompanyNotFound = apperr.New(apperr.NotFound, "not_found", "Kompaniya topilmadi")
```
Test helperlari (`service_test.go`):
```go
const ownerID int64 = 461603558

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func dbToday(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}

func createCompany(t *testing.T, pool *pgxpool.Pool, endDate time.Time) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO companies (name, end_date) VALUES ('Olma', $1) RETURNING id", endDate).Scan(&id))
	return id
}

func endDateOf(t *testing.T, pool *pgxpool.Pool, id int64) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT end_date FROM companies WHERE id = $1", id).Scan(&d))
	return d
}

func amountText(t *testing.T, n pgtype.Numeric) string {
	t.Helper()
	v, err := n.Value()
	require.NoError(t, err)
	s, _ := v.(string)
	return s
}
```
- [ ] **B1 RED: Extend sanani suradi** (uchta test bitta siklda; stub `errors.New("not implemented")`):
```go
func TestExtendFromTheEndDate(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))

	b, err := s.Extend(t.Context(), id, ExtendInput{Days: 30, Amount: "150000.50", Note: " Naqd "}, ownerID)

	require.NoError(t, err)
	assert.True(t, b.PrevEndDate.Equal(d.AddDate(0, 0, 5)))
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 35)))
	assert.Equal(t, "150000.50", amountText(t, b.Amount))
	assert.Equal(t, "Naqd", *b.Note)
	assert.Equal(t, ownerID, *b.CreatedBy)
	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 35)), "the company's end date moves too")
}

func TestExtendAnExpiredCompanyFromToday(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, -10))

	b, err := s.Extend(t.Context(), id, ExtendInput{Days: 30}, ownerID)

	require.NoError(t, err)
	assert.True(t, b.PrevEndDate.Equal(d.AddDate(0, 0, -10)))
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 30)))
	assert.False(t, b.Amount.Valid, "no amount")
	assert.Nil(t, b.Note)
}

func TestConcurrentExtensionsChain(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d.AddDate(0, 0, 5))

	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Go(func() {
			_, err := s.Extend(t.Context(), id, ExtendInput{Days: 10}, ownerID)
			errs <- err
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	assert.True(t, endDateOf(t, pool, id).Equal(d.AddDate(0, 0, 25)), "both payments count")
	h, err := s.History(t.Context(), id)
	require.NoError(t, err)
	require.Len(t, h, 2)
	assert.True(t, h[0].PrevEndDate.Equal(h[1].NewEndDate), "the later payment starts where the earlier ended")
}
```
(`History` bu siklda stub `nil, errors.New("not implemented")`. Concurrency testi uni ishlatadi, shuning uchun B1 GREEN'da `History` ham yoziladi. B3 da uning alohida testi bor.)
- [ ] **B1 GREEN:** validatsiyasiz `Extend` (lock → `NewEndDate` → update → insert) va `History`. Commit: `feat(billing): Extend moves the end date in one locked transaction`.
- [ ] **B2 RED: rad etishlar**
```go
func TestExtendRefusals(t *testing.T) {
	s, pool := newService(t)
	id := createCompany(t, pool, dbToday(t, pool))
	for name, tc := range map[string]struct {
		companyID int64
		in        ExtendInput
		kind      apperr.Kind
	}{
		"no days":          {id, ExtendInput{Days: 0}, apperr.Invalid},
		"over ten years":   {id, ExtendInput{Days: 3651}, apperr.Invalid},
		"amount not money": {id, ExtendInput{Days: 1, Amount: "ko'p"}, apperr.Invalid},
		"negative amount":  {id, ExtendInput{Days: 1, Amount: "-5"}, apperr.Invalid},
		"three decimals":   {id, ExtendInput{Days: 1, Amount: "1.234"}, apperr.Invalid},
		"unknown company":  {id + 1, ExtendInput{Days: 1}, apperr.NotFound},
	} {
		_, err := s.Extend(t.Context(), tc.companyID, tc.in, ownerID)
		var e *apperr.Error
		require.ErrorAs(t, err, &e, name)
		assert.Equal(t, tc.kind, e.Kind, name)
	}
}
```
RED: `3651` o'tib ketadi, xom DB va `Scan` xatolari chiqadi. GREEN: yakuniy koddagi validatsiyalar va `errCompanyNotFound`. Commit: `feat(billing): refuse bad days, amounts and unknown companies`.
- [ ] **B3: History** (B1'da yozilgan kodning alohida xatti-harakati):
```go
func TestHistory(t *testing.T) {
	s, pool := newService(t)
	d := dbToday(t, pool)
	id := createCompany(t, pool, d)
	other := createCompany(t, pool, d)
	first, err := s.Extend(t.Context(), id, ExtendInput{Days: 30}, ownerID)
	require.NoError(t, err)
	second, err := s.Extend(t.Context(), id, ExtendInput{Days: 7}, ownerID)
	require.NoError(t, err)
	_, err = s.Extend(t.Context(), other, ExtendInput{Days: 1}, ownerID)
	require.NoError(t, err)

	h, err := s.History(t.Context(), id)
	require.NoError(t, err)
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{h[0].ID, h[1].ID})

	_, err = s.History(t.Context(), other+1)
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.NotFound, e.Kind)
}
```
RED: B1'dagi `History` kompaniya borligini tekshirmaydi → `[]` va `nil`. GREEN: `GetCompany` tekshiruvi. Commit: `feat(billing): History of an unknown company is not found`.

---

### Task 5: `company.Service` (7 sikl, real Postgres)

`internal/company/company.go`:
```go
// Package company runs the admin panel's company operations.
package company

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// PageSize is how many companies a list page holds.
const PageSize = 20

// Service runs the company operations.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the company service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// Company is a company with the days its paid period has left, counted from
// the database's today; negative once it has expired.
type Company struct {
	gen.Company
	DaysLeft int
}

// withDaysLeft counts in Unix seconds: both dates are UTC midnights, and a
// far end date would overflow the time.Duration that Sub returns.
func withDaysLeft(c gen.Company, today time.Time) Company {
	return Company{Company: c, DaysLeft: int((c.EndDate.Unix() - today.Unix()) / 86400)}
}

// Member is a company user with the role there.
type Member struct {
	Phone     string
	FullName  *string
	Role      string
	CreatedAt time.Time
}

var errNotFound = apperr.New(apperr.NotFound, "not_found", "Kompaniya topilmadi")

func invalid(message string) error {
	return apperr.New(apperr.Invalid, "validation_error", message)
}
```
Test helperlari (`company_test.go`):
```go
const ownerID int64 = 461603558

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func dbToday(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}

func mustCreate(t *testing.T, s *Service, name string, endDate time.Time) Company {
	t.Helper()
	c, err := s.Create(t.Context(), CreateInput{Name: name, EndDate: endDate, OwnerPhone: "998900000001", OwnerFullName: "Egasi"}, ownerID)
	require.NoError(t, err)
	return c
}

func kindOf(t *testing.T, err error) apperr.Kind {
	t.Helper()
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	return e.Kind
}

func ptr[T any](v T) *T { return &v }
```
- [ ] **C1 Create** — test:
```go
func TestCreate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	end := dbToday(t, pool).AddDate(0, 0, 30)

	c, err := s.Create(ctx, CreateInput{Name: "  Olma MChJ ", EndDate: end, OwnerPhone: "+998 90 123 45 67", OwnerFullName: "Ali Valiyev"}, ownerID)

	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", c.Name)
	assert.True(t, c.EndDate.Equal(end))
	assert.Equal(t, 30, c.DaysLeft)
	assert.Equal(t, ownerID, *c.CreatedBy)
	var role, name string
	require.NoError(t, pool.QueryRow(ctx, `SELECT uc.role, u.full_name FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1 AND uc.user_phone = '998901234567'`, c.ID).Scan(&role, &name))
	assert.Equal(t, "owner", role)
	assert.Equal(t, "Ali Valiyev", name)

	second, err := s.Create(ctx, CreateInput{Name: "Nok", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: "Boshqa Ism"}, ownerID)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, `SELECT u.full_name FROM user_companies uc JOIN users u ON u.phone = uc.user_phone
		WHERE uc.company_id = $1`, second.ID).Scan(&name))
	assert.Equal(t, "Ali Valiyev", name, "an existing user is reused unchanged")
}
```
Yakuniy `create.go`:
```go
package company

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// CreateInput is a new company and its owner.
type CreateInput struct {
	Name          string
	EndDate       time.Time
	OwnerPhone    string
	OwnerFullName string
}

// Create adds a company with its owner in one transaction: the company row,
// the owner's user row (an existing user is reused unchanged) and the owner
// membership.
func (s *Service) Create(ctx context.Context, in CreateInput, adminID int64) (Company, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Company{}, invalid("Kompaniya nomini kiriting")
	}
	phone, err := user.NormalizePhone(in.OwnerPhone)
	if err != nil {
		return Company{}, invalid("Egasining telefon raqami noto'g'ri")
	}
	ownerName := strings.TrimSpace(in.OwnerFullName)
	if ownerName == "" {
		return Company{}, invalid("Egasining ismini kiriting")
	}

	var created Company
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		c, err := q.CreateCompany(ctx, gen.CreateCompanyParams{Name: name, EndDate: in.EndDate, CreatedBy: &adminID})
		if err != nil {
			return err
		}
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: phone, FullName: &ownerName}); err != nil {
			return err
		}
		if _, err := q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: phone, CompanyID: c.ID, Role: "owner"}); err != nil {
			return err
		}
		today, err := q.CurrentDate(ctx)
		if err != nil {
			return err
		}
		created = withDaysLeft(c, today)
		return nil
	})
	return created, err
}
```
C1 GREEN validatsiyasiz bo'ladi: telefon xatosi xom holda qaytadi, bo'sh nom tekshirilmaydi. Commit: `feat(company): Create adds a company and its owner in one transaction`.
- [ ] **C2 Create validatsiyasi**
```go
func TestCreateValidation(t *testing.T) {
	s, pool := newService(t)
	end := dbToday(t, pool)
	for name, tc := range map[string]struct {
		in      CreateInput
		message string
	}{
		"no name":   {CreateInput{Name: "  ", EndDate: end, OwnerPhone: "998901234567"}, "Kompaniya nomini kiriting"},
		"bad phone": {CreateInput{Name: "Olma", EndDate: end, OwnerPhone: "12ab"}, "Egasining telefon raqami noto'g'ri"},
		"no owner name": {CreateInput{Name: "Olma", EndDate: end, OwnerPhone: "998901234567", OwnerFullName: " "}, "Egasining ismini kiriting"},
	} {
		_, err := s.Create(t.Context(), tc.in, ownerID)
		var e *apperr.Error
		require.ErrorAs(t, err, &e, name)
		assert.Equal(t, apperr.Invalid, e.Kind, name)
		assert.Equal(t, tc.message, e.Message, name)
	}
	var companies int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM companies").Scan(&companies))
	assert.Zero(t, companies, "nothing is written")
}
```
RED: bo'sh nom va bo'sh egasi ismi bilan company yaratiladi; telefon xatosi `apperr` emas. GREEN: yakuniy `Create` boshidagi tekshiruvlar. Commit: `feat(company): Create refuses an empty name and a bad phone`.
- [ ] **C3 AddUser**
```go
func TestAddUser(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	m, err := s.AddUser(t.Context(), c.ID, "90 222 33 44", "Xodim", "staff")
	require.NoError(t, err)
	assert.Equal(t, "998902223344", m.Phone)
	assert.Equal(t, "Xodim", *m.FullName)
	assert.Equal(t, "staff", m.Role)

	m, err = s.AddUser(t.Context(), c.ID, "998902223344", "Boshqa Ism", "manager")
	require.NoError(t, err)
	assert.Equal(t, "manager", m.Role, "a member gets the new role")
	assert.Equal(t, "Xodim", *m.FullName, "and keeps the name")
}
```
Yakuniy `members.go`:
```go
package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var roles = map[string]bool{"owner": true, "manager": true, "staff": true}

// AddUser adds a user to the company in one transaction; a user who is
// already a member gets the new role, an existing user keeps the name.
func (s *Service) AddUser(ctx context.Context, companyID int64, phone, fullName, role string) (Member, error) {
	if !roles[role] {
		return Member{}, invalid("Rol owner, manager yoki staff bo'lishi kerak")
	}
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, invalid("Telefon raqami noto'g'ri")
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return Member{}, invalid("Ismni kiriting")
	}
	var m Member
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.GetCompany(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errNotFound
			}
			return err
		}
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
			return err
		}
		uc, err := q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: normalized, CompanyID: companyID, Role: role})
		if err != nil {
			return err
		}
		u, err := q.GetUser(ctx, normalized)
		if err != nil {
			return err
		}
		m = Member{Phone: u.Phone, FullName: u.FullName, Role: uc.Role, CreatedAt: uc.CreatedAt}
		return nil
	})
	return m, err
}
```
C3 GREEN'da rol va company tekshiruvi bo'lmaydi (C4'da qo'shiladi). Commit: `feat(company): AddUser adds a member or changes the role`.
- [ ] **C4 AddUser rad etishlari**
```go
func TestAddUserRefusals(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))
	for name, tc := range map[string]struct {
		companyID             int64
		phone, fullName, role string
		kind                  apperr.Kind
	}{
		"unknown company": {c.ID + 1, "998902223344", "Xodim", "staff", apperr.NotFound},
		"bad role":        {c.ID, "998902223344", "Xodim", "boss", apperr.Invalid},
		"bad phone":       {c.ID, "12ab", "Xodim", "staff", apperr.Invalid},
		"no name":         {c.ID, "998902223344", " ", "staff", apperr.Invalid},
	} {
		_, err := s.AddUser(t.Context(), tc.companyID, tc.phone, tc.fullName, tc.role)
		assert.Equal(t, tc.kind, kindOf(t, err), name)
	}
}
```
RED: xom FK, check va telefon xatolari; bo'sh ism yoziladi. Commit: `feat(company): AddUser refuses unknown companies, roles and phones`.
- [ ] **C5 List**
```go
func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	d := dbToday(t, pool)
	mustCreate(t, s, "Olma Savdo", d.AddDate(0, 0, 10))
	mustCreate(t, s, "Nok Market", d)
	mustCreate(t, s, "Olcha Servis", d.AddDate(0, 0, -1))
	blocked := mustCreate(t, s, "Behi 50% Blok", d.AddDate(0, 0, 30))
	_, err := pool.Exec(ctx, "UPDATE companies SET is_active = false WHERE id = $1", blocked.ID)
	require.NoError(t, err)

	page, err := s.List(ctx, ListInput{Status: "expired", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, int64(2), page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, 20, page.PageSize)
	require.Len(t, page.Items, 2)
	assert.Equal(t, "Behi 50% Blok", page.Items[0].Name)
	assert.Equal(t, 30, page.Items[0].DaysLeft)
	assert.Equal(t, "Olcha Servis", page.Items[1].Name)
	assert.Equal(t, -1, page.Items[1].DaysLeft)

	page, err = s.List(ctx, ListInput{Search: " % ", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total, "% is a character, not a wildcard")

	page, err = s.List(ctx, ListInput{Page: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(4), page.Total)
	assert.Empty(t, page.Items)
}
```
Yakuniy `list.go`:
```go
package company

import (
	"context"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// ListInput filters the company list: Search matches the name, Status is
// "", "active" or "expired", Page starts at 1.
type ListInput struct {
	Search string
	Status string
	Page   int
}

// Page is one page of companies and the count of all that match.
type Page struct {
	Items    []Company
	Total    int64
	Page     int
	PageSize int
}

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// List returns a page of companies, newest first.
func (s *Service) List(ctx context.Context, in ListInput) (Page, error) {
	if in.Status != "" && in.Status != "active" && in.Status != "expired" {
		return Page{}, invalid("Status active yoki expired bo'lishi kerak")
	}
	if in.Page < 1 || in.Page > maxPage {
		return Page{}, invalid("Sahifa raqami noto'g'ri")
	}
	var search, status *string
	if term := strings.TrimSpace(in.Search); term != "" {
		escaped := likeEscaper.Replace(term)
		search = &escaped
	}
	if in.Status != "" {
		status = &in.Status
	}

	total, err := s.q.CountCompanies(ctx, gen.CountCompaniesParams{Search: search, Status: status})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListCompanies(ctx, gen.ListCompaniesParams{
		Search: search, Status: status,
		Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Page{}, err
	}
	items := make([]Company, 0, len(rows))
	for _, c := range rows {
		items = append(items, withDaysLeft(c, today))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// likeEscaper makes a search term match literally inside ILIKE, whose escape
// character is the backslash.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
```
C5 GREEN'da status va page validatsiyasi bo'lmaydi (C6'da qo'shiladi). Commit: `feat(company): List pages companies with days left; search is literal`.
- [ ] **C6 List validatsiyasi**
```go
func TestListValidation(t *testing.T) {
	s, _ := newService(t)
	for name, in := range map[string]ListInput{
		"unknown status": {Status: "deleted", Page: 1},
		"page zero":      {Page: 0},
		"page too far":   {Page: 1_000_001},
	} {
		_, err := s.List(t.Context(), in)
		assert.Equal(t, apperr.Invalid, kindOf(t, err), name)
	}
}
```
Commit: `feat(company): List refuses unknown statuses and pages`.
- [ ] **C7 Get + Update** — ikki sikl, har biri o'z testi bilan. Yakuniy `detail.go`:
```go
package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Detail is a company with its users.
type Detail struct {
	Company
	Users []Member
}

// Get returns a company and its users.
func (s *Service) Get(ctx context.Context, id int64) (Detail, error) {
	c, err := s.q.GetCompany(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, errNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	rows, err := s.q.ListCompanyUsers(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Detail{}, err
	}
	users := make([]Member, 0, len(rows))
	for _, u := range rows {
		users = append(users, Member{Phone: u.Phone, FullName: u.FullName, Role: u.Role, CreatedAt: u.CreatedAt})
	}
	return Detail{Company: withDaysLeft(c, today), Users: users}, nil
}

// Update changes the name and the active flag; a nil argument keeps the
// column as it is.
func (s *Service) Update(ctx context.Context, id int64, name *string, isActive *bool) (Company, error) {
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return Company{}, invalid("Kompaniya nomini kiriting")
		}
		name = &trimmed
	}
	c, err := s.q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: id, Name: name, IsActive: isActive})
	if errors.Is(err, pgx.ErrNoRows) {
		return Company{}, errNotFound
	}
	if err != nil {
		return Company{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Company{}, err
	}
	return withDaysLeft(c, today), nil
}
```
Get testi:
```go
func TestGet(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool).AddDate(0, 0, 3))
	_, err := s.AddUser(t.Context(), c.ID, "998902223344", "Xodim", "staff")
	require.NoError(t, err)

	d, err := s.Get(t.Context(), c.ID)
	require.NoError(t, err)
	assert.Equal(t, c.ID, d.ID)
	assert.Equal(t, 3, d.DaysLeft)
	require.Len(t, d.Users, 2)
	assert.Equal(t, "owner", d.Users[0].Role)
	assert.Equal(t, "staff", d.Users[1].Role)

	_, err = s.Get(t.Context(), c.ID+1)
	assert.Equal(t, apperr.NotFound, kindOf(t, err))
}
```
Update testi:
```go
func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	c := mustCreate(t, s, "Olma", dbToday(t, pool))

	u, err := s.Update(t.Context(), c.ID, ptr("  Olma MChJ "), nil)
	require.NoError(t, err)
	assert.Equal(t, "Olma MChJ", u.Name)
	assert.True(t, u.IsActive)

	u, err = s.Update(t.Context(), c.ID, nil, ptr(false))
	require.NoError(t, err)
	assert.False(t, u.IsActive)
	assert.Equal(t, "Olma MChJ", u.Name)

	_, err = s.Update(t.Context(), c.ID, ptr(" "), nil)
	assert.Equal(t, apperr.Invalid, kindOf(t, err))
	_, err = s.Update(t.Context(), c.ID+1, ptr("X"), nil)
	assert.Equal(t, apperr.NotFound, kindOf(t, err))
}
```
Commit'lar: `feat(company): Get returns a company with its users`, `feat(company): Update renames and blocks`.

---

### Task 6: admin hisoblari (`auth`, 4 sikl)

Yakuniy `internal/auth/admin_accounts.go`:
```go
package auth

import (
	"context"
	"errors"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// ListAdmins returns every admin, active or not.
func (a *AdminAuth) ListAdmins(ctx context.Context) ([]gen.Admin, error) {
	return a.q.ListAdmins(ctx)
}

// AddAdmin adds an admin, or reactivates a deactivated one with the new
// name. An active admin with that Telegram ID is a conflict.
func (a *AdminAuth) AddAdmin(ctx context.Context, telegramID int64, fullName string) (gen.Admin, error) {
	if telegramID <= 0 {
		return gen.Admin{}, apperr.New(apperr.Invalid, "validation_error", "Telegram ID noto'g'ri")
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return gen.Admin{}, apperr.New(apperr.Invalid, "validation_error", "Adminning ismini kiriting")
	}
	admin, err := a.q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: telegramID, FullName: &name})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.Admin{}, apperr.New(apperr.Conflict, "admin_exists", "Bu admin allaqachon faol")
	}
	return admin, err
}

// DeactivateAdmin turns an admin off and ends their sessions. Admins cannot
// turn themselves off, and the last active admin stays: the active rows are
// locked, so two admins turning each other off cannot both win.
func (a *AdminAuth) DeactivateAdmin(ctx context.Context, actorID, telegramID int64) error {
	if actorID == telegramID {
		return apperr.New(apperr.Conflict, "cannot_delete_self", "O'zingizni o'chira olmaysiz")
	}
	return pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		active, err := q.LockActiveAdmins(ctx)
		if err != nil {
			return err
		}
		if !slices.Contains(active, telegramID) {
			return apperr.New(apperr.NotFound, "not_found", "Faol admin topilmadi")
		}
		if len(active) == 1 {
			return apperr.New(apperr.Conflict, "last_admin", "Kamida bitta faol admin qolishi kerak")
		}
		if _, err := q.DeactivateAdmin(ctx, telegramID); err != nil {
			return err
		}
		return q.DeleteAdminSessionsByAdmin(ctx, telegramID)
	})
}
```
Testlar (`admin_accounts_test.go`, 3-bosqichdagi `newAdminAuth`, `mustExec` va `ownerID` dan foydalanadi):
- [ ] **A1 ListAdmins**
```go
func TestListAdmins(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name, is_active, created_at) VALUES (42, 'Ikkinchi', false, now() + interval '1 minute')")

	admins, err := a.ListAdmins(t.Context())

	require.NoError(t, err)
	require.Len(t, admins, 2)
	assert.Equal(t, ownerID, admins[0].TelegramID)
	assert.False(t, admins[1].IsActive)
}
```
- [ ] **A2 AddAdmin** (yangi, qayta faollashtirish, 409):
```go
func TestAddAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()

	added, err := a.AddAdmin(ctx, 42, "  Yangi Admin ")
	require.NoError(t, err)
	assert.True(t, added.IsActive)
	assert.Equal(t, "Yangi Admin", *added.FullName)

	mustExec(t, pool, "UPDATE admins SET is_active = false WHERE telegram_id = 42")
	back, err := a.AddAdmin(ctx, 42, "Qaytgan")
	require.NoError(t, err)
	assert.True(t, back.IsActive)
	assert.Equal(t, "Qaytgan", *back.FullName)

	_, err = a.AddAdmin(ctx, ownerID, "Boshqa")
	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "admin_exists", e.Code)
}
```
- [ ] **A3 AddAdmin validatsiyasi**
```go
func TestAddAdminValidation(t *testing.T) {
	a, _ := newAdminAuth(t)
	for name, tc := range map[string]struct {
		id   int64
		name string
	}{
		"no telegram id": {0, "Ism"},
		"no name":        {43, "  "},
	} {
		_, err := a.AddAdmin(t.Context(), tc.id, tc.name)
		var e *apperr.Error
		require.ErrorAs(t, err, &e, name)
		assert.Equal(t, apperr.Invalid, e.Kind, name)
	}
}
```
- [ ] **A4 DeactivateAdmin** (asosiy holat, keyin rad etishlar alohida siklda):
```go
func TestDeactivateAdmin(t *testing.T) {
	a, pool := newAdminAuth(t)
	ctx := t.Context()
	mustExec(t, pool, "INSERT INTO admins (telegram_id, full_name) VALUES (42, 'Ikkinchi')")
	issued, err := a.IssueLoginCode(ctx, 42)
	require.NoError(t, err)
	s, err := a.LoginWithCode(ctx, issued.Code)
	require.NoError(t, err)

	require.NoError(t, a.DeactivateAdmin(ctx, ownerID, 42))

	active, err := a.IsActiveAdmin(ctx, 42)
	require.NoError(t, err)
	assert.False(t, active)
	_, err = a.Authenticate(ctx, s.ID.String())
	assert.ErrorIs(t, err, ErrUnauthenticated, "the sessions end too")
}

func TestDeactivateAdminRefusals(t *testing.T) {
	a, pool := newAdminAuth(t)
	mustExec(t, pool, "INSERT INTO admins (telegram_id, is_active) VALUES (42, false)")
	for name, tc := range map[string]struct {
		actor, target int64
		code          string
	}{
		"self":             {ownerID, ownerID, "cannot_delete_self"},
		"unknown":          {ownerID, 999, "not_found"},
		"already inactive": {ownerID, 42, "not_found"},
		"the last admin":   {42, ownerID, "last_admin"},
	} {
		err := a.DeactivateAdmin(t.Context(), tc.actor, tc.target)
		var e *apperr.Error
		require.ErrorAs(t, err, &e, name)
		assert.Equal(t, tc.code, e.Code, name)
	}
}
```
Bu ikki test ikki siklda yoziladi:
1. Birinchi siklda minimal GREEN `DeactivateAdmin` + `DeleteAdminSessionsByAdmin`.
2. Ikkinchi siklda rad etishlar qo'shiladi; RED'da o'zini o'chirish muvaffaqiyatli o'tadi.

Commit'lar: `feat(auth): list admins`, `feat(auth): add or reactivate an admin`, `feat(auth): AddAdmin validation`, `feat(auth): deactivate an admin and end their sessions`, `feat(auth): admins cannot remove themselves or the last admin`.

---

### Task 7: `/admin` HTTP endpointlari

- [ ] **Refactor (xatti-harakat o'zgarmaydi):**
```go
// Services is what the /admin API runs on.
type Services struct {
	Auth      *auth.AdminAuth
	Companies *company.Service
	Billing   *billing.Service
}

// NewHandler wires the /admin API. otpLimiter caps code attempts per IP.
func NewHandler(s Services, cookieSecure bool, otpLimiter *httpx.RateLimiter) *Handler
```
`Services` uchala maydon bilan e'lon qilinadi. `Handler` esa avval faqat `auth` maydonini oladi; `companies` H1 da, `billing` H6 da qo'shiladi, chunki ishlatilmagan maydonni `unused` linteri ushlaydi. `newTestAPI` va `cmd/api` uchala servisni beradi. `go test ./...` yashil bo'lgach commit: `refactor(admin): the handler takes its services together`.

`internal/admin/json.go`:
```go
package admin

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

type companyJSON struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	EndDate   string    `json:"end_date"`
	IsActive  bool      `json:"is_active"`
	DaysLeft  int       `json:"days_left"`
	CreatedAt time.Time `json:"created_at"`
}

func toCompanyJSON(c company.Company) companyJSON {
	return companyJSON{ID: c.ID, Name: c.Name, EndDate: c.EndDate.Format(time.DateOnly), IsActive: c.IsActive, DaysLeft: c.DaysLeft, CreatedAt: c.CreatedAt}
}

type memberJSON struct {
	Phone     string    `json:"phone"`
	FullName  *string   `json:"full_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func toMemberJSON(m company.Member) memberJSON {
	return memberJSON{Phone: m.Phone, FullName: m.FullName, Role: m.Role, CreatedAt: m.CreatedAt}
}

type detailJSON struct {
	companyJSON
	Users []memberJSON `json:"users"`
}

type pageJSON struct {
	Items    []companyJSON `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type billingJSON struct {
	ID          int64     `json:"id"`
	CompanyID   int64     `json:"company_id"`
	Days        int32     `json:"days"`
	Amount      *string   `json:"amount"`
	PrevEndDate string    `json:"prev_end_date"`
	NewEndDate  string    `json:"new_end_date"`
	Note        *string   `json:"note"`
	CreatedBy   *int64    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

func toBillingJSON(b gen.Billing) billingJSON {
	return billingJSON{
		ID: b.ID, CompanyID: b.CompanyID, Days: b.Days, Amount: amountText(b.Amount),
		PrevEndDate: b.PrevEndDate.Format(time.DateOnly), NewEndDate: b.NewEndDate.Format(time.DateOnly),
		Note: b.Note, CreatedBy: b.CreatedBy, CreatedAt: b.CreatedAt,
	}
}

// amountText is the stored amount as written, "150000.50", or nil.
func amountText(n pgtype.Numeric) *string {
	if !n.Valid {
		return nil
	}
	v, err := n.Value()
	if err != nil {
		return nil
	}
	s, _ := v.(string)
	return &s
}

type adminAccountJSON struct {
	TelegramID int64     `json:"telegram_id"`
	FullName   *string   `json:"full_name"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

func toAdminAccountJSON(a gen.Admin) adminAccountJSON {
	return adminAccountJSON{TelegramID: a.TelegramID, FullName: a.FullName, IsActive: a.IsActive, CreatedAt: a.CreatedAt}
}
```
Test helperlari (`handler_test.go` ga qo'shiladi):
```go
// login opens an admin session for the owner and returns its cookie.
func (api testAPI) login(t *testing.T) *http.Cookie {
	t.Helper()
	return sessionCookieOf(t, api.do(t, http.MethodPost, "/admin/auth/otp", `{"code":"`+api.code(t)+`"}`))
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &m), rec.Body.String())
	return m
}

func dbToday(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	var d time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT CURRENT_DATE").Scan(&d))
	return d
}
```
Har bir endpoint sikli:
1. Test.
2. Route qo'shiladi; handler stub `w.WriteHeader(http.StatusNotImplemented)` → RED.
3. Handler → GREEN.
4. Commit.

Barcha yangi route'lar `requireSession` guruhi ichida bo'ladi.

- [ ] **H1 POST /admin/companies**
```go
func TestCreateCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	end := dbToday(t, api.pool).AddDate(0, 0, 30).Format(time.DateOnly)

	rec := api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma MChJ","end_date":"`+end+`","owner_phone":"+998 90 123 45 67","owner_full_name":"Ali"}`, cookie)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "Olma MChJ", body["name"])
	assert.Equal(t, end, body["end_date"])
	assert.EqualValues(t, 30, body["days_left"])
	assert.Equal(t, true, body["is_active"])

	rec = api.do(t, http.MethodPost, "/admin/companies", `{"name":"Olma","end_date":"31.12.2026","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/admin/companies", `{"name":" ","end_date":"`+end+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/admin/companies", `{}`).Code, "needs a session")
}
```
Handler (`companies.go`):
```go
func (h *Handler) createCompany(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string `json:"name"`
		EndDate       string `json:"end_date"`
		OwnerPhone    string `json:"owner_phone"`
		OwnerFullName string `json:"owner_full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	end, err := time.Parse(time.DateOnly, body.EndDate)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak")
		return
	}
	c, err := h.companies.Create(r.Context(), company.CreateInput{
		Name: body.Name, EndDate: end, OwnerPhone: body.OwnerPhone, OwnerFullName: body.OwnerFullName,
	}, currentAdmin(r.Context()).TelegramID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCompanyJSON(c))
}
```
- [ ] **H2 GET /admin/companies**
```go
func TestListCompanies(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	d := dbToday(t, api.pool)
	for _, name := range []string{"Olma", "Olcha", "Nok"} {
		require.Equal(t, http.StatusCreated, api.do(t, http.MethodPost, "/admin/companies",
			`{"name":"`+name+`","end_date":"`+d.Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie).Code)
	}

	rec := api.do(t, http.MethodGet, "/admin/companies?search=ol&status=active&page=1", "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.EqualValues(t, 2, body["total"])
	assert.EqualValues(t, 1, body["page"])
	assert.EqualValues(t, 20, body["page_size"])
	assert.Len(t, body["items"], 2)

	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/admin/companies", "", cookie).Code, "page defaults to 1")
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodGet, "/admin/companies?page=abc", "", cookie).Code)
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodGet, "/admin/companies?status=deleted", "", cookie).Code)
}
```
Handler:
```go
func (h *Handler) listCompanies(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := 1
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		page = n
	}
	res, err := h.companies.List(r.Context(), company.ListInput{Search: query.Get("search"), Status: query.Get("status"), Page: page})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]companyJSON, 0, len(res.Items))
	for _, c := range res.Items {
		items = append(items, toCompanyJSON(c))
	}
	httpx.JSON(w, http.StatusOK, pageJSON{Items: items, Total: res.Total, Page: res.Page, PageSize: res.PageSize})
}
```
- [ ] **H3 GET /admin/companies/{id}**
```go
func TestGetCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	created := decode(t, api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"`+dbToday(t, api.pool).Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie))
	id := fmt.Sprint(created["id"])

	rec := api.do(t, http.MethodGet, "/admin/companies/"+id, "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "Olma", body["name"])
	users := body["users"].([]any)
	require.Len(t, users, 1)
	assert.Equal(t, "998901234567", users[0].(map[string]any)["phone"])
	assert.Equal(t, "owner", users[0].(map[string]any)["role"])

	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/admin/companies/999999", "", cookie).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/admin/companies/abc", "", cookie).Code)
}
```
Handler (`companyID` helper bilan):
```go
// companyID reads {id}; anything but a positive number is a missing company.
func companyID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusNotFound, "not_found", "Kompaniya topilmadi")
		return 0, false
	}
	return id, true
}

func (h *Handler) getCompany(w http.ResponseWriter, r *http.Request) {
	id, ok := companyID(w, r)
	if !ok {
		return
	}
	d, err := h.companies.Get(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	users := make([]memberJSON, 0, len(d.Users))
	for _, m := range d.Users {
		users = append(users, toMemberJSON(m))
	}
	httpx.JSON(w, http.StatusOK, detailJSON{companyJSON: toCompanyJSON(d.Company), Users: users})
}
```
- [ ] **H4 PATCH /admin/companies/{id}**
```go
func TestPatchCompany(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	created := decode(t, api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"`+dbToday(t, api.pool).Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie))
	path := "/admin/companies/" + fmt.Sprint(created["id"])

	rec := api.do(t, http.MethodPatch, path, `{"is_active":false}`, cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, false, body["is_active"])
	assert.Equal(t, "Olma", body["name"])

	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPatch, path, `{"name":""}`, cookie).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPatch, "/admin/companies/999999", `{"name":"X"}`, cookie).Code)
}
```
Handler: body `{Name *string \`json:"name"\`; IsActive *bool \`json:"is_active"\`}` → `h.companies.Update` → `toCompanyJSON`.
- [ ] **H5 POST /admin/companies/{id}/users**
```go
func TestAddCompanyUser(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	created := decode(t, api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"`+dbToday(t, api.pool).Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie))
	path := "/admin/companies/" + fmt.Sprint(created["id"]) + "/users"

	rec := api.do(t, http.MethodPost, path, `{"phone":"90 222 33 44","full_name":"Xodim","role":"staff"}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, "998902223344", body["phone"])
	assert.Equal(t, "staff", body["role"])

	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, path, `{"phone":"998902223344","role":"boss"}`, cookie).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPost, "/admin/companies/999999/users", `{"phone":"998902223344","full_name":"Xodim","role":"staff"}`, cookie).Code)
}
```
- [ ] **H6 POST /admin/companies/{id}/billings**
```go
func TestCreateBilling(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	d := dbToday(t, api.pool)
	created := decode(t, api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"`+d.AddDate(0, 0, 5).Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie))
	path := "/admin/companies/" + fmt.Sprint(created["id"]) + "/billings"

	rec := api.do(t, http.MethodPost, path, `{"days":30,"amount":"150000.50","note":"Naqd"}`, cookie)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, d.AddDate(0, 0, 5).Format(time.DateOnly), body["prev_end_date"])
	assert.Equal(t, d.AddDate(0, 0, 35).Format(time.DateOnly), body["new_end_date"])
	assert.Equal(t, "150000.50", body["amount"])
	assert.EqualValues(t, ownerID, body["created_by"])

	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, path, `{"days":0}`, cookie).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPost, "/admin/companies/999999/billings", `{"days":1}`, cookie).Code)
}
```
Handler: body `{Days int; Amount string; Note string}` → `h.billing.Extend(…, currentAdmin(ctx).TelegramID)` → 201 `toBillingJSON`.
- [ ] **H7 GET /admin/companies/{id}/billings**
```go
func TestListBillings(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	created := decode(t, api.do(t, http.MethodPost, "/admin/companies",
		`{"name":"Olma","end_date":"`+dbToday(t, api.pool).Format(time.DateOnly)+`","owner_phone":"998901234567","owner_full_name":"Ali"}`, cookie))
	path := "/admin/companies/" + fmt.Sprint(created["id"]) + "/billings"
	api.do(t, http.MethodPost, path, `{"days":30}`, cookie)
	api.do(t, http.MethodPost, path, `{"days":7}`, cookie)

	rec := api.do(t, http.MethodGet, path, "", cookie)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var items []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &items))
	require.Len(t, items, 2)
	assert.EqualValues(t, 7, items[0]["days"], "newest first")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/admin/companies/999999/billings", "", cookie).Code)
}
```
Handler: `h.billing.History` → `[]billingJSON` (bo'sh bo'lsa `[]`).
- [ ] **H8 GET/POST /admin/admins**
```go
func TestAdmins(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)

	rec := api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":42,"full_name":"Ikkinchi"}`, cookie)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, true, decode(t, rec)["is_active"])

	rec = api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":42,"full_name":"Yana"}`, cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"admin_exists","message":"Bu admin allaqachon faol"}`, rec.Body.String())

	rec = api.do(t, http.MethodGet, "/admin/admins", "", cookie)
	require.Equal(t, http.StatusOK, rec.Code)
	var admins []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &admins))
	assert.Len(t, admins, 2)
}
```
- [ ] **H9 DELETE /admin/admins/{telegram_id}**
```go
func TestDeleteAdmin(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	api.do(t, http.MethodPost, "/admin/admins", `{"telegram_id":42,"full_name":"Ikkinchi"}`, cookie)

	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, "/admin/admins/42", "", cookie).Code)

	rec := api.do(t, http.MethodDelete, "/admin/admins/461603558", "", cookie)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"cannot_delete_self","message":"O'zingizni o'chira olmaysiz"}`, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, "/admin/admins/abc", "", cookie).Code)
}
```
Handler: `{telegram_id}` → `strconv.ParseInt` (xato bo'lsa 404 "Faol admin topilmadi") → `h.auth.DeactivateAdmin(ctx, currentAdmin(ctx).TelegramID, id)` → 204.

Yakuniy route jadvali (`handler.go` `Routes`):
```go
		r.Group(func(r chi.Router) {
			r.Use(h.requireSession)
			r.Get("/me", h.me)
			r.Get("/companies", h.listCompanies)
			r.Post("/companies", h.createCompany)
			r.Get("/companies/{id}", h.getCompany)
			r.Patch("/companies/{id}", h.patchCompany)
			r.Post("/companies/{id}/users", h.addCompanyUser)
			r.Get("/companies/{id}/billings", h.listBillings)
			r.Post("/companies/{id}/billings", h.createBilling)
			r.Get("/admins", h.listAdmins)
			r.Post("/admins", h.addAdmin)
			r.Delete("/admins/{telegram_id}", h.deleteAdmin)
		})
```

---

### Task 8: openapi + api-client
`openapi.yaml` ga qo'shiladi:
- Schemalar: `Company`, `CompanyDetail` (allOf Company + users), `CompanyPage`, `Member`, `Billing` (amount: string|null), `AdminAccount`.
- Request body'lar: `CreateCompany`, `PatchCompany`, `AddMember`, `CreateBilling`, `AddAdmin`.
- Path'lar: 6-bo'limdagi 10 ta endpoint, path parametrlari va 400/401/404/409 javoblari bilan. Barchasida `security: adminSession`.

So'ng `make api-client`, `pnpm --filter @hisob24/api-client test typecheck`. Commit: `feat(api): openapi for the admin API`.

---

### Task 9: Hujjatlar va tekshiruv
- Dizayn hujjatiga "4-bosqich qarorlari" bo'limi (yuqoridagi API tafsilotlari) qo'shiladi. Commit.
- `make lint`, `make test`, keshsiz `go test`.
- `start.sh` + curl smoke, Next `/api` orqali (`make otp` → login):
  1. company yaratish → 201;
  2. ro'yxat;
  3. user qo'shish;
  4. billing ikki marta → sanalar zanjiri;
  5. tarix;
  6. PATCH bilan bloklash → `status=expired` filtrida chiqadi;
  7. admin qo'shish va o'chirish;
  8. o'zini o'chirish → 409.
- `git push origin main`, hisobot.
