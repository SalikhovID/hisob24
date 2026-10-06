# Rollar, 1-bosqich: ruxsat poydevori (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API har so'rovda a'zoning amaldagi ruxsatlarini bazadan hisoblaydi (egasi hammasi, rolsiz xodim standart, rolli xodim rolniki) va har route'ni `requirePermission` bilan tekshiradi (403 `forbidden`); `/app/me` ruxsatlarni va rol nomini qaytaradi; `Member` da rol maydonlari; openapi, TS client va mock API shunga mos. Hozirgi userlar uchun xatti-harakat o'zgarmaydi (rollar hali yaratilmaydi: 2-bosqich).

**Architecture:**
- **`internal/access`** (yangi, bazasiz): `Permission`, `All`, `Default`, `Set`, `Parse`, `Effective`.
- **Baza:** migratsiya `00009_roles.sql` (`roles`, `user_companies.role_id`, CHECK, kompaniya bo'yicha FK). So'rovlar: `GetCompanyAccess` (+`role_id`, `permissions`), `ListCompanyUsers` va `ListUserCompanies` (+rol maydonlari), `SetCompanyOwner` (`role_id = NULL`), yangi `GetCompanyMember`.
- **Servis:** `user.Access{Role, Permissions, Active}`, `user.Membership.RoleName`, `company.Member{RoleID, RoleName}`.
- **API:** `requireAccess` ruxsat to'plamini context'ga qo'yadi; `requirePermission(p)`; route'lar `requireCompany` + ruxsat bo'yicha; `createTask` yangi mijozda `customers.create`; `/app/me` `permissions` + `role_name`; `memberJSON` (app, admin) `role_id`, `role_name`.
- **Kontrakt va mock:** openapi (`Permission`, `Forbidden`, sxema maydonlari) → `make api-client`; admin mock `member()`; web `lib/permissions.ts` (katalog), mock `permittedSession`, `/app/me`, `query-client` `forbidden`.

**Tech Stack:** Go (chi, pgx, sqlc, goose, testify, pgtest), openapi-typescript, MSW, Vitest.

Qoidalar: `logic/roles.md` (4, 7-bo'limlar), `logic/user.md` (7–9). Dizayn: `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: SQL yoziladi → `make sqlc` → test mantiq bo'yicha yiqiladi (yangi ustun kutilgan qiymatda emas) yoki stub. Migratsiya uchun RED tabiiy (jadval yo'q: 42P01).
- Har GREEN'dan keyin paket testlari va commit (faqat o'z fayllari: `git add <yo'llar>`).
- Mavjud testlar talab o'zgargani uchun o'zgaradi: `owner_only` → `forbidden` (ruxsatli route'larda), kompaniyasiz token → `company_required`. Hech biri o'chirilmaydi.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/access/access.go` (+`access_test.go`) | katalog, `Set`, `Parse`, `Effective` |
| `backend/migrations/00009_roles.sql` (+`migrations_test.go`) | `roles`, `role_id`, CHECK, FK, Down |
| `backend/internal/db/queries/users.sql` (+`internal/db/users_test.go`) | 4 so'rov o'zgaradi, `GetCompanyMember` qo'shiladi |
| `backend/internal/user/profiles.go` (+`profiles_test.go`) | `Access.Permissions`, `Membership.RoleName` |
| `backend/internal/company/company.go`, `members.go`, `employees.go`, `detail.go` (+testlar) | `Member.RoleID/RoleName`, `RenameEmployee` `GetCompanyMember` bilan |
| `backend/internal/app/session.go`, `handler.go`, `tasks.go`, `employees.go` (+`permissions_test.go`, mavjud testlar) | `requirePermission`, route'lar, `forbidden`, `/app/me`, `memberJSON` |
| `backend/internal/admin/json.go` | `memberJSON` rol maydonlari |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `Permission`, `Forbidden`, `Member`, `AppCompany`, `Me` |
| `apps/admin/mocks/data.ts` | `member()` rol maydonlari |
| `apps/web/lib/permissions.ts` (+test), `lib/types.ts`, `lib/query-client.ts` (+test) | katalog, `Permission` tipi, `forbidden` |
| `apps/web/mocks/data.ts`, `gate.ts`, `handlers.ts`, `customer-settings.ts`, `task-settings.ts`, `customers.ts`, `tasks.ts` (+`handlers.test.ts`) | `permissionsOf`, `permittedSession`, `/app/me`, rol maydonlari |

---

### Task 1: `internal/access` — katalog

**Files:** Create `backend/internal/access/access.go`, `backend/internal/access/access_test.go`.

- [x] **Test** (`access_test.go`, package `access_test`):
  - `TestAllHasEighteenPermissionsInOrder`: `len(All) == 18`, birinchi `customers.view`, oxirgi `settings.delete`.
  - `TestDefaultIsTheCustomersAndTheTasksWithoutHistory`: `Default` aynan 8 ta: `customers.view/create/edit/delete`, `tasks.view/create/edit/delete`.
  - `TestParse` (table): `{"customers.view","customers.create"}` → o'sha ikkisi; `{"tasks.view","customers.view","customers.view"}` → katalog tartibida, takrorsiz (`customers.view, tasks.view`); `{"customers.create"}` → `validation_error` "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"; `{"settings.delete","settings.view","tasks.edit"}` → "«Vazifalar» bo'limida avval «Ko'rish» ni belgilang" (katalog tartibida birinchi buzilgan bo'lim); `{"customers.fly"}` → "Ruxsat noto'g'ri"; `{}` → bo'sh ro'yxat, xato yo'q.
  - `TestEffective`: `("owner", false, nil)` → `All`; `("user", false, nil)` → `Default`; `("user", true, []string{"tasks.view"})` → faqat `tasks.view`; `("user", true, []string{})` → bo'sh; `Set.Has`.
- [x] **RED** → **Kod:**

```go
// Package access is the catalog of what a member of a company may do: the
// permissions a company role is made of, the set a member without a role
// has, and the set the owner has (everything). It knows no database.
package access

import (
	"fmt"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// Permission is one thing a member may do, as "section.action".
type Permission string

const (
	CustomersView    Permission = "customers.view"
	CustomersCreate  Permission = "customers.create"
	CustomersEdit    Permission = "customers.edit"
	CustomersDelete  Permission = "customers.delete"
	CustomersHistory Permission = "customers.history"
	TasksView        Permission = "tasks.view"
	TasksCreate      Permission = "tasks.create"
	TasksEdit        Permission = "tasks.edit"
	TasksDelete      Permission = "tasks.delete"
	TasksHistory     Permission = "tasks.history"
	EmployeesView    Permission = "employees.view"
	EmployeesCreate  Permission = "employees.create"
	EmployeesEdit    Permission = "employees.edit"
	EmployeesDelete  Permission = "employees.delete"
	SettingsView     Permission = "settings.view"
	SettingsCreate   Permission = "settings.create"
	SettingsEdit     Permission = "settings.edit"
	SettingsDelete   Permission = "settings.delete"
)

// All is the catalog in its order: what the owner has.
var All = []Permission{ /* 18 ta, yuqoridagi tartibda */ }

// Default is what a user with no role has: the customers and the tasks,
// without their history. It is the rule from before roles existed.
var Default = []Permission{CustomersView, CustomersCreate, CustomersEdit, CustomersDelete, TasksView, TasksCreate, TasksEdit, TasksDelete}

var sectionNames = map[string]string{"customers": "Mijozlar", "tasks": "Vazifalar", "employees": "Xodimlar", "settings": "Sozlamalar"}

// Set is a member's permissions.
type Set map[Permission]bool

func NewSet(perms []Permission) Set
func (s Set) Has(p Permission) bool
func (s Set) List() []Permission // All tartibida

// Parse reads a role's permissions as a client sends them: each in the
// catalog, a repeated one once, and an action of a section only with the
// section's view.
func Parse(raw []string) ([]Permission, error)

// Effective is what a member may do right now: the owner everything, a user
// with no role the Default, a user with a role what the role holds.
func Effective(role string, hasRole bool, rolePerms []string) Set
```

- [x] **GREEN**, commit `feat(access): the permission catalog`.

### Task 2: Migratsiya `00009_roles.sql`

**Files:** Create `backend/migrations/00009_roles.sql`; Modify `backend/migrations/migrations_test.go`.

- [x] **Test** `TestRolesAreACompanysAndItsUsersOnly`: kompaniya Olma va Nok; rol `INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'Sotuvchi', '{customers.view}') RETURNING id`; a'zolar: egasi va xodim; `UPDATE user_companies SET role_id = $1 WHERE user_phone = xodim` → OK; egasiga → `23514`; Nok'ning xodimiga Olma roli → `23503`; `INSERT roles ('sotuvchi')` → `23505`; `DELETE FROM roles WHERE id = $1` (biriktirilgan) → `23503`; rol olib tashlangach DELETE → OK. Down: mavjud `TestInitDownRemovesTheSchema`.
- [x] **RED** (42P01) → **Kod** (spec'dagi SQL, izohlar bilan) → **GREEN**, commit `feat(db): company roles and the member's role`.

### Task 3: So'rovlar

**Files:** Modify `backend/internal/db/queries/users.sql`, `backend/internal/db/users_test.go`.

```sql
-- name: ListCompanyUsers :many
SELECT uc.user_phone AS phone, uc.full_name, uc.role, uc.role_id, r.name AS role_name, uc.created_at
FROM user_companies uc LEFT JOIN roles r ON r.id = uc.role_id
WHERE uc.company_id = $1
ORDER BY (uc.role = 'owner') DESC, uc.created_at, uc.user_phone;

-- name: GetCompanyMember :one
SELECT uc.user_phone AS phone, uc.full_name, uc.role, uc.role_id, r.name AS role_name, uc.created_at
FROM user_companies uc LEFT JOIN roles r ON r.id = uc.role_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;

-- name: ListUserCompanies :many  (+ r.name AS role_name, LEFT JOIN roles)
-- name: GetCompanyAccess :one    (+ uc.role_id, r.permissions, LEFT JOIN roles)
-- name: SetCompanyOwner :one     (DO UPDATE SET role = 'owner', role_id = NULL, full_name = EXCLUDED.full_name)
```

- [x] **Test:** `TestGetCompanyAccess` ga rolli a'zo (rol `'{customers.view,customers.create}'`): `RoleID` to'ldirilgan, `Permissions` ikki kalit; rolsizda `RoleID == nil`. `TestListCompanyUsers`: rolli xodimda `RoleName == "Sotuvchi"`, egasida nil. `TestGetCompanyMember`: rolli xodim, a'zo emas → `pgx.ErrNoRows`. `TestListUserCompanies`: `RoleName`. `TestSetCompanyOwner`: rolli xodim egasi qilinsa `RoleID == nil`.
- [x] **RED** → **Kod** + `make sqlc` → **GREEN**, commit `feat(db): the member's role in the access, member and company queries`.

### Task 4: `user.Profiles` va `company.Member`

**Files:** Modify `backend/internal/user/profiles.go` (+`profiles_test.go`), `backend/internal/company/company.go`, `members.go`, `employees.go`, `detail.go` (+`employees_test.go`, `company_test.go`).

- [x] **Test** `TestAccess`: kutilgan `Access{Role: "owner", Permissions: access.NewSet(access.All), Active: true}` va h.k.; yangi holat "a user with a role": rol `'{tasks.view}'` → `Permissions` faqat `tasks.view`. `TestGetIsTheUserAndTheirCompanies`: `RoleName` nil; yangi `TestGetNamesTheRole`.
- [x] **Kod:** `Access.Permissions access.Set` (`access.Effective(row.Role, row.RoleID != nil, row.Permissions)`), `Membership.RoleName`.
- [x] **Test** (company): `TestMembersTellTheRole` (rolli xodim → `RoleID`, `RoleName`), `TestRenameEmployeeKeepsTheRole` (`RenameEmployee` javobida `RoleName`).
- [x] **Kod:** `Member{RoleID *int64, RoleName *string}`; `Members`, `Detail` mapping; `RenameEmployee` → `RenameCompanyUser` so'ng `GetCompanyMember`; `AddEmployee`, `ReplaceOwner` `RoleID: uc.RoleID` (nom yo'q: yangi xodim rolsiz, egasi rolsiz).
- [x] **GREEN**, commit `feat(user,company): the member's permissions and role`.

### Task 5: `requirePermission` va route'lar

**Files:** Modify `backend/internal/app/session.go`, `handler.go`; Create `backend/internal/app/permissions_test.go`; Modify `employees_test.go`, `members_test.go`, `customers_test.go`, `customer_settings_test.go`, `task_settings_test.go`, `tasks_test.go`.

- [x] **Test** (`permissions_test.go`): yordamchilar `api.addRole(t, companyID, name, perms ...string) int64`, `api.setRole(t, phone, companyID int64, roleID *int64)`; `const forbidden = {"error":"forbidden","message":"Bu amal uchun ruxsatingiz yo'q"}`.
  - `TestARoleLimitsWhatAnEmployeeMayDo`: rol "Kuzatuvchi" `{customers.view, tasks.view}`; xodim: `GET /app/customers` 200, `POST /app/customers` 403 `forbidden`, `GET /app/tasks` 200, `PATCH /app/tasks/1/stage` 403, `GET /app/employees` 403, `POST /app/customer-types` 403, `GET /app/customers/1/history` 403, `GET /app/customer-types` 200 (hammaga), `GET /app/members` 200. Rolga `customers.create` qo'shilgach (UPDATE roles) `POST /app/customers` darhol 201. Rol olib tashlangach (role_id NULL) standart: `POST /app/customers` 201, `GET /app/employees` 403. Egasi hamma yerda 200/201.
  - `TestPermissionRoutesNeedACompany`: kompaniyasiz token `GET /app/employees` → 403 `company_required`.
- [x] **Kod** (`session.go`):

```go
type accessKey struct{}

// requireAccess ... context'ga user.Access (rol va ruxsatlar) qo'yadi.
func currentAccess(ctx context.Context) user.Access
func currentRole(ctx context.Context) string { return currentAccess(ctx).Role }
func currentPermissions(ctx context.Context) access.Set { return currentAccess(ctx).Permissions }

func forbidden(w http.ResponseWriter) {
	httpx.Error(w, http.StatusForbidden, "forbidden", "Bu amal uchun ruxsatingiz yo'q")
}

// requirePermission lets through only a member whose permissions in the
// company, as requireAccess read them, hold p.
func (h *Handler) requirePermission(p access.Permission) func(http.Handler) http.Handler
```

`handler.go`: `/me`; `requireCompany` guruhi ichida hammaga ochiq GET'lar; `employees` (view/create/edit/delete); `settings.create` guruhi (7 POST); `settings.edit` guruhi (PATCH va PUT …/order); `settings.delete` guruhi (7 DELETE); mijozlar va vazifalar har route'da `r.With(h.requirePermission(...))`. `requireOwner` qoladi (2-bosqich uchun), hozircha route'siz: `golangci-lint` unused deb bersa, `//nolint:unused // 2-bosqich: rollar API` izohi.

- [x] **Mavjud testlar:** `TestEmployeesAreForTheOwnerOnly` → `TestEmployeesNeedTheirPermission` (xodim → `forbidden`, kompaniyasiz → `companyRequired`); `customer_settings_test.go`, `task_settings_test.go`, `members_test.go`, `customers_test.go`, `tasks_test.go` dagi `ownerOnly` → `forbidden`.
- [x] **GREEN** (`go test ./internal/app/...`), commit `feat(app): routes are gated by the member's permissions`.

### Task 6: Yangi mijozli vazifa `customers.create` so'raydi

**Files:** Modify `backend/internal/app/tasks.go`; Test `permissions_test.go`.

- [x] **Test** `TestATaskWithANewCustomerNeedsCustomersCreate`: rol `{tasks.view, tasks.create, customers.view}`; `POST /app/tasks` yangi mijoz bilan → 403 `forbidden`, `tasks` va `customers` bo'sh; mavjud mijoz (egasi qo'shgan) bilan → 201.
- [x] **Kod:** `createTask` da `in := body.Customer.input(); if in.New != nil && !currentPermissions(r.Context()).Has(access.CustomersCreate) { forbidden(w); return }`.
- [x] **GREEN**, commit `feat(app): a task with a new customer needs customers.create too`.

### Task 7: `/app/me` va `memberJSON`

**Files:** Modify `backend/internal/app/handler.go` (`meJSON`, `companyJSON`), `employees.go` (`memberJSON`), `backend/internal/admin/json.go`; Test `handler_test.go`, `employees_test.go`, `permissions_test.go`.

- [x] **Test:** `TestMe`: `permissions` = `access.All` (18 ta, tartibda), `company.role_name == nil`. Yangi `TestMeTellsThePermissionsAndTheRole`: rolli xodim → `permissions` rolniki, `company.role_name == "Kuzatuvchi"`, `companies[i].role_name`; kompaniyasiz token → `permissions == []`. `TestListEmployees`: `role_id == nil`, `role_name == nil`; rolli xodimda nom.
- [x] **Kod:** `meJSON.Permissions []string` (`currentPermissions(ctx).List()`, bo'sh bo'lsa `[]string{}`); `companyJSON.RoleName *string`; `memberJSON{RoleID *int64, RoleName *string}` ikkala paketda.
- [x] **GREEN**, commit `feat(app): /app/me tells the permissions; members tell their role`.

### Task 8: openapi, TS client, mock'lar

**Files:** Modify `backend/openapi.yaml`; `packages/api-client/src/schema.d.ts` (`make api-client`); `apps/admin/mocks/data.ts`; Create `apps/web/lib/permissions.ts` (+`permissions.test.ts`); Modify `apps/web/lib/types.ts`, `lib/query-client.ts` (+test), `mocks/data.ts`, `gate.ts`, `handlers.ts`, `customer-settings.ts`, `task-settings.ts`, `customers.ts`, `tasks.ts`, `handlers.test.ts`.

- [x] **openapi:** `Permission` (enum 18, description: bo'lim va amal ma'nosi); response `Forbidden` ("Sessiya hali kompaniya tanlamagan (company_required) yoki amalga ruxsati yo'q (forbidden)"); ruxsatli route'larda `OwnerOnly` → `Forbidden`, "(faqat owner)" → "(ruxsat: …)"; `Member` + `role_id`, `role_name`; `AppCompany` + `role_name`; `Me` + `permissions`; `OwnerOnly` izohi rollar uchun qoladi. `make api-client`.
- [x] **Admin:** `member()` → `role_id: null, role_name: null`; `pnpm --filter admin typecheck`.
- [x] **Web test** (`lib/permissions.test.ts`): `allPermissions` 18 ta, `defaultPermissions` 8 ta. (`query-client.test.tsx`): `forbidden` ham `/app/me` ni qayta so'ratadi. (`mocks/handlers.test.ts`): xodim `/app/employees` → `forbidden` "Bu amal uchun ruxsatingiz yo'q"; kompaniyasiz → `company_required`; `/app/me` da `permissions` (egasi 18, xodim 8, kompaniyasiz `[]`) va `company.role_name === null`; a'zolarda `role_id: null`.
- [x] **Kod:** `lib/permissions.ts` (`allPermissions`, `defaultPermissions`, `Permission` tipi `lib/types.ts` dan); `data.ts`: `permissionsOf(phone, companyId)`, `companiesOf` `role_name: null`, `membersOf` rol maydonlari; `gate.ts`: `forbidden()`, `permittedSession(request, permission)`; handler fayllarida `ownerSession`/`memberSession` → `permittedSession` tegishli ruxsat bilan (`/app/members` va sozlamalar GET'lari `memberSession` da qoladi); `/app/me` `permissions`; `query-client.ts` `standingChanged` ga `forbidden`.
- [x] **GREEN** (`pnpm --filter web test`, typecheck), commit `feat(api,web): the permission contract; the mock API gates by permission`.

### Task 9: Yakun

- [x] `make lint`, `make test`, `make e2e` toza.
- [x] Spec'ga "1-bosqich qarorlari"; `git push origin main`; hisobot.
