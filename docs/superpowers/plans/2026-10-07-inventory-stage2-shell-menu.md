# Ombor, 2-bosqich: qobiq — menyu tartibi va «Yana» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyuda ikki yangi bo'lim («Mahsulotlar»: `/products`, `/services` tablari; «Ombor»: `/purchases`, `/suppliers` tablari) paydo bo'ladi; a'zo bo'limlar tartibini sudrab sozlaydi, tartib a'zolikda saqlanadi (`user_companies.nav_order`, `PUT /app/me/nav`, `/app/me.nav_order`) va sidebar bilan tab-bar bir tartibda; telefonda 6+ bo'limda birinchi 4 tasi va **«Yana»** (pastdan chiqadigan ro'yxat, qolgan bo'limlar va «Menyuni sozlash»). Bo'lim sahifalarining o'zi 3 va 5-bosqichlarda.

**Architecture:**
- **Baza:** migratsiya `00012_nav_order.sql` (`user_companies.nav_order TEXT[]`, NULL = standart). So'rovlar: `GetCompanyAccess` + `uc.nav_order`; `SetNavOrder`.
- **Servis:** `internal/user/nav.go`: `NavSections` (7 kalit), `ParseNavOrder(raw []string) ([]string, error)` (katalogdan, takror bir marta, bo'sh ro'yxat ham tartib); `Access.NavOrder []string` (nil = standart); `Profiles.SetNavOrder(ctx, phone, companyID, sections []string | nil)`.
- **API:** `GET /app/me` → `nav_order` (tanlangan kompaniyaniki, `null` standart yoki kompaniyasiz); `PUT /app/me/nav {sections: string[] | null}` (`requireCompany`) → 200 `Me` (yangi tartib bilan). `me` handler'ining tanasi `meBody(ctx, claims, standing)` ga ajraladi.
- **Web:** `lib/nav.ts` — `NavKey`, `NavTab`, `NavItem{key, label, href, icon, permission?, tabs?}`, `navFor(permissions, navOrder)` (ruxsatli bo'limlar saqlangan tartibda, yo'qlari standart tartibda oxirida; bo'lim ruxsatli birinchi tabiga ochiladi), `isCurrentItem(item, pathname)`, `barItems(items)` (≤ 5 hammasi; aks holda 4 + qolganlari). `TabBar`: «Yana» tugmasi + `MoreSheet` (`Sheet side="bottom"`); `NavOrderDialog` (`SortableList`, «Standart holat», «Saqlash»); `Sidebar` shu tartibda; `Topbar` profil menyusida «Menyuni sozlash». `useSetNavOrder` (`lib/queries.ts`).
- **Mock:** `Membership.navOrder?: string[]`, `/app/me.nav_order`, `PUT /app/me/nav` (Go tartibi va xabari); `meOf(user)` yordamchisi.
- `SectionTabs` 3-bosqichga ko'chdi (birinchi sahifalar bilan birga).

**Tech Stack:** Go (chi, pgx, sqlc, goose, testify, pgtest), openapi-typescript, Next 16, Base UI (Sheet, Dialog, DropdownMenu), dnd-kit (`SortableList`), TanStack Query, MSW, Vitest, Playwright.

Qoidalar: `logic/roles.md` (8-bo'lim), `logic/user.md` (1, 6). Dizayn: `docs/superpowers/specs/2026-10-07-inventory-design.md` (14–15-qarorlar). Kelishuvlar 1-bosqich rejasidagidek (`GOTEST`, RED → GREEN → commit, mavjud testlar faqat talab o'zgarganda).

---

### Task 1: Migratsiya `00012_nav_order.sql`

**Files:** Create `backend/migrations/00012_nav_order.sql`; Modify `backend/migrations/migrations_test.go`.

- [ ] **Test:**

```go
func TestAMembershipKeepsTheMembersOrderOfTheMenu(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ('998901111111', $1, 'owner')", olma)
	require.NoError(t, err)

	var order []string
	require.NoError(t, pool.QueryRow(ctx, "SELECT nav_order FROM user_companies WHERE user_phone = '998901111111'").Scan(&order))
	assert.Nil(t, order, "the default order until the member sets one")
	_, err = pool.Exec(ctx, "UPDATE user_companies SET nav_order = '{tasks,home}' WHERE user_phone = '998901111111'")
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "SELECT nav_order FROM user_companies WHERE user_phone = '998901111111'").Scan(&order))
	assert.Equal(t, []string{"tasks", "home"}, order)
}

func TestTheNavOrderMigrationDownRemovesTheColumn(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	_, err := newProvider(t, pool).DownTo(ctx, 11)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "SELECT nav_order FROM user_companies")
	assert.Equal(t, "42703", sqlState(err), "undefined_column")
}
```

- [ ] **RED** (42703) → **Kod:**

```sql
-- +goose Up
-- A member's own order of the app's sections in the company (logic/roles.md,
-- section 8): the section keys as the app knows them; NULL is the default
-- order. It goes with the membership.
ALTER TABLE user_companies ADD COLUMN nav_order TEXT[];

-- +goose Down
ALTER TABLE user_companies DROP COLUMN nav_order;
```

- [ ] **GREEN**, `make migrate`, commit `feat(db): a member's own order of the menu`.

### Task 2: So'rovlar

**Files:** Modify `backend/internal/db/queries/users.sql`, `backend/internal/db/users_test.go`.

- [ ] **Test:** `TestGetCompanyAccess` ga: `assert.Nil(t, got.NavOrder, "the default order")`; `mustExec(... UPDATE user_companies SET nav_order = '{tasks,home}' WHERE user_phone = '998901234567' AND company_id = $1, olma.ID)` → qayta o'qilganda `[]string{"tasks", "home"}`. Yangi `TestSetNavOrder`: a'zoga `{"tasks","home"}` → qator qaytadi, `nav_order` shunday; `nil` → NULL; a'zo bo'lmagan → `pgx.ErrNoRows`.
- [ ] **RED** → **Kod:** `GetCompanyAccess` SELECT'iga `uc.nav_order,` (`uc.all_locations` dan keyin); yangi:

```sql
-- name: SetNavOrder :one
-- Keeps the member's own order of the menu in the company (NULL: the
-- default). pgx.ErrNoRows when the user is not its member.
UPDATE user_companies SET nav_order = sqlc.narg('nav_order')::text[]
WHERE user_phone = sqlc.arg('user_phone') AND company_id = sqlc.arg('company_id')
RETURNING user_phone;
```

- [ ] `make sqlc`, **GREEN**, commit `feat(db): the member's menu order in the access row; SetNavOrder`.

### Task 3: `internal/user`: kalitlar, tekshiruv, saqlash

**Files:** Create `backend/internal/user/nav.go`, `backend/internal/user/nav_test.go`; Modify `backend/internal/user/profiles.go`, `backend/internal/user/profiles_test.go`.

- [ ] **Test** (`nav_test.go`, paket `user`):

```go
func TestNavSections(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []string{"home", "customers", "tasks", "products", "warehouse", "employees", "settings"}, NavSections)
}

func TestParseNavOrder(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  []string
		want []string
		err  string
	}{
		"an order":              {[]string{"tasks", "home", "settings"}, []string{"tasks", "home", "settings"}, ""},
		"a repeated key once":   {[]string{"tasks", "tasks", "home"}, []string{"tasks", "home"}, ""},
		"nothing is an order":   {[]string{}, []string{}, ""},
		"a key not in the list": {[]string{"tasks", "reports"}, nil, "Bo'lim noto'g'ri"},
	} {
		got, err := ParseNavOrder(tc.raw)
		if tc.err != "" {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, apperr.Invalid, e.Kind, name)
			assert.Equal(t, "validation_error", e.Code, name)
			assert.Equal(t, tc.err, e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, tc.want, got, name)
	}
}
```

`profiles_test.go`: `TestAccess` jadvalidagi `Access` qiymatlari `NavOrder: nil` bilan o'tadi (maydon qo'shilganda o'z-o'zidan); yangi `TestSetNavOrder`: `profiles.SetNavOrder(ctx, phone, id, []string{"tasks", "home"})` → `Access(...).NavOrder == []string{"tasks","home"}`; `SetNavOrder(..., nil)` → `nil`; a'zo bo'lmagan telefon → `ErrNotMember`.

- [ ] **RED** → **Kod** (`nav.go`):

```go
package user

import "github.com/SalikhovID/hisob24/backend/internal/apperr"

// NavSections are the app's sections by key, in the default order of the
// menu (logic/roles.md, section 8): a member may put them in their own
// order, which their membership keeps.
var NavSections = []string{"home", "customers", "tasks", "products", "warehouse", "employees", "settings"}

// ParseNavOrder reads an order of the sections as a client sends it: each
// key one of NavSections, a repeated one counts once. Nothing is an order
// too (the client fills the rest in the default order).
func ParseNavOrder(raw []string) ([]string, error) {
	known := make(map[string]bool, len(NavSections))
	for _, s := range NavSections {
		known[s] = true
	}
	order := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, key := range raw {
		if !known[key] {
			return nil, apperr.New(apperr.Invalid, "validation_error", "Bo'lim noto'g'ri")
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		order = append(order, key)
	}
	return order, nil
}
```

`profiles.go`: `Access.NavOrder []string` (izoh: the member's own order of the menu, nil for the default) — `Access()` da `NavOrder: row.NavOrder`; yangi:

```go
// SetNavOrder keeps the member's own order of the menu in the company, or
// drops it (nil) for the default. ErrNotMember when the user is not a
// member of the company.
func (p *Profiles) SetNavOrder(ctx context.Context, phone string, companyID int64, sections []string) error {
	_, err := p.q.SetNavOrder(ctx, gen.SetNavOrderParams{UserPhone: phone, CompanyID: companyID, NavOrder: sections})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotMember
	}
	return err
}
```

- [ ] **GREEN**, commit `feat(user): the member's own order of the menu`.

### Task 4: API: `/app/me.nav_order`, `PUT /app/me/nav`, kontrakt

**Files:** Create `backend/internal/app/nav.go`; Modify `backend/internal/app/handler.go` (`me` → `meBody`, route), `backend/internal/app/handler_test.go` (`TestMe` + `nav_order`; yangi `TestSetNavOrder`), `backend/openapi.yaml`, `apps/web/lib/types.ts` (o'zgarmaydi: `Me` generatsiyadan), `packages/api-client`.

- [ ] **Test:** `TestMe` ga `assert.Nil(t, body["nav_order"], "the default order")`; yangi:

```go
func TestSetNavOrder(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	undecided, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user", nok: "user"})

	rec := api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["tasks","home","tasks","settings"]}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, []any{"tasks", "home", "settings"}, body["nav_order"], "the answer is /app/me with the order, a repeated key once")
	assert.Equal(t, "Olma", body["company"].(map[string]any)["name"])
	rec = api.do(t, http.MethodGet, "/app/me", "", bearer(owner))
	assert.Equal(t, []any{"tasks", "home", "settings"}, decode(t, rec)["nav_order"], "kept")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["tasks","reports"]}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Bo'lim noto'g'ri"}`, rec.Body.String())

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":null}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Nil(t, decode(t, rec)["nav_order"], "back to the default")

	rec = api.do(t, http.MethodPut, "/app/me/nav", `{"sections":["home"]}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}
```

- [ ] **RED** (404) → **Kod.** `handler.go`: `meJSON` + `NavOrder *[]string json:"nav_order"`; `me` tanasi:

```go
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	body, err := h.meBody(r.Context(), currentUser(r.Context()), currentAccess(r.Context()))
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, body)
}

// meBody is what /app/me answers: the user, the company the token is for,
// what they may do and the locations and the order of the menu there (from
// standing, as requireAccess read it, or as read anew after a change), and
// all of their companies.
func (h *Handler) meBody(ctx context.Context, claims auth.AccessClaims, standing user.Access) (meJSON, error) {
	profile, err := h.profiles.Get(ctx, claims.Phone)
	if err != nil {
		return meJSON{}, err
	}
	body := meJSON{User: userJSON{Phone: profile.Phone, FullName: profile.FullName}, Companies: []companyJSON{}, Permissions: []string{}, Locations: []locationJSON{}}
	for _, p := range standing.Permissions.List() {
		body.Permissions = append(body.Permissions, string(p))
	}
	if claims.CompanyID != nil {
		locations, err := h.companies.MemberLocations(ctx, *claims.CompanyID, claims.Phone)
		if err != nil {
			return meJSON{}, err
		}
		body.Locations = toLocationsJSON(locations)
		if standing.NavOrder != nil {
			order := standing.NavOrder
			body.NavOrder = &order
		}
	}
	for _, m := range profile.Companies { … (avvalgidek) }
	return body, nil
}
```

`nav.go`:

```go
// setNavOrder keeps the member's own order of the menu in the company the
// session works in (logic/roles.md, section 8), or drops it for the default
// (null), and answers /app/me with the order as it is now.
func (h *Handler) setNavOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Sections *[]string `json:"sections"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	var sections []string
	if body.Sections != nil {
		parsed, err := user.ParseNavOrder(*body.Sections)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		sections = parsed
	}
	claims := currentUser(r.Context())
	if err := h.profiles.SetNavOrder(r.Context(), claims.Phone, *claims.CompanyID, sections); err != nil {
		if errors.Is(err, user.ErrNotMember) {
			unauthorized(w)
			return
		}
		httpx.InternalError(w, r, err)
		return
	}
	standing, err := h.profiles.Access(r.Context(), claims.Phone, *claims.CompanyID)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	me, err := h.meBody(r.Context(), claims, standing)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, me)
}
```

Route: `requireCompany` guruhida, `/members` dan oldin: `r.Put("/me/nav", h.setNavOrder)` (izoh: the member's own order of the menu). `sections: []` (bo'sh) ham saqlanadi (`[]string{}` → `'{}'`), client standart tartibni to'ldiradi.

openapi: `Me.required` ga `nav_order`, property `nav_order: {type: [array, "null"], items: {type: string, enum: [home, customers, tasks, products, warehouse, employees, settings]}, description: A'zoning shu kompaniyadagi menyu tartibi (bo'lim kalitlari); null standart tartib yoki kompaniya tanlanmagan (logic/roles.md, 8-bo'lim)}`; `NavOrderInput {sections: array|null of the same enum}`; path `/app/me/nav` `put` (`operationId: setNavOrder`, 200 `Me`, 400 `BadRequest`, 401, 402, 403 `CompanyRequired`). `make api-client`.

- [ ] **GREEN** (`./internal/app/`, `./internal/httpx/`), commit `feat(app,api): PUT /app/me/nav, the member's own order of the menu`.

### Task 5: Web `lib/nav.ts`

**Files:** Modify `apps/web/lib/nav.ts`, `apps/web/lib/nav.test.ts`.

- [ ] **Test** (`nav.test.ts`, talab o'zgargani uchun mavjud kutilmalar yangilanadi):

```ts
const labels = (permissions?: Permission[], order?: string[] | null) => navFor(permissions, order).map((item) => item.label)

test("the owner may open every section, in the default order", () => {
  expect(labels(allPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor", "Xodimlar", "Sozlamalar"])
})

test("an employee without a role sees the customers, the tasks, the products and the warehouse", () => {
  expect(labels(defaultPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor"])
})

test("an employee with a role sees the sections the role lets them view; before the session is known, the home alone", () => {
  expect(labels(["tasks.view", "tasks.create", "settings.view"])).toEqual(["Bosh sahifa", "Vazifalar", "Sozlamalar"])
  expect(labels(["employees.view"])).toEqual(["Bosh sahifa", "Xodimlar"])
  expect(labels(["suppliers.view"])).toEqual(["Bosh sahifa", "Ombor"])
  expect(labels([])).toEqual(["Bosh sahifa"])
  expect(labels(undefined)).toEqual(["Bosh sahifa"])
})

test("a section with tabs opens at the first tab the member may see", () => {
  const href = (permissions: Permission[], label: string) => navFor(permissions).find((item) => item.label === label)?.href
  expect(href(allPermissions, "Mahsulotlar")).toBe("/products")
  expect(href(allPermissions, "Ombor")).toBe("/purchases")
  expect(href(["suppliers.view"], "Ombor")).toBe("/suppliers")
  expect(href(defaultPermissions, "Mijozlar")).toBe("/customers")
})

test("the member's own order comes first; what it does not name follows in the default order, what they may not see is left out", () => {
  expect(labels(allPermissions, ["settings", "tasks"])).toEqual(["Sozlamalar", "Vazifalar", "Bosh sahifa", "Mijozlar", "Mahsulotlar", "Ombor", "Xodimlar"])
  expect(labels(defaultPermissions, ["settings", "warehouse", "home"])).toEqual(["Ombor", "Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
  expect(labels(allPermissions, null)).toEqual(labels(allPermissions))
  expect(labels(allPermissions, ["bogus"])).toEqual(labels(allPermissions))
})

test("the bar shows up to five sections; past that, four and the rest apart", () => {
  const seven = navFor(allPermissions)
  expect(barItems(seven).shown.map((item) => item.label)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
  expect(barItems(seven).more.map((item) => item.label)).toEqual(["Ombor", "Xodimlar", "Sozlamalar"])
  const five = navFor(defaultPermissions)
  expect(barItems(five).shown).toHaveLength(5)
  expect(barItems(five).more).toEqual([])
})

test.each([
  ["home", "/", true], ["home", "/employees", false],
  ["employees", "/employees", true], ["employees", "/employees/998901234567", true], ["employees", "/employees-archive", false],
  ["settings", "/settings/customer-types/7", true], ["customers", "/customers/7", true], ["tasks", "/tasks/7", true],
  ["products", "/products", true], ["products", "/services/3", true], ["products", "/purchases", false],
  ["warehouse", "/purchases/new", true], ["warehouse", "/suppliers/2", true], ["warehouse", "/products", false],
])("the section %s holds the page %s: %s", (key, pathname, current) => {
  expect(isCurrentItem(navItems.find((item) => item.key === key)!, pathname)).toBe(current)
})
```

(`isCurrent(href, pathname)` qoladi, eski `test.each` o'rniga yuqoridagi.)

- [ ] **RED** → **Kod:**

```ts
import { ContactIcon, HouseIcon, ListTodoIcon, type LucideIcon, PackageIcon, SettingsIcon, UsersIcon, WarehouseIcon } from "lucide-react"
import { can } from "./permissions"
import type { Permission } from "./types"

// NavKey names a section, as the API keeps a member's order of the menu.
export type NavKey = "home" | "customers" | "tasks" | "products" | "warehouse" | "employees" | "settings"

// NavTab is a page of a section that holds several: its own address and the
// permission that opens it.
export interface NavTab { label: string; href: string; permission: Permission }

// NavItem is a section of the app in the sidebar and the tab bar.
export interface NavItem {
  key: NavKey
  label: string
  // href is where the section opens; a section with tabs opens at the first
  // tab the member may see (navFor resolves it).
  href: string
  icon: LucideIcon
  // permission is what opens the section (logic/roles.md, section 8); a
  // section without one and without tabs is everyone's.
  permission?: Permission
  tabs?: NavTab[]
}

export const navItems: NavItem[] = [
  { key: "home", label: "Bosh sahifa", href: "/", icon: HouseIcon },
  { key: "customers", label: "Mijozlar", href: "/customers", icon: ContactIcon, permission: "customers.view" },
  { key: "tasks", label: "Vazifalar", href: "/tasks", icon: ListTodoIcon, permission: "tasks.view" },
  { key: "products", label: "Mahsulotlar", href: "/products", icon: PackageIcon, tabs: [
    { label: "Mahsulotlar", href: "/products", permission: "products.view" },
    { label: "Xizmatlar", href: "/services", permission: "products.view" },
  ] },
  { key: "warehouse", label: "Ombor", href: "/purchases", icon: WarehouseIcon, tabs: [
    { label: "Xaridlar", href: "/purchases", permission: "purchases.view" },
    { label: "Ta'minotchilar", href: "/suppliers", permission: "suppliers.view" },
  ] },
  { key: "employees", label: "Xodimlar", href: "/employees", icon: UsersIcon, permission: "employees.view" },
  { key: "settings", label: "Sozlamalar", href: "/settings", icon: SettingsIcon, permission: "settings.view" },
]

// BAR_LIMIT is how many sections the tab bar shows at most; past it, the
// bar shows BAR_LIMIT - 1 and the rest under "Yana".
export const BAR_LIMIT = 5

// navFor is the sections someone with permissions may open (what /app/me
// told; undefined is a session not known yet, which may open the home
// alone), in the member's own order (navOrder, what /app/me told) with what
// it does not name after it in the default order. A section with tabs opens
// at the first tab the member may see.
export function navFor(permissions: readonly Permission[] | undefined, navOrder?: readonly string[] | null): NavItem[] {
  const visible = navItems.flatMap((item) => {
    if (item.tabs) {
      const tab = item.tabs.find((t) => can(permissions, t.permission))
      return tab ? [{ ...item, href: tab.href }] : []
    }
    return !item.permission || can(permissions, item.permission) ? [item] : []
  })
  if (!navOrder) return visible
  const rank = new Map(navOrder.map((key, index) => [key, index]))
  return [...visible].sort((a, b) => (rank.get(a.key) ?? navOrder.length) - (rank.get(b.key) ?? navOrder.length))
}
```

(Barqaror sort: tartibda bo'lmaganlar `navOrder.length` darajasi bilan o'z tartibida qoladi — `Array.prototype.sort` barqaror.)

```ts
// barItems splits the sections for the tab bar: all of them up to
// BAR_LIMIT; past that, the first BAR_LIMIT - 1 and the rest, which go
// under "Yana".
export function barItems(items: NavItem[]): { shown: NavItem[]; more: NavItem[] } {
  if (items.length <= BAR_LIMIT) return { shown: items, more: [] }
  return { shown: items.slice(0, BAR_LIMIT - 1), more: items.slice(BAR_LIMIT - 1) }
}

// isCurrent says whether the page at pathname belongs to the section at href.
export function isCurrent(href: string, pathname: string): boolean { … (avvalgidek) }

// isCurrentItem says whether the page at pathname belongs to the section:
// to its address, or to any of its tabs'.
export function isCurrentItem(item: NavItem, pathname: string): boolean {
  const hrefs = item.tabs ? item.tabs.map((tab) => tab.href) : [item.href]
  return hrefs.some((href) => isCurrent(href, pathname))
}
```

- [ ] **GREEN** (`nav.test.ts`; `tab-bar.test.tsx`, `sidebar.test.tsx` hali eski `navFor` imzosi bilan o'tadi), commit `feat(web): the products and the warehouse in the menu, in the member's order`.

### Task 6: Web qobiq: «Yana», sozlash dialogi, sidebar, profil menyusi

**Files:** Create `apps/web/components/shell/more-sheet.tsx`, `apps/web/components/shell/nav-order-dialog.tsx`, `apps/web/components/shell/more-sheet.test.tsx`, `apps/web/components/shell/nav-order-dialog.test.tsx`; Modify `apps/web/components/shell/tab-bar.tsx` (+test), `sidebar.tsx` (+test), `topbar.tsx` (+test), `apps/web/lib/queries.ts`.

- [ ] **Test** (`tab-bar.test.tsx`; talab o'zgardi: egasi 7 bo'lim):

```ts
test("the owner's bar is the first four sections and «Yana», which holds the rest; the page's section is marked where it is", async () => {
  await signIn(ALI)
  setLocation("/employees")
  const { user } = renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("button", { name: "Yana" })).toHaveAttribute("aria-current", "page")
  expect(tabs()).toEqual([["Bosh sahifa", "/"], ["Mijozlar", "/customers"], ["Vazifalar", "/tasks"], ["Mahsulotlar", "/products"]])
  await user.click(within(bar()).getByRole("button", { name: "Yana" }))
  const sheet = await screen.findByRole("dialog", { name: "Yana" })
  expect(within(sheet).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Ombor", "/purchases"], ["Xodimlar", "/employees"], ["Sozlamalar", "/settings"],
  ])
  expect(within(sheet).getByRole("link", { name: "Xodimlar" })).toHaveAttribute("aria-current", "page")
  expect(within(sheet).getByRole("button", { name: "Menyuni sozlash" })).toBeInTheDocument()
})

test("an employee without a role has five sections: all in the bar, no «Yana»", async () => {
  await signIn(VALI); await chooseCompany(1)
  renderWithProviders(<TabBar />)
  expect(await within(bar()).findByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/purchases")
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor"])
  expect(within(bar()).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()
})

test("the bar follows the member's own order", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  renderWithProviders(<TabBar />)
  expect(await within(bar()).findByRole("link", { name: "Sozlamalar" })).toBeInTheDocument()
  expect(tabs().map(([label]) => label)).toEqual(["Sozlamalar", "Vazifalar", "Bosh sahifa", "Mijozlar"])
})
```

(mavjud "an employee with a role …" va "before the session is known …" testlari qoladi.) `sidebar.test.tsx`: egasi `["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor", "Xodimlar", "Sozlamalar"]`; rolsiz xodim `[…, "Mahsulotlar", "Ombor"]`; yangi test: `navOrder = ["tasks", "home"]` → `["Vazifalar", "Bosh sahifa", …]`. `topbar.test.tsx`: profil menyusida «Menyuni sozlash» bosilsa `dialog` «Menyuni sozlash» ochiladi. `nav-order-dialog.test.tsx`:

```ts
test("the dialog lists the member's sections in their order; Saqlash sends the order and the menu follows", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<NavOrderDialog open onOpenChange={() => {}} />)
  const list = await screen.findByRole("list", { name: "Bo'limlar tartibi" })
  expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor", "Xodimlar", "Sozlamalar"])

  const handle = within(list).getByRole("button", { name: "Sozlamalar: tartibini o'zgartirish" })
  handle.focus()
  await user.keyboard("{Home}")
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Sozlamalar")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[ALI][0].navOrder).toEqual(["settings", "home", "customers", "tasks", "products", "warehouse", "employees"]))
  expect(await screen.findByText("Menyu tartibi saqlandi")).toBeInTheDocument()
})

test("Standart holat drops the member's order", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  const { user } = renderWithProviders(<NavOrderDialog open onOpenChange={() => {}} />)
  const list = await screen.findByRole("list", { name: "Bo'limlar tartibi" })
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Sozlamalar")
  await user.click(screen.getByRole("button", { name: "Standart holat" }))
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Bosh sahifa")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(db.members[ALI][0].navOrder).toBeUndefined())
})
```

- [ ] **RED** → **Kod.** `lib/queries.ts`:

```ts
// useSetNavOrder keeps the member's own order of the menu in the company
// (null: the default). The API answers with /app/me as it is now.
export function useSetNavOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sections: string[] | null) => call(api.PUT("/app/me/nav", { body: { sections } })),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
  })
}
```

`nav-order-dialog.tsx`: controlled `Dialog` («Menyuni sozlash», izoh «Bo'limlar sidebar va pastki panelda shu tartibda turadi; telefonda birinchi 4 tasi panelda, qolgani «Yana»da.»); ochilganda tartib `navFor(me.permissions, me.nav_order)` dan (`useState` + `useEffect` on open); `SortableList label="Bo'limlar tartibi"` (`getId: key`, `getLabel: label`, `renderItem`: `<li>` ichida `handle` + ikonka + nom); «Standart holat» (`variant="outline"`, tartibni `navFor(permissions)` ga qaytaradi va `isDefault = true`); «Saqlash» (`PendingButton`) → `isDefault ? null : keys`; `onSuccess`: toast «Menyu tartibi saqlandi», `onOpenChange(false)`; `Refusal` xatoda. `more-sheet.tsx`: `MoreSheet({ items, open, onOpenChange, onCustomize })` — `Sheet side="bottom"` (`SheetContent className="pb-safe"`), `SheetTitle` «Yana» (ko'rinadigan), ro'yxat (`nav aria-label="Qolgan bo'limlar"`, har bo'lim `Link` ikonka bilan, `aria-current`, bosilganda yopiladi), pastda `Button variant="ghost"` «Menyuni sozlash» (`SlidersHorizontalIcon`) → `onCustomize()`. `tab-bar.tsx`: `navFor(me.permissions, me.nav_order)`, `barItems`; `more.length > 0` bo'lsa oxirida `MoreTab` tugmasi (`EllipsisIcon`, matn «Yana», `aria-current={more.some(isCurrentItem) ? "page" : undefined}`, `aria-haspopup="dialog"`), `MoreSheet` va `NavOrderDialog` holatlari TabBar'da. `sidebar.tsx`: `navFor(me.permissions, me.nav_order)` va `isCurrentItem`. `topbar.tsx` `ProfileMenu`: `DropdownMenuItem` «Menyuni sozlash» (`SlidersHorizontalIcon`, «Kompaniyani almashtirish»dan oldin) → `NavOrderDialog` (holat `ProfileMenu`da).

- [ ] **GREEN** (web Vitest to'liq), commit `feat(web): the tab bar's «Yana», the member's order of the menu, the dialog to set it`.

### Task 7: Web mock

**Files:** Modify `apps/web/mocks/data.ts` (`Membership.navOrder?: string[]`), `apps/web/mocks/handlers.ts` (`meOf`, `/app/me.nav_order`, `PUT /app/me/nav`), `apps/web/mocks/handlers.test.ts`.

- [ ] **Test** (`handlers.test.ts`):

```ts
test("/app/me tells the member's own order of the menu; PUT /app/me/nav keeps it, a repeated key once, null drops it", async () => {
  await signIn(ALI)
  expect((await call(api.GET("/app/me"))).nav_order).toBeNull()
  const me = await call(api.PUT("/app/me/nav", { body: { sections: ["tasks", "home", "tasks"] } }))
  expect(me.nav_order).toEqual(["tasks", "home"])
  expect(me.company?.name).toBe("Olma Savdo")
  expect((await call(api.GET("/app/me"))).nav_order).toEqual(["tasks", "home"])
  expect(await failure(call(api.PUT("/app/me/nav", { body: { sections: ["tasks", "reports" as never] } })))).toMatchObject({ status: 400, message: "Bo'lim noto'g'ri" })
  expect((await call(api.PUT("/app/me/nav", { body: { sections: null } }))).nav_order).toBeNull()

  await signIn(VALI)
  expect(await failure(call(api.PUT("/app/me/nav", { body: { sections: ["home"] } })))).toMatchObject({ status: 403, code: "company_required" })
})
```

- [ ] **RED** → **Kod:** `handlers.ts`: `meOf(user: Session)` (hozirgi `/app/me` tanasi, `nav_order: membership?.navOrder ?? null`), `GET /app/me` undan; `PUT /app/me/nav`: `memberSession` → tana `sections` `null` → `delete membership.navOrder`; massiv → har kalit `navKeys` dan (aks holda 400 «Bo'lim noto'g'ri»), takror bir marta → `membership.navOrder = order`; javob `meOf`. `navKeys` `@/lib/nav` dan import (`navItems.map(i => i.key)`).
- [ ] **GREEN**, commit `feat(web): the mock API keeps the member's order of the menu`.

### Task 8: e2e va yakun

**Files:** Modify `apps/web/e2e/shell.spec.ts`.

- [ ] Mavjud birinchi test (telefon qismi): bar `["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"]` va «Yana» tugmasi; «Xodimlar» «Yana» ichidan ochiladi (`tabBar.getByRole("button", {name: "Yana"})` → `page.getByRole("dialog", {name: "Yana"}).getByRole("link", {name: "Xodimlar"})`); keyin «Yana» `aria-current="page"`. Yangi test «the member puts the sections in their own order, which the sidebar and the bar keep after a reload»: egasi profil menyusidan (desktop) yoki «Yana» dan (telefon) «Menyuni sozlash»ni ochadi, «Sozlamalar: tartibini o'zgartirish» tutqichida `Home`, «Saqlash», toast; sidebar / bar birinchi bo'limi «Sozlamalar»; `page.reload()` dan keyin ham.
- [ ] `make lint`, `make test`, `make e2e`; lokal haqiqiy stack curl (`PUT /app/me/nav` → `/app/me`, 400, null, kompaniyasiz 403) — 1-bosqich smoke skriptlari asosida; spec'ga «2-bosqich qarorlari»; `git push origin main`.

## Self-review

- Spec 14–15-qarorlar: saqlash (1–4), tartib va «Yana» (5–6), kirish joylari (6), mock (7), e2e (8). `SectionTabs` 3-bosqichda (sahifalar bilan).
- Tiplar: `NavKey`/`NavSections` kalitlari bir xil ro'yxat; `Me.nav_order: string[] | null`; `useSetNavOrder(sections: string[] | null)`.
