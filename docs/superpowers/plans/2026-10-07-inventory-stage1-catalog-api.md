# Ombor, 1-bosqich: katalog API (mahsulotlar va xizmatlar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ruxsat katalogiga `products`, `suppliers`, `purchases` bo'limlari kiradi (Go, openapi, TS), bazada `products` jadvali paydo bo'ladi, `internal/catalog` servisi mahsulot va xizmatlarni yuritadi (ro'yxat, qo'shish, sahifa, tahrir, nofaol, o'chirish), `/app/products*` ning 6 route'i ishlaydi, kontrakt va TS client, web mock shunga mos. Qoldiq, oxirgi narx va xaridga bog'liq qoidalar (`product_in_use`) 4-bosqichda.

**Architecture:**
- **Ruxsatlar:** `internal/access` katalogi 30 ta; `Default` yangi 12 tasini ham oladi; `openapi.yaml` `Permission` enum; `apps/web/lib/permissions.ts`.
- **Baza:** migratsiya `00011_catalog.sql` (spec'dagi SQL); so'rovlar `internal/db/queries/products.sql` (`CreateProduct`, `GetProduct`, `ListProducts`, `CountProducts`, `UpdateProduct`, `SetProductActive`, `DeleteProduct`).
- **Servis:** `internal/catalog` (`catalog.go`: `Service`, `write()`, `Product`, `Input`, tekshiruv `check`; `units.go`; `numbers.go`: `Money`, `Text`; `products.go`: `List`, `Get`, `Create`, `Update`, `SetActive`, `Delete`). Har yozuv `LockCompanyCustomers` ostida (mijoz va vazifa yozuvlari bilan bir navbat).
- **API:** `internal/app/catalog.go` handlerlari, `handler.go` da `Services.Catalog` va route'lar (`allowed(access.Products*)`), `cmd/api/main.go` ulaydi.
- **Kontrakt va mock:** openapi (`Unit`, `ProductKind`, `Product`, `ProductInput`, `ProductUpdate`, `ActiveInput`, `ProductPage`, `ProductNotFound`, `ProductConflict`, ikki path) → `make api-client`; web `lib/types.ts`; `mocks/catalog.ts` + `mocks/data.ts` (`ProductRow`, `db.products`) + `handlers.test.ts`.

**Tech Stack:** Go 1.27 (chi, pgx/v5 `pgtype.Numeric`, sqlc, goose, testify, pgtest), openapi-typescript, MSW, Vitest.

Qoidalar: `logic/products.md`. Dizayn: `docs/superpowers/specs/2026-10-07-inventory-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: SQL yoziladi → `make sqlc` → test mantiq bo'yicha yiqiladi yoki stub. Migratsiya uchun RED tabiiy (jadval yo'q: 42P01). Web: `cd apps/web && pnpm exec vitest run <fayl>`.
- Har GREEN'dan keyin paket testlari va commit (faqat o'z fayllari, `git add <yo'llar>`).
- Mavjud testlar faqat talab o'zgarganda o'zgaradi (ruxsat katalogi 18 → 30, standart to'plam); hech biri o'chirilmaydi.
- Pul JSON'da matn (`"150000.50"`), bazadagidek ikki kasr xonasi bilan qaytadi (`pgtype.Numeric` → `Text`).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/access/access.go` (+`access_test.go`) | 12 ta yangi ruxsat, `All`, `Default`, `sectionNames` |
| `backend/openapi.yaml` | `Permission` enum; sxemalar va ikki path |
| `apps/web/lib/permissions.ts` (+`permissions.test.ts`), `apps/web/components/settings/role-form.test.tsx` | katalog, standart to'plam, bo'limlar |
| `backend/migrations/00011_catalog.sql` (+`migrations_test.go`) | `products` jadvali, indekslar, CHECK'lar, Down |
| `backend/internal/db/queries/products.sql` (+`internal/db/products_test.go`) | 7 so'rov |
| `backend/internal/catalog/catalog.go`, `units.go`, `numbers.go`, `products.go` (+`numbers_test.go`, `check_test.go`, `products_test.go`) | servis |
| `backend/internal/app/catalog.go` (+`catalog_test.go`, `permissions_test.go`, `handler_test.go`), `handler.go`, `backend/cmd/api/main.go` | handlerlar, route'lar, ulash |
| `packages/api-client/src/schema.d.ts` (generatsiya), `apps/web/lib/types.ts` | tiplar |
| `apps/web/mocks/data.ts`, `mocks/catalog.ts` (yangi), `mocks/handlers.ts` (+`mocks/handlers.test.ts`) | mock API |

---

### Task 1: Ruxsat katalogi (Go)

**Files:** Modify `backend/internal/access/access.go`, `backend/internal/access/access_test.go`.

- [ ] **Step 1: Testlarni yangi talabga moslash** (`access_test.go`). `TestAllHasEighteenPermissionsInOrder` o'rniga:

```go
func TestAllHasThirtyPermissionsInOrder(t *testing.T) {
	t.Parallel()
	require.Len(t, access.All, 30)
	assert.Equal(t, access.CustomersView, access.All[0])
	assert.Equal(t, access.ProductsView, access.All[10], "the warehouse sections come after the tasks")
	assert.Equal(t, access.PurchasesDelete, access.All[21])
	assert.Equal(t, access.EmployeesView, access.All[22])
	assert.Equal(t, access.SettingsDelete, access.All[29])
	seen := map[access.Permission]bool{}
	for _, p := range access.All {
		assert.False(t, seen[p], "%s twice", p)
		seen[p] = true
	}
}
```

`TestDefaultIsTheCustomersAndTheTasksWithoutHistory` o'rniga:

```go
func TestDefaultIsTheCustomersTheTasksAndTheWarehouseWithoutHistory(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []access.Permission{
		"customers.view", "customers.create", "customers.edit", "customers.delete",
		"tasks.view", "tasks.create", "tasks.edit", "tasks.delete",
		"products.view", "products.create", "products.edit", "products.delete",
		"suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
		"purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
	}, access.Default)
}
```

`TestParse` jadvaliga ikki holat:

```go
		"a warehouse action without the view":  {[]string{"purchases.create"}, nil, "«Xaridlar» bo'limida avval «Ko'rish» ni belgilang"},
		"a product action with its view":       {[]string{"products.edit", "products.view"}, []access.Permission{"products.view", "products.edit"}, ""},
```

- [ ] **Step 2: RED.** `GOTEST ./internal/access/` → `undefined: access.ProductsView`. Bu kompilyatsiya xatosi: avval `access.go` ga konstantalarni qo'shib (`All`, `Default` ga hali qo'shmay) qayta ishga tushir: `Len 30` va `Default` tasdiqlari mantiq bo'yicha yiqiladi.

- [ ] **Step 3: Kod** (`access.go`):

```go
// The sections and their actions. Every section has view, create, edit and
// delete; the customers and the tasks have a history too.
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
	ProductsView     Permission = "products.view"
	ProductsCreate   Permission = "products.create"
	ProductsEdit     Permission = "products.edit"
	ProductsDelete   Permission = "products.delete"
	SuppliersView    Permission = "suppliers.view"
	SuppliersCreate  Permission = "suppliers.create"
	SuppliersEdit    Permission = "suppliers.edit"
	SuppliersDelete  Permission = "suppliers.delete"
	PurchasesView    Permission = "purchases.view"
	PurchasesCreate  Permission = "purchases.create"
	PurchasesEdit    Permission = "purchases.edit"
	PurchasesDelete  Permission = "purchases.delete"
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
var All = []Permission{
	CustomersView, CustomersCreate, CustomersEdit, CustomersDelete, CustomersHistory,
	TasksView, TasksCreate, TasksEdit, TasksDelete, TasksHistory,
	ProductsView, ProductsCreate, ProductsEdit, ProductsDelete,
	SuppliersView, SuppliersCreate, SuppliersEdit, SuppliersDelete,
	PurchasesView, PurchasesCreate, PurchasesEdit, PurchasesDelete,
	EmployeesView, EmployeesCreate, EmployeesEdit, EmployeesDelete,
	SettingsView, SettingsCreate, SettingsEdit, SettingsDelete,
}

// Default is what a user with no role has: the customers and the tasks,
// without their history (the rule from before roles existed), and the
// warehouse sections: the products, the suppliers and the purchases
// (logic/roles.md, 4.2).
var Default = []Permission{
	CustomersView, CustomersCreate, CustomersEdit, CustomersDelete,
	TasksView, TasksCreate, TasksEdit, TasksDelete,
	ProductsView, ProductsCreate, ProductsEdit, ProductsDelete,
	SuppliersView, SuppliersCreate, SuppliersEdit, SuppliersDelete,
	PurchasesView, PurchasesCreate, PurchasesEdit, PurchasesDelete,
}

// sectionNames are the sections' names in the app, for the messages.
var sectionNames = map[string]string{
	"customers": "Mijozlar",
	"tasks":     "Vazifalar",
	"products":  "Mahsulotlar",
	"suppliers": "Ta'minotchilar",
	"purchases": "Xaridlar",
	"employees": "Xodimlar",
	"settings":  "Sozlamalar",
}
```

- [ ] **Step 4: GREEN.** `GOTEST ./internal/access/ ./internal/app/` → `access` o'tadi; `app` dagi `TestMe` egasining ruxsatlarini `access.All` dan oladi, o'tadi. `TestARoleLimitsWhatAnEmployeeMayDo` (rolsiz xodim) o'tadi.

- [ ] **Step 5: Commit** `feat(access): the products, the suppliers and the purchases in the catalog`.

### Task 2: Ruxsat katalogi (openapi, TS)

**Files:** Modify `backend/openapi.yaml` (`Permission`), `apps/web/lib/permissions.ts`, `apps/web/lib/permissions.test.ts`, `apps/web/components/settings/role-form.test.tsx`, `apps/web/mocks/handlers.test.ts` (tekshirib, kerak bo'lsa).

- [ ] **Step 1: Test** (`permissions.test.ts`): birinchi test `thirty` bo'ladi:

```ts
test("the catalog is the thirty permissions in their order", () => {
  expect(allPermissions).toHaveLength(30)
  expect(allPermissions[0]).toBe("customers.view")
  expect(allPermissions[10]).toBe("products.view")
  expect(allPermissions[21]).toBe("purchases.delete")
  expect(allPermissions[29]).toBe("settings.delete")
  expect(new Set(allPermissions).size).toBe(30)
})

test("an employee without a role has the customers, the tasks and the warehouse, without the history", () => {
  expect(defaultPermissions).toEqual([
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "tasks.view", "tasks.create", "tasks.edit", "tasks.delete",
    "products.view", "products.create", "products.edit", "products.delete",
    "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
    "purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
  ])
})

test("the sections have their names in the app", () => {
  expect(sectionLabels).toEqual({
    customers: "Mijozlar", tasks: "Vazifalar", products: "Mahsulotlar", suppliers: "Ta'minotchilar",
    purchases: "Xaridlar", employees: "Xodimlar", settings: "Sozlamalar",
  })
})
```

`summaryOf(allPermissions)` kutilgani: `"Mijozlar, Vazifalar, Mahsulotlar, Ta'minotchilar, Xaridlar, Xodimlar, Sozlamalar"`. `actionsOf("products")` → `["view", "create", "edit", "delete"]` (yangi tasdiq). `role-form.test.tsx` 17-qatordagi bo'limlar ro'yxatiga `"Mahsulotlar", "Ta'minotchilar", "Xaridlar"` qo'shiladi (`Xodimlar`dan oldin), `group("Xaridlar")` da 4 checkbox.

- [ ] **Step 2: RED.** `cd apps/web && pnpm exec vitest run lib/permissions.test.ts components/settings/role-form.test.tsx` → uzunlik 18, `sectionLabels` farqi.

- [ ] **Step 3: Kod.** `openapi.yaml` `Permission` enum'iga `tasks.history` dan keyin 12 qator (`products.view`, `products.create`, `products.edit`, `products.delete`, `suppliers.view`, …, `purchases.delete`), `description` ga: "products (mahsulotlar va xizmatlar), suppliers (ta'minotchilar), purchases (xaridlar va to'lovlar)". `make api-client`. `permissions.ts`:

```ts
export const allPermissions: Permission[] = [
  "customers.view", "customers.create", "customers.edit", "customers.delete", "customers.history",
  "tasks.view", "tasks.create", "tasks.edit", "tasks.delete", "tasks.history",
  "products.view", "products.create", "products.edit", "products.delete",
  "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
  "purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
  "employees.view", "employees.create", "employees.edit", "employees.delete",
  "settings.view", "settings.create", "settings.edit", "settings.delete",
]

// defaultPermissions is what an employee without a role has: the customers
// and the tasks, without their history (the rule from before roles), and the
// warehouse sections (logic/roles.md, 4.2).
export const defaultPermissions: Permission[] = [
  "customers.view", "customers.create", "customers.edit", "customers.delete",
  "tasks.view", "tasks.create", "tasks.edit", "tasks.delete",
  "products.view", "products.create", "products.edit", "products.delete",
  "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
  "purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
]

export type Section = "customers" | "tasks" | "products" | "suppliers" | "purchases" | "employees" | "settings"

export const sectionLabels: Record<Section, string> = {
  customers: "Mijozlar",
  tasks: "Vazifalar",
  products: "Mahsulotlar",
  suppliers: "Ta'minotchilar",
  purchases: "Xaridlar",
  employees: "Xodimlar",
  settings: "Sozlamalar",
}

export const sections: Section[] = ["customers", "tasks", "products", "suppliers", "purchases", "employees", "settings"]
```

- [ ] **Step 4: GREEN.** `pnpm exec vitest run` (web, to'liq) → `handlers.test.ts` `/app/me` testi `allPermissions` / `defaultPermissions` ni import qiladi, o'tadi; `mocks/data.ts` `permissionsOf` ham shulardan. `pnpm typecheck`.

- [ ] **Step 5: Commit** `feat(api,web): the warehouse sections in the permission catalog`.

### Task 3: Migratsiya `00011_catalog.sql`

**Files:** Create `backend/migrations/00011_catalog.sql`; Modify `backend/migrations/migrations_test.go`.

- [ ] **Step 1: Test:**

```go
func TestProductsAreOfTwoKindsWithTheirOwnRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	str := func(s string) *string { return &s }
	insert := func(companyID int64, kind, name string, unit, sku, price *string) error {
		_, err := pool.Exec(ctx, `INSERT INTO products (company_id, kind, name, unit, sku, price, created_by)
			VALUES ($1, $2, $3, $4, $5, $6::numeric, '998901111111')`, companyID, kind, name, unit, sku, price)
		return err
	}

	require.NoError(t, insert(olma, "product", "Olma", str("kg"), str("A-1"), str("1200.50")), "a product has a unit")
	require.NoError(t, insert(olma, "service", "Yetkazish", nil, nil, nil), "a service has no unit")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", nil, nil, nil)), "a product without a unit")       // check_violation
	assert.Equal(t, "23514", sqlState(insert(olma, "service", "Ta'mirlash", str("dona"), nil, nil)), "a service with a unit")
	assert.Equal(t, "23514", sqlState(insert(olma, "service", "Ta'mirlash", nil, str("S-1"), nil)), "a service with a SKU")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", str("tonna"), nil, nil)), "a unit not in the list")
	assert.Equal(t, "23514", sqlState(insert(olma, "product", "Nok", str("dona"), nil, str("-1"))), "a price below zero")
	assert.Equal(t, "23514", sqlState(insert(olma, "thing", "Nok", nil, nil, nil)), "a kind not of the two")
	assert.Equal(t, "23505", sqlState(insert(olma, "product", "OLMA", str("dona"), nil, nil)), "the name is taken among the products, whatever the case") // unique_violation
	assert.Equal(t, "23505", sqlState(insert(olma, "product", "Nok", str("dona"), str("a-1"), nil)), "the SKU is taken, whatever the case")
	require.NoError(t, insert(olma, "service", "Olma", nil, nil, nil), "a service may have a product's name")
	require.NoError(t, insert(nok, "product", "Olma", str("dona"), str("A-1"), nil), "another company has its own names and SKUs")
	_, err = pool.Exec(ctx, "UPDATE products SET deleted_at = now() WHERE company_id = $1 AND kind = 'product' AND name = 'Olma'", olma)
	require.NoError(t, err)
	require.NoError(t, insert(olma, "product", "Olma", str("dona"), str("A-1"), nil), "a deleted product's name and SKU are free")
	assert.Equal(t, "23503", sqlState(insert(999999, "product", "Begona", str("dona"), nil, nil)), "a product is a company's") // foreign_key_violation
	var active bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_active FROM products WHERE company_id = $1 AND name = 'Yetkazish'", olma).Scan(&active))
	assert.True(t, active, "a product starts active")
}

func TestTheCatalogMigrationDownRemovesTheProducts(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 10)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "SELECT 1 FROM products")
	assert.Equal(t, "42P01", sqlState(err), "undefined_table")
}
```

- [ ] **Step 2: RED.** `GOTEST ./migrations/ -run 'TestProducts|TestTheCatalogMigration'` → birinchisi 42P01 (`relation "products" does not exist`), ikkinchisi `DownTo(10)` da hozirgi versiya 10 bo'lgani uchun o'tadi (bu holat qabul qilinadi: `Down` birinchi test bilan birga yoziladi).

- [ ] **Step 3: Kod** (`00011_catalog.sql`, izohlar inglizcha, loyiha uslubida):

```sql
-- +goose Up
-- A company's products and services (logic/products.md): a product is a
-- good bought into the stock, with a unit; a service is offered, with no
-- unit and no SKU. Nothing here is ever removed: deleted_at hides a row, and
-- its name and SKU are free again. An inactive row stays, but is no longer
-- offered.
CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    kind            TEXT NOT NULL CHECK (kind IN ('product', 'service')),
    name            TEXT NOT NULL,
    unit            TEXT CHECK (unit IN ('dona', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'quti', 'juft', 'komplekt')),
    sku             TEXT,
    -- The sale price of a product, the price of a service; may be none.
    price           NUMERIC(14,2) CHECK (price >= 0),
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    -- What a purchase line's and the stock's foreign keys point at: a
    -- product and its purchase are one company's.
    UNIQUE (company_id, id),
    -- A product has a unit, a service has none; only a product has a SKU.
    CHECK ((kind = 'product') = (unit IS NOT NULL)),
    CHECK (kind = 'product' OR sku IS NULL)
);
-- A name is one product's among the company's products, one service's among
-- its services (whatever the case); a SKU is one product's in the company.
CREATE UNIQUE INDEX products_name ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX products_sku ON products (company_id, lower(sku)) WHERE deleted_at IS NULL AND sku IS NOT NULL;
CREATE INDEX products_list ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE products;
```

- [ ] **Step 4: GREEN.** `GOTEST ./migrations/` (hammasi) → o'tadi; `make migrate` lokal bazani 11 ga olib chiqadi.

- [ ] **Step 5: Commit** `feat(db): the products and the services of a company`.

### Task 4: So'rovlar `products.sql`

**Files:** Create `backend/internal/db/queries/products.sql`, `backend/internal/db/products_test.go`.

- [ ] **Step 1: Test** (`products_test.go`; `enteredBy`, `createUser`, `createCompany`, `today`, `mustExec`, `ptr`, `sqlState`, `addMember` yordamchilari shu paketda bor):

```go
package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// numeric is an amount as a query takes it.
func numeric(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	var n pgtype.Numeric
	require.NoError(t, n.Scan(s))
	return n
}

// numericText is a stored amount as the database writes it ("1200.50").
func numericText(t *testing.T, n pgtype.Numeric) string {
	t.Helper()
	require.True(t, n.Valid, "an amount is there")
	v, err := n.Value()
	require.NoError(t, err)
	s, ok := v.(string)
	require.True(t, ok)
	return s
}

// createProduct enters a product (or, with no unit, a service) of the
// company, as enteredBy, who has to be a user.
func createProduct(t *testing.T, q *gen.Queries, companyID int64, kind, name string, unit *string) gen.Product {
	t.Helper()
	p, err := q.CreateProduct(t.Context(), gen.CreateProductParams{CompanyID: companyID, Kind: kind, Name: name, Unit: unit, CreatedBy: enteredBy})
	require.NoError(t, err)
	return p
}

func TestCreateProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")

	p, err := q.CreateProduct(ctx, gen.CreateProductParams{
		CompanyID: olma.ID, Kind: "product", Name: "Olma", Unit: ptr("kg"), Sku: ptr("A-1"), Price: numeric(t, "1200.5"), Note: ptr("Qizil"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})

	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, olma.ID, p.CompanyID)
	assert.Equal(t, "product", p.Kind)
	assert.Equal(t, "Olma", p.Name)
	assert.Equal(t, ptr("kg"), p.Unit)
	assert.Equal(t, ptr("A-1"), p.Sku)
	assert.Equal(t, "1200.50", numericText(t, p.Price), "two decimals, as the column keeps it")
	assert.Equal(t, ptr("Qizil"), p.Note)
	assert.True(t, p.IsActive)
	assert.Equal(t, enteredBy, p.CreatedBy)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName, "the name the member went by then")
	assert.Equal(t, p.CreatedAt, p.UpdatedAt, "not edited yet")
	assert.Nil(t, p.DeletedAt)
	service := createProduct(t, q, olma.ID, "service", "Yetkazish", nil)
	assert.Nil(t, service.Unit)
	assert.False(t, service.Price.Valid, "no price")
	_, err = q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "olma", Unit: ptr("dona"), CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the name is taken among the products") // unique_violation
	_, err = q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "Nok", Unit: ptr("dona"), Sku: ptr("a-1"), CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the SKU is taken")
}

func TestGetProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	addMember(t, q, olma.ID, enteredBy, "Ali aka", "owner")
	p, err := q.CreateProduct(ctx, gen.CreateProductParams{CompanyID: olma.ID, Kind: "product", Name: "Olma", Unit: ptr("kg"), CreatedBy: enteredBy, CreatedByName: ptr("Ali")})
	require.NoError(t, err)
	gone := createProduct(t, q, olma.ID, "service", "Eski", nil)
	mustExec(t, pool, "UPDATE products SET deleted_at = now() WHERE id = $1", gone.ID)

	got, err := q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Olma", got.Name)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName, "the name the member goes by in the company now")

	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", enteredBy)
	got, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Ali"), got.CreatedByName, "once they have left, the name of then")

	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's product")
	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: gone.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted one")
}

func TestListProducts(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	nokP := createProduct(t, q, olma.ID, "product", "Nok", ptr("dona"))
	mustExec(t, pool, "UPDATE products SET sku = 'N-1' WHERE id = $1", nokP.ID)
	anor := createProduct(t, q, olma.ID, "product", "anor", ptr("kg"))
	olmaP := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	mustExec(t, pool, "UPDATE products SET is_active = false WHERE id = $1", olmaP.ID)
	createProduct(t, q, olma.ID, "service", "Yetkazish", nil)
	gone := createProduct(t, q, olma.ID, "product", "Eski", ptr("dona"))
	mustExec(t, pool, "UPDATE products SET deleted_at = now() WHERE id = $1", gone.ID)
	createProduct(t, q, nok.ID, "product", "Olma", ptr("kg"))
	ids := func(rows []gen.ListProductsRow) []int64 {
		out := make([]int64, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.ID)
		}
		return out
	}
	list := func(kind string, active bool, search *string) []gen.ListProductsRow {
		rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: olma.ID, Kind: kind, IsActive: active, Search: search, Limit: 20, Offset: 0})
		require.NoError(t, err)
		return rows
	}

	assert.Equal(t, []int64{anor.ID, nokP.ID}, ids(list("product", true, nil)), "the live active products, by name whatever the case; not the deleted, not the inactive, not another company's")
	assert.Equal(t, []int64{olmaP.ID}, ids(list("product", false, nil)), "the inactive ones apart")
	assert.Len(t, list("service", true, nil), 1, "the services apart")
	assert.Equal(t, []int64{nokP.ID}, ids(list("product", true, ptr("n-1"))), "a search looks in the SKU too, whatever the case")
	assert.Equal(t, []int64{anor.ID}, ids(list("product", true, ptr("NO"))), "and in the name")
	assert.Empty(t, list("product", true, ptr(`\%`)), "the search is taken literally (escaped by the caller)")
	rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true, Limit: 1, Offset: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{nokP.ID}, ids(rows), "a page")
	count, err := q.CountProducts(ctx, gen.CountProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	count, err = q.CountProducts(ctx, gen.CountProductsParams{CompanyID: olma.ID, Kind: "product", IsActive: true, Search: ptr("nok")})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "under the same filter")
}

func TestUpdateProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	createProduct(t, q, olma.ID, "product", "Nok", ptr("dona"))

	updated, err := q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "Qizil olma", Unit: ptr("dona"), Sku: ptr("A-2"), Price: numeric(t, "100"), Note: ptr("Yangi")})
	require.NoError(t, err)
	assert.Equal(t, "Qizil olma", updated.Name)
	assert.Equal(t, ptr("dona"), updated.Unit)
	assert.Equal(t, ptr("A-2"), updated.Sku)
	assert.Equal(t, "100.00", numericText(t, updated.Price))
	assert.Equal(t, ptr("Yangi"), updated.Note)
	assert.False(t, updated.UpdatedAt.Before(p.UpdatedAt), "the moment of the edit")

	cleared, err := q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "Olma", Unit: ptr("kg")})
	require.NoError(t, err)
	assert.Nil(t, cleared.Sku, "what is not sent is cleared")
	assert.False(t, cleared.Price.Valid)
	assert.Nil(t, cleared.Note)

	_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: olma.ID, Name: "nok", Unit: ptr("kg")})
	assert.Equal(t, "23505", sqlState(err), "the name is another product's")
	_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{ID: p.ID, CompanyID: nok.ID, Name: "Olma", Unit: ptr("kg")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's product")
}

func TestSetProductActive(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	off, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID, CompanyID: olma.ID, IsActive: false})
	require.NoError(t, err)
	assert.False(t, off.IsActive)
	on, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID, CompanyID: olma.ID, IsActive: true})
	require.NoError(t, err)
	assert.True(t, on.IsActive)
	_, err = q.SetProductActive(ctx, gen.SetProductActiveParams{ID: p.ID + 1, CompanyID: olma.ID, IsActive: false})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func TestDeleteProduct(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	p := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	_, err := q.DeleteProduct(ctx, gen.DeleteProductParams{ID: p.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.GetProduct(ctx, gen.GetProductParams{ID: p.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "hidden")
	_, err = q.DeleteProduct(ctx, gen.DeleteProductParams{ID: p.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	assert.Equal(t, "Olma", createProduct(t, q, olma.ID, "product", "Olma", ptr("kg")).Name, "its name is free again")
}
```

- [ ] **Step 2: RED.** `GOTEST ./internal/db/ -run 'Product'` → `q.CreateProduct undefined` (kompilyatsiya). SQL'ni yozib `make sqlc` dan keyin testlar mantiq bo'yicha o'tadi: so'rov testlari uchun RED shu (kelishuvlar).

- [ ] **Step 3: Kod** (`products.sql`):

```sql
-- name: CreateProduct :one
-- Enters a product (unit set) or a service (unit NULL). created_by_name is
-- the name the member who enters it goes by in the company now: it stays
-- when they leave. The name is one row's among the company's rows of the
-- kind, the SKU one product's in the company (23505, whatever the case).
INSERT INTO products (company_id, kind, name, unit, sku, price, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('kind'), sqlc.arg('name'), sqlc.narg('unit'), sqlc.narg('sku'),
        sqlc.narg('price'), sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetProduct :one
-- The company's product or service; pgx.ErrNoRows when it has none such, or
-- deleted it. created_by_name is the name the member who entered it goes by
-- in the company now; once they have left it (or go by no name), the name
-- of then.
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL;

-- name: ListProducts :many
-- A page of the company's products or services (kind), the active or the
-- inactive ones (is_active), by name whatever the case, without the deleted.
-- search, escaped for ILIKE, is looked for in the name and in the SKU; NULL
-- leaves it out.
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.kind = sqlc.arg('kind') AND p.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR p.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR p.sku ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY lower(p.name), p.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProducts :one
-- How many rows ListProducts finds under the same filter, on all of its pages.
SELECT count(*) FROM products p
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.kind = sqlc.arg('kind') AND p.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR p.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR p.sku ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: UpdateProduct :one
-- An edit: every field as it is now (NULL clears an optional one), and the
-- moment of the edit. The kind stays. pgx.ErrNoRows when the company has no
-- such row, or deleted it; 23505 when the name or the SKU is another's.
UPDATE products
SET name = sqlc.arg('name'), unit = sqlc.narg('unit'), sku = sqlc.narg('sku'), price = sqlc.narg('price'),
    note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetProductActive :one
-- Turns a product or a service off (no longer offered) or on again.
-- pgx.ErrNoRows when the company has no such row, or deleted it.
UPDATE products SET is_active = sqlc.arg('is_active'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteProduct :one
-- Hides the product or the service: nothing is removed, and its name and SKU
-- are free again. pgx.ErrNoRows when the company has no such row, or
-- deleted it already.
UPDATE products SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;
```

`make sqlc`. Eslatma: `GetProduct` va `ListProducts` ustunlarni sanab o'tadi (`p.*` + `created_by_name` alias bitta nomni ikki marta berardi); `gen.GetProductRow` va `gen.ListProductsRow` bir xil maydonli.

- [ ] **Step 4: GREEN.** `GOTEST ./internal/db/` → o'tadi.

- [ ] **Step 5: Commit** `feat(db): the product queries` (`products.sql`, `products_test.go`, `internal/db/gen/*`).

### Task 5: `internal/catalog`: pul, birliklar, tekshiruv

**Files:** Create `backend/internal/catalog/catalog.go`, `numbers.go`, `units.go`, `numbers_test.go`, `check_test.go`.

- [ ] **Step 1: Test** (`numbers_test.go`, paket `catalog` ichida):

```go
package catalog

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func ptr[T any](v T) *T { return &v }

func TestMoney(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  *string
		want string // "" for no amount
		bad  bool
	}{
		"none":              {nil, "", false},
		"empty":             {ptr(""), "", false},
		"whole":             {ptr("150000"), "150000", false},
		"two decimals":      {ptr("150000.50"), "150000.50", false},
		"one decimal":       {ptr("0.5"), "0.5", false},
		"three decimals":    {ptr("1.005"), "", true},
		"a comma":           {ptr("1,5"), "", true},
		"a sign":            {ptr("-1"), "", true},
		"letters":           {ptr("abc"), "", true},
		"thirteen digits":   {ptr("1234567890123"), "", true},
		"spaces":            {ptr("1 000"), "", true},
	} {
		n, err := Money(tc.raw, "Narx noto'g'ri")
		if tc.bad {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, "Narx noto'g'ri", e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		if tc.want == "" {
			assert.False(t, n.Valid, name)
			assert.Nil(t, Text(n), name)
			continue
		}
		assert.Equal(t, ptr(tc.want), Text(n), name)
	}
}

func TestTextIsTheAmountAsTheDatabaseWritesIt(t *testing.T) {
	t.Parallel()
	var n pgtype.Numeric
	require.NoError(t, n.Scan("1200.50"))
	assert.Equal(t, ptr("1200.50"), Text(n))
	assert.Nil(t, Text(pgtype.Numeric{}), "no amount")
}

func TestUnits(t *testing.T) {
	t.Parallel()
	assert.Len(t, Units, 10)
	assert.Equal(t, Unit{Code: "dona", Name: "dona"}, Units[0])
	assert.Equal(t, Unit{Code: "m2", Name: "m²"}, Units[6])
	assert.True(t, unitKnown("kg"))
	assert.False(t, unitKnown("tonna"))
	assert.False(t, unitKnown(""))
}
```

`check_test.go`:

```go
package catalog

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCheck(t *testing.T) {
	t.Parallel()
	long := strings.Repeat("a", 121)
	for name, tc := range map[string]struct {
		kind string
		in   Input
		want checked
		err  string
	}{
		"a product, trimmed, with its optional fields": {
			KindProduct, Input{Name: " Olma ", Unit: ptr("kg"), SKU: ptr(" A-1 "), Price: ptr("12000.5"), Note: ptr(" Qizil ")},
			checked{Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1"), Note: ptr("Qizil")}, ""},
		"a product with nothing optional":  {KindProduct, Input{Name: "Olma", Unit: ptr("dona"), SKU: ptr(" "), Price: ptr(""), Note: nil}, checked{Name: "Olma", Unit: ptr("dona")}, ""},
		"a service":                        {KindService, Input{Name: "Yetkazish", Price: ptr("50000")}, checked{Name: "Yetkazish"}, ""},
		"a service with an empty unit":     {KindService, Input{Name: "Yetkazish", Unit: ptr("")}, checked{Name: "Yetkazish"}, ""},
		"no kind":                          {"", Input{Name: "Olma"}, checked{}, "Turni tanlang"},
		"a kind not of the two":            {"thing", Input{Name: "Olma"}, checked{}, "Turni tanlang"},
		"no name":                          {KindProduct, Input{Name: "  ", Unit: ptr("kg")}, checked{}, "Nomni kiriting"},
		"a long name":                      {KindProduct, Input{Name: long, Unit: ptr("kg")}, checked{}, "Nom 120 belgidan oshmasin"},
		"a product without a unit":         {KindProduct, Input{Name: "Olma"}, checked{}, "Birlikni tanlang"},
		"a unit not in the list":           {KindProduct, Input{Name: "Olma", Unit: ptr("tonna")}, checked{}, "Birlikni tanlang"},
		"a service with a unit":            {KindService, Input{Name: "Yetkazish", Unit: ptr("dona")}, checked{}, "Xizmatga birlik berilmaydi"},
		"a service with a SKU":             {KindService, Input{Name: "Yetkazish", SKU: ptr("S-1")}, checked{}, "Xizmatga artikul berilmaydi"},
		"a long SKU":                       {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), SKU: ptr(strings.Repeat("1", 61))}, checked{}, "Artikul 60 belgidan oshmasin"},
		"a bad price":                      {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), Price: ptr("abc")}, checked{}, "Narx noto'g'ri"},
		"a long note":                      {KindProduct, Input{Name: "Olma", Unit: ptr("kg"), Note: ptr(strings.Repeat("x", 501))}, checked{}, "Izoh 500 belgidan oshmasin"},
		"the name before the unit":         {KindProduct, Input{Name: "", Unit: nil}, checked{}, "Nomni kiriting"},
	} {
		got, err := check(tc.kind, tc.in)
		if tc.err != "" {
			var e *apperr.Error
			require.ErrorAs(t, err, &e, name)
			assert.Equal(t, apperr.Invalid, e.Kind, name)
			assert.Equal(t, tc.err, e.Message, name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, tc.want.Name, got.Name, name)
		assert.Equal(t, tc.want.Unit, got.Unit, name)
		assert.Equal(t, tc.want.SKU, got.SKU, name)
		assert.Equal(t, tc.want.Note, got.Note, name)
		assert.Equal(t, tc.in.Price != nil && *tc.in.Price != "", got.Price.Valid, name)
	}
}
```

- [ ] **Step 2: RED.** `GOTEST ./internal/catalog/` → paket yo'q / aniqlanmagan nomlar. Avval `catalog.go` ni `check` stub'i bilan (`return checked{}, errors.New("not implemented")`), `numbers.go` ni `Money` stub'i bilan yoz, qayta ishga tushir: jadval holatlari mantiq bo'yicha yiqiladi.

- [ ] **Step 3: Kod.** `catalog.go`:

```go
// Package catalog runs a company's products and services
// (logic/products.md): the goods it buys into its stock, each with a unit,
// and the services it offers.
package catalog

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// The kinds a row of the catalog is of.
const (
	KindProduct = "product"
	KindService = "service"
)

// How long a name, a SKU and a note may be, in characters.
const (
	MaxName = 120
	MaxSKU  = 60
	MaxNote = 500
)

var (
	errProductNotFound = apperr.New(apperr.NotFound, "not_found", "Mahsulot topilmadi")
	errSKUTaken        = apperr.New(apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	errNoKind          = invalid("Turni tanlang")
	errNoUnit          = invalid("Birlikni tanlang")
	errServiceUnit     = invalid("Xizmatga birlik berilmaydi")
	errServiceSKU      = invalid("Xizmatga artikul berilmaydi")
)

// Service runs the catalog of every company; each call names the company it
// acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the catalog service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// write runs fn in one transaction that holds the company the way a write of
// its customers does (LockCompanyCustomers): the writes of a company's
// catalog, customers, tasks and, later, purchases take turns, so what one of
// them checks cannot change under it.
func (s *Service) write(ctx context.Context, companyID int64, fn func(q *gen.Queries) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			return err
		}
		return fn(q)
	})
}

func invalid(message string) error {
	return fields.Invalid(message)
}

// Product is a product or a service of a company, as the API shows it. The
// amounts are text, as the database writes them ("150000.50").
type Product struct {
	ID    int64
	Kind  string
	Name  string
	Unit  *string
	SKU   *string
	Price *string
	Note  *string
	// Active says whether it is still offered (logic/products.md, 3.3).
	Active bool
	// CreatedByName is the name the member who entered it goes by in the
	// company; nil when they go by none.
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Input is what a product or a service is saved with, as the client sent
// it. Kind is read on entry alone: it never changes.
type Input struct {
	Kind  string
	Name  string
	Unit  *string
	SKU   *string
	Price *string
	Note  *string
}

// checked is an input as it is kept: the name clean, the unit of a product
// one of the Units (a service has none, and no SKU), the price an amount or
// none, the SKU and the note trimmed or none.
type checked struct {
	Name  string
	Unit  *string
	SKU   *string
	Price pgtype.Numeric
	Note  *string
}

// check reads an input of the kind. What is wrong is told in this order:
// the kind, the name, the unit, the SKU, the price, the note.
func check(kind string, in Input) (checked, error) {
	if kind != KindProduct && kind != KindService {
		return checked{}, errNoKind
	}
	name, err := cleanName(in.Name)
	if err != nil {
		return checked{}, err
	}
	c := checked{Name: name}
	unit := trimmed(in.Unit)
	switch {
	case kind == KindService && unit != nil:
		return checked{}, errServiceUnit
	case kind == KindProduct && (unit == nil || !unitKnown(*unit)):
		return checked{}, errNoUnit
	}
	c.Unit = unit
	if kind == KindService && trimmed(in.SKU) != nil {
		return checked{}, errServiceSKU
	}
	if c.SKU, err = cleanOptional(in.SKU, MaxSKU, "Artikul 60 belgidan oshmasin"); err != nil {
		return checked{}, err
	}
	if c.Price, err = Money(in.Price, "Narx noto'g'ri"); err != nil {
		return checked{}, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return checked{}, err
	}
	return c, nil
}

// cleanName is a name as it is kept: without the spaces around it, not
// empty and not longer than MaxName.
func cleanName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	switch {
	case name == "":
		return "", invalid("Nomni kiriting")
	case utf8.RuneCountInString(name) > MaxName:
		return "", invalid("Nom 120 belgidan oshmasin")
	}
	return name, nil
}

// trimmed is an optional text without the spaces around it; nil when there
// is nothing left.
func trimmed(raw *string) *string {
	if raw == nil {
		return nil
	}
	text := strings.TrimSpace(*raw)
	if text == "" {
		return nil
	}
	return &text
}

// cleanOptional is an optional text as it is kept: trimmed, nil when empty,
// refused with tooLong past max characters.
func cleanOptional(raw *string, max int, tooLong string) (*string, error) {
	text := trimmed(raw)
	if text != nil && utf8.RuneCountInString(*text) > max {
		return nil, invalid(tooLong)
	}
	return text, nil
}

// nameTaken is the refusal of a name another row of the kind has.
func nameTaken(kind string) error {
	if kind == KindService {
		return apperr.New(apperr.Conflict, "name_taken", "Bu nomli xizmat allaqachon bor")
	}
	return apperr.New(apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor")
}

// takenError tells which unique index refused the row: the SKU's or the
// name's.
func takenError(err error, kind string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == "products_sku" {
		return errSKUTaken
	}
	return nameTaken(kind)
}

// memberName is the name the member goes by in the company, nil when they
// go by none or are not its member (they may have been taken out while the
// request ran).
func memberName(ctx context.Context, q *gen.Queries, companyID int64, phone string) (*string, error) {
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return name, err
}

func toProduct(r gen.GetProductRow) Product {
	return Product{
		ID: r.ID, Kind: r.Kind, Name: r.Name, Unit: r.Unit, SKU: r.Sku, Price: Text(r.Price), Note: r.Note, Active: r.IsActive,
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}
```

(`time` import ham kerak.) `numbers.go`:

```go
package catalog

import (
	"regexp"

	"github.com/jackc/pgx/v5/pgtype"
)

// moneyPattern is an amount as the client writes it: so'm, up to twelve
// digits and two decimals ("150000.50"), the way the admin's billing takes
// one.
var moneyPattern = regexp.MustCompile(`^\d{1,12}(\.\d{1,2})?$`)

// Money reads an amount the client sent; nil or empty is no amount. What
// does not match the pattern is refused with message.
func Money(raw *string, message string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if raw == nil || *raw == "" {
		return n, nil
	}
	if !moneyPattern.MatchString(*raw) || n.Scan(*raw) != nil {
		return pgtype.Numeric{}, invalid(message)
	}
	return n, nil
}

// Text is a stored amount as the database writes it ("150000.50"), nil when
// there is none.
func Text(n pgtype.Numeric) *string {
	if !n.Valid {
		return nil
	}
	v, err := n.Value()
	if err != nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	return &s
}
```

`units.go`:

```go
package catalog

// Unit is a unit a product is measured in: its code, as it is kept, and its
// name on screen.
type Unit struct {
	Code string
	Name string
}

// Units is the list a product's unit is chosen from (logic/products.md,
// 3.2). It is not set up per company; the column's CHECK lists the same.
var Units = []Unit{
	{"dona", "dona"}, {"kg", "kg"}, {"g", "g"}, {"l", "l"}, {"ml", "ml"},
	{"m", "m"}, {"m2", "m²"}, {"quti", "quti"}, {"juft", "juft"}, {"komplekt", "komplekt"},
}

// unitKnown tells whether code is one of the Units.
func unitKnown(code string) bool {
	for _, u := range Units {
		if u.Code == code {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: GREEN.** `GOTEST ./internal/catalog/` → o'tadi. `cd backend && go vet ./...`.

- [ ] **Step 5: Commit** `feat(catalog): the rules of a product's and a service's fields`.

### Task 6: `internal/catalog`: servis amallari

**Files:** Create `backend/internal/catalog/products.go`, `backend/internal/catalog/products_test.go`.

- [ ] **Step 1: Test** (`products_test.go`; `addCompany`, `refused`, `holdCompany`, `waits` yordamchilari `internal/customer` testlaridagidek shu faylda yoziladi):

```go
package catalog

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali  = "998901111111"
	vali = "998902222222"
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

// addCompany inserts a company with Ali as its owner (named "Ali aka"
// there) and Vali as a user with no name, and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	ctx := t.Context()
	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT DO NOTHING", ali, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka'), ($3, $2, 'user', NULL)", ali, id, vali)
	require.NoError(t, err)
	return id
}

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

func product(name, unit string) Input {
	return Input{Kind: KindProduct, Name: name, Unit: ptr(unit)}
}

func TestCreate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: " Olma ", Unit: ptr("kg"), SKU: ptr("A-1"), Price: ptr("12000.5"), Note: ptr("Qizil")})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, KindProduct, p.Kind)
	assert.Equal(t, "Olma", p.Name, "trimmed")
	assert.Equal(t, ptr("kg"), p.Unit)
	assert.Equal(t, ptr("A-1"), p.SKU)
	assert.Equal(t, ptr("12000.50"), p.Price, "two decimals, as the database writes it")
	assert.Equal(t, ptr("Qizil"), p.Note)
	assert.True(t, p.Active)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName, "the name the member goes by in the company")
	assert.Equal(t, p.CreatedAt, p.UpdatedAt)

	service, err := s.Create(ctx, olma, vali, Input{Kind: KindService, Name: "Yetkazish", Price: ptr("50000")})
	require.NoError(t, err)
	assert.Equal(t, KindService, service.Kind)
	assert.Nil(t, service.Unit)
	assert.Equal(t, ptr("50000.00"), service.Price)
	assert.Nil(t, service.CreatedByName, "a member who goes by no name")

	_, err = s.Create(ctx, olma, ali, product("olma", "dona"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor", "the name is taken among the products, whatever the case")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "yetkazish"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli xizmat allaqachon bor")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Olma"})
	require.NoError(t, err, "a service may have a product's name")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("a-1")})
	refused(t, err, apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	_, err = s.Create(ctx, nok, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err, "another company has its own names")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok"})
	refused(t, err, apperr.Invalid, "validation_error", "Birlikni tanlang", "the input is checked before anything is written")
}

func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nokCo := addCompany(t, pool, "Nok")
	nok, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("N-1")})
	require.NoError(t, err)
	anor, err := s.Create(ctx, olma, ali, product("anor", "kg"))
	require.NoError(t, err)
	off, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)
	_, err = s.SetActive(ctx, olma, off.ID, false)
	require.NoError(t, err)
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)
	_, err = s.Create(ctx, nokCo, ali, product("Olma", "kg"))
	require.NoError(t, err)
	ids := func(page Page) []int64 {
		out := make([]int64, 0, len(page.Items))
		for _, p := range page.Items {
			out = append(out, p.ID)
		}
		return out
	}

	page, err := s.List(ctx, olma, ListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{anor.ID, nok.ID}, ids(page), "the active products by name, whatever the case; the kind is product unless said")
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	page, err = s.List(ctx, olma, ListInput{Kind: KindProduct, Status: "inactive", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{off.ID}, ids(page))
	page, err = s.List(ctx, olma, ListInput{Kind: KindService, Status: "active", Page: 1})
	require.NoError(t, err)
	assert.Len(t, page.Items, 1)
	page, err = s.List(ctx, olma, ListInput{Search: " n-1 ", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{nok.ID}, ids(page), "a search looks in the SKU too")
	page, err = s.List(ctx, olma, ListInput{Search: "%", Page: 1})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "a search is taken literally")
	page, err = s.List(ctx, olma, ListInput{Page: 2})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "past the last page")
	assert.EqualValues(t, 2, page.Total)

	_, err = s.List(ctx, olma, ListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	_, err = s.List(ctx, olma, ListInput{Kind: "thing", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Tur noto'g'ri")
	_, err = s.List(ctx, olma, ListInput{Status: "gone", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Holat noto'g'ri")
}

func TestGet(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)

	got, err := s.Get(ctx, olma, p.ID)
	require.NoError(t, err)
	assert.Equal(t, p, got)
	_, err = s.Get(ctx, nok, p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	require.NoError(t, s.Delete(ctx, olma, p.ID))
	_, err = s.Get(ctx, olma, p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "a deleted one")
}

func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1"), Price: ptr("100"), Note: ptr("Qizil")})
	require.NoError(t, err)
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("N-1")})
	require.NoError(t, err)
	service, err := s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)

	updated, err := s.Update(ctx, olma, p.ID, Input{Kind: KindService, Name: " Qizil olma ", Unit: ptr("dona"), SKU: ptr("A-2"), Price: ptr("150.5"), Note: ptr("Yangi")})
	require.NoError(t, err)
	assert.Equal(t, KindProduct, updated.Kind, "the kind stays whatever is sent")
	assert.Equal(t, "Qizil olma", updated.Name)
	assert.Equal(t, ptr("dona"), updated.Unit)
	assert.Equal(t, ptr("A-2"), updated.SKU)
	assert.Equal(t, ptr("150.50"), updated.Price)
	assert.Equal(t, ptr("Yangi"), updated.Note)
	assert.Equal(t, p.CreatedByName, updated.CreatedByName)

	cleared, err := s.Update(ctx, olma, p.ID, product("Olma", "kg"))
	require.NoError(t, err)
	assert.Nil(t, cleared.SKU, "what is not sent is cleared")
	assert.Nil(t, cleared.Price)
	assert.Nil(t, cleared.Note)

	_, err = s.Update(ctx, olma, p.ID, product("nok", "kg"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor")
	_, err = s.Update(ctx, olma, p.ID, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("n-1")})
	refused(t, err, apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	_, err = s.Update(ctx, olma, p.ID, Input{Name: "Olma"})
	refused(t, err, apperr.Invalid, "validation_error", "Birlikni tanlang", "a product is checked as a product")
	_, err = s.Update(ctx, olma, service.ID, Input{Name: "Yetkazish", Unit: ptr("dona")})
	refused(t, err, apperr.Invalid, "validation_error", "Xizmatga birlik berilmaydi", "a service as a service")
	_, err = s.Update(ctx, nok, p.ID, product("Olma", "kg"))
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	_, err = s.Update(ctx, olma, p.ID+100, Input{})
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "the record before its fields")
}

func TestSetActive(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)

	off, err := s.SetActive(ctx, olma, p.ID, false)
	require.NoError(t, err)
	assert.False(t, off.Active)
	on, err := s.SetActive(ctx, olma, p.ID, true)
	require.NoError(t, err)
	assert.True(t, on.Active)
	_, err = s.SetActive(ctx, olma, p.ID+1, false)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi")
	_, err = s.Create(ctx, olma, ali, product("olma", "dona"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor", "an inactive row keeps its name")
}

func TestDelete(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err)

	refused(t, s.Delete(ctx, nok, p.ID), apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	require.NoError(t, s.Delete(ctx, olma, p.ID))
	refused(t, s.Delete(ctx, olma, p.ID), apperr.NotFound, "not_found", "Mahsulot topilmadi", "deleted already")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err, "the name and the SKU are free again")
}

// holdCompany holds the company the way a write of its customers does,
// until release is called: a write made meanwhile has to wait.
func holdCompany(t *testing.T, pool *pgxpool.Pool, companyID int64) (release func()) {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	_, err = tx.Exec(t.Context(), "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", companyID)
	require.NoError(t, err)
	return func() { require.NoError(t, tx.Commit(t.Context())) }
}

// waits asserts that the write waits while the company is held, and goes on
// once it is free.
func waits(t *testing.T, pool *pgxpool.Pool, companyID int64, write func() error) {
	t.Helper()
	release := holdCompany(t, pool, companyID)
	done := make(chan error, 1)
	go func() { done <- write() }()
	pgtest.WaitForLockWait(t, pool)
	select {
	case err := <-done:
		t.Fatalf("the write did not wait: %v", err)
	default:
	}
	release()
	require.NoError(t, <-done, "the write goes on once the company is free")
}

func TestAWriteWaitsForAnotherWriteOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)
	for name, write := range map[string]func() error{
		"Create":    func() error { _, err := s.Create(ctx, olma, ali, product("Nok", "dona")); return err },
		"Update":    func() error { _, err := s.Update(ctx, olma, p.ID, product("Olma", "dona")); return err },
		"SetActive": func() error { _, err := s.SetActive(ctx, olma, p.ID, false); return err },
		"Delete":    func() error { return s.Delete(ctx, olma, p.ID) },
	} {
		t.Run(name, func(t *testing.T) { waits(t, pool, olma, write) })
	}
}

func TestNamesAreCheckedAgainstTheLiveRows(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	long := strings.Repeat("a", 120)
	p, err := s.Create(ctx, olma, ali, product(long, "kg"))
	require.NoError(t, err, "120 characters is the limit")
	assert.Equal(t, long, p.Name)
}
```

(`Delete` testidagi `holdCompany` / `waits` ketma-ket subtestlarda: har subtest o'z `holdCompany` tranzaksiyasini ochadi; `Delete` oxirgi bo'lgani uchun keyingi `Update` yo'q. `map` tartibi tasodifiy: `Delete` birinchi tushsa `Update` / `SetActive` 404 beradi. Shuning uchun `Delete` ni alohida: map'dan olib, oxirida `waits(t, pool, olma, func() error { return s.Delete(ctx, olma, p.ID) })`.)

- [ ] **Step 2: RED.** `GOTEST ./internal/catalog/` → `s.Create undefined` (kompilyatsiya). `products.go` ga stub'lar (`return Product{}, errors.New("not implemented")`) → mantiq bo'yicha yiqiladi.

- [ ] **Step 3: Kod** (`products.go`):

```go
package catalog

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// PageSize is how many rows a page of the list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// ListInput narrows the list: Kind is product (the default) or service,
// Status active (the default) or inactive, Search is looked for in the
// names and the SKUs. Page starts at 1.
type ListInput struct {
	Kind   string
	Status string
	Search string
	Page   int
}

// Page is one page of the list and how many rows there are on all of them.
type Page struct {
	Items    []Product
	Total    int64
	Page     int
	PageSize int
}

// List is a page of the company's products or services, by name.
func (s *Service) List(ctx context.Context, companyID int64, in ListInput) (Page, error) {
	if in.Page < 1 || in.Page > maxPage {
		return Page{}, invalid("Sahifa raqami noto'g'ri")
	}
	kind := in.Kind
	if kind == "" {
		kind = KindProduct
	}
	if kind != KindProduct && kind != KindService {
		return Page{}, invalid("Tur noto'g'ri")
	}
	var active bool
	switch in.Status {
	case "", "active":
		active = true
	case "inactive":
		active = false
	default:
		return Page{}, invalid("Holat noto'g'ri")
	}
	search, _ := customer.SearchOf(in.Search)
	total, err := s.q.CountProducts(ctx, gen.CountProductsParams{CompanyID: companyID, Kind: kind, IsActive: active, Search: search})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListProducts(ctx, gen.ListProductsParams{
		CompanyID: companyID, Kind: kind, IsActive: active, Search: search,
		Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	items := make([]Product, 0, len(rows))
	for _, r := range rows {
		items = append(items, toProduct(gen.GetProductRow(r)))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// Get is the company's product or service.
func (s *Service) Get(ctx context.Context, companyID, id int64) (Product, error) {
	return get(ctx, s.q, companyID, id)
}

func get(ctx context.Context, q *gen.Queries, companyID, id int64) (Product, error) {
	r, err := q.GetProduct(ctx, gen.GetProductParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, errProductNotFound
	}
	if err != nil {
		return Product{}, err
	}
	return toProduct(r), nil
}

// Create enters a product or a service (in.Kind) into the company, as the
// member with phone by. What is wrong is told in the order of check, then
// a name or a SKU another row has (409).
func (s *Service) Create(ctx context.Context, companyID int64, by string, in Input) (Product, error) {
	c, err := check(in.Kind, in)
	if err != nil {
		return Product{}, err
	}
	var p Product
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreateProduct(ctx, gen.CreateProductParams{
			CompanyID: companyID, Kind: in.Kind, Name: c.Name, Unit: c.Unit, Sku: c.SKU, Price: c.Price, Note: c.Note,
			CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			if isUnique(err) {
				return takenError(err, in.Kind)
			}
			return err
		}
		p, err = get(ctx, q, companyID, row.ID)
		return err
	})
	return p, err
}

// Update saves the company's product or service with other fields; its kind
// stays, whatever in.Kind says, and the fields are checked as that kind's.
// The record itself comes first: one that is not there is not found.
func (s *Service) Update(ctx context.Context, companyID, id int64, in Input) (Product, error) {
	var p Product
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := get(ctx, q, companyID, id)
		if err != nil {
			return err
		}
		c, err := check(was.Kind, in)
		if err != nil {
			return err
		}
		_, err = q.UpdateProduct(ctx, gen.UpdateProductParams{
			ID: id, CompanyID: companyID, Name: c.Name, Unit: c.Unit, Sku: c.SKU, Price: c.Price, Note: c.Note,
		})
		if err != nil {
			if isUnique(err) {
				return takenError(err, was.Kind)
			}
			return err
		}
		p, err = get(ctx, q, companyID, id)
		return err
	})
	return p, err
}

// SetActive turns the company's product or service off (no longer offered)
// or on again.
func (s *Service) SetActive(ctx context.Context, companyID, id int64, active bool) (Product, error) {
	var p Product
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.SetProductActive(ctx, gen.SetProductActiveParams{ID: id, CompanyID: companyID, IsActive: active})
		if errors.Is(err, pgx.ErrNoRows) {
			return errProductNotFound
		}
		if err != nil {
			return err
		}
		p, err = get(ctx, q, companyID, id)
		return err
	})
	return p, err
}

// Delete hides the company's product or service; its name and SKU are free
// again. (A product a purchase holds is refused from stage 4 on.)
func (s *Service) Delete(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteProduct(ctx, gen.DeleteProductParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errProductNotFound
		}
		return err
	})
}

// isUnique tells that a unique index refused the row.
func isUnique(err error) bool { return fields.Taken(err) }
```

(`fields` importi `catalog.go` da bor; `isUnique` o'rniga to'g'ridan-to'g'ri `fields.Taken(err)` ishlatish ham mumkin; `gen.GetProductRow(r)` o'tkazmasi ikkala row tipi bir xil maydonli bo'lgani uchun ishlaydi, aks holda `toProduct` ga alohida funksiya.)

- [ ] **Step 4: GREEN.** `GOTEST ./internal/catalog/` → o'tadi; `go vet ./...`.

- [ ] **Step 5: Commit** `feat(catalog): a company's products and services: list, enter, edit, turn off, delete`.

### Task 7: Handlerlar, route'lar, ulash

**Files:** Create `backend/internal/app/catalog.go`, `backend/internal/app/catalog_test.go`; Modify `backend/internal/app/handler.go`, `backend/internal/app/handler_test.go` (`newTestAPIWith`), `backend/internal/app/permissions_test.go`, `backend/cmd/api/main.go`.

- [ ] **Step 1: Test** (`catalog_test.go`):

```go
package app

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// enterProduct enters a product (or a service) as the session and returns
// the API's answer.
func (api testAPI) enterProduct(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/products", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func TestCreateProduct(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)

	rec := api.do(t, http.MethodPost, "/app/products",
		`{"kind":"product","name":" Olma ","unit":"kg","sku":"A-1","price":"12000.5","note":"Qizil"}`, bearer(employee))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	p := decode(t, rec)
	assert.NotEmpty(t, p["id"])
	assert.Equal(t, "product", p["kind"])
	assert.Equal(t, "Olma", p["name"], "an employee without a role enters products, trimmed")
	assert.Equal(t, "kg", p["unit"])
	assert.Equal(t, "A-1", p["sku"])
	assert.Equal(t, "12000.50", p["price"], "two decimals, as text")
	assert.Equal(t, "Qizil", p["note"])
	assert.Equal(t, true, p["is_active"])
	assert.Equal(t, "Vali Aliyev", p["created_by_name"])
	assert.NotEmpty(t, p["created_at"])
	assert.Equal(t, p["created_at"], p["updated_at"])

	service := api.enterProduct(t, owner, `{"kind":"service","name":"Yetkazish","price":"50000"}`)
	assert.Equal(t, "service", service["kind"])
	assert.Nil(t, service["unit"])
	assert.Nil(t, service["sku"])
	assert.Equal(t, "50000.00", service["price"])
	assert.Nil(t, service["note"])
	assert.Nil(t, service["created_by_name"], "the owner goes by no name here")

	for name, tc := range map[string]struct{ body, message string }{
		"no kind":                  {`{"name":"Nok"}`, "Turni tanlang"},
		"no name":                  {`{"kind":"product","name":" ","unit":"kg"}`, "Nomni kiriting"},
		"a long name":              {fmt.Sprintf(`{"kind":"product","name":"%s","unit":"kg"}`, strings.Repeat("a", 121)), "Nom 120 belgidan oshmasin"},
		"a product without a unit": {`{"kind":"product","name":"Nok"}`, "Birlikni tanlang"},
		"a unit not in the list":   {`{"kind":"product","name":"Nok","unit":"tonna"}`, "Birlikni tanlang"},
		"a service with a unit":    {`{"kind":"service","name":"Ta'mirlash","unit":"dona"}`, "Xizmatga birlik berilmaydi"},
		"a service with a SKU":     {`{"kind":"service","name":"Ta'mirlash","sku":"S-1"}`, "Xizmatga artikul berilmaydi"},
		"a long SKU":               {fmt.Sprintf(`{"kind":"product","name":"Nok","unit":"kg","sku":"%s"}`, strings.Repeat("1", 61)), "Artikul 60 belgidan oshmasin"},
		"a bad price":              {`{"kind":"product","name":"Nok","unit":"kg","price":"1,5"}`, "Narx noto'g'ri"},
		"a long note":              {fmt.Sprintf(`{"kind":"product","name":"Nok","unit":"kg","note":"%s"}`, strings.Repeat("x", 501)), "Izoh 500 belgidan oshmasin"},
	} {
		rec := api.do(t, http.MethodPost, "/app/products", tc.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}

	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"OLMA","unit":"dona"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli mahsulot allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"service","name":"yetkazish"}`, bearer(owner))
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli xizmat allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona","sku":"a-1"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"sku_taken","message":"Bu artikulli mahsulot allaqachon bor"}`, rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona"}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session with no company chosen")
	assert.JSONEq(t, `{"error":"company_required","message":"Avval kompaniyani tanlang"}`, rec.Body.String())
}

func TestListProducts(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	other, _ := api.signIn(t, valisPhone, map[int64]string{nok: "owner"})
	nokP := api.enterProduct(t, owner, `{"kind":"product","name":"Nok","unit":"dona","sku":"N-1"}`)
	anor := api.enterProduct(t, owner, `{"kind":"product","name":"anor","unit":"kg"}`)
	off := api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	api.enterProduct(t, owner, `{"kind":"service","name":"Yetkazish"}`)
	api.enterProduct(t, other, `{"kind":"product","name":"Olma","unit":"kg"}`)
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPatch, fmt.Sprintf("/app/products/%v", off["id"]), `{"is_active":false}`, bearer(owner)).Code)
	names := func(query string) []any {
		rec := api.do(t, http.MethodGet, "/app/products"+query, "", bearer(owner))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		items, _ := decode(t, rec)["items"].([]any)
		out := make([]any, 0, len(items))
		for _, item := range items {
			out = append(out, item.(map[string]any)["name"])
		}
		return out
	}

	assert.Equal(t, []any{"anor", "Nok"}, names(""), "the active products by name; not the inactive, not the services, not another company's")
	assert.Equal(t, []any{"Olma"}, names("?status=inactive"))
	assert.Equal(t, []any{"Yetkazish"}, names("?kind=service"))
	assert.Equal(t, []any{"Nok"}, names("?search=n-1"), "a search looks in the SKU too")
	assert.Equal(t, []any{"anor"}, names("?search=NO"))
	rec := api.do(t, http.MethodGet, "/app/products?page=2", "", bearer(owner))
	body := decode(t, rec)
	assert.Empty(t, body["items"], "past the last page")
	assert.EqualValues(t, 2, body["total"])
	assert.EqualValues(t, 2, body["page"])
	assert.EqualValues(t, 20, body["page_size"])
	_ = nokP
	_ = anor

	for name, tc := range map[string]struct{ query, message string }{
		"a page that is no number": {"?page=abc", "Sahifa raqami noto'g'ri"},
		"a kind not of the two":    {"?kind=thing", "Tur noto'g'ri"},
		"a status not of the two":  {"?status=gone", "Holat noto'g'ri"},
	} {
		rec := api.do(t, http.MethodGet, "/app/products"+tc.query, "", bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
}

func TestProductByID(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	other, _ := api.signIn(t, valisPhone, map[int64]string{nok: "owner"})
	p := api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg","sku":"A-1","price":"100","note":"Qizil"}`)
	path := fmt.Sprintf("/app/products/%v", p["id"])
	notFound := `{"error":"not_found","message":"Mahsulot topilmadi"}`

	rec := api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, p, decode(t, rec), "the product as it was entered")
	rec = api.do(t, http.MethodGet, path, "", bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's product")
	assert.JSONEq(t, notFound, rec.Body.String())

	rec = api.do(t, http.MethodPut, path, `{"name":"Qizil olma","unit":"dona"}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "Qizil olma", edited["name"])
	assert.Equal(t, "dona", edited["unit"])
	assert.Nil(t, edited["sku"], "what is not sent is cleared")
	assert.Nil(t, edited["price"])
	assert.Nil(t, edited["note"])
	assert.Equal(t, "product", edited["kind"], "the kind stays")
	rec = api.do(t, http.MethodPut, path, `{"name":"Qizil olma"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Birlikni tanlang"}`, rec.Body.String(), "checked as a product")
	rec = api.do(t, http.MethodPut, path, `{"name":"Olma","unit":"kg"}`, bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodPatch, path, `{"is_active":false}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, false, decode(t, rec)["is_active"])
	rec = api.do(t, http.MethodPatch, path, `{}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Holat noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"is_active":true}`, bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodDelete, path, "", bearer(other))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "hidden")
	assert.JSONEq(t, notFound, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg","sku":"A-1"}`)
}
```

`permissions_test.go` `TestARoleLimitsWhatAnEmployeeMayDo` jadvaliga (rol `customers.view`, `tasks.view`): `"the products": {http.MethodGet, "/app/products", ""}`, `"adding a product": {http.MethodPost, "/app/products", `{"kind":"product","name":"Nok","unit":"dona"}`}`; rol kengaytirilganda (`UPDATE roles SET permissions = …`) `products.view` qo'shilsa `GET /app/products` 200 (ixtiyoriy). `handler_test.go` `newTestAPIWith`: `Catalog: catalog.NewService(pool)`.

- [ ] **Step 2: RED.** `GOTEST ./internal/app/ -run 'Product'` → `Services` da `Catalog` yo'q (kompilyatsiya); `Services.Catalog` va handler maydonini qo'shib, route'larsiz ishga tushir: 404 (`chi` route yo'q) → mantiq bo'yicha yiqiladi.

- [ ] **Step 3: Kod.** `handler.go`: `Services.Catalog *catalog.Service`, `Handler.catalog`, `NewHandler` da `catalog: s.Catalog`; `requireCompany` guruhida `allowed(access.TasksHistory)…` dan keyin:

```go
				// The catalog: the products the company buys into its stock
				// and the services it offers (logic/products.md).
				allowed(access.ProductsView).Get("/products", h.listProducts)
				allowed(access.ProductsCreate).Post("/products", h.createProduct)
				allowed(access.ProductsView).Get("/products/{id}", h.getProduct)
				allowed(access.ProductsEdit).Put("/products/{id}", h.updateProduct)
				allowed(access.ProductsEdit).Patch("/products/{id}", h.setProductActive)
				allowed(access.ProductsDelete).Delete("/products/{id}", h.deleteProduct)
```

`app/catalog.go`:

```go
package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type productJSON struct {
	ID   int64  `json:"id"`
	Kind string `json:"kind"`
	Name string `json:"name"`
	// Unit is a product's; a service has none, and no SKU.
	Unit *string `json:"unit"`
	SKU  *string `json:"sku"`
	// Price is the sale price of a product, the price of a service, as text
	// with two decimals ("150000.50"); null when there is none.
	Price         *string   `json:"price"`
	Note          *string   `json:"note"`
	IsActive      bool      `json:"is_active"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toProductJSON(p catalog.Product) productJSON {
	return productJSON{
		ID: p.ID, Kind: p.Kind, Name: p.Name, Unit: p.Unit, SKU: p.SKU, Price: p.Price, Note: p.Note, IsActive: p.Active,
		CreatedByName: p.CreatedByName, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

type productPageJSON struct {
	Items    []productJSON `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

// productInputJSON is a product or a service as the client sends it; the
// kind is read on entry alone.
type productInputJSON struct {
	Kind  string  `json:"kind"`
	Name  string  `json:"name"`
	Unit  *string `json:"unit"`
	SKU   *string `json:"sku"`
	Price *string `json:"price"`
	Note  *string `json:"note"`
}

func (in productInputJSON) input() catalog.Input {
	return catalog.Input{Kind: in.Kind, Name: in.Name, Unit: in.Unit, SKU: in.SKU, Price: in.Price, Note: in.Note}
}

// listProducts is a page of the products (?kind=product, the default) or
// the services (?kind=service) of the company the session works in, the
// active ones unless ?status=inactive, by name: ?search= looks in the
// names and the SKUs, ?page= starts at 1.
func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	in := catalog.ListInput{Kind: query.Get("kind"), Status: query.Get("status"), Search: query.Get("search"), Page: 1}
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		in.Page = n
	}
	page, err := h.catalog.List(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]productJSON, 0, len(page.Items))
	for _, p := range page.Items {
		items = append(items, toProductJSON(p))
	}
	httpx.JSON(w, http.StatusOK, productPageJSON{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize})
}

// createProduct enters a product or a service into the company the session
// works in, as the member the session is of.
func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var body productInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.catalog.Create(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toProductJSON(p))
}

// getProduct is a product or a service of the company the session works in.
func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	p, err := h.catalog.Get(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
}

// updateProduct saves a product or a service of the company the session
// works in with other fields; its kind stays.
func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	var body productInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	p, err := h.catalog.Update(r.Context(), sessionCompany(r), pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
}

// setProductActive turns a product or a service of the company the session
// works in off, or on again.
func (h *Handler) setProductActive(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IsActive *bool `json:"is_active"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if body.IsActive == nil {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Holat noto'g'ri")
		return
	}
	p, err := h.catalog.SetActive(r.Context(), sessionCompany(r), pathID(r, "id"), *body.IsActive)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toProductJSON(p))
}

// deleteProduct hides a product or a service of the company the session
// works in.
func (h *Handler) deleteProduct(w http.ResponseWriter, r *http.Request) {
	if err := h.catalog.Delete(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

`cmd/api/main.go`: `Catalog: catalog.NewService(pool),` (import `internal/catalog`).

- [ ] **Step 4: GREEN.** `GOTEST ./internal/app/` → `catalog_test`, `permissions_test` o'tadi; `./internal/httpx/` kontrakt testi **yiqiladi** (route'lar openapi'da yo'q): bu Task 8 da tuzatiladi; shu Task'da `GOTEST ./internal/app/ ./internal/catalog/` ko'rsatiladi.

- [ ] **Step 5: Commit** `feat(app): the /app/products routes`.

### Task 8: Kontrakt (`openapi.yaml`) va TS client

**Files:** Modify `backend/openapi.yaml`, `apps/web/lib/types.ts`; generate `packages/api-client/src/schema.d.ts`.

- [ ] **Step 1: RED.** `GOTEST ./internal/httpx/` → `TestRouterServesExactlyTheDocumentedAPI` 6 ta route'ni ortiqcha deb ko'rsatadi.

- [ ] **Step 2: Kod.** `paths` ga (`/app/tasks/{id}/history` dan keyin):

```yaml
  /app/products:
    get:
      operationId: listProducts
      summary: Mahsulotlar yoki xizmatlar ro'yxati (products.view ruxsati)
      description: >
        Access token'dagi kompaniyaning mahsulotlari (kind=product, standart)
        yoki xizmatlari (kind=service), faol (status=active, standart) yoki
        nofaol (status=inactive) lari, nom bo'yicha (katta-kichik harf
        farqsiz), sahifada 20 ta. search nomda (mahsulotda artikulda ham)
        qidiradi, harfma-harf (logic/products.md, 5-bo'lim).
      security:
        - appBearer: []
      parameters:
        - name: kind
          in: query
          schema:
            $ref: "#/components/schemas/ProductKind"
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive]
        - name: search
          in: query
          schema:
            type: string
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
      responses:
        "200":
          description: Sahifa
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProductPage"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
    post:
      operationId: createProduct
      summary: Mahsulot yoki xizmat qo'shish (products.create ruxsati)
      description: >
        Tur (kind) keyin o'zgarmaydi. Mahsulotda birlik majburiy, xizmatda
        birlik va artikul bo'lmaydi. Nom 1–120 belgi, mahsulotlar ichida va
        xizmatlar ichida alohida takrorlanmaydi; artikul 60 belgigacha,
        kompaniyada takrorlanmaydi; narx ixtiyoriy; izoh 500 belgigacha
        (logic/products.md, 3 va 4-bo'limlar).
      security:
        - appBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProductInput"
      responses:
        "201":
          description: Qo'shilgan mahsulot yoki xizmat
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Product"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
        "409":
          $ref: "#/components/responses/ProductConflict"
  /app/products/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          format: int64
    get:
      operationId: getProduct
      summary: Mahsulot yoki xizmat (products.view ruxsati)
      security:
        - appBearer: []
      responses:
        "200":
          description: Mahsulot yoki xizmat
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Product"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/ProductNotFound"
    put:
      operationId: updateProduct
      summary: Mahsulot yoki xizmatni tahrirlash (products.edit ruxsati)
      description: >
        Maydonlar yuborilganiga almashadi, yuborilmagan ixtiyoriy maydon
        bo'shaydi; tur o'zgarmaydi va maydonlar o'sha tur qoidalari bilan
        tekshiriladi.
      security:
        - appBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProductUpdate"
      responses:
        "200":
          description: Saqlangan mahsulot yoki xizmat
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Product"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/ProductNotFound"
        "409":
          $ref: "#/components/responses/ProductConflict"
    patch:
      operationId: setProductActive
      summary: Nofaol qilish yoki faollashtirish (products.edit ruxsati)
      description: >
        Nofaol mahsulot xarid takliflarida chiqmaydi; nomi va artikuli band
        qoladi (logic/products.md, 3.3).
      security:
        - appBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ActiveInput"
      responses:
        "200":
          description: Mahsulot yoki xizmat yangi holatida
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Product"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/ProductNotFound"
    delete:
      operationId: deleteProduct
      summary: Mahsulot yoki xizmatni o'chirish (products.delete ruxsati)
      description: >
        Yashiriladi (deleted_at), nomi va artikuli bo'shaydi. Jonli xaridda
        bor mahsulot o'chirilmaydi (409 product_in_use, 4-bosqichdan).
      security:
        - appBearer: []
      responses:
        "204":
          description: O'chirildi
        "401":
          $ref: "#/components/responses/Unauthorized"
        "402":
          $ref: "#/components/responses/SubscriptionExpired"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/ProductNotFound"
        "409":
          $ref: "#/components/responses/ProductConflict"
```

`components/responses` ga (`TaskNotFound` dan keyin):

```yaml
    ProductNotFound:
      description: Mahsulot yoki xizmat topilmadi (not_found, "Mahsulot topilmadi")
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    ProductConflict:
      description: >
        Nom band (name_taken: "Bu nomli mahsulot allaqachon bor" / "Bu nomli
        xizmat allaqachon bor"), artikul band (sku_taken), mahsulot jonli
        xaridda bor (product_in_use)
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
```

`components/schemas` ga (`TaskHistoryEntry` dan keyin yoki oxiriga):

```yaml
    ProductKind:
      type: string
      description: Mahsulot (omborda turadi, birligi bor) yoki xizmat
      enum: [product, service]
    Unit:
      type: string
      description: O'lchov birligi, tayyor ro'yxatdan; m2 interfeysda m²
      enum: [dona, kg, g, l, ml, m, m2, quti, juft, komplekt]
    Product:
      type: object
      required: [id, kind, name, unit, sku, price, note, is_active, created_by_name, created_at, updated_at]
      properties:
        id:
          type: integer
          format: int64
        kind:
          $ref: "#/components/schemas/ProductKind"
        name:
          type: string
        unit:
          oneOf:
            - $ref: "#/components/schemas/Unit"
            - type: "null"
          description: Mahsulotda bor, xizmatda null
        sku:
          type: [string, "null"]
          description: Artikul yoki shtrix-kod; xizmatda null
        price:
          type: [string, "null"]
          description: Mahsulotda sotuv narxi, xizmatda narx; bazadagidek ikki kasr xonasi bilan ("150000.50")
        note:
          type: [string, "null"]
        is_active:
          type: boolean
          description: Nofaol (false) bo'lsa xarid takliflarida chiqmaydi
        created_by_name:
          type: [string, "null"]
          description: Qo'shgan a'zoning kompaniyadagi hozirgi ismi; chiqarilgan bo'lsa o'sha paytdagi ismi
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    ProductInput:
      type: object
      required: [kind, name]
      properties:
        kind:
          $ref: "#/components/schemas/ProductKind"
        name:
          type: string
          maxLength: 120
        unit:
          oneOf:
            - $ref: "#/components/schemas/Unit"
            - type: "null"
        sku:
          type: [string, "null"]
          maxLength: 60
        price:
          type: [string, "null"]
          pattern: "^[0-9]{1,12}([.][0-9]{1,2})?$"
        note:
          type: [string, "null"]
          maxLength: 500
    ProductUpdate:
      type: object
      required: [name]
      properties:
        name:
          type: string
          maxLength: 120
        unit:
          oneOf:
            - $ref: "#/components/schemas/Unit"
            - type: "null"
        sku:
          type: [string, "null"]
          maxLength: 60
        price:
          type: [string, "null"]
          pattern: "^[0-9]{1,12}([.][0-9]{1,2})?$"
        note:
          type: [string, "null"]
          maxLength: 500
    ActiveInput:
      type: object
      required: [is_active]
      properties:
        is_active:
          type: boolean
    ProductPage:
      type: object
      required: [items, total, page, page_size]
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/Product"
        total:
          type: integer
          format: int64
        page:
          type: integer
        page_size:
          type: integer
```

`make api-client`. `apps/web/lib/types.ts` ga:

```ts
export type ProductKind = components["schemas"]["ProductKind"]
export type Unit = components["schemas"]["Unit"]
export type Product = components["schemas"]["Product"]
export type ProductInput = components["schemas"]["ProductInput"]
export type ProductUpdate = components["schemas"]["ProductUpdate"]
export type ProductPage = components["schemas"]["ProductPage"]
```

- [ ] **Step 3: GREEN.** `GOTEST ./internal/httpx/` → o'tadi; `pnpm --filter @hisob24/api-client test` (bor bo'lsa) va `cd apps/web && pnpm typecheck`.

- [ ] **Step 4: Commit** `feat(api): the products in the contract` (`openapi.yaml`, `packages/api-client/src/schema.d.ts`, `apps/web/lib/types.ts`).

### Task 9: Web mock `mocks/catalog.ts`

**Files:** Create `apps/web/mocks/catalog.ts`; Modify `apps/web/mocks/data.ts`, `apps/web/mocks/handlers.ts`, `apps/web/mocks/handlers.test.ts`.

- [ ] **Step 1: Test** (`handlers.test.ts` oxiriga; `signIn`, `chooseCompany`, `giveRole` (`@/test/roles`), `failure` yordamchilari bor):

```ts
// The catalog (logic/products.md; backend/internal/app/catalog_test.go).
const products = (query: Record<string, string> = {}) => call(api.GET("/app/products", { params: { query } }))
const addProduct = (body: components["schemas"]["ProductInput"]) => call(api.POST("/app/products", { body }))

test("a product is entered with its fields trimmed, a service without a unit; the names and the SKUs are checked like the Go API's", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  const olma = await addProduct({ kind: "product", name: " Olma ", unit: "kg", sku: "A-1", price: "12000.5", note: "Qizil" })
  expect(olma).toMatchObject({ kind: "product", name: "Olma", unit: "kg", sku: "A-1", price: "12000.50", note: "Qizil", is_active: true, created_by_name: "Vali Aliyev" })
  expect(olma.created_at).toBe(olma.updated_at)
  const service = await addProduct({ kind: "service", name: "Yetkazish", price: "50000" })
  expect(service).toMatchObject({ kind: "service", unit: null, sku: null, price: "50000.00", note: null })

  for (const [body, message] of [
    [{ name: "Nok" }, "Turni tanlang"],
    [{ kind: "product", name: " ", unit: "kg" }, "Nomni kiriting"],
    [{ kind: "product", name: "a".repeat(121), unit: "kg" }, "Nom 120 belgidan oshmasin"],
    [{ kind: "product", name: "Nok" }, "Birlikni tanlang"],
    [{ kind: "product", name: "Nok", unit: "tonna" }, "Birlikni tanlang"],
    [{ kind: "service", name: "Ta'mirlash", unit: "dona" }, "Xizmatga birlik berilmaydi"],
    [{ kind: "service", name: "Ta'mirlash", sku: "S-1" }, "Xizmatga artikul berilmaydi"],
    [{ kind: "product", name: "Nok", unit: "kg", sku: "1".repeat(61) }, "Artikul 60 belgidan oshmasin"],
    [{ kind: "product", name: "Nok", unit: "kg", price: "1,5" }, "Narx noto'g'ri"],
    [{ kind: "product", name: "Nok", unit: "kg", note: "x".repeat(501) }, "Izoh 500 belgidan oshmasin"],
  ] as [components["schemas"]["ProductInput"], string][]) {
    expect(await failure(addProduct(body)), message).toMatchObject({ status: 400, code: "validation_error", message })
  }
  expect(await failure(addProduct({ kind: "product", name: "OLMA", unit: "dona" }))).toMatchObject({ status: 409, code: "name_taken", message: "Bu nomli mahsulot allaqachon bor" })
  expect(await failure(addProduct({ kind: "service", name: "yetkazish" }))).toMatchObject({ status: 409, code: "name_taken", message: "Bu nomli xizmat allaqachon bor" })
  expect(await failure(addProduct({ kind: "product", name: "Nok", unit: "dona", sku: "a-1" }))).toMatchObject({ status: 409, code: "sku_taken", message: "Bu artikulli mahsulot allaqachon bor" })
  await expect(addProduct({ kind: "service", name: "Olma" })).resolves.toMatchObject({ kind: "service" })
})

test("the list is the active products by name, the services and the inactive apart, searched by name or SKU, 20 a page", async () => {
  await signIn(ALI)
  await addProduct({ kind: "product", name: "Nok", unit: "dona", sku: "N-1" })
  await addProduct({ kind: "product", name: "anor", unit: "kg" })
  const off = await addProduct({ kind: "product", name: "Olma", unit: "kg" })
  await addProduct({ kind: "service", name: "Yetkazish" })
  await call(api.PATCH("/app/products/{id}", { params: { path: { id: off.id } }, body: { is_active: false } }))
  const names = async (query: Record<string, string> = {}) => (await products(query)).items.map((p) => p.name)

  expect(await names()).toEqual(["anor", "Nok"])
  expect(await names({ status: "inactive" })).toEqual(["Olma"])
  expect(await names({ kind: "service" })).toEqual(["Yetkazish"])
  expect(await names({ search: "n-1" })).toEqual(["Nok"])
  expect(await names({ search: "NO" })).toEqual(["anor"])
  expect(await products({ page: "2" })).toMatchObject({ items: [], total: 2, page: 2, page_size: 20 })
  expect(await failure(products({ page: "abc" }))).toMatchObject({ status: 400, message: "Sahifa raqami noto'g'ri" })
  expect(await failure(products({ kind: "thing" }))).toMatchObject({ status: 400, message: "Tur noto'g'ri" })
  expect(await failure(products({ status: "gone" }))).toMatchObject({ status: 400, message: "Holat noto'g'ri" })
})

test("a product is read, edited (its kind stays, what is not sent is cleared), turned off and deleted; another company's is not found", async () => {
  await signIn(ALI)
  const p = await addProduct({ kind: "product", name: "Olma", unit: "kg", sku: "A-1", price: "100", note: "Qizil" })
  const path = { params: { path: { id: p.id } } }

  expect(await call(api.GET("/app/products/{id}", path))).toEqual(p)
  const edited = await call(api.PUT("/app/products/{id}", { ...path, body: { name: "Qizil olma", unit: "dona" } }))
  expect(edited).toMatchObject({ kind: "product", name: "Qizil olma", unit: "dona", sku: null, price: null, note: null })
  expect(await failure(call(api.PUT("/app/products/{id}", { ...path, body: { name: "Qizil olma" } })))).toMatchObject({ status: 400, message: "Birlikni tanlang" })
  expect((await call(api.PATCH("/app/products/{id}", { ...path, body: { is_active: false } }))).is_active).toBe(false)
  expect(await failure(call(api.PATCH("/app/products/{id}", { ...path, body: {} as { is_active: boolean } })))).toMatchObject({ status: 400, message: "Holat noto'g'ri" })
  await call(api.DELETE("/app/products/{id}", path))
  expect(await failure(call(api.GET("/app/products/{id}", path)))).toMatchObject({ status: 404, code: "not_found", message: "Mahsulot topilmadi" })
  expect(await failure(call(api.DELETE("/app/products/{id}", path)))).toMatchObject({ status: 404 })
  await expect(addProduct({ kind: "product", name: "Olma", unit: "kg", sku: "A-1" })).resolves.toMatchObject({ name: "Olma" })

  await signIn(VALI)
  await chooseCompany(2)
  const theirs = await addProduct({ kind: "product", name: "Nok", unit: "dona" })
  await signIn(ALI)
  expect(await failure(call(api.GET("/app/products/{id}", { params: { path: { id: theirs.id } } })))).toMatchObject({ status: 404 })
})

test("the products take their permissions: an employee without a role has them all, a role without them gets 403", async () => {
  giveRole(SARDOR, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(SARDOR)
  await chooseCompany(1)
  expect(await failure(products())).toMatchObject({ status: 403, code: "forbidden" })
  expect(await failure(addProduct({ kind: "product", name: "Nok", unit: "dona" }))).toMatchObject({ status: 403, code: "forbidden" })

  await signIn(VALI)
  await chooseCompany(1)
  await expect(addProduct({ kind: "product", name: "Nok", unit: "dona" })).resolves.toMatchObject({ name: "Nok" })
})
```

(`SARDOR` Olma Savdo'da (1) `user`; `giveRole` imzosi `test/roles.ts` dagidek.)

- [ ] **Step 2: RED.** `cd apps/web && pnpm exec vitest run mocks/handlers.test.ts` → MSW `onUnhandledRequest` xatosi / 404.

- [ ] **Step 3: Kod.** `mocks/data.ts`: `ProductRow`, `Db.products`, seed `products: []`:

```ts
// A product or a service of a company (logic/products.md): a product has a
// unit, a service none and no SKU. The amounts are text as the API sends
// them ("150000.50"). by is who entered it, byName the name they went by
// then. A deleted row is hidden, never removed; an inactive one stays.
export interface ProductRow {
  id: number
  companyId: number
  kind: ProductKind
  name: string
  unit: Unit | null
  sku: string | null
  price: string | null
  note: string | null
  active: boolean
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}
```

`mocks/catalog.ts`:

```ts
// The catalog of the mock API: the products and the services of a company,
// under the Go API's rules (logic/products.md; backend/internal/catalog).
import { http, HttpResponse } from "msw"
import type { Product, ProductKind, Unit } from "@/lib/types"
import { nameOf } from "./customers"
import { db, nameIn, nextId, now, type ProductRow } from "./data"
import { api, fail, permittedSession } from "./gate"

const PAGE_SIZE = 20
export const units: Unit[] = ["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"]
const money = /^\d{1,12}(\.\d{1,2})?$/

const invalid = (message: string) => fail(400, "validation_error", message)
const productNotFound = () => fail(404, "not_found", "Mahsulot topilmadi")
const nameTaken = (kind: ProductKind) =>
  fail(409, "name_taken", kind === "service" ? "Bu nomli xizmat allaqachon bor" : "Bu nomli mahsulot allaqachon bor")
const skuTaken = () => fail(409, "sku_taken", "Bu artikulli mahsulot allaqachon bor")

// asMoney writes an amount as the database does: two decimals.
export function asMoney(raw: string): string {
  const [whole, decimals = ""] = raw.split(".")
  return `${whole}.${decimals.padEnd(2, "0")}`
}

// trimmed is an optional text without the spaces around it, null when
// nothing is left.
function trimmed(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : ""
  return text === "" ? null : text
}

type Checked = Pick<ProductRow, "name" | "unit" | "sku" | "price" | "note">

// check reads a body as the Go API does, in its order: the kind, the name,
// the unit, the SKU, the price, the note.
function check(kind: unknown, body: Record<string, unknown>): Checked | Response {
  if (kind !== "product" && kind !== "service") return invalid("Turni tanlang")
  const name = trimmed(body.name)
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 120) return invalid("Nom 120 belgidan oshmasin")
  const unit = trimmed(body.unit)
  if (kind === "service" && unit !== null) return invalid("Xizmatga birlik berilmaydi")
  if (kind === "product" && !units.includes(unit as Unit)) return invalid("Birlikni tanlang")
  const sku = trimmed(body.sku)
  if (kind === "service" && sku !== null) return invalid("Xizmatga artikul berilmaydi")
  if (sku !== null && [...sku].length > 60) return invalid("Artikul 60 belgidan oshmasin")
  const price = typeof body.price === "string" && body.price !== "" ? body.price : null
  if (price !== null && !money.test(price)) return invalid("Narx noto'g'ri")
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { name, unit: unit as Unit | null, sku, price: price === null ? null : asMoney(price), note }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
export const liveProducts = (companyId: number) => db.products.filter((p) => p.companyId === companyId && !p.deleted)

// taken is the refusal of a name another live row of the kind has, or of a
// SKU another live product has; null when both are free.
function taken(companyId: number, kind: ProductKind, c: Checked, except?: number): Response | null {
  const others = liveProducts(companyId).filter((p) => p.id !== except)
  if (others.some((p) => p.kind === kind && same(p.name, c.name))) return nameTaken(kind)
  if (c.sku !== null && others.some((p) => p.sku !== null && same(p.sku, c.sku!))) return skuTaken()
  return null
}

export const toProduct = (p: ProductRow): Product => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  unit: p.unit,
  sku: p.sku,
  price: p.price,
  note: p.note,
  is_active: p.active,
  created_by_name: nameOf(p.by, p.companyId, p.byName),
  created_at: p.createdAt,
  updated_at: p.updatedAt,
})

function liveProduct(companyId: number, id: unknown): ProductRow | undefined {
  return liveProducts(companyId).find((p) => p.id === Number(id))
}

export const catalogHandlers = [
  http.get(api("/app/products"), ({ request }) => {
    const member = permittedSession(request, "products.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    const kind = query.get("kind") || "product"
    if (kind !== "product" && kind !== "service") return invalid("Tur noto'g'ri")
    const status = query.get("status") || "active"
    if (status !== "active" && status !== "inactive") return invalid("Holat noto'g'ri")
    const search = (query.get("search") ?? "").trim().toLowerCase()
    const all = liveProducts(member.companyId)
      .filter((p) => p.kind === kind && p.active === (status === "active"))
      .filter((p) => !search || p.name.toLowerCase().includes(search) || (p.sku !== null && p.sku.toLowerCase().includes(search)))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
    return HttpResponse.json({
      items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toProduct),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/app/products"), async ({ request }) => {
    const member = permittedSession(request, "products.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const c = check(body.kind, body)
    if (c instanceof Response) return c
    const kind = body.kind as ProductKind
    const refusal = taken(member.companyId, kind, c)
    if (refusal) return refusal
    const at = now()
    const row: ProductRow = {
      id: nextId(), companyId: member.companyId, kind, ...c, active: true,
      by: member.phone, byName: nameIn(member.phone, member.companyId), createdAt: at, updatedAt: at,
    }
    db.products.push(row)
    return HttpResponse.json(toProduct(row), { status: 201 })
  }),

  http.get(api("/app/products/:id"), ({ params, request }) => {
    const member = permittedSession(request, "products.view")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    return p ? HttpResponse.json(toProduct(p)) : productNotFound()
  }),

  http.put(api("/app/products/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "products.edit")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = check(p.kind, body)
    if (c instanceof Response) return c
    const refusal = taken(member.companyId, p.kind, c, p.id)
    if (refusal) return refusal
    Object.assign(p, c, { updatedAt: now() })
    return HttpResponse.json(toProduct(p))
  }),

  http.patch(api("/app/products/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "products.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { is_active?: unknown }
    if (typeof body.is_active !== "boolean") return invalid("Holat noto'g'ri")
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    p.active = body.is_active
    p.updatedAt = now()
    return HttpResponse.json(toProduct(p))
  }),

  http.delete(api("/app/products/:id"), ({ params, request }) => {
    const member = permittedSession(request, "products.delete")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    p.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
```

`handlers.ts`: `import { catalogHandlers } from "./catalog"` va ro'yxatga `...catalogHandlers`. Eslatma: Go `PATCH` da holat tekshiruvi yozuvdan oldin (`Holat noto'g'ri` 400, keyin 404): mock ham shu tartibda.

- [ ] **Step 4: GREEN.** `pnpm exec vitest run` (web, to'liq), `pnpm lint`, `pnpm typecheck`.

- [ ] **Step 5: Commit** `feat(web): the mock API's products`.

### Task 10: Yakun

- [ ] `make lint` (0 issues), `make test`, `make e2e` toza.
- [ ] Lokal haqiqiy stack'da curl bilan (`docs/superpowers/specs/2026-10-07-inventory-design.md`, "Tekshiruv"; vaqtinchalik DB `TEMPLATE hisob24`, bo'sh portlar, SMS kodi API log'idan): egasi mahsulot va xizmat qo'shadi, takror nom va artikul 409, nofaol qiladi (ro'yxatda `status=inactive`), tahrirlaydi, o'chiradi; rolsiz xodim ham qo'shadi; bo'sh rolli xodim 403; kompaniyasiz sessiya 403 `company_required`; `/app/me.permissions` 30 ta. Sinov DB o'chiriladi.
- [ ] Spec'ga "1-bosqich qarorlari" bo'limi (bajarilganlar, amalga oshirishdagi tafsilotlar, tekshiruv sonlari).
- [ ] `git push origin main`.

## Self-review

- **Spec coverage:** ruxsat katalogi (Task 1–2), migratsiya (3), so'rovlar (4), servis va tekshiruv tartibi (5–6), 6 route (7), kontrakt (8), mock (9). Qoldiq / oxirgi narx / `product_in_use` 4-bosqichda (spec shunday).
- **Type consistency:** `catalog.Input{Kind, Name, Unit, SKU, Price, Note}`, `catalog.Product{… Active …}`, `ListInput{Kind, Status, Search, Page}`, `Page{Items, Total, Page, PageSize}`; handler `productInputJSON.input()`; mock `ProductRow{active}` ↔ `Product.is_active`.
- **Placeholders:** yo'q.
