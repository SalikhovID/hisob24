# Ombor, 4-bosqich: ombor API (ta'minotchilar, xaridlar, qoldiq, to'lovlar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bazada `suppliers`, `purchases`, `purchase_items`, `stock`, `supplier_payments` jadvallari paydo bo'ladi; `internal/warehouse` servisi ta'minotchilar, xaridlar (raqam, qatorlar, qoldiq), to'lovlar va balansni yuritadi; `internal/catalog` mahsulotga qoldiq (`quantity`, `stock`), oxirgi xarid narxi (`last_price`), xaridlari ro'yxati va `product_in_use` qoidasini oladi; admin jonli xaridi bor lokatsiyani o'chira olmaydi; 16 yangi route, kontrakt, TS client va web mock shunga mos. UI 5-bosqichda.

**Architecture:**
- **Baza:** migratsiya `00013_warehouse.sql` (spec'dagi SQL); so'rovlar `suppliers.sql`, `purchases.sql`, `supplier_payments.sql`; `products.sql` ga qoldiq, oxirgi narx va xaridlar so'rovlari; `locations.sql` ga `CountLocationPurchases`.
- **Servislar:** `internal/warehouse` (`warehouse.go`: `Service`, `write()`, `Scope`, xatolar; `numbers.go`: summa va miqdor o'qish; `suppliers.go`; `payments.go`; `purchases.go`; `stock.go`). `internal/catalog` kengayadi: `Scope`, `Quantity`, `Zero`, `Detail`, `Purchases`, `Delete` qoidasi. Har yozuv `LockCompanyCustomers` ostida (mijoz, vazifa va katalog yozuvlari bilan bir navbat): raqam, qoldiq, balans va «ishlatilganmi» tekshiruvlari poygasiz.
- **Pul va miqdor:** JSON'da matn (`"150000.50"`, `"12.500"`), Go'da `pgtype.Numeric`, arifmetika faqat bazada (`SetPurchaseTotal`, `AddStock`, balans, `last_price`).
- **API:** `internal/app/warehouse.go` handlerlari, `catalog.go` o'zgarishlari (`?location_id=`, `stock`, `/products/{id}/purchases`), `handler.go` da `Services.Warehouse` va route'lar (`allowed(access.Suppliers*)`, `allowed(access.Purchases*)`), `cmd/api/main.go`.
- **Kontrakt va mock:** openapi (7 yangi path, sxemalar, javoblar) → `make api-client`; web `lib/types.ts`; `mocks/warehouse.ts` (yangi), `mocks/catalog.ts`, `mocks/data.ts`, `mocks/handlers.ts`, `handlers.test.ts`.

**Tech Stack:** Go 1.27 (chi, pgx/v5 `pgtype.Numeric`, sqlc, goose, testify, pgtest), openapi-typescript, MSW, Vitest.

Qoidalar: `logic/warehouse.md`, `logic/products.md` (5, 6-bo'limlar), `logic/locations.md` (7-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-07-inventory-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: SQL yoziladi → `make sqlc` → test mantiq bo'yicha yiqiladi yoki stub. Migratsiya uchun RED tabiiy (jadval yo'q: 42P01). Web: `cd apps/web && pnpm exec vitest run <fayl>`.
- Har GREEN'dan keyin paket testlari va commit (faqat o'z fayllari). Commit xabarlari inglizcha, Conventional Commits.
- Mavjud testlar faqat talab o'zgarganda o'zgaradi (`catalog` imzolari `Scope` oladi; `GetProduct` / `ListProducts` ga `location_ids`; `TestDeleteLocation` xarid qoidasi; ruxsat matritsasi); hech biri o'chirilmaydi.
- Scope tashqarisidagi lokatsiya: 403 `forbidden` ni **handler** beradi (`allowedLocation`, vazifalardagidek); servis uni vazifalar servisi kabi ko'radi: ro'yxatda «hech qaysi lokatsiya» (bo'sh scope: qoldiq 0 / xarid yo'q), xarid kiritishda 400 «Lokatsiyani tanlang». `apperr` da `Forbidden` kind yo'q va qo'shilmaydi.
- Ta'minotchi telefoni: `user.NormalizePhone(raw) (string, error)` 9–15 raqamni qabul qiladi; so'ng `^998\d{9}$` tekshiriladi (faqat O'zbekiston), aks holda «Telefon raqami noto'g'ri».
- Sana: bazada `DATE` → Go `time.Time` (sqlc sozlamasi, vazifalar `deadline` kabi), JSON `YYYY-MM-DD` (`time.DateOnly`).
- `logic/warehouse.md` 4.3 dagi «Hech narsa o'zgarmagan saqlash hech narsani yozmaydi» jumlasi «… qoldiq va balansni o'zgartirmaydi» deb aniqlashtiriladi (tahrir qatorlarni qaytadan yozadi, `updated_at` yangilanadi; qoldiq farqi 0): avval hujjat, keyin kod (Task 9).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00013_warehouse.sql` (+`migrations_test.go`) | 5 jadval, indekslar, CHECK'lar, Down |
| `backend/internal/db/queries/suppliers.sql` (+`internal/db/suppliers_test.go`) | 10 so'rov |
| `backend/internal/db/queries/purchases.sql` (+`internal/db/purchases_test.go`) | 13 so'rov (xarid, qatorlar, qoldiq, lokatsiya soni) |
| `backend/internal/db/queries/supplier_payments.sql` (+`internal/db/supplier_payments_test.go`) | 9 so'rov |
| `backend/internal/db/queries/products.sql` (+`internal/db/products_test.go`) | `GetProduct` / `ListProducts` ga `location_ids`, `quantity`, `last_price`; `ProductStanding`, `ListProductStock`, `CountProductPurchases`, `ListProductPurchases`, `CountProductPurchaseLines` |
| `backend/internal/catalog/catalog.go`, `numbers.go`, `products.go`, `purchases.go` (yangi) (+testlar) | `Scope`, `Quantity`, `Zero`, `Product.Quantity/LastPrice`, `Detail`, `Purchases`, `Delete` qoidasi |
| `backend/internal/warehouse/warehouse.go`, `numbers.go`, `suppliers.go`, `payments.go`, `purchases.go`, `stock.go` (+testlar) | servis |
| `backend/internal/company/locations.go` (+`locations_test.go`) | `DeleteLocation` xarid qoidasi |
| `backend/internal/app/warehouse.go` (+`warehouse_test.go`), `catalog.go` (+`catalog_test.go`), `session.go`, `handler.go`, `permissions_test.go`, `handler_test.go`, `backend/cmd/api/main.go` | handlerlar, route'lar, ulash |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` (generatsiya), `apps/web/lib/types.ts` | kontrakt, tiplar |
| `apps/web/mocks/data.ts`, `mocks/catalog.ts`, `mocks/warehouse.ts` (yangi), `mocks/handlers.ts` (+`handlers.test.ts`) | mock API |

---

### Task 1: Migratsiya `00013_warehouse.sql`

**Files:** Create `backend/migrations/00013_warehouse.sql`; Modify `backend/migrations/migrations_test.go`.

- [ ] **Step 1: Test** (`migrations_test.go` oxiriga; `addCompany`, `sqlState`, `newProvider` bor):

```go
// warehouseFixture is a company with a user, a location, a supplier and a
// product: what a purchase needs.
type warehouseFixture struct {
	company, location, supplier, product int64
}

func addWarehouseFixture(t *testing.T, pool *pgxpool.Pool, company string) warehouseFixture {
	t.Helper()
	ctx := t.Context()
	f := warehouseFixture{company: addCompany(t, pool, company)}
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111') ON CONFLICT DO NOTHING")
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM locations WHERE company_id = $1 ORDER BY id LIMIT 1", f.company).Scan(&f.location))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', '998901111111') RETURNING id", f.company).Scan(&f.supplier))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', '998901111111') RETURNING id", f.company).Scan(&f.product))
	return f
}

func TestSuppliersAreACompanysWithTheirOwnNames(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addWarehouseFixture(t, pool, "Olma")
	nok := addWarehouseFixture(t, pool, "Nok")
	insert := func(companyID int64, name string, phone *string) error {
		_, err := pool.Exec(ctx, "INSERT INTO suppliers (company_id, name, phone, created_by) VALUES ($1, $2, $3, '998901111111')", companyID, name, phone)
		return err
	}
	str := func(s string) *string { return &s }

	assert.Equal(t, "23505", sqlState(insert(olma.company, "BOZOR", nil)), "the name is taken, whatever the case")
	require.NoError(t, insert(nok.company, "Bozor", str("998901234567")), "another company has its own names")
	assert.Equal(t, "23514", sqlState(insert(olma.company, "Do'kon", str("+998901234567"))), "a phone is 998 and nine digits")
	_, err := pool.Exec(ctx, "UPDATE suppliers SET deleted_at = now() WHERE id = $1", olma.supplier)
	require.NoError(t, err)
	require.NoError(t, insert(olma.company, "Bozor", nil), "a deleted supplier's name is free")
	var active bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT is_active FROM suppliers WHERE id = $1", nok.supplier).Scan(&active))
	assert.True(t, active, "a supplier starts active")
}

func TestPurchasesAreNumberedInTheCompanyAndStandInItsLocations(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addWarehouseFixture(t, pool, "Olma")
	nok := addWarehouseFixture(t, pool, "Nok")
	insert := func(f warehouseFixture, number int, locationID, supplierID int64) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, created_by)
			VALUES ($1, $2, $3, $4, '2026-10-07', '998901111111') RETURNING id`, f.company, number, locationID, supplierID).Scan(&id)
		return id, err
	}

	first, err := insert(olma, 1, olma.location, olma.supplier)
	require.NoError(t, err)
	_, err = insert(olma, 1, olma.location, olma.supplier)
	assert.Equal(t, "23505", sqlState(err), "a number is one purchase's in the company")
	_, err = insert(nok, 1, nok.location, nok.supplier)
	require.NoError(t, err, "another company counts its own")
	_, err = insert(olma, 2, nok.location, olma.supplier)
	assert.Equal(t, "23503", sqlState(err), "the location is the company's")
	_, err = insert(olma, 2, olma.location, nok.supplier)
	assert.Equal(t, "23503", sqlState(err), "the supplier is the company's")
	var total string
	require.NoError(t, pool.QueryRow(ctx, "SELECT total::text FROM purchases WHERE id = $1", first).Scan(&total))
	assert.Equal(t, "0.00", total, "a purchase starts with no total")

	item := func(purchaseID, productID int64, quantity, price string) error {
		_, err := pool.Exec(ctx, "INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", purchaseID, productID, quantity, price)
		return err
	}
	require.NoError(t, item(first, olma.product, "12.5", "1000"))
	assert.Equal(t, "23505", sqlState(item(first, olma.product, "1", "1000")), "a product once in a purchase")
	assert.Equal(t, "23514", sqlState(item(first, nok.product, "0", "1000")), "a quantity above zero")
	assert.Equal(t, "23514", sqlState(item(first, nok.product, "1", "-1")), "a price not below zero")
	var quantity string
	require.NoError(t, pool.QueryRow(ctx, "SELECT quantity::text FROM purchase_items WHERE purchase_id = $1", first).Scan(&quantity))
	assert.Equal(t, "12.500", quantity, "three decimals, as the column keeps it")
}

func TestStockIsALocationsAndNeverBelowZero(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addWarehouseFixture(t, pool, "Olma")
	nok := addWarehouseFixture(t, pool, "Nok")
	insert := func(companyID, locationID, productID int64, quantity string) error {
		_, err := pool.Exec(ctx, "INSERT INTO stock (company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4::numeric)", companyID, locationID, productID, quantity)
		return err
	}

	require.NoError(t, insert(olma.company, olma.location, olma.product, "0"))
	assert.Equal(t, "23505", sqlState(insert(olma.company, olma.location, olma.product, "1")), "one row per location and product")
	assert.Equal(t, "23514", sqlState(insert(nok.company, nok.location, nok.product, "-1")), "stock is never below zero")
	assert.Equal(t, "23503", sqlState(insert(olma.company, nok.location, olma.product, "1")), "the location is the company's")
	assert.Equal(t, "23503", sqlState(insert(olma.company, olma.location, nok.product, "1")), "the product is the company's")
	var pgErr *pgconn.PgError
	require.ErrorAs(t, insert(nok.company, nok.location, nok.product, "-1"), &pgErr)
	assert.Equal(t, "stock_quantity_check", pgErr.ConstraintName, "the service tells the refusal by this name")
}

func TestAPaymentIsASuppliersAndAPurchaseHoldsOne(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	olma := addWarehouseFixture(t, pool, "Olma")
	nok := addWarehouseFixture(t, pool, "Nok")
	var purchase int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, created_by)
		VALUES ($1, 1, $2, $3, '2026-10-07', '998901111111') RETURNING id`, olma.company, olma.location, olma.supplier).Scan(&purchase))
	insert := func(companyID, supplierID int64, purchaseID *int64, amount string) (int64, error) {
		var id int64
		err := pool.QueryRow(ctx, `INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, created_by)
			VALUES ($1, $2, $3, $4::numeric, '2026-10-07', '998901111111') RETURNING id`, companyID, supplierID, purchaseID, amount).Scan(&id)
		return id, err
	}

	linked, err := insert(olma.company, olma.supplier, &purchase, "5000")
	require.NoError(t, err)
	_, err = insert(olma.company, olma.supplier, &purchase, "1")
	assert.Equal(t, "23505", sqlState(err), "a purchase holds one live payment")
	_, err = pool.Exec(ctx, "UPDATE supplier_payments SET deleted_at = now() WHERE id = $1", linked)
	require.NoError(t, err)
	_, err = insert(olma.company, olma.supplier, &purchase, "1")
	require.NoError(t, err, "a deleted one does not count")
	_, err = insert(olma.company, olma.supplier, nil, "0")
	assert.Equal(t, "23514", sqlState(err), "an amount above zero")
	_, err = insert(olma.company, nok.supplier, nil, "1")
	assert.Equal(t, "23503", sqlState(err), "the supplier is the company's")
}

func TestTheWarehouseMigrationDownRemovesItsTables(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()

	_, err := newProvider(t, pool).DownTo(ctx, 12)
	require.NoError(t, err)

	for _, table := range []string{"supplier_payments", "stock", "purchase_items", "purchases", "suppliers"} {
		_, err = pool.Exec(ctx, "SELECT 1 FROM "+table)
		assert.Equal(t, "42P01", sqlState(err), table)
	}
}
```

- [ ] **Step 2: RED.** `GOTEST ./migrations/ -run 'TestSuppliers|TestPurchases|TestStock|TestAPayment|TestTheWarehouseMigration'` → 42P01 (`relation "suppliers" does not exist`); Down testi `DownTo(12)` da o'tadi (qabul qilinadi).

- [ ] **Step 3: Kod** (`00013_warehouse.sql`):

```sql
-- +goose Up
-- The warehouse (logic/warehouse.md): the suppliers a company buys from,
-- its purchases (one supplier, one location, lines of products), the stock
-- of every product in every location, and the payments to the suppliers.
-- Nothing is ever removed: deleted_at hides a row. Amounts are so'm with
-- two decimals, quantities have three.

-- A supplier: a name (one live supplier's in the company, whatever the
-- case), a phone (an Uzbek number, as the users' phones are kept) and a
-- note. An inactive supplier stays but is offered to no new purchase.
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    name            TEXT NOT NULL,
    phone           TEXT CHECK (phone ~ '^998[0-9]{9}$'),
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX suppliers_name ON suppliers (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A purchase: numbered in the company from 1 (a deleted purchase keeps its
-- number), in one of the company's locations, from one of its suppliers,
-- on a day. total is the sum of its lines, kept by the service.
CREATE TABLE purchases (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    number          INT NOT NULL,
    location_id     BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchased_on    DATE NOT NULL,
    note            TEXT,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id),
    UNIQUE (company_id, number),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE INDEX purchases_newest ON purchases (company_id, purchased_on DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX purchases_supplier ON purchases (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX purchases_location ON purchases (location_id) WHERE deleted_at IS NULL;

-- A line of a purchase: a product once per purchase, a quantity above zero
-- and a price. position is the order the lines were entered in.
CREATE TABLE purchase_items (
    purchase_id BIGINT NOT NULL REFERENCES purchases(id),
    product_id  BIGINT NOT NULL REFERENCES products(id),
    quantity    NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    price       NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    position    INT NOT NULL,
    PRIMARY KEY (purchase_id, product_id)
);
CREATE INDEX purchase_items_product ON purchase_items (product_id);

-- The stock of a product in a location, changed by the purchases alone and
-- never below zero (stock_quantity_check is what the service tells a
-- refusal by).
CREATE TABLE stock (
    company_id  BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (location_id, product_id),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id)
);

-- A payment to a supplier. One entered with a purchase is linked to it
-- (purchase_id): a purchase holds at most one live payment, which is
-- changed through the purchase alone.
CREATE TABLE supplier_payments (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchase_id     BIGINT REFERENCES purchases(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    paid_on         DATE NOT NULL,
    note            TEXT,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE UNIQUE INDEX supplier_payments_purchase ON supplier_payments (purchase_id) WHERE purchase_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX supplier_payments_newest ON supplier_payments (supplier_id, paid_on DESC, id DESC) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE supplier_payments;
DROP TABLE stock;
DROP TABLE purchase_items;
DROP TABLE purchases;
DROP TABLE suppliers;
```

- [ ] **Step 4: GREEN.** `GOTEST ./migrations/` hammasi o'tadi (pgtest shablon migratsiya hash'i bilan yangilanadi). Commit `feat(db): the warehouse tables`.

### Task 2: So'rovlar `suppliers.sql`

**Files:** Create `backend/internal/db/queries/suppliers.sql`, `backend/internal/db/suppliers_test.go`.

- [ ] **Step 1: Test** (`db_test` paketi; `setup`, `createCompany`, `createUser`, `enteredBy`, `today`, `ptr`, `numeric`, `numericText`, `addLocation`, `createProduct` bor):

```go
// createSupplier enters a supplier of the company, as enteredBy.
func createSupplier(t *testing.T, q *gen.Queries, companyID int64, name string) gen.Supplier {
	t.Helper()
	s, err := q.CreateSupplier(t.Context(), gen.CreateSupplierParams{CompanyID: companyID, Name: name, CreatedBy: enteredBy})
	require.NoError(t, err)
	return s
}

// addPurchase enters a purchase of the supplier in the location with one
// line (quantity × price) and returns its id; deleted hides it.
func addPurchase(t *testing.T, pool *pgxpool.Pool, companyID, locationID, supplierID, productID int64, number int32, quantity, price string, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, total, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, '2026-10-07', ($5::numeric * $6::numeric), $7, CASE WHEN $8 THEN now() END) RETURNING id`,
		companyID, number, locationID, supplierID, quantity, price, enteredBy, deleted).Scan(&id))
	mustExec(t, pool, "INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", id, productID, quantity, price)
	return id
}

// addPayment enters a payment to the supplier, linked to purchaseID when
// one is given; deleted hides it.
func addPayment(t *testing.T, pool *pgxpool.Pool, companyID, supplierID int64, purchaseID *int64, amount string, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), `INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, created_by, deleted_at)
		VALUES ($1, $2, $3, $4::numeric, '2026-10-07', $5, CASE WHEN $6 THEN now() END) RETURNING id`,
		companyID, supplierID, purchaseID, amount, enteredBy, deleted).Scan(&id))
	return id
}

func TestCreateSupplier(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")

	s, err := q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Bozor", Phone: ptr("998901234567"), Note: ptr("Chorsu"), CreatedBy: enteredBy, CreatedByName: ptr("Ali aka")})

	require.NoError(t, err)
	assert.Positive(t, s.ID)
	assert.Equal(t, "Bozor", s.Name)
	assert.Equal(t, ptr("998901234567"), s.Phone)
	assert.Equal(t, ptr("Chorsu"), s.Note)
	assert.True(t, s.IsActive)
	assert.Equal(t, ptr("Ali aka"), s.CreatedByName)
	_, err = q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "bozor", CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the name is taken, whatever the case")
}

func TestGetSupplierTellsItsBalance(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', 'Ali aka')", enteredBy, olma.ID)
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	product := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	s, err := q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "0.00", numericText(t, s.PurchasesTotal), "nothing bought yet")
	assert.Equal(t, "0.00", numericText(t, s.PaymentsTotal))
	assert.Equal(t, "0.00", numericText(t, s.Balance))
	assert.Equal(t, ptr("Ali aka"), s.CreatedByName, "the name the member goes by now")

	one := addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 1, "10", "1000", false)
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 2, "5", "1000", true)
	addPayment(t, pool, olma.ID, bozor.ID, &one, "2500.50", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "100", true)
	s, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "10000.00", numericText(t, s.PurchasesTotal), "the live purchases")
	assert.Equal(t, "2500.50", numericText(t, s.PaymentsTotal), "the live payments")
	assert.Equal(t, "7499.50", numericText(t, s.Balance), "what is owed")

	addPayment(t, pool, olma.ID, bozor.ID, nil, "10000", false)
	s, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "-2500.50", numericText(t, s.Balance), "an advance")

	nok := createCompany(t, q, "Nok", today(t, pool))
	_, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")
	mustExec(t, pool, "UPDATE suppliers SET deleted_at = now() WHERE id = $1", bozor.ID)
	_, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted")
}

func TestListSuppliers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	for _, name := range []string{"Chorsu", "bozor", "Anhor"} {
		createSupplier(t, q, olma.ID, name)
	}
	createSupplier(t, q, nok.ID, "Begona")
	_, err := q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Dehqon", Phone: ptr("998909998877"), CreatedBy: enteredBy})
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE suppliers SET is_active = false WHERE company_id = $1 AND name = 'Anhor'", olma.ID)
	mustExec(t, pool, "UPDATE suppliers SET deleted_at = now() WHERE company_id = $1 AND name = 'Chorsu'", olma.ID)
	names := func(params gen.ListSuppliersParams) []string {
		rows, err := q.ListSuppliers(ctx, params)
		require.NoError(t, err)
		out := make([]string, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Name)
		}
		return out
	}
	active := gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Limit: 20}

	assert.Equal(t, []string{"bozor", "Dehqon"}, names(active), "the live active ones, by name whatever the case")
	assert.Equal(t, []string{"Anhor"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: false, Limit: 20}), "the inactive")
	assert.Equal(t, []string{"bozor"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Search: ptr("ZOR"), Limit: 20}), "searched by name, whatever the case")
	assert.Equal(t, []string{"Dehqon"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Digits: ptr("99988"), Limit: 20}), "searched by the digits of the phone")
	assert.Equal(t, []string{"Dehqon"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Limit: 1, Offset: 1}), "paged")
	count, err := q.CountSuppliers(ctx, gen.CountSuppliersParams{CompanyID: olma.ID, IsActive: true})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	rows, err := q.ListSuppliers(ctx, active)
	require.NoError(t, err)
	assert.Equal(t, "0.00", numericText(t, rows[0].Balance), "each with its balance")
}

func TestUpdateSupplier(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	createSupplier(t, q, olma.ID, "Chorsu")

	s, err := q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: bozor.ID, CompanyID: olma.ID, Name: "Eski bozor", Phone: ptr("998901234567"), Note: nil})
	require.NoError(t, err)
	assert.Equal(t, "Eski bozor", s.Name)
	assert.Equal(t, ptr("998901234567"), s.Phone)
	assert.Nil(t, s.Note)
	assert.True(t, s.UpdatedAt.After(bozor.UpdatedAt))
	_, err = q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: bozor.ID, CompanyID: olma.ID, Name: "CHORSU"})
	assert.Equal(t, "23505", sqlState(err), "another's name")
	_, err = q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: 999999, CompanyID: olma.ID, Name: "X"})
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	off, err := q.SetSupplierActive(ctx, gen.SetSupplierActiveParams{ID: bozor.ID, CompanyID: olma.ID, IsActive: false})
	require.NoError(t, err)
	assert.False(t, off.IsActive)

	_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Eski bozor", CreatedBy: enteredBy})
	assert.NoError(t, err, "the name is free again")
}

func TestASupplierInUseIsCounted(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	product := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 1, "1", "1", false)
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 2, "1", "1", true)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", true)

	purchases, err := q.CountSupplierPurchases(ctx, bozor.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, purchases, "the deleted purchase not counted")
	payments, err := q.CountSupplierPayments(ctx, bozor.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, payments, "the deleted payment not counted")

	standing, err := q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.True(t, standing, "is_active")
	_, err = q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: 999999, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```

- [ ] **Step 2: RED.** SQL yoziladi → `make sqlc` → `GOTEST ./internal/db/ -run 'Supplier'`; yiqilish: generatsiya bo'lmaguncha kompilyatsiya xatosi (qabul qilinmaydi), shuning uchun avval SQL + `make sqlc`, keyin testlar mantiq bo'yicha o'tishi kerak bo'lgan joyda yiqilsa (masalan balans noto'g'ri) tuzatiladi. So'rov testlari uchun RED «SQL yo'q → `undefined: gen.CreateSupplierParams`» hisobga olinmaydi; mantiqiy RED balansni `0` qilib yozib ko'rish bilan tekshiriladi (1-bosqichdagi kelishuv).

- [ ] **Step 3: Kod** (`suppliers.sql`):

```sql
-- name: CreateSupplier :one
-- Enters a supplier. created_by_name is the name the member who enters it
-- goes by in the company now: it stays when they leave. The name is one
-- live supplier's in the company (23505, whatever the case).
INSERT INTO suppliers (company_id, name, phone, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.narg('phone'), sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetSupplier :one
-- The company's supplier with its balance: what its live purchases come to,
-- what its live payments come to, and the difference (owed when above zero,
-- an advance when below). pgx.ErrNoRows when the company has none such, or
-- deleted it.
SELECT s.id, s.name, s.phone, s.note, s.is_active, s.created_at, s.updated_at,
       COALESCE(m.full_name, s.created_by_name) AS created_by_name,
       t.purchases_total, t.payments_total, (t.purchases_total - t.payments_total)::numeric(14,2) AS balance
FROM suppliers s
LEFT JOIN user_companies m ON m.user_phone = s.created_by AND m.company_id = s.company_id
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT sum(p.total) FROM purchases p WHERE p.supplier_id = s.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS purchases_total,
           COALESCE((SELECT sum(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS payments_total
) t
WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL;

-- name: ListSuppliers :many
-- A page of the company's suppliers, the active or the inactive ones, by
-- name whatever the case, without the deleted, each with its balance.
-- search, escaped for ILIKE, is looked for in the name; digits in the
-- phone. A NULL argument leaves its filter out.
SELECT s.id, s.name, s.phone, s.note, s.is_active, s.created_at, s.updated_at,
       COALESCE(m.full_name, s.created_by_name) AS created_by_name,
       t.purchases_total, t.payments_total, (t.purchases_total - t.payments_total)::numeric(14,2) AS balance
FROM suppliers s
LEFT JOIN user_companies m ON m.user_phone = s.created_by AND m.company_id = s.company_id
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT sum(p.total) FROM purchases p WHERE p.supplier_id = s.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS purchases_total,
           COALESCE((SELECT sum(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS payments_total
) t
WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL AND s.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL OR s.name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('digits')::text IS NULL OR s.phone LIKE '%' || sqlc.narg('digits')::text || '%')
ORDER BY lower(s.name), s.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSuppliers :one
-- How many rows ListSuppliers finds under the same filter, on all of its pages.
SELECT count(*) FROM suppliers s
WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL AND s.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL OR s.name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('digits')::text IS NULL OR s.phone LIKE '%' || sqlc.narg('digits')::text || '%');

-- name: UpdateSupplier :one
-- An edit: every field as it is now (NULL clears an optional one), and the
-- moment of the edit. pgx.ErrNoRows when the company has no such supplier,
-- or deleted it; 23505 when the name is another's.
UPDATE suppliers
SET name = sqlc.arg('name'), phone = sqlc.narg('phone'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetSupplierActive :one
-- Turns a supplier off (offered to no new purchase) or on again.
UPDATE suppliers SET is_active = sqlc.arg('is_active'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteSupplier :one
-- Hides the supplier: nothing is removed, and its name is free again.
-- pgx.ErrNoRows when the company has no such supplier, or deleted it already.
UPDATE suppliers SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: CountSupplierPurchases :one
-- How many live purchases the supplier has: one with any is not deleted.
SELECT count(*) FROM purchases WHERE supplier_id = $1 AND deleted_at IS NULL;

-- name: CountSupplierPayments :one
-- How many live payments the supplier has: one with any is not deleted.
SELECT count(*) FROM supplier_payments WHERE supplier_id = $1 AND deleted_at IS NULL;

-- name: SupplierStanding :one
-- Whether the company's live supplier is active; pgx.ErrNoRows when the
-- company has none such, or deleted it (a purchase may not name it).
SELECT is_active FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
```

Agar sqlc `CROSS JOIN LATERAL` ustunlarining tipini aniqlay olmasa, ikkala so'rovda `t.*` o'rniga ikki subquery to'g'ridan-to'g'ri ustunlarda takrorlanadi (`balance` uchun ikkalasining ayirmasi).

- [ ] **Step 4: GREEN.** `make sqlc`, `GOTEST ./internal/db/ -run Supplier`, `go vet ./...`. Commit `feat(db): the supplier queries, with the balance`.

### Task 3: So'rovlar `purchases.sql` (xarid, qatorlar, qoldiq, lokatsiya soni)

**Files:** Create `backend/internal/db/queries/purchases.sql`, `backend/internal/db/purchases_test.go`; Modify `backend/internal/db/queries/locations.sql` (`CountLocationPurchases`).

- [ ] **Step 1: Test:**

```go
// warehouse is a company with a member, two locations, a supplier and two
// products: what the purchase queries need.
type warehouse struct {
	company, asosiy, chilonzor, bozor, olma, nok int64
}

func newWarehouse(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) warehouse {
	t.Helper()
	company := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', 'Ali aka')", enteredBy, company.ID)
	return warehouse{
		company:   company.ID,
		asosiy:    addLocation(t, pool, company.ID, "Asosiy"),
		chilonzor: addLocation(t, pool, company.ID, "Chilonzor"),
		bozor:     createSupplier(t, q, company.ID, "Bozor").ID,
		olma:      createProduct(t, q, company.ID, "product", "Olma", ptr("kg")).ID,
		nok:       createProduct(t, q, company.ID, "product", "Nok", ptr("dona")).ID,
	}
}

// day is a DATE as the queries take one.
func day(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse(time.DateOnly, s)
	require.NoError(t, err)
	return d
}

func TestNextPurchaseNumberCountsTheCompanysPurchasesDeletedOnesToo(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	nok := createCompany(t, q, "Nok", today(t, pool))

	n, err := q.NextPurchaseNumber(ctx, w.company)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "the first")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	n, err = q.NextPurchaseNumber(ctx, w.company)
	require.NoError(t, err)
	assert.EqualValues(t, 3, n, "a deleted purchase keeps its number")
	n, err = q.NextPurchaseNumber(ctx, nok.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "another company counts its own")
}

func TestCreateAndGetPurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)

	p, err := q.CreatePurchase(ctx, gen.CreatePurchaseParams{
		CompanyID: w.company, Number: 7, LocationID: w.asosiy, SupplierID: w.bozor, PurchasedOn: day(t, "2026-10-07"), Note: ptr("Ertalab"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	assert.EqualValues(t, 7, p.Number)
	assert.Equal(t, "0.00", numericText(t, p.Total), "no lines yet")

	require.NoError(t, q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: p.ID, ProductID: w.olma, Quantity: numeric(t, "12.5"), Price: numeric(t, "1000"), Position: 1}))
	require.NoError(t, q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: p.ID, ProductID: w.nok, Quantity: numeric(t, "3"), Price: numeric(t, "2500.5"), Position: 2}))
	total, err := q.SetPurchaseTotal(ctx, p.ID)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", numericText(t, total), "12.5 × 1000 + 3 × 2500.5")

	got, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	assert.EqualValues(t, 7, got.Number)
	assert.Equal(t, "Asosiy", got.LocationName)
	assert.Equal(t, "Bozor", got.SupplierName)
	assert.Equal(t, day(t, "2026-10-07"), got.PurchasedOn)
	assert.Equal(t, ptr("Ertalab"), got.Note)
	assert.Equal(t, "20001.50", numericText(t, got.Total))
	assert.Equal(t, "0.00", numericText(t, got.Paid), "nothing paid")
	assert.EqualValues(t, 2, got.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)

	addPayment(t, pool, w.company, w.bozor, &p.ID, "5000", false)
	got, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", numericText(t, got.Paid), "the payment entered with it")

	items, err := q.ListPurchaseItems(ctx, p.ID)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "Olma", items[0].Name, "in the order entered")
	assert.Equal(t, ptr("kg"), items[0].Unit)
	assert.Equal(t, "12.500", numericText(t, items[0].Quantity))
	assert.Equal(t, "1000.00", numericText(t, items[0].Price))
	assert.Equal(t, "12500.00", numericText(t, items[0].Amount))
	assert.Equal(t, "7501.50", numericText(t, items[1].Amount))

	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.chilonzor}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "outside the member's locations")
	nok := createCompany(t, q, "Nok", today(t, pool))
	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: nok.ID, LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")
}

func TestListPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE number = 1")
	addPurchase(t, pool, w.company, w.chilonzor, dehqon, w.olma, 2, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE number = 2")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE number = 3")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", true)
	numbers := func(params gen.ListPurchasesParams) []int32 {
		rows, err := q.ListPurchases(ctx, params)
		require.NoError(t, err)
		out := make([]int32, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Number)
		}
		return out
	}
	all := []int64{w.asosiy, w.chilonzor}

	assert.Equal(t, []int32{3, 2, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 20}), "the newest first, then the later entered; the deleted left out")
	assert.Equal(t, []int32{3, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}, Limit: 20}), "one location")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, SupplierID: &dehqon, Limit: 20}), "one supplier")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 1, Offset: 1}), "paged")
	assert.Empty(t, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{}, Limit: 20}), "a member with no location sees none")
	count, err := q.CountPurchases(ctx, gen.CountPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
}

func TestUpdateAndDeletePurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	id := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)

	p, err := q.UpdatePurchase(ctx, gen.UpdatePurchaseParams{ID: id, CompanyID: w.company, SupplierID: dehqon, PurchasedOn: day(t, "2026-10-09"), Note: ptr("Kechga")})
	require.NoError(t, err)
	assert.Equal(t, dehqon, p.SupplierID)
	assert.Equal(t, day(t, "2026-10-09"), p.PurchasedOn)
	assert.Equal(t, ptr("Kechga"), p.Note)
	assert.EqualValues(t, 1, p.Number, "the number stays")
	assert.Equal(t, w.asosiy, p.LocationID, "the location stays")

	require.NoError(t, q.DeletePurchaseItems(ctx, id))
	items, err := q.ListPurchaseItems(ctx, id)
	require.NoError(t, err)
	assert.Empty(t, items)
	total, err := q.SetPurchaseTotal(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "0.00", numericText(t, total), "no lines, no total")

	_, err = q.DeletePurchase(ctx, gen.DeletePurchaseParams{ID: id, CompanyID: w.company})
	require.NoError(t, err)
	_, err = q.DeletePurchase(ctx, gen.DeletePurchaseParams{ID: id, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.UpdatePurchase(ctx, gen.UpdatePurchaseParams{ID: id, CompanyID: w.company, SupplierID: dehqon, PurchasedOn: day(t, "2026-10-09")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted purchase is not edited")
}

func TestAddStockMovesAProductsQuantityInALocation(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	quantity := func(locationID, productID int64) string {
		var s string
		require.NoError(t, pool.QueryRow(ctx, "SELECT quantity::text FROM stock WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s))
		return s
	}
	move := func(locationID, productID int64, added, removed string) error {
		return q.AddStock(ctx, gen.AddStockParams{CompanyID: w.company, LocationID: locationID, ProductID: productID, Added: numeric(t, added), Removed: numeric(t, removed)})
	}

	require.NoError(t, move(w.asosiy, w.olma, "12.5", "0"), "a first purchase makes the row")
	assert.Equal(t, "12.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "2", "0"), "another adds to it")
	assert.Equal(t, "14.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "3", "2"), "an edit moves by the difference")
	assert.Equal(t, "15.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "0", "15.5"), "a deletion takes it back")
	assert.Equal(t, "0.000", quantity(w.asosiy, w.olma))
	var pgErr *pgconn.PgError
	require.ErrorAs(t, move(w.asosiy, w.olma, "0", "0.001"), &pgErr, "below zero")
	assert.Equal(t, "23514", pgErr.Code)
	assert.Equal(t, "stock_quantity_check", pgErr.ConstraintName)
	require.ErrorAs(t, move(w.chilonzor, w.nok, "0", "1"), &pgErr, "taking from a location that has none")
	assert.Equal(t, "stock_quantity_check", pgErr.ConstraintName)
	require.NoError(t, move(w.chilonzor, w.olma, "1", "0"))
	assert.Equal(t, "0.000", quantity(w.asosiy, w.olma), "each location its own")
	assert.Equal(t, "1.000", quantity(w.chilonzor, w.olma))
}

func TestCountLocationPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 3, "1", "1", false)

	count, err := q.CountLocationPurchases(ctx, w.asosiy)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "the live purchases standing in the location")
}
```

`day` nomi `tasks_test.go` da band bo'lsa, `onDay` deb nomlanadi; `pgconn` import qilinadi.

- [ ] **Step 2: RED.** SQL yoziladi → `make sqlc` → `GOTEST ./internal/db/ -run 'Purchase|Stock|CountLocationPurchases'`. Mantiqiy RED: `AddStock` ni avval `DO NOTHING` bilan yozib ko'rish (`14.500` o'rniga `12.500`), keyin to'g'rilanadi.

- [ ] **Step 3: Kod** (`purchases.sql`):

```sql
-- name: NextPurchaseNumber :one
-- The number the company's next purchase takes: one past the highest so
-- far, the deleted purchases counted (a number is never given twice). Run
-- under the company's lock (LockCompanyCustomers), so two purchases entered
-- at once take two numbers.
SELECT (COALESCE(max(number), 0) + 1)::int AS number FROM purchases WHERE company_id = $1;

-- name: CreatePurchase :one
-- Enters a purchase in a location of the company, from a supplier of it,
-- with no lines yet (total 0). created_by_name is the name the member goes
-- by in the company now: it stays when they leave.
INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('number'), sqlc.arg('location_id'), sqlc.arg('supplier_id'), sqlc.arg('purchased_on'),
        sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetPurchase :one
-- The company's purchase, in one of the locations given (the member's):
-- with its supplier's and location's names, what was paid with it (the
-- live payment linked to it, 0 when none), how many lines it has.
-- pgx.ErrNoRows when the company has none such in those locations, or
-- deleted it.
SELECT p.id, p.number, p.location_id, l.name AS location_name, p.supplier_id, s.name AS supplier_name,
       p.purchased_on, p.note, p.total, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       COALESCE((SELECT sp.amount FROM supplier_payments sp WHERE sp.purchase_id = p.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS items_count
FROM purchases p
JOIN locations l ON l.id = p.location_id
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListPurchases :many
-- A page of the company's purchases in the locations given, the newest
-- first (then the later entered), without the deleted; supplier_id keeps
-- one supplier's, NULL leaves the filter out. The columns are GetPurchase's.
SELECT p.id, p.number, p.location_id, l.name AS location_name, p.supplier_id, s.name AS supplier_name,
       p.purchased_on, p.note, p.total, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       COALESCE((SELECT sp.amount FROM supplier_payments sp WHERE sp.purchase_id = p.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS items_count
FROM purchases p
JOIN locations l ON l.id = p.location_id
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR p.supplier_id = sqlc.narg('supplier_id')::bigint)
ORDER BY p.purchased_on DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPurchases :one
-- How many rows ListPurchases finds under the same filter, on all of its pages.
SELECT count(*) FROM purchases p
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR p.supplier_id = sqlc.narg('supplier_id')::bigint);

-- name: UpdatePurchase :one
-- An edit of the head: the supplier, the day and the note (NULL clears it),
-- and the moment of the edit. The number and the location stay.
-- pgx.ErrNoRows when the company has no such purchase, or deleted it.
UPDATE purchases
SET supplier_id = sqlc.arg('supplier_id'), purchased_on = sqlc.arg('purchased_on'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetPurchaseTotal :one
-- Writes the purchase's total as the sum of its lines (quantity × price),
-- 0 with no lines, and returns it.
UPDATE purchases
SET total = COALESCE((SELECT sum(i.quantity * i.price) FROM purchase_items i WHERE i.purchase_id = purchases.id), 0)
WHERE id = $1
RETURNING total;

-- name: DeletePurchase :one
-- Hides the purchase: nothing is removed, its number is never given again.
-- pgx.ErrNoRows when the company has no such purchase, or deleted it already.
UPDATE purchases SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: AddPurchaseItem :exec
-- Enters a line of the purchase: a product once per purchase (23505), a
-- quantity above zero and a price not below it (23514).
INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position)
VALUES (sqlc.arg('purchase_id'), sqlc.arg('product_id'), sqlc.arg('quantity'), sqlc.arg('price'), sqlc.arg('position'));

-- name: ListPurchaseItems :many
-- The lines of the purchase in the order entered, each with its product's
-- name and unit and what it comes to.
SELECT i.product_id, pr.name, pr.unit, i.quantity, i.price, (i.quantity * i.price)::numeric(14,2) AS amount, i.position
FROM purchase_items i
JOIN products pr ON pr.id = i.product_id
WHERE i.purchase_id = $1
ORDER BY i.position, i.product_id;

-- name: DeletePurchaseItems :exec
-- Removes the lines of the purchase (an edit writes them anew).
DELETE FROM purchase_items WHERE purchase_id = $1;

-- name: AddStock :exec
-- Moves the product's stock in the location by added − removed: a purchase
-- adds its quantity, a deletion removes it, an edit passes both (the
-- difference). The row is made on the first move. Below zero: 23514,
-- stock_quantity_check.
INSERT INTO stock (company_id, location_id, product_id, quantity)
VALUES (sqlc.arg('company_id'), sqlc.arg('location_id'), sqlc.arg('product_id'), sqlc.arg('added')::numeric - sqlc.arg('removed')::numeric)
ON CONFLICT (location_id, product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity;
```

`locations.sql` ga:

```sql
-- name: CountLocationPurchases :one
-- How many live purchases stand in the location: one with any is not
-- deleted (logic/locations.md, section 7).
SELECT count(*) FROM purchases WHERE location_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 4: GREEN.** `make sqlc`, `GOTEST ./internal/db/`. Commit `feat(db): the purchase, line and stock queries`.

### Task 4: So'rovlar `supplier_payments.sql`

**Files:** Create `backend/internal/db/queries/supplier_payments.sql`, `backend/internal/db/supplier_payments_test.go`.

- [ ] **Step 1: Test:**

```go
func TestCreateGetAndListPayments(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", false)

	linked, err := q.CreatePayment(ctx, gen.CreatePaymentParams{
		CompanyID: w.company, SupplierID: w.bozor, PurchaseID: &purchase, Amount: numeric(t, "5000"), PaidOn: day(t, "2026-10-07"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", numericText(t, linked.Amount))
	own, err := q.CreatePayment(ctx, gen.CreatePaymentParams{CompanyID: w.company, SupplierID: w.bozor, Amount: numeric(t, "1200.5"), PaidOn: day(t, "2026-10-09"), Note: ptr("Naqd"), CreatedBy: enteredBy})
	require.NoError(t, err)
	_, err = q.CreatePayment(ctx, gen.CreatePaymentParams{CompanyID: w.company, SupplierID: w.bozor, Amount: numeric(t, "0"), PaidOn: day(t, "2026-10-09"), CreatedBy: enteredBy})
	assert.Equal(t, "23514", sqlState(err), "an amount above zero")

	got, err := q.GetPayment(ctx, gen.GetPaymentParams{ID: linked.ID, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, &purchase, got.PurchaseID)
	assert.Equal(t, ptr(int32(4)), got.PurchaseNumber, "the number of the purchase it was entered with")
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	got, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own.ID, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Nil(t, got.PurchaseID)
	assert.Nil(t, got.PurchaseNumber)
	assert.Equal(t, ptr("Naqd"), got.Note)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	_, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own.ID, SupplierID: dehqon, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another supplier's")

	rows, err := q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, own.ID, rows[0].ID, "the newest first")
	assert.Equal(t, linked.ID, rows[1].ID)
	count, err := q.CountPayments(ctx, gen.CountPaymentsParams{SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	rows, err = q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 1, Offset: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{linked.ID}, []int64{rows[0].ID}, "paged")
}

func TestUpdateAndDeletePayment(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	own := addPayment(t, pool, w.company, w.bozor, nil, "1000", false)

	p, err := q.UpdatePayment(ctx, gen.UpdatePaymentParams{ID: own, CompanyID: w.company, Amount: numeric(t, "1500"), PaidOn: day(t, "2026-10-01"), Note: ptr("Karta")})
	require.NoError(t, err)
	assert.Equal(t, "1500.00", numericText(t, p.Amount))
	assert.Equal(t, day(t, "2026-10-01"), p.PaidOn)
	assert.Equal(t, ptr("Karta"), p.Note)

	_, err = q.DeletePayment(ctx, gen.DeletePaymentParams{ID: own, CompanyID: w.company})
	require.NoError(t, err)
	_, err = q.DeletePayment(ctx, gen.DeletePaymentParams{ID: own, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.UpdatePayment(ctx, gen.UpdatePaymentParams{ID: own, CompanyID: w.company, Amount: numeric(t, "1"), PaidOn: day(t, "2026-10-01")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted payment is not edited")
}

func TestAPurchasesPaymentFollowsThePurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)

	_, err := q.GetPurchasePayment(ctx, purchase)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "none yet")
	id := addPayment(t, pool, w.company, w.bozor, &purchase, "5000", false)
	p, err := q.GetPurchasePayment(ctx, purchase)
	require.NoError(t, err)
	assert.Equal(t, id, p.ID)

	require.NoError(t, q.UpdatePurchasePayment(ctx, gen.UpdatePurchasePaymentParams{PurchaseID: purchase, SupplierID: dehqon, Amount: numeric(t, "7000"), PaidOn: day(t, "2026-10-09")}))
	p, err = q.GetPurchasePayment(ctx, purchase)
	require.NoError(t, err)
	assert.Equal(t, dehqon, p.SupplierID, "it moves with the purchase to the other supplier")
	assert.Equal(t, "7000.00", numericText(t, p.Amount))
	assert.Equal(t, day(t, "2026-10-09"), p.PaidOn, "on the purchase's day")

	require.NoError(t, q.DeletePurchasePayment(ctx, purchase))
	_, err = q.GetPurchasePayment(ctx, purchase)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "hidden with the purchase")
	require.NoError(t, q.DeletePurchasePayment(ctx, purchase), "nothing to hide is fine")
}
```

- [ ] **Step 2: RED.** `make sqlc` → `GOTEST ./internal/db/ -run Payment`.

- [ ] **Step 3: Kod** (`supplier_payments.sql`):

```sql
-- name: CreatePayment :one
-- Enters a payment to the supplier; purchase_id links the one entered with
-- a purchase. created_by_name stays when the member leaves. 23514 on an
-- amount not above zero; 23505 on a second live payment of a purchase.
INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('supplier_id'), sqlc.narg('purchase_id'), sqlc.arg('amount'), sqlc.arg('paid_on'),
        sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetPayment :one
-- The supplier's payment in the company, with the number of the purchase it
-- was entered with (NULL for one entered on its own). pgx.ErrNoRows when
-- there is none such, or it is deleted.
SELECT sp.id, sp.supplier_id, sp.purchase_id, p.number AS purchase_number, sp.amount, sp.paid_on, sp.note, sp.created_at, sp.updated_at,
       COALESCE(m.full_name, sp.created_by_name) AS created_by_name
FROM supplier_payments sp
LEFT JOIN purchases p ON p.id = sp.purchase_id
LEFT JOIN user_companies m ON m.user_phone = sp.created_by AND m.company_id = sp.company_id
WHERE sp.id = $1 AND sp.supplier_id = $2 AND sp.company_id = $3 AND sp.deleted_at IS NULL;

-- name: ListPayments :many
-- A page of the supplier's live payments, the newest first (then the later
-- entered). The columns are GetPayment's.
SELECT sp.id, sp.supplier_id, sp.purchase_id, p.number AS purchase_number, sp.amount, sp.paid_on, sp.note, sp.created_at, sp.updated_at,
       COALESCE(m.full_name, sp.created_by_name) AS created_by_name
FROM supplier_payments sp
LEFT JOIN purchases p ON p.id = sp.purchase_id
LEFT JOIN user_companies m ON m.user_phone = sp.created_by AND m.company_id = sp.company_id
WHERE sp.supplier_id = sqlc.arg('supplier_id') AND sp.company_id = sqlc.arg('company_id') AND sp.deleted_at IS NULL
ORDER BY sp.paid_on DESC, sp.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPayments :one
-- How many rows ListPayments finds, on all of its pages.
SELECT count(*) FROM supplier_payments sp
WHERE sp.supplier_id = sqlc.arg('supplier_id') AND sp.company_id = sqlc.arg('company_id') AND sp.deleted_at IS NULL;

-- name: UpdatePayment :one
-- An edit of a payment entered on its own: the amount, the day and the note
-- (NULL clears it). pgx.ErrNoRows when the company has none such, or
-- deleted it. (A linked one is refused by the service before this.)
UPDATE supplier_payments
SET amount = sqlc.arg('amount'), paid_on = sqlc.arg('paid_on'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeletePayment :one
-- Hides the payment. pgx.ErrNoRows when the company has none such, or
-- deleted it already.
UPDATE supplier_payments SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: GetPurchasePayment :one
-- The live payment entered with the purchase; pgx.ErrNoRows when there is
-- none.
SELECT * FROM supplier_payments WHERE purchase_id = $1 AND deleted_at IS NULL;

-- name: UpdatePurchasePayment :exec
-- The payment entered with the purchase follows an edit of it: the
-- purchase's supplier, the amount paid and the purchase's day.
UPDATE supplier_payments
SET supplier_id = sqlc.arg('supplier_id'), amount = sqlc.arg('amount'), paid_on = sqlc.arg('paid_on'), updated_at = now()
WHERE purchase_id = sqlc.arg('purchase_id') AND deleted_at IS NULL;

-- name: DeletePurchasePayment :exec
-- Hides the payment entered with the purchase, when there is one: the
-- purchase was deleted, or is paid nothing now.
UPDATE supplier_payments SET deleted_at = now() WHERE purchase_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 4: GREEN.** `make sqlc`, `GOTEST ./internal/db/`. Commit `feat(db): the supplier payment queries`.

### Task 5: `products.sql`: qoldiq, oxirgi narx, mahsulot xaridlari

**Files:** Modify `backend/internal/db/queries/products.sql`, `backend/internal/db/products_test.go`.

- [ ] **Step 1: Test** (`products_test.go` ga; mavjud `GetProduct` / `ListProducts` chaqiruvlariga `LocationIds` qo'shiladi):

```go
func TestAProductTellsItsStockInTheLocationsGivenAndItsLastPrice(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	service := createProduct(t, q, w.company, "service", "Yetkazish", nil)
	mustExec(t, pool, "INSERT INTO stock (company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, 12.5), ($1, $4, $3, 2)", w.company, w.asosiy, w.olma, w.chilonzor)
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE id = $1", one)
	two := addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 2, "2", "1200.5", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE id = $1", two)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "9999", true)
	get := func(id int64, locations ...int64) gen.GetProductRow {
		p, err := q.GetProduct(ctx, gen.GetProductParams{ID: id, CompanyID: w.company, LocationIds: locations})
		require.NoError(t, err)
		return p
	}

	p := get(w.olma, w.asosiy, w.chilonzor)
	assert.Equal(t, "14.500", numericText(t, p.Quantity), "the stock of every location given")
	assert.Equal(t, "1200.50", numericText(t, p.LastPrice), "the newest live purchase's price, whatever the location")
	assert.Equal(t, "12.500", numericText(t, get(w.olma, w.asosiy).Quantity), "one location")
	assert.Equal(t, "0.000", numericText(t, get(w.nok, w.asosiy).Quantity), "nothing in stock")
	assert.False(t, get(w.nok, w.asosiy).LastPrice.Valid, "never bought")
	assert.False(t, get(service.ID, w.asosiy).Quantity.Valid, "a service has no stock")
	assert.Equal(t, "0.000", numericText(t, get(w.olma).Quantity), "a member with no location sees 0")

	rows, err := q.ListProducts(ctx, gen.ListProductsParams{CompanyID: w.company, Kind: "product", IsActive: true, LocationIds: []int64{w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "0.000", numericText(t, rows[0].Quantity), "Nok")
	assert.Equal(t, "2.000", numericText(t, rows[1].Quantity), "Olma in Chilonzor")
	assert.Equal(t, "1200.50", numericText(t, rows[1].LastPrice))

	lines, err := q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: w.company, ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	require.Len(t, lines, 2)
	assert.Equal(t, "Asosiy", lines[0].LocationName, "in the order the locations were added")
	assert.Equal(t, "12.500", numericText(t, lines[0].Quantity))
	assert.Equal(t, "Chilonzor", lines[1].LocationName)
	lines, err = q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: w.company, ProductID: w.nok, LocationIds: []int64{w.chilonzor}})
	require.NoError(t, err)
	require.Len(t, lines, 1)
	assert.Equal(t, "0.000", numericText(t, lines[0].Quantity), "a location with none is listed with 0")
}

func TestAProductsPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	one := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "10", "1000", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE id = $1", one)
	two := addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 2, "2", "1200.5", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE id = $1", two)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "9999", true)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.nok, 4, "1", "1", false)

	count, err := q.CountProductPurchases(ctx, w.olma)
	require.NoError(t, err)
	assert.EqualValues(t, 2, count, "the live purchases the product is in, whatever the location")
	count, err = q.CountProductPurchases(ctx, createProduct(t, q, w.company, "product", "Anor", ptr("kg")).ID)
	require.NoError(t, err)
	assert.Zero(t, count)

	rows, err := q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy, w.chilonzor}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.EqualValues(t, 2, rows[0].Number, "the newest first")
	assert.Equal(t, "Bozor", rows[0].SupplierName)
	assert.Equal(t, "Chilonzor", rows[0].LocationName)
	assert.Equal(t, "2.000", numericText(t, rows[0].Quantity))
	assert.Equal(t, "1200.50", numericText(t, rows[0].Price))
	assert.Equal(t, "2401.00", numericText(t, rows[0].Amount))
	assert.EqualValues(t, 1, rows[1].Number)
	rows, err = q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1, "the member's locations alone")
	lines, err := q.CountProductPurchaseLines(ctx, gen.CountProductPurchaseLinesParams{ProductID: w.olma, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, lines)

	kind, err := q.ProductStanding(ctx, gen.ProductStandingParams{ID: w.olma, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, "product", kind.Kind)
	assert.Equal(t, "Olma", kind.Name)
	assert.True(t, kind.IsActive)
	_, err = q.ProductStanding(ctx, gen.ProductStandingParams{ID: 999999, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
```

- [ ] **Step 2: RED.** `make sqlc` → `GOTEST ./internal/db/ -run 'Product'`.

- [ ] **Step 3: Kod.** `GetProduct` va `ListProducts` ustunlariga (ikkalasida bir xil, `toProduct` tip almashtiradi):

```sql
       CASE WHEN p.kind = 'product'
            THEN COALESCE((SELECT sum(s.quantity) FROM stock s WHERE s.product_id = p.id AND s.location_id = ANY(sqlc.arg('location_ids')::bigint[])), 0)
       END::numeric(14,3) AS quantity,
       (SELECT i.price FROM purchase_items i JOIN purchases pu ON pu.id = i.purchase_id
         WHERE i.product_id = p.id AND pu.deleted_at IS NULL
         ORDER BY pu.purchased_on DESC, pu.id DESC LIMIT 1) AS last_price
```

(`GetProduct` da `$1`, `$2` o'rniga `sqlc.arg('id')`, `sqlc.arg('company_id')`.) Izohga: «quantity is the product's stock in the locations given (the member's, or the one asked for), NULL for a service; last_price is the price of its newest live purchase line, whatever the location.» Yangi so'rovlar:

```sql
-- name: ProductStanding :one
-- The company's live product or service: its kind, name and whether it is
-- active (what a purchase line may name). pgx.ErrNoRows when the company
-- has none such, or deleted it.
SELECT kind, name, is_active FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: ListProductStock :many
-- The product's stock in each of the locations given (the member's), in
-- the order the locations were added; a location with none is listed with 0.
SELECT l.id AS location_id, l.name AS location_name, COALESCE(s.quantity, 0)::numeric(14,3) AS quantity
FROM locations l
LEFT JOIN stock s ON s.location_id = l.id AND s.product_id = sqlc.arg('product_id')
WHERE l.company_id = sqlc.arg('company_id') AND l.deleted_at IS NULL AND l.id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY l.created_at, l.id;

-- name: CountProductPurchases :one
-- How many live purchases hold the product, in any location: one held is
-- not deleted (logic/products.md, section 4).
SELECT count(*) FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
WHERE i.product_id = $1 AND p.deleted_at IS NULL;

-- name: ListProductPurchases :many
-- A page of the live purchase lines of the product in the locations given,
-- the newest purchase first: the purchase, its supplier and location, the
-- line's quantity, price and what it comes to.
SELECT p.id AS purchase_id, p.number, p.purchased_on, p.supplier_id, s.name AS supplier_name, p.location_id, l.name AS location_name,
       i.quantity, i.price, (i.quantity * i.price)::numeric(14,2) AS amount
FROM purchase_items i
JOIN purchases p ON p.id = i.purchase_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN locations l ON l.id = p.location_id
WHERE i.product_id = sqlc.arg('product_id') AND p.deleted_at IS NULL AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY p.purchased_on DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductPurchaseLines :one
-- How many rows ListProductPurchases finds, on all of its pages.
SELECT count(*) FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
WHERE i.product_id = sqlc.arg('product_id') AND p.deleted_at IS NULL AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[]);
```

Mavjud `products_test.go` chaqiruvlari `LocationIds: nil` bilan kompilyatsiya bo'ladi (bo'sh massiv → qoldiq 0).

- [ ] **Step 4: GREEN.** `make sqlc`; `internal/catalog` kompilyatsiyasi buziladi (`GetProductParams` yangi maydon) — shu task ichida `catalog/products.go` ga `LocationIds: nil` vaqtincha qo'yilmaydi: Task 6 shu zahoti `Scope` ni kiritadi. Shuning uchun Task 5 va Task 6 birinchi qismi (imzolar) bitta commit'da: `feat(db): a product's stock, last price and purchases`.

### Task 6: `internal/catalog`: `Scope`, miqdor, qoldiq, oxirgi narx, xaridlar, `product_in_use`

**Files:** Modify `backend/internal/catalog/catalog.go`, `numbers.go`, `products.go`, `numbers_test.go`, `products_test.go`; Create `backend/internal/catalog/purchases.go`, `purchases_test.go`.

- [ ] **Step 1: Test** (`numbers_test.go` ga):

```go
func TestQuantity(t *testing.T) {
	for name, tc := range map[string]struct {
		raw  *string
		want string
		bad  bool
	}{
		"whole":          {ptr("12"), "12", false},
		"three decimals": {ptr("0.125"), "0.125", false},
		"nine digits":    {ptr("123456789.999"), "123456789.999", false},
		"nil":            {nil, "", true},
		"empty":          {ptr(""), "", true},
		"zero":           {ptr("0"), "", true},
		"zero decimals":  {ptr("0.000"), "", true},
		"negative":       {ptr("-1"), "", true},
		"four decimals":  {ptr("1.0001"), "", true},
		"ten digits":     {ptr("1234567890"), "", true},
		"comma":          {ptr("1,5"), "", true},
		"spaces":         {ptr(" 1"), "", true},
	} {
		n, err := Quantity(tc.raw, "Miqdor noto'g'ri")
		if tc.bad {
			refused(t, err, apperr.Invalid, "validation_error", "Miqdor noto'g'ri", name)
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, ptr(tc.want), Text(n), name)
	}
}

func TestZero(t *testing.T) {
	assert.True(t, Zero(pgtype.Numeric{}), "no amount")
	zero, err := Money(ptr("0.00"), "x")
	require.NoError(t, err)
	assert.True(t, Zero(zero))
	some, err := Money(ptr("0.01"), "x")
	require.NoError(t, err)
	assert.False(t, Zero(some))
}
```

`products_test.go`: `addCompany` lokatsiya ham qaytarsin (`locations` jadvaliga egasi uchun `Asosiy` kiritiladi: migratsiya 00010 har kompaniyaga tayyor lokatsiya beradimi — `migrations_test` `TestTheLocationsMigrationGivesEveryCompanyAReadyLocation` mavjud kompaniyalar uchun; yangi kompaniyani servis yaratadi; testda `INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id`). Yordamchi:

```go
// shop is a company with Ali (owner, "Ali aka") and Vali (user), its
// location Asosiy and a second, Chilonzor; scope is the owner's.
type shop struct {
	company, asosiy, chilonzor int64
}

func (s shop) scope(locations ...int64) Scope {
	if locations == nil {
		locations = []int64{s.asosiy, s.chilonzor}
	}
	return Scope{CompanyID: s.company, LocationIDs: locations}
}

func newShop(t *testing.T, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	s := shop{company: addCompany(t, pool, name)}
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", s.company).Scan(&s.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", s.company).Scan(&s.chilonzor))
	return s
}

// buy enters a live purchase of the product in the location: quantity at
// price, as fixture SQL (the warehouse service is another package).
func buy(t *testing.T, pool *pgxpool.Pool, s shop, locationID, productID int64, number int, day, quantity, price string, deleted bool) int64 {
	t.Helper()
	ctx := t.Context()
	var supplier int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor ' || $2::text, $3) ON CONFLICT DO NOTHING RETURNING id", s.company, number, ali).Scan(&supplier))
	var id int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, total, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, $5::date, $6::numeric * $7::numeric, $8, CASE WHEN $9 THEN now() END) RETURNING id`,
		s.company, number, locationID, supplier, day, quantity, price, ali, deleted).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", id, productID, quantity, price)
	require.NoError(t, err)
	if !deleted {
		_, err = pool.Exec(ctx, `INSERT INTO stock (company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4::numeric)
			ON CONFLICT (location_id, product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity`, s.company, locationID, productID, quantity)
		require.NoError(t, err)
	}
	return id
}
```

Mavjud testlar: `addCompany(t, pool, "Olma")` → `newShop(t, pool, "Olma")`, `s.Create(ctx, olma, ali, …)` → `s.Create(ctx, olma.scope(), ali, …)`, `s.List(ctx, olma, …)` → `s.List(ctx, olma.scope(), …)`, `s.Get(ctx, olma, id)` → `s.Get(ctx, olma.scope(), id)` va hokazo (talab o'zgardi: scope). Yangi testlar:

```go
func TestAProductCarriesItsStockAndLastPrice(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	p, err := s.Create(ctx, olma.scope(), ali, product("Olma", "kg"))
	require.NoError(t, err)
	assert.Equal(t, ptr("0.000"), p.Quantity, "nothing in stock yet")
	assert.Nil(t, p.LastPrice, "never bought")
	service, err := s.Create(ctx, olma.scope(), ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)
	assert.Nil(t, service.Quantity, "a service has no stock")

	buy(t, pool, olma, olma.asosiy, p.ID, 1, "2026-10-01", "10", "1000", false)
	buy(t, pool, olma, olma.chilonzor, p.ID, 2, "2026-10-05", "2.5", "1200.5", false)
	buy(t, pool, olma, olma.asosiy, p.ID, 3, "2026-10-06", "1", "9999", true)
	got, err := s.Get(ctx, olma.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, ptr("12.500"), got.Quantity, "every location of the scope")
	assert.Equal(t, ptr("1200.50"), got.LastPrice, "the newest live purchase")
	got, err = s.Get(ctx, olma.scope(olma.chilonzor), p.ID)
	require.NoError(t, err)
	assert.Equal(t, ptr("2.500"), got.Quantity, "a restricted member's location alone")

	page, err := s.List(ctx, olma.scope(), ListInput{Page: 1, LocationID: olma.asosiy})
	require.NoError(t, err)
	assert.Equal(t, ptr("10.000"), page.Items[0].Quantity, "the location asked for")
	page, err = s.List(ctx, olma.scope(), ListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, ptr("12.500"), page.Items[0].Quantity, "no location asked for: the scope's")
	page, err = s.List(ctx, olma.scope(olma.asosiy), ListInput{Page: 1, LocationID: olma.chilonzor})
	require.NoError(t, err)
	assert.Equal(t, ptr("0.000"), page.Items[0].Quantity, "a location outside the scope counts as none (the handler refuses it with 403 before)")
}

func TestDetailListsTheStockOfEveryLocationOfTheScope(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	p, err := s.Create(ctx, olma.scope(), ali, product("Olma", "kg"))
	require.NoError(t, err)
	buy(t, pool, olma, olma.chilonzor, p.ID, 1, "2026-10-05", "2.5", "1200.5", false)

	d, err := s.Detail(ctx, olma.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, d.ID)
	assert.Equal(t, []StockLine{{LocationID: olma.asosiy, LocationName: "Asosiy", Quantity: "0.000"}, {LocationID: olma.chilonzor, LocationName: "Chilonzor", Quantity: "2.500"}}, d.Stock)
	d, err = s.Detail(ctx, olma.scope(olma.chilonzor), p.ID)
	require.NoError(t, err)
	assert.Len(t, d.Stock, 1, "the member's locations alone")
	service, err := s.Create(ctx, olma.scope(), ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)
	d, err = s.Detail(ctx, olma.scope(), service.ID)
	require.NoError(t, err)
	assert.Empty(t, d.Stock, "a service has no stock")
	_, err = s.Detail(ctx, olma.scope(), 999999)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi")
}

func TestAProductsPurchasesAreThoseOfTheScope(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	p, err := s.Create(ctx, olma.scope(), ali, product("Olma", "kg"))
	require.NoError(t, err)
	one := buy(t, pool, olma, olma.asosiy, p.ID, 1, "2026-10-01", "10", "1000", false)
	two := buy(t, pool, olma, olma.chilonzor, p.ID, 2, "2026-10-05", "2.5", "1200.5", false)
	buy(t, pool, olma, olma.asosiy, p.ID, 3, "2026-10-06", "1", "9999", true)

	page, err := s.Purchases(ctx, olma.scope(), p.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total)
	require.Len(t, page.Items, 2)
	assert.Equal(t, ProductPurchase{PurchaseID: two, Number: 2, PurchasedOn: time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC), SupplierID: page.Items[0].SupplierID, SupplierName: "Bozor 2",
		LocationID: olma.chilonzor, LocationName: "Chilonzor", Quantity: "2.500", Price: "1200.50", Amount: "3001.25"}, page.Items[0], "the newest first")
	assert.Equal(t, one, page.Items[1].PurchaseID)
	page, err = s.Purchases(ctx, olma.scope(olma.asosiy), p.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, page.Total, "the member's locations alone")
	_, err = s.Purchases(ctx, olma.scope(), p.ID, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	_, err = s.Purchases(ctx, olma.scope(), 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi")
}

func TestAProductInAPurchaseIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	p, err := s.Create(ctx, olma.scope(), ali, product("Olma", "kg"))
	require.NoError(t, err)
	buy(t, pool, olma, olma.asosiy, p.ID, 1, "2026-10-01", "10", "1000", false)
	buy(t, pool, olma, olma.chilonzor, p.ID, 2, "2026-10-05", "2.5", "1200.5", false)
	buy(t, pool, olma, olma.asosiy, p.ID, 3, "2026-10-06", "1", "9999", true)

	err = s.Delete(ctx, olma.scope(olma.asosiy), p.ID)
	refused(t, err, apperr.Conflict, "product_in_use", "Bu mahsulot 2 ta xaridda bor", "every live purchase counts, whatever the location")
	_, err = s.Get(ctx, olma.scope(), p.ID)
	assert.NoError(t, err, "it stays")
	_, err = s.SetActive(ctx, olma.scope(), p.ID, false)
	assert.NoError(t, err, "it may be turned off instead")

	_, err = pool.Exec(ctx, "UPDATE purchases SET deleted_at = now() WHERE company_id = $1", olma.company)
	require.NoError(t, err)
	assert.NoError(t, s.Delete(ctx, olma.scope(), p.ID), "once its purchases are gone")
}
```

`TestAProductsPurchasesAreThoseOfTheScope` da `time.Date(... time.UTC)`: sqlc `DATE` → `time.Time` UTC yarim tun (vazifalar `deadline` kabi); mos kelmasa `page.Items[0].PurchasedOn.Format(time.DateOnly)` bilan solishtiriladi.

- [ ] **Step 2: RED.** `GOTEST ./internal/catalog/` → kompilyatsiya xatosi (`Scope`, `Quantity` yo'q) — avval stub: `catalog.go` ga `type Scope struct{ CompanyID int64; LocationIDs []int64 }`, `numbers.go` ga `Quantity` (`return pgtype.Numeric{}, errors.New("not implemented")`), `Zero` (`return false`), `products.go` imzolari scope bilan (ichida hozircha `LocationIds: scope.LocationIDs`), `purchases.go` da `Detail`, `Purchases` stub (`not implemented`). Testlar mantiq bo'yicha yiqiladi (`Quantity` nil, `Detail` xato, `Delete` 409 bermaydi).

- [ ] **Step 3: Kod.** `catalog.go`:

```go
// Scope is a member's reach in a company: the company and the locations of
// it they may work in. The stock a member sees is these locations'.
type Scope struct {
	CompanyID   int64
	LocationIDs []int64
}

// has tells whether the location is one of the scope's.
func (sc Scope) has(locationID int64) bool {
	for _, id := range sc.LocationIDs {
		if id == locationID {
			return true
		}
	}
	return false
}
```

`Product` ga:

```go
	// Quantity is the product's stock in the scope's locations (or the one
	// asked for), three decimals; nil for a service.
	Quantity *string
	// LastPrice is the price of the product's newest live purchase line,
	// whatever the location; nil when it was never bought.
	LastPrice *string
```

`toProduct`: `Quantity: Text(r.Quantity), LastPrice: Text(r.LastPrice)`. `numbers.go`:

```go
// quantityPattern is a quantity as the client writes it: up to nine digits
// and three decimals ("12.500"), in any unit.
var quantityPattern = regexp.MustCompile(`^\d{1,9}(\.\d{1,3})?$`)

// Quantity reads a quantity the client sent: one is needed, above zero.
// What is missing or does not match is refused with message.
func Quantity(raw *string, message string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if raw == nil || !quantityPattern.MatchString(*raw) || n.Scan(*raw) != nil || Zero(n) {
		return pgtype.Numeric{}, invalid(message)
	}
	return n, nil
}

// Zero tells whether the amount is nothing: no amount, or 0 however written.
func Zero(n pgtype.Numeric) bool {
	return !n.Valid || n.Int == nil || n.Int.Sign() == 0
}
```

`products.go`: `ListInput.LocationID int64` («0: the scope's locations»); `List(ctx, scope, in)`: `locations := scope.LocationIDs; if in.LocationID != 0 { locations = []int64{}; if scope.has(in.LocationID) { locations = []int64{in.LocationID} } }` (vazifalar ro'yxati kabi: scope tashqarisidagi lokatsiya hech qaysi lokatsiya); `ListProductsParams{..., LocationIds: locations}`. `Get(ctx, scope, id)` → `get(ctx, q, scope, id)` (`GetProductParams{ID, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs}`). `Create(ctx, scope, by, in)`, `Update(ctx, scope, id, in)`, `SetActive(ctx, scope, id, active)` — `companyID` o'rniga `scope.CompanyID`, qayta o'qish `get(ctx, q, scope, …)`. `Delete(ctx, scope, id)`:

```go
// Delete hides the company's product or service; its name and SKU are free
// again. A product a live purchase holds is refused (409): it may be turned
// off instead (logic/products.md, section 4).
func (s *Service) Delete(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		if _, err := get(ctx, q, scope, id); err != nil {
			return err
		}
		held, err := q.CountProductPurchases(ctx, id)
		if err != nil {
			return err
		}
		if held > 0 {
			return apperr.New(apperr.Conflict, "product_in_use", fmt.Sprintf("Bu mahsulot %d ta xaridda bor", held))
		}
		_, err = q.DeleteProduct(ctx, gen.DeleteProductParams{ID: id, CompanyID: scope.CompanyID})
		return err
	})
}
```

`purchases.go`:

```go
package catalog

// StockLine is the product's stock in one location.
type StockLine struct {
	LocationID   int64
	LocationName string
	Quantity     string
}

// Detail is a product with its stock in each of the scope's locations (a
// service has none).
type Detail struct {
	Product
	Stock []StockLine
}

// ProductPurchase is one live purchase line of a product: the purchase, its
// supplier and location, the quantity, the price and what the line came to.
type ProductPurchase struct {
	PurchaseID   int64
	Number       int32
	PurchasedOn  time.Time
	SupplierID   int64
	SupplierName string
	LocationID   int64
	LocationName string
	Quantity     string
	Price        string
	Amount       string
}

// PurchasePage is one page of a product's purchase lines.
type PurchasePage struct {
	Items    []ProductPurchase
	Total    int64
	Page     int
	PageSize int
}

// Detail is the company's product or service with its stock in the scope's
// locations, each listed (0 too), in the order the locations were added.
func (s *Service) Detail(ctx context.Context, scope Scope, id int64) (Detail, error) {
	p, err := get(ctx, s.q, scope, id)
	if err != nil {
		return Detail{}, err
	}
	d := Detail{Product: p, Stock: []StockLine{}}
	if p.Kind != KindProduct {
		return d, nil
	}
	rows, err := s.q.ListProductStock(ctx, gen.ListProductStockParams{CompanyID: scope.CompanyID, ProductID: id, LocationIds: scope.LocationIDs})
	if err != nil {
		return Detail{}, err
	}
	for _, r := range rows {
		d.Stock = append(d.Stock, StockLine{LocationID: r.LocationID, LocationName: r.LocationName, Quantity: *Text(r.Quantity)})
	}
	return d, nil
}

// Purchases is a page of the live purchase lines of the product, in the
// scope's locations, the newest purchase first. The product comes first:
// one that is not there is not found.
func (s *Service) Purchases(ctx context.Context, scope Scope, id int64, page int) (PurchasePage, error) {
	if page < 1 || page > maxPage {
		return PurchasePage{}, invalid("Sahifa raqami noto'g'ri")
	}
	if _, err := get(ctx, s.q, scope, id); err != nil {
		return PurchasePage{}, err
	}
	total, err := s.q.CountProductPurchaseLines(ctx, gen.CountProductPurchaseLinesParams{ProductID: id, LocationIds: scope.LocationIDs})
	if err != nil {
		return PurchasePage{}, err
	}
	rows, err := s.q.ListProductPurchases(ctx, gen.ListProductPurchasesParams{ProductID: id, LocationIds: scope.LocationIDs, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return PurchasePage{}, err
	}
	items := make([]ProductPurchase, 0, len(rows))
	for _, r := range rows {
		items = append(items, ProductPurchase{
			PurchaseID: r.PurchaseID, Number: r.Number, PurchasedOn: r.PurchasedOn, SupplierID: r.SupplierID, SupplierName: r.SupplierName,
			LocationID: r.LocationID, LocationName: r.LocationName, Quantity: *Text(r.Quantity), Price: *Text(r.Price), Amount: *Text(r.Amount),
		})
	}
	return PurchasePage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}
```

`internal/app/catalog.go` va `catalog_test.go` kompilyatsiyasi shu task'da `catalogScope(r)` bilan tiklanadi (Task 11 to'liq handler ishini qiladi, bu yerda faqat imzolar: `session.go` ga `func catalogScope(r *http.Request) catalog.Scope { return catalog.Scope{CompanyID: sessionCompany(r), LocationIDs: currentAccess(r.Context()).LocationIDs} }`).

- [ ] **Step 4: GREEN.** `GOTEST ./internal/catalog/ ./internal/db/ ./internal/app/`, `go vet ./...`. Commit `feat(catalog): a product's stock, last price and purchases; one in a purchase is not deleted`.

### Task 7: `internal/warehouse`: servis, summalar, ta'minotchilar

**Files:** Create `backend/internal/warehouse/warehouse.go`, `numbers.go`, `suppliers.go`, `numbers_test.go`, `suppliers_test.go`.

- [ ] **Step 1: Test** (`numbers_test.go`):

```go
package warehouse

func ptr[T any](v T) *T { return &v }

func TestPaymentAmountIsNeededAndAboveZero(t *testing.T) {
	n, err := paymentAmount(ptr("1200.5"))
	require.NoError(t, err)
	assert.Equal(t, ptr("1200.5"), catalog.Text(n))
	for name, raw := range map[string]*string{"nil": nil, "empty": ptr("")} {
		_, err := paymentAmount(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Summani kiriting", name)
	}
	for name, raw := range map[string]*string{"zero": ptr("0"), "zero decimals": ptr("0.00"), "negative": ptr("-5"), "comma": ptr("1,5"), "three decimals": ptr("1.005")} {
		_, err := paymentAmount(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Summa noto'g'ri", name)
	}
}

func TestDayIsNeededAndADate(t *testing.T) {
	d, err := day("2026-10-07")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC), d)
	_, err = day("  ")
	refused(t, err, apperr.Invalid, "validation_error", "Sanani kiriting")
	_, err = day("07.10.2026")
	refused(t, err, apperr.Invalid, "validation_error", "Sana noto'g'ri")
	_, err = day("2026-13-01")
	refused(t, err, apperr.Invalid, "validation_error", "Sana noto'g'ri")
}
```

`suppliers_test.go`:

```go
const (
	ali  = "998901111111"
	vali = "998902222222"
)

// shop is a company with Ali (owner, "Ali aka") and Vali (user, no name),
// and two locations.
type shop struct {
	company, asosiy, chilonzor int64
}

func (s shop) scope(locations ...int64) Scope {
	if locations == nil {
		locations = []int64{s.asosiy, s.chilonzor}
	}
	return Scope{CompanyID: s.company, LocationIDs: locations}
}

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func newShop(t *testing.T, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	var s shop
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&s.company))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT DO NOTHING", ali, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka'), ($3, $2, 'user', NULL)", ali, s.company, vali)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", s.company).Scan(&s.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", s.company).Scan(&s.chilonzor))
	return s
}

// addProduct enters a product (unit kg) or, with no unit, a service, and
// returns its id.
func addProduct(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, unit *string, active bool) int64 {
	t.Helper()
	kind := "product"
	if unit == nil {
		kind = "service"
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO products (company_id, kind, name, unit, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
		companyID, kind, name, unit, active, ali).Scan(&id))
	return id
}

func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

func TestCreateSupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")

	sup, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: " Bozor ", Phone: ptr("+998 90 123-45-67"), Note: ptr(" Chorsu ")})
	require.NoError(t, err)
	assert.Positive(t, sup.ID)
	assert.Equal(t, "Bozor", sup.Name, "trimmed")
	assert.Equal(t, ptr("998901234567"), sup.Phone, "normalized")
	assert.Equal(t, ptr("Chorsu"), sup.Note)
	assert.True(t, sup.Active)
	assert.Equal(t, "0.00", sup.Balance, "nothing owed")
	assert.Equal(t, "0.00", sup.PurchasesTotal)
	assert.Equal(t, "0.00", sup.PaymentsTotal)
	assert.Equal(t, ptr("Ali aka"), sup.CreatedByName)
	assert.Equal(t, sup.CreatedAt, sup.UpdatedAt)

	plain, err := s.CreateSupplier(ctx, olma.company, vali, SupplierInput{Name: "Dehqon", Phone: ptr(" ")})
	require.NoError(t, err)
	assert.Nil(t, plain.Phone, "a blank phone is none")
	assert.Nil(t, plain.CreatedByName, "Vali goes by no name")

	for name, tc := range map[string]struct {
		in      SupplierInput
		message string
	}{
		"no name":      {SupplierInput{Name: " "}, "Nomni kiriting"},
		"a long name":  {SupplierInput{Name: strings.Repeat("a", 121)}, "Nom 120 belgidan oshmasin"},
		"a bad phone":  {SupplierInput{Name: "X", Phone: ptr("12345")}, "Telefon raqami noto'g'ri"},
		"a foreign one": {SupplierInput{Name: "X", Phone: ptr("+7 900 000 00 00")}, "Telefon raqami noto'g'ri"},
		"a long note":  {SupplierInput{Name: "X", Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.CreateSupplier(ctx, olma.company, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "BOZOR"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	_, err = s.CreateSupplier(ctx, nok.company, ali, SupplierInput{Name: "Bozor"})
	assert.NoError(t, err, "another company has its own names")
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon 2", Phone: ptr("998901234567")})
	assert.NoError(t, err, "a phone may repeat")
}

func TestListSuppliers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	for _, name := range []string{"Chorsu", "bozor", "Anhor"} {
		_, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: name})
		require.NoError(t, err)
	}
	dehqon, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon", Phone: ptr("998909998877")})
	require.NoError(t, err)
	anhor := nameOf(t, s, olma.company, "Anhor")
	_, err = s.SetSupplierActive(ctx, olma.company, anhor, false)
	require.NoError(t, err)
	names := func(in SupplierListInput) []string {
		page, err := s.ListSuppliers(ctx, olma.company, in)
		require.NoError(t, err)
		out := make([]string, 0, len(page.Items))
		for _, x := range page.Items {
			out = append(out, x.Name)
		}
		return out
	}

	assert.Equal(t, []string{"bozor", "Chorsu", "Dehqon"}, names(SupplierListInput{Page: 1}), "the active ones by name, whatever the case")
	assert.Equal(t, []string{"Anhor"}, names(SupplierListInput{Status: "inactive", Page: 1}))
	assert.Equal(t, []string{"bozor"}, names(SupplierListInput{Search: "ZOR", Page: 1}), "by name")
	assert.Equal(t, []string{"Dehqon"}, names(SupplierListInput{Search: "99 988", Page: 1}), "digits search the phone")
	assert.Empty(t, names(SupplierListInput{Search: "%", Page: 1}), "a wildcard is a character")
	page, err := s.ListSuppliers(ctx, olma.company, SupplierListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 3, page.Total)
	assert.Equal(t, PageSize, page.PageSize)
	assert.Equal(t, dehqon.ID, page.Items[2].ID)
	_, err = s.ListSuppliers(ctx, olma.company, SupplierListInput{Status: "all", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Holat noto'g'ri")
	_, err = s.ListSuppliers(ctx, olma.company, SupplierListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
}

// nameOf is the id of the company's supplier called name.
func nameOf(t *testing.T, s *Service, companyID int64, name string) int64 {
	t.Helper()
	page, err := s.ListSuppliers(t.Context(), companyID, SupplierListInput{Search: name, Page: 1})
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	return page.Items[0].ID
}

func TestGetUpdateAndTurnOffASupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Chorsu"})
	require.NoError(t, err)

	got, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, bozor, got)
	_, err = s.GetSupplier(ctx, nok.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's")

	saved, err := s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: "Eski bozor", Phone: ptr("998901234567")})
	require.NoError(t, err)
	assert.Equal(t, "Eski bozor", saved.Name)
	assert.Equal(t, ptr("998901234567"), saved.Phone)
	assert.Nil(t, saved.Note, "left out: cleared")
	assert.True(t, saved.UpdatedAt.After(bozor.UpdatedAt))
	_, err = s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: "chorsu"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	_, err = s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: " "})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting")
	_, err = s.UpdateSupplier(ctx, olma.company, 999999, SupplierInput{Name: " "})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "the record comes first")

	off, err := s.SetSupplierActive(ctx, olma.company, bozor.ID, false)
	require.NoError(t, err)
	assert.False(t, off.Active)
	on, err := s.SetSupplierActive(ctx, olma.company, bozor.ID, true)
	require.NoError(t, err)
	assert.True(t, on.Active)
	_, err = s.SetSupplierActive(ctx, nok.company, bozor.ID, false)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
}

func TestDeleteSupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	olmaID := addProduct(t, pool, olma.company, "Olma", ptr("kg"), true)

	one, err := s.CreatePurchase(ctx, olma.scope(), ali, olma.asosiy, PurchaseInput{SupplierID: bozor.ID, PurchasedOn: "2026-10-07", Items: []ItemInput{{ProductID: olmaID, Quantity: ptr("1"), Price: ptr("1000")}}})
	require.NoError(t, err)
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.Conflict, "supplier_in_use", "Bu ta'minotchida 1 ta xarid bor")
	require.NoError(t, s.DeletePurchase(ctx, olma.scope(), one.ID))

	_, err = s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("500"), PaidOn: "2026-10-07"})
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("500"), PaidOn: "2026-10-07"})
	require.NoError(t, err)
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.Conflict, "supplier_in_use", "Bu ta'minotchida 2 ta to'lov bor", "no purchase, but payments")
	_, err = pool.Exec(ctx, "UPDATE supplier_payments SET deleted_at = now() WHERE supplier_id = $1", bozor.ID)
	require.NoError(t, err)

	require.NoError(t, s.DeleteSupplier(ctx, olma.company, bozor.ID))
	_, err = s.GetSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "deleted already")
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	assert.NoError(t, err, "the name is free again")
}
```

`TestDeleteSupplier` xarid va to'lovga tayanadi: u Task 9 dan keyin yashil bo'ladi (Task 7 da `CreatePurchase`, `DeletePurchase`, `AddPayment` stub'lari `not implemented` qaytaradi va test shu sababdan yiqiladi; bu qabul qilinadi, chunki xatti-harakat Task 8–9 niki). Task 7 commit'ida bu test `t.Skip` qilinmaydi: u Task 9 commit'i bilan birga qo'shiladi (fayl Task 7 da yoziladi, lekin `git add -p`siz: `TestDeleteSupplier` Task 9 da qo'shiladi).

- [ ] **Step 2: RED.** `GOTEST ./internal/warehouse/` → kompilyatsiya xatosi → stub'lar (`warehouse.go`: `Service`, `NewService`, `write`, `Scope`, tiplar; `suppliers.go`: hamma metod `not implemented`), keyin mantiq bo'yicha yiqiladi.

- [ ] **Step 3: Kod.** `warehouse.go`:

```go
// Package warehouse runs a company's warehouse (logic/warehouse.md): the
// suppliers it buys from, its purchases into the stock of its locations,
// the stock itself, and the payments to the suppliers and what is owed them.
package warehouse

import (...)

// PageSize is how many rows a page of a list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// How long a name and a note may be, in characters.
const (
	MaxName = 120
	MaxNote = 500
)

var (
	errSupplierNotFound  = apperr.New(apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
	errPurchaseNotFound  = apperr.New(apperr.NotFound, "not_found", "Xarid topilmadi")
	errPaymentNotFound   = apperr.New(apperr.NotFound, "not_found", "To'lov topilmadi")
	errSupplierNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	errPaymentLinked     = apperr.New(apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	errStockInsufficient = apperr.New(apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q")
	errNoLocation        = invalid("Lokatsiyani tanlang")
)

// Scope is a member's reach in a company: the company and the locations of
// it they may work in. The purchases a member reads, enters and changes are
// those of these locations alone; the suppliers and the balances are the
// company's.
type Scope struct {
	CompanyID   int64
	LocationIDs []int64
}

func (sc Scope) has(locationID int64) bool { ... }

// Service runs the warehouse of every company; each call names the company
// (or the scope) it acts in.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: gen.New(pool)} }

// write runs fn in one transaction that holds the company the way a write of
// its customers does (LockCompanyCustomers): the writes of a company's
// warehouse, catalog, customers and tasks take turns, so a purchase's
// number, the stock and the balances are never raced.
func (s *Service) write(ctx context.Context, companyID int64, fn func(q *gen.Queries) error) error { ... as catalog ... }

func invalid(message string) error { return fields.Invalid(message) }

// cleanName, trimmed, cleanOptional, memberName: as catalog's (copied; the
// two packages stay apart).
```

`numbers.go`:

```go
// paymentAmount reads the amount of a payment: one is needed ("Summani
// kiriting"), an amount above zero ("Summa noto'g'ri").
func paymentAmount(raw *string) (pgtype.Numeric, error) {
	if raw == nil || *raw == "" {
		return pgtype.Numeric{}, invalid("Summani kiriting")
	}
	n, err := catalog.Money(raw, "Summa noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if catalog.Zero(n) {
		return pgtype.Numeric{}, invalid("Summa noto'g'ri")
	}
	return n, nil
}

// day reads a day the client sent, YYYY-MM-DD: one is needed.
func day(raw string) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, invalid("Sanani kiriting")
	}
	d, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, invalid("Sana noto'g'ri")
	}
	return d, nil
}

// text is a stored amount as the database writes it; "" when there is none
// (the columns here are NOT NULL).
func text(n pgtype.Numeric) string {
	if s := catalog.Text(n); s != nil {
		return *s
	}
	return ""
}
```

`suppliers.go`:

```go
// Supplier is a supplier of a company, as the API shows it, with its
// balance: what its live purchases come to, what its live payments come to,
// and the difference (owed above zero, an advance below).
type Supplier struct {
	ID             int64
	Name           string
	Phone          *string
	Note           *string
	Active         bool
	PurchasesTotal string
	PaymentsTotal  string
	Balance        string
	CreatedByName  *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// SupplierInput is what a supplier is saved with, as the client sent it.
type SupplierInput struct {
	Name  string
	Phone *string
	Note  *string
}

// SupplierListInput narrows the list: Status active (the default) or
// inactive, Search looked for in the names, or, when it is digits, in the
// phones. Page starts at 1.
type SupplierListInput struct {
	Status string
	Search string
	Page   int
}

// SupplierPage is one page of the suppliers and how many there are on all.
type SupplierPage struct {
	Items    []Supplier
	Total    int64
	Page     int
	PageSize int
}

type checkedSupplier struct {
	Name  string
	Phone *string
	Note  *string
}

// checkSupplier reads an input. What is wrong is told in this order: the
// name, the phone, the note.
func checkSupplier(in SupplierInput) (checkedSupplier, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return checkedSupplier{}, err
	}
	c := checkedSupplier{Name: name}
	if raw := trimmed(in.Phone); raw != nil {
		phone, err := user.NormalizePhone(*raw)
		if err != nil || !uzbekPhone.MatchString(phone) {
			return checkedSupplier{}, invalid("Telefon raqami noto'g'ri")
		}
		c.Phone = &phone
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return checkedSupplier{}, err
	}
	return c, nil
}
```

`var uzbekPhone = regexp.MustCompile(`^998\d{9}$`)`: faqat O'zbekiston raqami (jadval CHECK'i bilan bir xil). `toSupplier(r gen.GetSupplierRow)`, `ListSuppliers` (`SearchOf` bilan `search`, `digits`; status; page), `GetSupplier`, `CreateSupplier` (write: memberName, CreateSupplier, `fields.Taken` → `errSupplierNameTaken`, qayta o'qish), `UpdateSupplier` (avval yozuv), `SetSupplierActive`, `DeleteSupplier`:

```go
// DeleteSupplier hides the company's supplier; its name is free again. One
// with live purchases, or with live payments, is refused (409): it may be
// turned off instead (logic/warehouse.md, 3.2).
func (s *Service) DeleteSupplier(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, id); err != nil {
			return err
		}
		purchases, err := q.CountSupplierPurchases(ctx, id)
		if err != nil {
			return err
		}
		if purchases > 0 {
			return apperr.New(apperr.Conflict, "supplier_in_use", fmt.Sprintf("Bu ta'minotchida %d ta xarid bor", purchases))
		}
		payments, err := q.CountSupplierPayments(ctx, id)
		if err != nil {
			return err
		}
		if payments > 0 {
			return apperr.New(apperr.Conflict, "supplier_in_use", fmt.Sprintf("Bu ta'minotchida %d ta to'lov bor", payments))
		}
		_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: id, CompanyID: companyID})
		return err
	})
}
```

- [ ] **Step 4: GREEN.** `GOTEST ./internal/warehouse/ -run 'Supplier|Payment|Day'` (`TestDeleteSupplier` dan tashqari, u keyin). Commit `feat(warehouse): the suppliers, with their balances`.

### Task 8: `internal/warehouse`: to'lovlar

**Files:** Create `backend/internal/warehouse/payments.go`, `payments_test.go`.

- [ ] **Step 1: Test:**

```go
func TestAddPayment(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)

	p, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("1200.5"), PaidOn: "2026-10-07", Note: ptr(" Naqd ")})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, bozor.ID, p.SupplierID)
	assert.Nil(t, p.PurchaseID, "entered on its own")
	assert.Nil(t, p.PurchaseNumber)
	assert.Equal(t, "1200.50", p.Amount)
	assert.Equal(t, "2026-10-07", p.PaidOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Naqd"), p.Note)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "-1200.50", sup.Balance, "an advance: nothing was bought")
	assert.Equal(t, "1200.50", sup.PaymentsTotal)

	for name, tc := range map[string]struct {
		in      PaymentInput
		message string
	}{
		"no amount":    {PaymentInput{PaidOn: "2026-10-07"}, "Summani kiriting"},
		"zero":         {PaymentInput{Amount: ptr("0"), PaidOn: "2026-10-07"}, "Summa noto'g'ri"},
		"a bad amount": {PaymentInput{Amount: ptr("1,5"), PaidOn: "2026-10-07"}, "Summa noto'g'ri"},
		"no day":       {PaymentInput{Amount: ptr("1")}, "Sanani kiriting"},
		"a bad day":    {PaymentInput{Amount: ptr("1"), PaidOn: "7.10.2026"}, "Sana noto'g'ri"},
		"a long note":  {PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07", Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.AddPayment(ctx, nok.company, ali, bozor.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's supplier")
	_, err = s.SetSupplierActive(ctx, olma.company, bozor.ID, false)
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, vali, bozor.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
	assert.NoError(t, err, "an inactive supplier is still paid")
}

func TestListUpdateAndDeletePayments(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	dehqon, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("100"), PaidOn: "2026-10-01"})
	require.NoError(t, err)
	second, err := s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("200"), PaidOn: "2026-10-05"})
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, ali, dehqon.ID, PaymentInput{Amount: ptr("300"), PaidOn: "2026-10-06"})
	require.NoError(t, err)

	page, err := s.ListPayments(ctx, olma.company, bozor.ID, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, []int64{second.ID, first.ID}, []int64{page.Items[0].ID, page.Items[1].ID}, "the newest first, the supplier's alone")
	_, err = s.ListPayments(ctx, olma.company, bozor.ID, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	_, err = s.ListPayments(ctx, olma.company, 999999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")

	saved, err := s.UpdatePayment(ctx, olma.company, bozor.ID, first.ID, PaymentInput{Amount: ptr("150"), PaidOn: "2026-10-02", Note: ptr("Karta")})
	require.NoError(t, err)
	assert.Equal(t, "150.00", saved.Amount)
	assert.Equal(t, "2026-10-02", saved.PaidOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Karta"), saved.Note)
	_, err = s.UpdatePayment(ctx, olma.company, dehqon.ID, first.ID, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-02"})
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "another supplier's payment")
	_, err = s.UpdatePayment(ctx, olma.company, bozor.ID, first.ID, PaymentInput{PaidOn: "2026-10-02"})
	refused(t, err, apperr.Invalid, "validation_error", "Summani kiriting")

	require.NoError(t, s.DeletePayment(ctx, olma.company, bozor.ID, first.ID))
	err = s.DeletePayment(ctx, olma.company, bozor.ID, first.ID)
	refused(t, err, apperr.NotFound, "not_found", "To'lov topilmadi", "deleted already")
	sup, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, "-200.00", sup.Balance, "the deleted payment no longer counts")
}
```

Bog'langan to'lov qoidasi (`payment_linked`) Task 9 testida (xarid bilan).

- [ ] **Step 2: RED.** Stub → mantiqiy yiqilish.

- [ ] **Step 3: Kod** (`payments.go`):

```go
// Payment is a payment to a supplier, as the API shows it. One entered with
// a purchase names it (PurchaseID, PurchaseNumber) and is changed through
// the purchase alone.
type Payment struct {
	ID             int64
	SupplierID     int64
	PurchaseID     *int64
	PurchaseNumber *int32
	Amount         string
	PaidOn         time.Time
	Note           *string
	CreatedByName  *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// PaymentInput is what a payment is saved with, as the client sent it.
type PaymentInput struct {
	Amount *string
	PaidOn string
	Note   *string
}

// PaymentPage is one page of a supplier's payments.
type PaymentPage struct {
	Items    []Payment
	Total    int64
	Page     int
	PageSize int
}

type checkedPayment struct {
	Amount pgtype.Numeric
	PaidOn time.Time
	Note   *string
}

// checkPayment reads an input. What is wrong is told in this order: the
// amount, the day, the note.
func checkPayment(in PaymentInput) (checkedPayment, error) { ... }

func toPayment(r gen.GetPaymentRow) Payment { ... Amount: text(r.Amount) ... }

// ListPayments is a page of the supplier's live payments, the newest first.
// The supplier comes first: one that is not there is not found.
func (s *Service) ListPayments(ctx context.Context, companyID, supplierID int64, page int) (PaymentPage, error) { ... }

// AddPayment enters a payment to the company's supplier (an inactive one
// too: what is owed is still paid), as the member with phone by.
func (s *Service) AddPayment(ctx context.Context, companyID int64, by string, supplierID int64, in PaymentInput) (Payment, error) {
	c, err := checkPayment(in)   // hmm: order — supplier first (404) or input first? Rule 6: 404 for the supplier is a path matter; the input check messages are the body's. Supplier first inside write (404), then input: keep "the record comes first".
	...
}
```

Tartib: avval ta'minotchi (`getSupplier` → 404), keyin `checkPayment` (400), keyin yozuv. `UpdatePayment(ctx, companyID, supplierID, paymentID, in)`: avval to'lov (`GetPayment` → 404), bog'langan (`PurchaseID != nil`) → `errPaymentLinked`, keyin `checkPayment`, `UpdatePayment`, qayta o'qish. `DeletePayment(ctx, companyID, supplierID, paymentID)`: to'lov → 404; bog'langan → 409; `DeletePayment`.

- [ ] **Step 4: GREEN.** `GOTEST ./internal/warehouse/ -run Payment`. Commit `feat(warehouse): the payments to a supplier`.

### Task 9: `internal/warehouse`: xaridlar, qatorlar, qoldiq, bog'langan to'lov

**Files:** Create `backend/internal/warehouse/purchases.go`, `stock.go`, `purchases_test.go`; Modify `logic/warehouse.md` (4.3 jumlasi).

- [ ] **Step 0: Hujjat.** `logic/warehouse.md` 4.3: «Hech narsa o'zgarmagan saqlash hech narsani yozmaydi.» → «Hech narsa o'zgarmagan saqlash qoldiq va balansni o'zgartirmaydi (qatorlar qaytadan yoziladi, farq 0).»

- [ ] **Step 1: Test:**

```go
// stockOf is the product's stock in the location, "0.000" when there is
// no row.
func stockOf(t *testing.T, pool *pgxpool.Pool, locationID, productID int64) string {
	t.Helper()
	var s string
	err := pool.QueryRow(t.Context(), "SELECT quantity::text FROM stock WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s)
	if errors.Is(err, pgx.ErrNoRows) {
		return "0.000"
	}
	require.NoError(t, err)
	return s
}

// market is a shop with a supplier and two products, Olma (kg) and Nok (dona).
type market struct {
	shop
	bozor, olma, nok int64
}

func newMarket(t *testing.T, s *Service, pool *pgxpool.Pool) market {
	t.Helper()
	m := market{shop: newShop(t, pool, "Olma")}
	bozor, err := s.CreateSupplier(t.Context(), m.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	m.bozor = bozor.ID
	m.olma = addProduct(t, pool, m.company, "Olma", ptr("kg"), true)
	m.nok = addProduct(t, pool, m.company, "Nok", ptr("dona"), true)
	return m
}

func line(productID int64, quantity, price string) ItemInput {
	return ItemInput{ProductID: productID, Quantity: ptr(quantity), Price: ptr(price)}
}

func TestCreatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)

	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, PurchasedOn: "2026-10-07", Note: ptr(" Ertalab "), Paid: ptr("5000"),
		Items: []ItemInput{line(m.olma, "12.5", "1000"), line(m.nok, "3", "2500.5")},
	})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.EqualValues(t, 1, p.Number, "the company's first")
	assert.Equal(t, m.asosiy, p.LocationID)
	assert.Equal(t, "Asosiy", p.LocationName)
	assert.Equal(t, m.bozor, p.SupplierID)
	assert.Equal(t, "Bozor", p.SupplierName)
	assert.Equal(t, "2026-10-07", p.PurchasedOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Ertalab"), p.Note, "trimmed")
	assert.Equal(t, "20001.50", p.Total, "the lines, summed in the database")
	assert.Equal(t, "5000.00", p.Paid)
	assert.EqualValues(t, 2, p.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName)
	assert.Equal(t, []Item{
		{ProductID: m.olma, Name: "Olma", Unit: ptr("kg"), Quantity: "12.500", Price: "1000.00", Amount: "12500.00"},
		{ProductID: m.nok, Name: "Nok", Unit: ptr("dona"), Quantity: "3.000", Price: "2500.50", Amount: "7501.50"},
	}, p.Items, "in the order entered")
	assert.Equal(t, "12.500", stockOf(t, pool, m.asosiy, m.olma), "into the stock at once")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, m.nok))
	assert.Equal(t, "0.000", stockOf(t, pool, m.chilonzor, m.olma), "the other location untouched")
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", sup.PurchasesTotal)
	assert.Equal(t, "5000.00", sup.PaymentsTotal, "what was paid with it")
	assert.Equal(t, "15001.50", sup.Balance, "owed")
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Equal(t, &p.ID, payments.Items[0].PurchaseID, "linked to the purchase")
	assert.Equal(t, ptr(int32(1)), payments.Items[0].PurchaseNumber)
	assert.Equal(t, "2026-10-07", payments.Items[0].PaidOn.Format(time.DateOnly), "on the purchase's day")

	second, err := s.CreatePurchase(ctx, m.scope(), vali, m.chilonzor, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-08", Items: []ItemInput{line(m.olma, "1", "900")}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, second.Number, "the next number")
	assert.Equal(t, "0.00", second.Paid, "nothing paid: no payment")
	assert.Nil(t, second.CreatedByName)
	payments, err = s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	assert.Len(t, payments.Items, 1, "no payment of 0")
	assert.Equal(t, "1.000", stockOf(t, pool, m.chilonzor, m.olma))
}

func TestCreatePurchaseRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	nok := newShop(t, pool, "Nok")
	foreign, err := s.CreateSupplier(ctx, nok.company, ali, SupplierInput{Name: "Begona"})
	require.NoError(t, err)
	off, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Yopiq"})
	require.NoError(t, err)
	_, err = s.SetSupplierActive(ctx, m.company, off.ID, false)
	require.NoError(t, err)
	service := addProduct(t, pool, m.company, "Yetkazish", nil, true)
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	theirs := addProduct(t, pool, nok.company, "Begona", ptr("kg"), true)
	ok := []ItemInput{line(m.olma, "1", "1000")}
	on := "2026-10-07"

	for name, tc := range map[string]struct {
		location int64
		in       PurchaseInput
		kind     apperr.Kind
		code     string
		message  string
	}{
		"no location":            {0, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok}, apperr.Invalid, "validation_error", "Lokatsiyani tanlang"},
		"a location outside":     {nok.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok}, apperr.Invalid, "validation_error", "Lokatsiyani tanlang"},
		"no supplier":            {m.asosiy, PurchaseInput{PurchasedOn: on, Items: ok}, apperr.Invalid, "validation_error", "Ta'minotchini tanlang"},
		"another's supplier":     {m.asosiy, PurchaseInput{SupplierID: foreign.ID, PurchasedOn: on, Items: ok}, apperr.Invalid, "validation_error", "Ta'minotchini tanlang"},
		"an inactive supplier":   {m.asosiy, PurchaseInput{SupplierID: off.ID, PurchasedOn: on, Items: ok}, apperr.Invalid, "validation_error", "Ta'minotchi nofaol"},
		"no day":                 {m.asosiy, PurchaseInput{SupplierID: m.bozor, Items: ok}, apperr.Invalid, "validation_error", "Sanani kiriting"},
		"a bad day":              {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "7.10.2026", Items: ok}, apperr.Invalid, "validation_error", "Sana noto'g'ri"},
		"a long note":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Note: ptr(strings.Repeat("x", 501)), Items: ok}, apperr.Invalid, "validation_error", "Izoh 500 belgidan oshmasin"},
		"no lines":               {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on}, apperr.Invalid, "validation_error", "Kamida bitta mahsulot qo'shing"},
		"no product":             {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{Quantity: ptr("1"), Price: ptr("1")}}}, apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		"another's product":      {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(theirs, "1", "1")}}, apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		"a service":              {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(service, "1", "1")}}, apperr.Invalid, "validation_error", "Xizmat xaridga kiritilmaydi"},
		"an inactive product":    {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(eski, "1", "1")}}, apperr.Invalid, "validation_error", "Mahsulot nofaol"},
		"a product twice":        {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.olma, "1", "1"), line(m.olma, "2", "1")}}, apperr.Invalid, "validation_error", "«Olma» ikki marta kiritilgan"},
		"no quantity":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{ProductID: m.olma, Price: ptr("1")}}}, apperr.Invalid, "validation_error", "«Olma» miqdori noto'g'ri"},
		"a zero quantity":        {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.olma, "0", "1")}}, apperr.Invalid, "validation_error", "«Olma» miqdori noto'g'ri"},
		"no price":               {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{{ProductID: m.nok, Quantity: ptr("1")}}}, apperr.Invalid, "validation_error", "«Nok» narxi noto'g'ri"},
		"a bad price":            {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: []ItemInput{line(m.nok, "1", "1,5")}}, apperr.Invalid, "validation_error", "«Nok» narxi noto'g'ri"},
		"a bad paid amount":      {m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok, Paid: ptr("-1")}, apperr.Invalid, "validation_error", "To'langan summa noto'g'ri"},
		"the first wrong thing":  {m.asosiy, PurchaseInput{SupplierID: off.ID, PurchasedOn: "x", Items: nil}, apperr.Invalid, "validation_error", "Ta'minotchi nofaol"},
	} {
		_, err := s.CreatePurchase(ctx, m.scope(), ali, tc.location, tc.in)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma), "nothing was written")
	n, err := s.q.NextPurchaseNumber(ctx, m.company)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "no number was taken")
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok, Paid: ptr("99999")})
	assert.NoError(t, err, "paying more than the total is an advance")
	_, err = s.CreatePurchase(ctx, m.scope(m.chilonzor), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: on, Items: ok})
	refused(t, err, apperr.Invalid, "validation_error", "Lokatsiyani tanlang", "a restricted member's other location (the handler answers 403 before)")
}

func TestAPurchaseIsWrittenWholeOrNotAtAll(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	pgtest.FailInserts(t, pool, "purchase_items")

	_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1")}, Paid: ptr("1")})

	require.Error(t, err)
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM purchases WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count, "the head is not kept without its lines")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.olma))
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM supplier_payments WHERE company_id = $1", m.company).Scan(&count))
	assert.Zero(t, count)
}

func TestGetAndListPurchases(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	first, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-01", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	second, err := s.CreatePurchase(ctx, m.scope(), ali, m.chilonzor, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-05", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	third, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-05", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	numbers := func(scope Scope, in PurchaseListInput) []int32 {
		page, err := s.ListPurchases(ctx, scope, in)
		require.NoError(t, err)
		out := make([]int32, 0, len(page.Items))
		for _, p := range page.Items {
			out = append(out, p.Number)
		}
		return out
	}

	got, err := s.GetPurchase(ctx, m.scope(), first.ID)
	require.NoError(t, err)
	assert.Equal(t, first, got)
	_, err = s.GetPurchase(ctx, m.scope(m.chilonzor), first.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	_, err = s.GetPurchase(ctx, m.scope(), 999999)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi")

	assert.Equal(t, []int32{3, 2, 1}, numbers(m.scope(), PurchaseListInput{Page: 1}), "the newest first, then the later entered")
	assert.Equal(t, []int32{3, 1}, numbers(m.scope(), PurchaseListInput{LocationID: m.asosiy, Page: 1}), "one location")
	assert.Equal(t, []int32{2}, numbers(m.scope(m.chilonzor), PurchaseListInput{Page: 1}), "a restricted member's locations")
	assert.Equal(t, []int32{2}, numbers(m.scope(), PurchaseListInput{SupplierID: dehqon.ID, Page: 1}), "one supplier")
	assert.Empty(t, numbers(m.scope(nil...), PurchaseListInput{Page: 1}), "no location, no purchases")
	assert.Empty(t, numbers(m.scope(m.asosiy), PurchaseListInput{LocationID: m.chilonzor, Page: 1}), "a location outside the scope counts as none (the handler answers 403 before)")
	_, err = s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	page, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 3, page.Total)
	assert.Equal(t, third.ID, page.Items[0].ID)
	assert.Equal(t, second.ID, page.Items[1].ID)
	assert.Empty(t, page.Items[0].Items, "the list carries no lines")
}

func TestUpdatePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	dehqon, err := s.CreateSupplier(ctx, m.company, ali, SupplierInput{Name: "Dehqon"})
	require.NoError(t, err)
	anor := addProduct(t, pool, m.company, "Anor", ptr("kg"), true)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{
		SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("5000"),
		Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")},
	})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "5", "1000")}})
	require.NoError(t, err)

	// Olma down to 4 (−6), Nok out (−3), Anor in (+2); another supplier,
	// another day, more paid.
	saved, err := s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{
		SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Note: ptr("Qayta"), Paid: ptr("7000"),
		Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number, "the number stays")
	assert.Equal(t, m.asosiy, saved.LocationID, "the location stays")
	assert.Equal(t, dehqon.ID, saved.SupplierID)
	assert.Equal(t, "2026-10-09", saved.PurchasedOn.Format(time.DateOnly))
	assert.Equal(t, ptr("Qayta"), saved.Note)
	assert.Equal(t, "10400.00", saved.Total, "2 × 3000 + 4 × 1100")
	assert.Equal(t, "7000.00", saved.Paid)
	assert.Equal(t, []int64{anor, m.olma}, []int64{saved.Items[0].ProductID, saved.Items[1].ProductID}, "the new order")
	assert.True(t, saved.UpdatedAt.After(p.UpdatedAt))
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "15 − 6: by the difference")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok), "taken back")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, anor), "added")
	bozor, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "5000.00", bozor.PurchasesTotal, "the other purchase alone")
	assert.Equal(t, "0.00", bozor.PaymentsTotal, "the payment went with the purchase")
	theirs, err := s.GetSupplier(ctx, m.company, dehqon.ID)
	require.NoError(t, err)
	assert.Equal(t, "10400.00", theirs.PurchasesTotal)
	assert.Equal(t, "7000.00", theirs.PaymentsTotal)
	payments, err := s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	require.Len(t, payments.Items, 1)
	assert.Equal(t, "2026-10-09", payments.Items[0].PaidOn.Format(time.DateOnly), "on the purchase's new day")

	// Paid down to nothing: the linked payment goes; then back: a new one.
	saved, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "0.00", saved.Paid)
	payments, err = s.ListPayments(ctx, m.company, dehqon.ID, 1)
	require.NoError(t, err)
	assert.Empty(t, payments.Items)
	saved, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Paid: ptr("100"), Items: []ItemInput{line(anor, "2", "3000"), line(m.olma, "4", "1100")}})
	require.NoError(t, err)
	assert.Equal(t, "100.00", saved.Paid)
	assert.Equal(t, "9.000", stockOf(t, pool, m.asosiy, m.olma), "the same lines: the stock is as it was")

	// An inactive supplier or product already in the purchase stays; a new
	// one has to be active.
	_, err = s.SetSupplierActive(ctx, m.company, dehqon.ID, false)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE products SET is_active = false WHERE id = $1", anor)
	require.NoError(t, err)
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	assert.NoError(t, err, "what the purchase already names is kept, changed quantity and all")
	assert.Equal(t, "3.000", stockOf(t, pool, m.asosiy, anor))
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "Olma out of this purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000"), line(m.nok, "1", "1")}})
	assert.NoError(t, err, "Nok is active")
	eski := addProduct(t, pool, m.company, "Eski", ptr("dona"), false)
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(eski, "1", "1")}})
	refused(t, err, apperr.Invalid, "validation_error", "Mahsulot nofaol", "a product new to the purchase")
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: dehqon.ID, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.Invalid, "validation_error", "Ta'minotchi nofaol", "a supplier new to the purchase")

	_, err = s.UpdatePurchase(ctx, m.scope(m.chilonzor), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09", Items: []ItemInput{line(anor, "3", "3000")}})
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-09"})
	refused(t, err, apperr.Invalid, "validation_error", "Kamida bitta mahsulot qo'shing")
}

func TestAnEditThatWouldTakeMoreThanTheStockHasIsRefused(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "10", "1000")}})
	require.NoError(t, err)
	// Something else took 8 of the 10 (a sale, one day).
	_, err = pool.Exec(ctx, "UPDATE stock SET quantity = 2 WHERE location_id = $1 AND product_id = $2", m.asosiy, m.olma)
	require.NoError(t, err)

	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1000")}})
	refused(t, err, apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q", "2 − 9 would be below zero")
	got, err := s.GetPurchase(ctx, m.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, "10.000", got.Items[0].Quantity, "nothing changed")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.olma))
	err = s.DeletePurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.Conflict, "stock_insufficient", "Omborda yetarli qoldiq yo'q")
	_, err = s.UpdatePurchase(ctx, m.scope(), p.ID, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "12", "1000")}})
	assert.NoError(t, err, "+2 is fine")
	assert.Equal(t, "4.000", stockOf(t, pool, m.asosiy, m.olma))
}

func TestDeletePurchase(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("500"), Items: []ItemInput{line(m.olma, "10", "1000"), line(m.nok, "3", "2000")}})
	require.NoError(t, err)
	_, err = s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "5", "1000")}})
	require.NoError(t, err)

	err = s.DeletePurchase(ctx, m.scope(m.chilonzor), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "outside the member's locations")
	require.NoError(t, s.DeletePurchase(ctx, m.scope(), p.ID))
	_, err = s.GetPurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi")
	err = s.DeletePurchase(ctx, m.scope(), p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Xarid topilmadi", "deleted already")
	assert.Equal(t, "5.000", stockOf(t, pool, m.asosiy, m.olma), "its quantity taken back")
	assert.Equal(t, "0.000", stockOf(t, pool, m.asosiy, m.nok))
	sup, err := s.GetSupplier(ctx, m.company, m.bozor)
	require.NoError(t, err)
	assert.Equal(t, "5000.00", sup.PurchasesTotal)
	assert.Equal(t, "0.00", sup.PaymentsTotal, "its payment went with it")
	assert.Equal(t, "5000.00", sup.Balance)
	next, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-08", Items: []ItemInput{line(m.olma, "1", "1")}})
	require.NoError(t, err)
	assert.EqualValues(t, 3, next.Number, "a deleted purchase keeps its number")
}

func TestAPurchasesPaymentIsChangedThroughThePurchaseAlone(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	p, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Paid: ptr("500"), Items: []ItemInput{line(m.olma, "1", "1000")}})
	require.NoError(t, err)
	payments, err := s.ListPayments(ctx, m.company, m.bozor, 1)
	require.NoError(t, err)
	linked := payments.Items[0].ID

	_, err = s.UpdatePayment(ctx, m.company, m.bozor, linked, PaymentInput{Amount: ptr("1"), PaidOn: "2026-10-07"})
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	err = s.DeletePayment(ctx, m.company, m.bozor, linked)
	refused(t, err, apperr.Conflict, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
	got, err := s.GetPurchase(ctx, m.scope(), p.ID)
	require.NoError(t, err)
	assert.Equal(t, "500.00", got.Paid, "it stays")
}

func TestTwoPurchasesEnteredAtOnceTakeTwoNumbers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	m := newMarket(t, s, pool)
	// Another write holds the company: the first purchase waits for it.
	other, err := pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = other.Rollback(context.Background()) })
	_, err = other.Exec(ctx, "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", m.company)
	require.NoError(t, err)
	in := PurchaseInput{SupplierID: m.bozor, PurchasedOn: "2026-10-07", Items: []ItemInput{line(m.olma, "1", "1")}}

	done := make(chan error, 2)
	for range 2 {
		go func() {
			_, err := s.CreatePurchase(ctx, m.scope(), ali, m.asosiy, in)
			done <- err
		}()
	}
	pgtest.WaitForLockWait(t, pool)
	require.NoError(t, other.Commit(ctx))
	require.NoError(t, <-done)
	require.NoError(t, <-done)

	page, err := s.ListPurchases(ctx, m.scope(), PurchaseListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int32{2, 1}, []int32{page.Items[0].Number, page.Items[1].Number}, "in turn, two numbers")
	assert.Equal(t, "2.000", stockOf(t, pool, m.asosiy, m.olma))
}
```

(`TestDeleteSupplier` ham shu task'da qo'shiladi: Task 7 ga qarang.)

- [ ] **Step 2: RED.** Stub'lar (`purchases.go` tiplari va metodlar `not implemented`) → mantiqiy yiqilish.

- [ ] **Step 3: Kod.** `stock.go`:

```go
// zero is an amount of nothing, for a move that only adds or only removes.
var zero = mustNumeric("0")

func mustNumeric(s string) pgtype.Numeric {
	var n pgtype.Numeric
	if err := n.Scan(s); err != nil {
		panic(err)
	}
	return n
}

// moveStock moves the product's stock in the location by added − removed,
// in the database. Below zero is refused (409 stock_insufficient).
func moveStock(ctx context.Context, q *gen.Queries, companyID, locationID, productID int64, added, removed pgtype.Numeric) error {
	err := q.AddStock(ctx, gen.AddStockParams{CompanyID: companyID, LocationID: locationID, ProductID: productID, Added: added, Removed: removed})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23514" && pgErr.ConstraintName == "stock_quantity_check" {
		return errStockInsufficient
	}
	return err
}
```

`purchases.go`:

```go
// Purchase is a purchase as the API shows it: its head, what it comes to,
// what was paid with it, and (on its own page) its lines.
type Purchase struct {
	ID            int64
	Number        int32
	LocationID    int64
	LocationName  string
	SupplierID    int64
	SupplierName  string
	PurchasedOn   time.Time
	Note          *string
	Total         string
	Paid          string
	ItemsCount    int64
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	// Items are the lines, in the order entered; a list carries none.
	Items []Item
}

// Item is a line of a purchase: a product, a quantity, a price and what the
// line comes to.
type Item struct {
	ProductID int64
	Name      string
	Unit      *string
	Quantity  string
	Price     string
	Amount    string
}

// ItemInput is a line as the client sent it.
type ItemInput struct {
	ProductID int64
	Quantity  *string
	Price     *string
}

// PurchaseInput is what a purchase is saved with, as the client sent it.
// The location is given apart, on entry alone.
type PurchaseInput struct {
	SupplierID  int64
	PurchasedOn string
	Note        *string
	Items       []ItemInput
	Paid        *string
}

// PurchaseListInput narrows the list: LocationID keeps one of the scope's
// locations (0: all of them), SupplierID one supplier (0: all). Page
// starts at 1.
type PurchaseListInput struct {
	LocationID int64
	SupplierID int64
	Page       int
}

// PurchasePage is one page of the purchases.
type PurchasePage struct {
	Items    []Purchase
	Total    int64
	Page     int
	PageSize int
}

// checkedItem is a line as it is kept.
type checkedItem struct {
	ProductID int64
	Quantity  pgtype.Numeric
	Price     pgtype.Numeric
}

// checkedPurchase is an input as it is kept.
type checkedPurchase struct {
	SupplierID  int64
	PurchasedOn time.Time
	Note        *string
	Items       []checkedItem
	Paid        pgtype.Numeric
}

// checkPurchase reads an input against the company, inside the write. What
// is wrong is told in this order (logic/warehouse.md, 4.2): the supplier
// (one of the company's; active unless it is the one the purchase already
// names, keep), the day, the note, the lines (at least one; each product one
// of the company's, a product not a service, active unless the purchase
// already holds it (held), once; its quantity; its price), what was paid.
func checkPurchase(ctx context.Context, q *gen.Queries, companyID int64, in PurchaseInput, keep int64, held map[int64]bool) (checkedPurchase, error) {
	c := checkedPurchase{SupplierID: in.SupplierID}
	if in.SupplierID == 0 {
		return c, invalid("Ta'minotchini tanlang")
	}
	active, err := q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: in.SupplierID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return c, invalid("Ta'minotchini tanlang")
	}
	if err != nil {
		return c, err
	}
	if !active && in.SupplierID != keep {
		return c, invalid("Ta'minotchi nofaol")
	}
	if c.PurchasedOn, err = day(in.PurchasedOn); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	if len(in.Items) == 0 {
		return c, invalid("Kamida bitta mahsulot qo'shing")
	}
	seen := make(map[int64]bool, len(in.Items))
	for _, it := range in.Items {
		if it.ProductID == 0 {
			return c, invalid("Mahsulotni tanlang")
		}
		p, err := q.ProductStanding(ctx, gen.ProductStandingParams{ID: it.ProductID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return c, invalid("Mahsulotni tanlang")
		}
		if err != nil {
			return c, err
		}
		if p.Kind != catalog.KindProduct {
			return c, invalid("Xizmat xaridga kiritilmaydi")
		}
		if !p.IsActive && !held[it.ProductID] {
			return c, invalid("Mahsulot nofaol")
		}
		if seen[it.ProductID] {
			return c, invalid(fmt.Sprintf("«%s» ikki marta kiritilgan", p.Name))
		}
		seen[it.ProductID] = true
		quantity, err := catalog.Quantity(it.Quantity, fmt.Sprintf("«%s» miqdori noto'g'ri", p.Name))
		if err != nil {
			return c, err
		}
		price, err := catalog.Money(it.Price, fmt.Sprintf("«%s» narxi noto'g'ri", p.Name))
		if err != nil {
			return c, err
		}
		if !price.Valid {
			return c, invalid(fmt.Sprintf("«%s» narxi noto'g'ri", p.Name))
		}
		c.Items = append(c.Items, checkedItem{ProductID: it.ProductID, Quantity: quantity, Price: price})
	}
	if c.Paid, err = catalog.Money(in.Paid, "To'langan summa noto'g'ri"); err != nil {
		return c, err
	}
	return c, nil
}
```

`CreatePurchase(ctx, scope, by, locationID, in)`:

```go
func (s *Service) CreatePurchase(ctx context.Context, scope Scope, by string, locationID int64, in PurchaseInput) (Purchase, error) {
	// The location is one the member works in (the handler has refused
	// another with 403 already; here it is no location at all).
	if locationID == 0 || !scope.has(locationID) {
		return Purchase{}, errNoLocation
	}
	var p Purchase
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkPurchase(ctx, q, scope.CompanyID, in, 0, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := q.NextPurchaseNumber(ctx, scope.CompanyID)
		if err != nil {
			return err
		}
		row, err := q.CreatePurchase(ctx, gen.CreatePurchaseParams{
			CompanyID: scope.CompanyID, Number: number, LocationID: locationID, SupplierID: c.SupplierID, PurchasedOn: c.PurchasedOn, Note: c.Note,
			CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeLines(ctx, q, scope.CompanyID, row.ID, locationID, nil, c.Items); err != nil {
			return err
		}
		if err := settle(ctx, q, scope.CompanyID, by, name, row.ID, c); err != nil {
			return err
		}
		p, err = getPurchase(ctx, q, scope, row.ID)
		return err
	})
	return p, err
}

// writeLines replaces the purchase's lines with the lines given and moves
// the location's stock by the difference, product by product: what was
// there is removed, what is given is added.
func writeLines(ctx context.Context, q *gen.Queries, companyID, purchaseID, locationID int64, was []gen.ListPurchaseItemsRow, items []checkedItem) error {
	if err := q.DeletePurchaseItems(ctx, purchaseID); err != nil {
		return err
	}
	for i, it := range items {
		if err := q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: purchaseID, ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price, Position: int32(i + 1)}); err != nil {
			return err
		}
	}
	if _, err := q.SetPurchaseTotal(ctx, purchaseID); err != nil {
		return err
	}
	removed := make(map[int64]pgtype.Numeric, len(was))
	order := make([]int64, 0, len(was)+len(items))
	for _, w := range was {
		removed[w.ProductID] = w.Quantity
		order = append(order, w.ProductID)
	}
	added := make(map[int64]pgtype.Numeric, len(items))
	for _, it := range items {
		added[it.ProductID] = it.Quantity
		if _, ok := removed[it.ProductID]; !ok {
			order = append(order, it.ProductID)
		}
	}
	for _, productID := range order {
		add, ok := added[productID]
		if !ok {
			add = zero
		}
		remove, ok := removed[productID]
		if !ok {
			remove = zero
		}
		if err := moveStock(ctx, q, companyID, locationID, productID, add, remove); err != nil {
			return err
		}
	}
	return nil
}

// settle keeps the payment entered with the purchase as what was paid says:
// made when something is paid and none is there, changed when one is there
// (the purchase's supplier and day), hidden when nothing is paid now.
func settle(ctx context.Context, q *gen.Queries, companyID int64, by string, byName *string, purchaseID int64, c checkedPurchase) error {
	_, err := q.GetPurchasePayment(ctx, purchaseID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if catalog.Zero(c.Paid) {
			return nil
		}
		_, err = q.CreatePayment(ctx, gen.CreatePaymentParams{
			CompanyID: companyID, SupplierID: c.SupplierID, PurchaseID: &purchaseID, Amount: c.Paid, PaidOn: c.PurchasedOn,
			CreatedBy: by, CreatedByName: byName,
		})
		return err
	case err != nil:
		return err
	case catalog.Zero(c.Paid):
		return q.DeletePurchasePayment(ctx, purchaseID)
	default:
		return q.UpdatePurchasePayment(ctx, gen.UpdatePurchasePaymentParams{PurchaseID: purchaseID, SupplierID: c.SupplierID, Amount: c.Paid, PaidOn: c.PurchasedOn})
	}
}
```

`UpdatePurchase(ctx, scope, id, in)`: write → `was := getPurchase(ctx, q, scope, id)` (404) → `held` = was.Items mahsulotlari → `checkPurchase(…, keep: was.SupplierID, held)` → `UpdatePurchase` (head) → `lines := q.ListPurchaseItems` (eski) → `writeLines(…, lines, c.Items)` → `settle(…, by = "", byName = nil …)`: yangi bog'langan to'lov tahrirda paydo bo'lsa `created_by` kim? Tahrir qiluvchi (`by` parametri `UpdatePurchase` ga ham beriladi: `UpdatePurchase(ctx, scope, by, id, in)`). → qayta o'qish. `DeletePurchase(ctx, scope, id)`: write → was (404) → `DeletePurchase` → `lines := ListPurchaseItems` → har biri `moveStock(zero, qty)` → `DeletePurchasePayment`. `GetPurchase(ctx, scope, id)` (`getPurchase`: `GetPurchase` + `ListPurchaseItems`), `ListPurchases(ctx, scope, in)` (LocationID 0 → scope'ning hammasi; scope'da bo'lsa shu bittasi; bo'lmasa `[]int64{}` — hech qaysi; `SupplierID` narg; sahifa; `Items: nil`: testda `assert.Empty`).

- [ ] **Step 4: GREEN.** `GOTEST ./internal/warehouse/`, `go vet`. Commit `feat(warehouse): the purchases into the stock, numbered, with what was paid`.

### Task 10: `company.DeleteLocation`: jonli xaridi bor lokatsiya o'chirilmaydi

**Files:** Modify `backend/internal/company/locations.go`, `locations_test.go`.

- [ ] **Step 1: Test** (`TestDeleteLocation` ichiga, `yunusobod` dan oldin):

```go
	// A location with a purchase standing in it is kept too (checked after
	// the tasks).
	qoyliq := addLocation(t, pool, c.ID, "Qo'yliq")
	addPurchaseIn(t, pool, c.ID, qoyliq, false)
	addPurchaseIn(t, pool, c.ID, qoyliq, true)
	err = s.DeleteLocation(ctx, c.ID, qoyliq)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "location_in_use", e.Code, "a location with a purchase standing in it")
	assert.Equal(t, "Bu lokatsiyada 1 ta xarid bor", e.Message, "the deleted purchase not counted")
	addTask(t, pool, c.ID, qoyliq, false)
	err = s.DeleteLocation(ctx, c.ID, qoyliq)
	require.ErrorAs(t, err, &e)
	assert.Equal(t, "Bu lokatsiyada 1 ta vazifa bor", e.Message, "the tasks come first")
```

va yordamchi:

```go
// addPurchaseIn enters a purchase standing in the location (a supplier is
// made for it); deleted hides it.
func addPurchaseIn(t *testing.T, pool *pgxpool.Pool, companyID, locationID int64, deleted bool) {
	t.Helper()
	ctx := t.Context()
	var supplier int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor ' || gen_random_uuid()::text, $2) RETURNING id", companyID, "998901111111").Scan(&supplier))
	var number int
	require.NoError(t, pool.QueryRow(ctx, "SELECT COALESCE(max(number), 0) + 1 FROM purchases WHERE company_id = $1", companyID).Scan(&number))
	_, err := pool.Exec(ctx, `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, CASE WHEN $6 THEN now() END)`, companyID, number, locationID, supplier, "998901111111", deleted)
	require.NoError(t, err)
}
```

(`998901111111` foydalanuvchisi `addTask` fixture'ida bo'lsa shu, aks holda `INSERT INTO users … ON CONFLICT DO NOTHING`.) `ListLocations` `tasks_count` o'zgarmaydi (admin ro'yxatida xarid soni ko'rsatilmaydi: chegara).

- [ ] **Step 2: RED.** `GOTEST ./internal/company/ -run TestDeleteLocation` → `location_in_use` emas, o'chib ketadi (`require.ErrorAs` yiqiladi).

- [ ] **Step 3: Kod** (`DeleteLocation`, vazifa tekshiruvidan keyin):

```go
		purchases, err := q.CountLocationPurchases(ctx, id)
		if err != nil {
			return err
		}
		if purchases > 0 {
			return apperr.New(apperr.Conflict, "location_in_use", fmt.Sprintf("Bu lokatsiyada %d ta xarid bor", purchases))
		}
```

- [ ] **Step 4: GREEN.** `GOTEST ./internal/company/`. Commit `feat(company): a location with a purchase standing in it is kept`.

### Task 11: Handlerlar, route'lar, ulash, ruxsat matritsasi

**Files:** Create `backend/internal/app/warehouse.go`, `warehouse_test.go`; Modify `backend/internal/app/catalog.go`, `catalog_test.go`, `session.go`, `handler.go`, `permissions_test.go`, `handler_test.go` (`newTestAPI`), `backend/cmd/api/main.go`.

- [ ] **Step 1: Test** (`catalog_test.go` ga; `api.addLocation`, `api.restrictTo` bor):

```go
func TestAProductTellsItsStockAndLastPriceAndListsItsPurchases(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	asosiy := api.addLocation(t, olma, "Asosiy")
	chilonzor := api.addLocation(t, olma, "Chilonzor")
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.restrictTo(t, valisPhone, olma, chilonzor)
	p := api.enterProduct(t, owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	assert.Equal(t, "0.000", p["quantity"], "nothing in stock")
	assert.Nil(t, p["last_price"], "never bought")
	supplier := api.enterSupplier(t, owner, `{"name":"Bozor"}`)
	api.enterPurchase(t, owner, fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-01","items":[{"product_id":%v,"quantity":"10","price":"1000"}]}`, asosiy, supplier["id"], p["id"]))
	api.enterPurchase(t, owner, fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-05","items":[{"product_id":%v,"quantity":"2.5","price":"1200.5"}]}`, chilonzor, supplier["id"], p["id"]))
	path := fmt.Sprintf("/app/products/%v", p["id"])

	rec := api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	got := decode(t, rec)
	assert.Equal(t, "12.500", got["quantity"], "every location of the owner")
	assert.Equal(t, "1200.50", got["last_price"])
	assert.Equal(t, []any{
		map[string]any{"location_id": float64(asosiy), "location_name": "Asosiy", "quantity": "10.000"},
		map[string]any{"location_id": float64(chilonzor), "location_name": "Chilonzor", "quantity": "2.500"},
	}, got["stock"])
	rec = api.do(t, http.MethodGet, path, "", bearer(employee))
	require.Equal(t, http.StatusOK, rec.Code)
	got = decode(t, rec)
	assert.Equal(t, "2.500", got["quantity"], "the restricted employee's location alone")
	assert.Len(t, got["stock"], 1)

	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products?location_id=%d", asosiy), "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "10.000", decode(t, rec)["items"].([]any)[0].(map[string]any)["quantity"], "the location asked for")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products?location_id=%d", asosiy), "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, noPermission, rec.Body.String(), "a location outside the employee's")
	rec = api.do(t, http.MethodGet, "/app/products?location_id=abc", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())

	rec = api.do(t, http.MethodGet, path+"/purchases", "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	first := page["items"].([]any)[0].(map[string]any)
	assert.EqualValues(t, 2, first["number"], "the newest first")
	assert.Equal(t, "2026-10-05", first["purchased_on"])
	assert.Equal(t, map[string]any{"id": supplier["id"], "name": "Bozor"}, first["supplier"])
	assert.EqualValues(t, chilonzor, first["location_id"])
	assert.Equal(t, "Chilonzor", first["location_name"])
	assert.Equal(t, "2.500", first["quantity"])
	assert.Equal(t, "1200.50", first["price"])
	assert.Equal(t, "3001.25", first["amount"])
	rec = api.do(t, http.MethodGet, path+"/purchases", "", bearer(employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "the employee's locations alone")
	rec = api.do(t, http.MethodGet, path+"/purchases?page=x", "", bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = api.do(t, http.MethodGet, "/app/products/999999/purchases", "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)

	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"product_in_use","message":"Bu mahsulot 2 ta xaridda bor"}`, rec.Body.String())
}
```

`warehouse_test.go`:

```go
func (api testAPI) enterSupplier(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/suppliers", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func (api testAPI) enterPurchase(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/purchases", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

// store is a company with two locations, its owner Ali and its employee
// Vali (restricted to Chilonzor), a supplier and a product.
type store struct {
	company, asosiy, chilonzor int64
	owner, employee            string
	supplier, product          map[string]any
}

func (api testAPI) newStore(t *testing.T) store {
	t.Helper()
	s := store{company: api.addCompany(t, "Olma", 30)}
	s.asosiy = api.addLocation(t, s.company, "Asosiy")
	s.chilonzor = api.addLocation(t, s.company, "Chilonzor")
	s.owner, _ = api.signIn(t, alisPhone, map[int64]string{s.company: "owner"})
	s.employee, _ = api.signIn(t, valisPhone, map[int64]string{s.company: "user"})
	api.restrictTo(t, valisPhone, s.company, s.chilonzor)
	s.supplier = api.enterSupplier(t, s.owner, `{"name":"Bozor","phone":"+998 90 123-45-67"}`)
	s.product = api.enterProduct(t, s.owner, `{"kind":"product","name":"Olma","unit":"kg"}`)
	return s
}

func (s store) purchase(locationID int64, lines string) string {
	return fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","items":[%s]}`, locationID, s.supplier["id"], lines)
}

func (s store) item(quantity, price string) string {
	return fmt.Sprintf(`{"product_id":%v,"quantity":"%s","price":"%s"}`, s.product["id"], quantity, price)
}

func TestSuppliersAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	kuzatuvchi := api.addRole(t, s.company, "Kuzatuvchi", "suppliers.view")
	watcher, _ := api.signIn(t, sardorsPhone, map[int64]string{s.company: "user"})
	api.giveRole(t, sardorsPhone, s.company, &kuzatuvchi)

	assert.Equal(t, "Bozor", s.supplier["name"])
	assert.Equal(t, "998901234567", s.supplier["phone"], "normalized")
	assert.Nil(t, s.supplier["note"])
	assert.Equal(t, true, s.supplier["is_active"])
	assert.Equal(t, "0.00", s.supplier["balance"], "the owner sees the balance")
	assert.Equal(t, "0.00", s.supplier["purchases_total"])
	assert.Equal(t, "0.00", s.supplier["payments_total"])
	path := fmt.Sprintf("/app/suppliers/%v", s.supplier["id"])

	for name, tc := range map[string]struct{ body, message string }{
		"no name":     {`{"name":" "}`, "Nomni kiriting"},
		"a bad phone": {`{"name":"X","phone":"12"}`, "Telefon raqami noto'g'ri"},
		"a long note": {fmt.Sprintf(`{"name":"X","note":"%s"}`, strings.Repeat("x", 501)), "Izoh 500 belgidan oshmasin"},
	} {
		rec := api.do(t, http.MethodPost, "/app/suppliers", tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}
	rec := api.do(t, http.MethodPost, "/app/suppliers", `{"name":"bozor"}`, bearer(s.employee))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli ta'minotchi allaqachon bor"}`, rec.Body.String())

	api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("10", "1000")))
	rec = api.do(t, http.MethodGet, "/app/suppliers", "", bearer(watcher))
	require.Equal(t, http.StatusOK, rec.Code)
	row := decode(t, rec)["items"].([]any)[0].(map[string]any)
	assert.Equal(t, "Bozor", row["name"])
	assert.Nil(t, row["balance"], "without purchases.view the balance is not shown")
	rec = api.do(t, http.MethodGet, path, "", bearer(watcher))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Nil(t, decode(t, rec)["purchases_total"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	got := decode(t, rec)
	assert.Equal(t, "10000.00", got["balance"], "the whole company's, whatever the employee's locations")
	assert.Equal(t, "10000.00", got["purchases_total"])
	rec = api.do(t, http.MethodGet, "/app/suppliers?status=inactive", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 0, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/suppliers?status=x", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = api.do(t, http.MethodGet, "/app/suppliers?search=90123", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "digits search the phone")

	rec = api.do(t, http.MethodPut, path, `{"name":"Eski bozor","note":"Chorsu"}`, bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got = decode(t, rec)
	assert.Equal(t, "Eski bozor", got["name"])
	assert.Nil(t, got["phone"], "left out: cleared")
	assert.Equal(t, "Chorsu", got["note"])
	rec = api.do(t, http.MethodPatch, path, `{"is_active":false}`, bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, false, decode(t, rec)["is_active"])
	rec = api.do(t, http.MethodPatch, path, `{}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Holat noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"supplier_in_use","message":"Bu ta'minotchida 1 ta xarid bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/suppliers/999999", "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Ta'minotchi topilmadi"}`, rec.Body.String())

	fresh := api.enterSupplier(t, s.owner, `{"name":"Dehqon"}`)
	rec = api.do(t, http.MethodDelete, fmt.Sprintf("/app/suppliers/%v", fresh["id"]), "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestPaymentsAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)
	path := fmt.Sprintf("/app/suppliers/%v/payments", s.supplier["id"])
	purchase := api.enterPurchase(t, s.owner, fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","paid":"500","items":[%s]}`, s.asosiy, s.supplier["id"], s.item("10", "1000")))

	rec := api.do(t, http.MethodPost, path, `{"amount":"1200.5","paid_on":"2026-10-08","note":" Naqd "}`, bearer(s.employee))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	own := decode(t, rec)
	assert.Equal(t, "1200.50", own["amount"])
	assert.Equal(t, "2026-10-08", own["paid_on"])
	assert.Equal(t, "Naqd", own["note"])
	assert.Nil(t, own["purchase_id"])
	assert.Nil(t, own["purchase_number"])
	assert.NotEmpty(t, own["created_at"])
	for name, tc := range map[string]struct{ body, message string }{
		"no amount": {`{"paid_on":"2026-10-08"}`, "Summani kiriting"},
		"zero":      {`{"amount":"0","paid_on":"2026-10-08"}`, "Summa noto'g'ri"},
		"no day":    {`{"amount":"1"}`, "Sanani kiriting"},
		"a bad day": {`{"amount":"1","paid_on":"8.10.2026"}`, "Sana noto'g'ri"},
	} {
		rec := api.do(t, http.MethodPost, path, tc.body, bearer(s.owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":"%s"}`, tc.message), rec.Body.String(), name)
	}

	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	items := page["items"].([]any)
	assert.Equal(t, own["id"], items[0].(map[string]any)["id"], "the newest first")
	linked := items[1].(map[string]any)
	assert.Equal(t, purchase["id"], linked["purchase_id"], "the one entered with the purchase")
	assert.EqualValues(t, 1, linked["purchase_number"])
	assert.Equal(t, "500.00", linked["amount"])
	rec = api.do(t, http.MethodGet, path+"?page=0", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	ownPath := fmt.Sprintf("%s/%v", path, own["id"])
	rec = api.do(t, http.MethodPut, ownPath, `{"amount":"1500","paid_on":"2026-10-09"}`, bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "1500.00", decode(t, rec)["amount"])
	linkedPath := fmt.Sprintf("%s/%v", path, linked["id"])
	rec = api.do(t, http.MethodPut, linkedPath, `{"amount":"1","paid_on":"2026-10-09"}`, bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"payment_linked","message":"Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, linkedPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	rec = api.do(t, http.MethodDelete, ownPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, ownPath, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"To'lov topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/suppliers/%v", s.supplier["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "9500.00", decode(t, rec)["balance"], "10000 − 500")
}

func TestPurchasesAPI(t *testing.T) {
	api := newTestAPI(t)
	s := api.newStore(t)

	rec := api.do(t, http.MethodPost, "/app/purchases", fmt.Sprintf(`{"location_id":%d,"supplier_id":%v,"purchased_on":"2026-10-07","note":" Ertalab ","paid":"5000","items":[%s]}`, s.asosiy, s.supplier["id"], s.item("12.5", "1000")), bearer(s.owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	p := decode(t, rec)
	assert.EqualValues(t, 1, p["number"])
	assert.EqualValues(t, s.asosiy, p["location_id"])
	assert.Equal(t, "Asosiy", p["location_name"])
	assert.Equal(t, map[string]any{"id": s.supplier["id"], "name": "Bozor"}, p["supplier"])
	assert.Equal(t, "2026-10-07", p["purchased_on"])
	assert.Equal(t, "Ertalab", p["note"])
	assert.Equal(t, "12500.00", p["total"])
	assert.Equal(t, "5000.00", p["paid"])
	assert.EqualValues(t, 1, p["items_count"])
	assert.Nil(t, p["created_by_name"])
	assert.Equal(t, []any{map[string]any{"product_id": s.product["id"], "name": "Olma", "unit": "kg", "quantity": "12.500", "price": "1000.00", "amount": "12500.00"}}, p["items"])
	path := fmt.Sprintf("/app/purchases/%v", p["id"])

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"no location":        {s.purchase(0, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Lokatsiyani tanlang"}`},
		"a location outside": {s.purchase(999999, s.item("1", "1")), http.StatusForbidden, noPermission},
		"no supplier":        {fmt.Sprintf(`{"location_id":%d,"purchased_on":"2026-10-07","items":[%s]}`, s.asosiy, s.item("1", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"Ta'minotchini tanlang"}`},
		"no lines":           {s.purchase(s.asosiy, ""), http.StatusBadRequest, `{"error":"validation_error","message":"Kamida bitta mahsulot qo'shing"}`},
		"a bad quantity":     {s.purchase(s.asosiy, s.item("0", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» miqdori noto'g'ri"}`},
		"a product twice":    {s.purchase(s.asosiy, s.item("1", "1")+","+s.item("2", "1")), http.StatusBadRequest, `{"error":"validation_error","message":"«Olma» ikki marta kiritilgan"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/purchases", tc.body, bearer(s.owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	rec = api.do(t, http.MethodPost, "/app/purchases", s.purchase(s.asosiy, s.item("1", "1")), bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the employee is restricted to Chilonzor")
	assert.JSONEq(t, noPermission, rec.Body.String())
	theirs := api.enterPurchase(t, s.employee, s.purchase(s.chilonzor, s.item("1", "900")))
	assert.EqualValues(t, 2, theirs["number"])

	// The list: the member's locations, or one of them; the newest first.
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	page := decode(t, rec)
	assert.EqualValues(t, 2, page["total"])
	assert.Nil(t, page["items"].([]any)[0].(map[string]any)["items"], "no lines in the list")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?location_id=%d", s.asosiy), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"])
	rec = api.do(t, http.MethodGet, "/app/purchases", "", bearer(s.employee))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 1, decode(t, rec)["total"], "the employee's location alone")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?location_id=%d", s.asosiy), "", bearer(s.employee))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.do(t, http.MethodGet, "/app/purchases?location_id=abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Lokatsiya noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, "/app/purchases?supplier_id=abc", "", bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Ta'minotchi noto'g'ri"}`, rec.Body.String())
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/purchases?supplier_id=%v", s.supplier["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.EqualValues(t, 2, decode(t, rec)["total"])

	// The page: the member's locations alone.
	rec = api.do(t, http.MethodGet, path, "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, p["items"], decode(t, rec)["items"])
	rec = api.do(t, http.MethodGet, path, "", bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.JSONEq(t, `{"error":"not_found","message":"Xarid topilmadi"}`, rec.Body.String())

	// An edit: the number and the location stay, the stock moves.
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"purchased_on":"2026-10-09","items":[%s]}`, s.supplier["id"], s.item("4", "1100")), bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	saved := decode(t, rec)
	assert.EqualValues(t, 1, saved["number"])
	assert.Equal(t, "2026-10-09", saved["purchased_on"])
	assert.Equal(t, "4400.00", saved["total"])
	assert.Equal(t, "0.00", saved["paid"], "nothing paid now")
	assert.Nil(t, saved["note"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "5.000", decode(t, rec)["quantity"], "4 in Asosiy, 1 in Chilonzor")
	rec = api.do(t, http.MethodPut, path, `{"supplier_id":0,"purchased_on":"2026-10-09","items":[]}`, bearer(s.owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"supplier_id":%v,"purchased_on":"2026-10-09","items":[%s]}`, s.supplier["id"], s.item("1", "1")), bearer(s.employee))
	assert.Equal(t, http.StatusNotFound, rec.Code, "the employee may not see it")

	// A deletion: the stock comes back, the number is never given again.
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	rec = api.do(t, http.MethodDelete, path, "", bearer(s.owner))
	assert.Equal(t, http.StatusNotFound, rec.Code)
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/products/%v", s.product["id"]), "", bearer(s.owner))
	assert.Equal(t, "1.000", decode(t, rec)["quantity"])
	next := api.enterPurchase(t, s.owner, s.purchase(s.asosiy, s.item("1", "1")))
	assert.EqualValues(t, 3, next["number"])
}
```

`permissions_test.go` matritsasiga (`Kuzatuvchi` da yo'q): `"the suppliers": {GET, "/app/suppliers"}`, `"adding a supplier": {POST, "/app/suppliers", {"name":"X"}}`, `"the purchases": {GET, "/app/purchases"}`, `"adding a purchase": {POST, "/app/purchases", {"location_id":1,...}}`, `"a supplier's payments": {GET, "/app/suppliers/1/payments"}`, `"a product's purchases": {GET, "/app/products/1/purchases"}`. Rolsiz xodim: `POST /app/suppliers` 201.

- [ ] **Step 2: RED.** `GOTEST ./internal/app/` → 404 (route yo'q) / kompilyatsiya (`enterSupplier` yo'q → yordamchilar test faylida, route yo'qligi 404 beradi).

- [ ] **Step 3: Kod.** `session.go`: `warehouseScope(r) warehouse.Scope`. `handler.go`: `Services.Warehouse *warehouse.Service`, `h.warehouse`; route'lar (`requireCompany` guruhida):

```go
				allowed(access.ProductsView).Get("/products", h.listProducts)
				...
				allowed(access.PurchasesView).Get("/products/{id}/purchases", h.listProductPurchases)
				allowed(access.SuppliersView).Get("/suppliers", h.listSuppliers)
				allowed(access.SuppliersCreate).Post("/suppliers", h.createSupplier)
				allowed(access.SuppliersView).Get("/suppliers/{id}", h.getSupplier)
				allowed(access.SuppliersEdit).Put("/suppliers/{id}", h.updateSupplier)
				allowed(access.SuppliersEdit).Patch("/suppliers/{id}", h.setSupplierActive)
				allowed(access.SuppliersDelete).Delete("/suppliers/{id}", h.deleteSupplier)
				allowed(access.PurchasesView).Get("/suppliers/{id}/payments", h.listPayments)
				allowed(access.PurchasesCreate).Post("/suppliers/{id}/payments", h.addPayment)
				allowed(access.PurchasesEdit).Put("/suppliers/{id}/payments/{paymentId}", h.updatePayment)
				allowed(access.PurchasesDelete).Delete("/suppliers/{id}/payments/{paymentId}", h.deletePayment)
				allowed(access.PurchasesView).Get("/purchases", h.listPurchases)
				allowed(access.PurchasesCreate).Post("/purchases", h.createPurchase)
				allowed(access.PurchasesView).Get("/purchases/{id}", h.getPurchase)
				allowed(access.PurchasesEdit).Put("/purchases/{id}", h.updatePurchase)
				allowed(access.PurchasesDelete).Delete("/purchases/{id}", h.deletePurchase)
```

`catalog.go`: `productJSON` += `Quantity *string json:"quantity"`, `LastPrice *string json:"last_price"`; `productDetailJSON{productJSON; Stock []stockLineJSON json:"stock"}` (`stockLineJSON{LocationID int64 json:"location_id"; LocationName string json:"location_name"; Quantity string json:"quantity"}`); `listProducts` `?location_id=` (`listTasks` kabi: 400 «Lokatsiya noto'g'ri», 403) → `in.LocationID`; `getProduct` → `h.catalog.Detail(r.Context(), catalogScope(r), id)`; `listProductPurchases` → `productPurchaseJSON{PurchaseID int64 json:"purchase_id"; Number int32 json:"number"; PurchasedOn string json:"purchased_on"; Supplier refJSON json:"supplier"; LocationID int64 json:"location_id"; LocationName string json:"location_name"; Quantity, Price, Amount string}` (`refJSON{ID int64 json:"id"; Name string json:"name"}`), sahifa `{items,total,page,page_size}`. Create/Update/SetActive/Delete `catalogScope(r)` bilan.

`warehouse.go` (app): `supplierJSON{ID, Name, Phone, Note, IsActive, Balance *string, PurchasesTotal *string, PaymentsTotal *string, CreatedByName, CreatedAt, UpdatedAt}` — `toSupplierJSON(s, withBalance bool)`: `withBalance = currentPermissions(ctx).Has(access.PurchasesView)`; `paymentJSON{ID, SupplierID json:"supplier_id", PurchaseID *int64, PurchaseNumber *int32, Amount, PaidOn string, Note, CreatedByName, CreatedAt, UpdatedAt}`; `purchaseJSON{ID, Number, LocationID, LocationName, Supplier refJSON, PurchasedOn string, Note, Total, Paid, ItemsCount, CreatedByName, CreatedAt, UpdatedAt, Items []itemJSON json:"items,omitempty"}` — ro'yxatda `items` yo'q (omitempty), sahifada bo'sh bo'lsa ham `[]` (sahifada `Items` hech qachon bo'sh emas: kamida bitta qator). `itemJSON{ProductID json:"product_id", Name, Unit *string, Quantity, Price, Amount}`. Handlerlar: `listSuppliers` (`?status=&search=&page=`), `createSupplier`, `getSupplier`, `updateSupplier`, `setSupplierActive` (`is_active` nil → 400 «Holat noto'g'ri»), `deleteSupplier` (204); `listPayments` (`?page=`), `addPayment` (201), `updatePayment`, `deletePayment` (204); `listPurchases` (`?location_id=` 400/403 `listTasks` kabi, `?supplier_id=` son emas → 400 «Ta'minotchi noto'g'ri», `?page=`), `createPurchase` (`location_id` 0 → 400 «Lokatsiyani tanlang»; `!allowedLocation` → `forbidden`; servis), `getPurchase`, `updatePurchase`, `deletePurchase` (204). `pathID(r, "paymentId")`.

`main.go` va `handler_test.go` (`newTestAPIWith`): `Warehouse: warehouse.NewService(pool)`.

- [ ] **Step 4: GREEN.** `GOTEST ./internal/app/` (`TestRouterServesExactlyTheDocumentedAPI` openapi'siz yiqiladi → Task 12 bilan birga commit, yoki openapi path'lari shu task'da qo'shiladi: **shu task'da openapi path'lari ham yoziladi**, Task 12 sxemalar va TS client). Commit `feat(api): the suppliers, the payments and the purchases`.

### Task 12: Kontrakt (`openapi.yaml`) va TS client

**Files:** Modify `backend/openapi.yaml`, `apps/web/lib/types.ts`; generatsiya `packages/api-client/src/schema.d.ts`.

- [ ] **Step 1: Test.** `TestRouterServesExactlyTheDocumentedAPI` (route'lar hujjatda); `pnpm --filter @hisob24/api-client test`; `apps/web` typecheck (yangi tiplar).

- [ ] **Step 2: Kod.** `Product` += `quantity` (`[string, "null"]`, «Mahsulotning so'ralgan lokatsiya (location_id) yoki a'zoga ruxsatli lokatsiyalardagi qoldig'i, uch kasr ("12.500"); xizmatda null»), `last_price` (`[string, "null"]`); `required` += ikkalasi. `ProductDetail: allOf [Product, {required: [stock], properties: {stock: array of StockLine}}]`; `StockLine {location_id, location_name, quantity}`; `ProductPurchase {purchase_id, number, purchased_on (date), supplier: Ref, location_id, location_name, quantity, price, amount}`; `Ref {id, name}`; `ProductPurchasePage`. `Supplier {id, name, phone, note, is_active, balance ([string,"null"]: «faqat purchases.view bo'lganga; musbat qarz, manfiy avans»), purchases_total, payments_total ([string,"null"]), created_by_name, created_at, updated_at}`; `SupplierInput {name, phone?, note?}`; `SupplierPage`; `Payment {id, supplier_id, purchase_id, purchase_number, amount, paid_on, note, created_by_name, created_at, updated_at}`; `PaymentInput {amount, paid_on, note?}`; `PaymentPage`; `PurchaseItem {product_id, name, unit, quantity, price, amount}`; `Purchase {id, number, location_id, location_name, supplier: Ref, purchased_on, note, total, paid, items_count, created_by_name, created_at, updated_at}`; `PurchaseDetail: allOf [Purchase, {required:[items], properties:{items: array of PurchaseItem}}]`; `PurchaseItemInput {product_id, quantity, price}`; `PurchaseInput {supplier_id, purchased_on, note?, paid?, items}`; `PurchaseCreate: allOf [PurchaseInput, {required:[location_id], properties:{location_id}}]`; `PurchasePage`. Javoblar: `SupplierNotFound`, `SupplierConflict` (`name_taken`, `supplier_in_use`), `PaymentNotFound`, `PaymentConflict` (`payment_linked`), `PurchaseNotFound`, `PurchaseConflict` (`stock_insufficient`); `ProductConflict` tavsifiga `product_in_use`. Path'lar (Task 11 da qo'shilgan): `/app/products` GET `location_id` param; `/app/products/{id}` GET → `ProductDetail`; `/app/products/{id}/purchases` (listProductPurchases); `/app/suppliers` (listSuppliers, createSupplier); `/app/suppliers/{id}` (getSupplier, updateSupplier, setSupplierActive, deleteSupplier); `/app/suppliers/{id}/payments` (listPayments, addPayment); `/app/suppliers/{id}/payments/{paymentId}` (updatePayment, deletePayment); `/app/purchases` (listPurchases, createPurchase); `/app/purchases/{id}` (getPurchase, updatePurchase, deletePurchase). `make api-client`. `lib/types.ts`: `ProductDetail`, `StockLine`, `ProductPurchase`, `ProductPurchasePage`, `Supplier`, `SupplierInput`, `SupplierPage`, `Payment`, `PaymentInput`, `PaymentPage`, `Purchase`, `PurchaseItem`, `PurchaseDetail`, `PurchaseInput`, `PurchaseCreate`, `PurchasePage`.

- [ ] **Step 3: GREEN.** `GOTEST ./internal/httpx/ ./internal/app/`, `pnpm -r typecheck`. Commit `feat(api): the warehouse in the contract and the client`.

### Task 13: Web mock: `mocks/warehouse.ts`, katalog kengaytmasi, ma'lumotlar

**Files:** Create `apps/web/mocks/warehouse.ts`; Modify `apps/web/mocks/data.ts`, `mocks/catalog.ts`, `mocks/handlers.ts`, `mocks/handlers.test.ts`.

- [ ] **Step 1: Test** (`handlers.test.ts` ga; `signIn`, `holdRole`, `seedCatalog` bor):

```ts
describe("the warehouse", () => {
  test("a supplier: entered, listed with its balance for whoever may see the purchases, turned off, kept while in use", async () => {
    const ali = await signIn(ALI, 1)
    const created = await post(ali, "/app/suppliers", { name: " Bozor ", phone: "+998 90 123-45-67" })
    expect(created.status).toBe(201)
    const supplier = await created.json()
    expect(supplier).toMatchObject({ name: "Bozor", phone: "998901234567", note: null, is_active: true, balance: "0.00", created_by_name: "Ali Valiyev" })
    expect((await (await post(ali, "/app/suppliers", { name: "bozor" })).json()).error).toBe("name_taken")
    expect((await (await post(ali, "/app/suppliers", { name: "X", phone: "12" })).json()).message).toBe("Telefon raqami noto'g'ri")

    holdRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
    const vali = await signIn(VALI, 1)
    const list = await (await get(vali, "/app/suppliers")).json()
    expect(list.items[0]).toMatchObject({ name: "Bozor", balance: null })

    const { olma } = seedCatalog()
    const asosiy = db.locations.find((l) => l.companyId === 1)!.id
    const purchase = await (await post(ali, "/app/purchases", { location_id: asosiy, supplier_id: supplier.id, purchased_on: "2026-10-07", paid: "500", items: [{ product_id: olma.id, quantity: "10", price: "1000" }] })).json()
    expect(purchase).toMatchObject({ number: 1, total: "10000.00", paid: "500.00", items_count: 1 })
    expect((await (await get(ali, `/app/suppliers/${supplier.id}`)).json())).toMatchObject({ balance: "9500.00", purchases_total: "10000.00", payments_total: "500.00" })
    expect((await (await del(ali, `/app/suppliers/${supplier.id}`)).json())).toEqual({ error: "supplier_in_use", message: "Bu ta'minotchida 1 ta xarid bor" })
    expect((await patch(ali, `/app/suppliers/${supplier.id}`, { is_active: false })).status).toBe(200)
    expect((await (await get(ali, "/app/suppliers?status=inactive")).json()).total).toBe(1)
  })

  test("a purchase lands in the stock of its location, is numbered, edited by the difference and deleted with its payment", async () => {
    const ali = await signIn(ALI, 1)
    const { olma, nok, yetkazish, eski } = seedCatalog()
    const supplier = await (await post(ali, "/app/suppliers", { name: "Bozor" })).json()
    const [asosiy, chilonzor] = db.locations.filter((l) => l.companyId === 1).map((l) => l.id)
    const body = (items: unknown[], extra: Record<string, unknown> = {}) => ({ location_id: asosiy, supplier_id: supplier.id, purchased_on: "2026-10-07", items, ...extra })

    for (const [input, message] of [
      [body([], { location_id: 0 }), "Lokatsiyani tanlang"],
      [body([{ product_id: olma.id, quantity: "1", price: "1" }], { supplier_id: 0 }), "Ta'minotchini tanlang"],
      [body([{ product_id: olma.id, quantity: "1", price: "1" }], { purchased_on: "" }), "Sanani kiriting"],
      [body([]), "Kamida bitta mahsulot qo'shing"],
      [body([{ product_id: yetkazish.id, quantity: "1", price: "1" }]), "Xizmat xaridga kiritilmaydi"],
      [body([{ product_id: eski.id, quantity: "1", price: "1" }]), "Mahsulot nofaol"],
      [body([{ product_id: olma.id, quantity: "1", price: "1" }, { product_id: olma.id, quantity: "2", price: "1" }]), "«Olma» ikki marta kiritilgan"],
      [body([{ product_id: olma.id, quantity: "0", price: "1" }]), "«Olma» miqdori noto'g'ri"],
      [body([{ product_id: olma.id, quantity: "1", price: "1,5" }]), "«Olma» narxi noto'g'ri"],
      [body([{ product_id: olma.id, quantity: "1", price: "1" }], { paid: "-1" }), "To'langan summa noto'g'ri"],
    ] as const) {
      const res = await post(ali, "/app/purchases", input)
      expect(res.status, message).toBe(400)
      expect((await res.json()).message).toBe(message)
    }
    expect((await post(ali, "/app/purchases", body([{ product_id: olma.id, quantity: "1", price: "1" }], { location_id: 999 }))).status).toBe(403)

    const first = await (await post(ali, "/app/purchases", body([{ product_id: olma.id, quantity: "12.5", price: "1000" }, { product_id: nok.id, quantity: "3", price: "2500.5" }], { paid: "5000", note: " Ertalab " }))).json()
    expect(first).toMatchObject({ number: 1, location_id: asosiy, location_name: "Asosiy", supplier: { id: supplier.id, name: "Bozor" }, total: "20001.50", paid: "5000.00", note: "Ertalab", items_count: 2 })
    expect(first.items).toEqual([
      { product_id: olma.id, name: "Olma", unit: "kg", quantity: "12.500", price: "1000.00", amount: "12500.00" },
      { product_id: nok.id, name: "Nok", unit: "dona", quantity: "3.000", price: "2500.50", amount: "7501.50" },
    ])
    const product = await (await get(ali, `/app/products/${olma.id}`)).json()
    expect(product).toMatchObject({ quantity: "12.500", last_price: "1000.00" })
    expect(product.stock).toEqual([{ location_id: asosiy, location_name: "Asosiy", quantity: "12.500" }, { location_id: chilonzor, location_name: "Chilonzor", quantity: "0.000" }])
    expect((await (await get(ali, `/app/products?location_id=${chilonzor}`)).json()).items.find((p: { id: number }) => p.id === olma.id).quantity).toBe("0.000")
    const payments = await (await get(ali, `/app/suppliers/${supplier.id}/payments`)).json()
    expect(payments.items).toHaveLength(1)
    expect(payments.items[0]).toMatchObject({ purchase_id: first.id, purchase_number: 1, amount: "5000.00", paid_on: "2026-10-07" })
    expect((await (await put(ali, `/app/suppliers/${supplier.id}/payments/${payments.items[0].id}`, { amount: "1", paid_on: "2026-10-07" })).json()).error).toBe("payment_linked")
    expect((await (await del(ali, `/app/products/${olma.id}`)).json())).toEqual({ error: "product_in_use", message: "Bu mahsulot 1 ta xaridda bor" })

    const saved = await (await put(ali, `/app/purchases/${first.id}`, { supplier_id: supplier.id, purchased_on: "2026-10-09", items: [{ product_id: olma.id, quantity: "4", price: "1100" }] })).json()
    expect(saved).toMatchObject({ number: 1, total: "4400.00", paid: "0.00", items_count: 1 })
    expect((await (await get(ali, `/app/products/${olma.id}`)).json()).quantity).toBe("4.000")
    expect((await (await get(ali, `/app/products/${nok.id}`)).json()).quantity).toBe("0.000")
    expect((await (await get(ali, `/app/suppliers/${supplier.id}/payments`)).json()).total).toBe(0)
    const lines = await (await get(ali, `/app/products/${olma.id}/purchases`)).json()
    expect(lines.items).toEqual([{ purchase_id: first.id, number: 1, purchased_on: "2026-10-09", supplier: { id: supplier.id, name: "Bozor" }, location_id: asosiy, location_name: "Asosiy", quantity: "4.000", price: "1100.00", amount: "4400.00" }])

    expect((await del(ali, `/app/purchases/${first.id}`)).status).toBe(204)
    expect((await (await get(ali, `/app/products/${olma.id}`)).json()).quantity).toBe("0.000")
    expect((await (await get(ali, "/app/purchases")).json()).total).toBe(0)
    const next = await (await post(ali, "/app/purchases", body([{ product_id: olma.id, quantity: "1", price: "1" }]))).json()
    expect(next.number).toBe(2)
  })

  test("a restricted employee sees the purchases of their locations alone, and the whole balance", async () => {
    const ali = await signIn(ALI, 1)
    const { olma } = seedCatalog()
    const supplier = await (await post(ali, "/app/suppliers", { name: "Bozor" })).json()
    const [asosiy, chilonzor] = db.locations.filter((l) => l.companyId === 1).map((l) => l.id)
    const theirs = await (await post(ali, "/app/purchases", { location_id: asosiy, supplier_id: supplier.id, purchased_on: "2026-10-07", items: [{ product_id: olma.id, quantity: "1", price: "1000" }] })).json()
    db.members[VALI].find((m) => m.companyId === 1)!.locationIds = [chilonzor]
    const vali = await signIn(VALI, 1)

    expect((await (await get(vali, "/app/purchases")).json()).total).toBe(0)
    expect((await get(vali, `/app/purchases?location_id=${asosiy}`)).status).toBe(403)
    expect((await get(vali, `/app/purchases/${theirs.id}`)).status).toBe(404)
    expect((await post(vali, "/app/purchases", { location_id: asosiy, supplier_id: supplier.id, purchased_on: "2026-10-07", items: [{ product_id: olma.id, quantity: "1", price: "1" }] })).status).toBe(403)
    expect((await (await get(vali, `/app/suppliers/${supplier.id}`)).json()).balance).toBe("1000.00")
    expect((await (await get(vali, `/app/products/${olma.id}`)).json()).stock).toEqual([{ location_id: chilonzor, location_name: "Chilonzor", quantity: "0.000" }])
  })
})
```

(`post`, `get`, `put`, `patch`, `del` yordamchilari `handlers.test.ts` da bo'lsa shular, bo'lmasa shu yerda yoziladi; `db.locations` da Olma Savdo'ning ikki lokatsiyasi bor — `data.ts` tekshiriladi, bo'lmasa testda ikkinchisi qo'shiladi.)

- [ ] **Step 2: RED.** `pnpm exec vitest run mocks/handlers.test.ts` → 404 (handler yo'q).

- [ ] **Step 3: Kod.** `data.ts`: `SupplierRow {id, companyId, name, phone, note, active, by, byName, createdAt, updatedAt, deleted?}`, `PurchaseRow {id, companyId, number, locationId, supplierId, purchasedOn, note, items: {productId, quantity, price}[], by, byName, createdAt, updatedAt, deleted?}`, `PaymentRow {id, companyId, supplierId, purchaseId: number | null, amount, paidOn, note, by, byName, createdAt, updatedAt, deleted?}`, `StockRow {companyId, locationId, productId, quantity: number}`; `db.suppliers`, `db.purchases`, `db.payments`, `db.stock`; `resetDb` tozalaydi. `mocks/warehouse.ts`: pul va miqdor `number` bilan hisoblanadi va `asMoney` / `asQuantity` (3 kasr) bilan yoziladi (`(a * b).toFixed(2)` — kasr xatolaridan `Math.round(x * 1000) / 1000`); `balanceOf(supplier)`; `liveSuppliers`, `toSupplier(row, withBalance)`; `check`lar Go tartibida; xarid: raqam `max + 1` (o'chirilganlar bilan), qoldiq `moveStock(locationId, productId, delta)` (manfiy → 409 `stock_insufficient`), bog'langan to'lov; lokatsiya tekshiruvi `memberLocations(phone, companyId)` (mock'da mavjud `locationIds`); handlerlar 16 route. `mocks/catalog.ts`: `toProduct(p, locationIds)` → `quantity` (mahsulotda, xizmatda null), `last_price`; `GET /app/products` `?location_id=` (400 / 403); `GET /app/products/:id` → `stock`; `GET /app/products/:id/purchases`; `DELETE` → `product_in_use`. `handlers.ts` ga `warehouseHandlers`.

- [ ] **Step 4: GREEN.** `pnpm exec vitest run mocks/`, `pnpm lint`, `pnpm typecheck`. Commit `feat(web): the warehouse in the mock API`.

### Task 14: Yakun

- [ ] `make lint`, `make test`, `make e2e` (mavjud e2e'lar o'zgarmaydi; `catalog.spec` `quantity` ustunisiz hali).
- [ ] Lokal haqiqiy stack smoke (1-bosqich skriptlari naqshida, `smoke_warehouse.py`): egasi ta'minotchi qo'shadi (takror 409), xarid (ikki qator, to'langan 0) → № 1, qoldiq, balans = jami, `last_price`; to'lov → balans kamayadi; qarzdan ortiq → avans; tahrir (miqdor kamayadi, ta'minotchi almashadi) → qoldiq farqi, to'lov ergashadi; o'chirish → qoldiq 0, bog'langan to'lov yo'q, keyingi raqam bo'shamaydi; xaridi bor mahsulot va ta'minotchi 409; cheklangan xodim boshqa lokatsiya xaridi 404 / 403, balansni ko'radi; bo'sh rolli 403; admin xaridi bor lokatsiyani o'chira olmaydi (409). Teardown DB'ni tashlaydi.
- [ ] Spec'ga «4-bosqich qarorlari», `git push origin main`.

## Self-review

- **Qamrov:** `logic/warehouse.md` 3 (ta'minotchi: maydonlar, amallar, nofaol, o'chirish, ro'yxat, balans) → Task 2, 7, 11; 4.1–4.5 (xarid: raqam, lokatsiya, ta'minotchi, sana, qatorlar, to'langan, izoh; qo'shish tartibi; tahrir farq bilan, bog'langan to'lov; o'chirish; ro'yxat `location_id` / `supplier_id`) → Task 3, 9, 11; 5 (qoldiq) → Task 3, 5, 6, 9; 6 (to'lov va balans, `payment_linked`) → Task 4, 8, 9, 11; 7 (lokatsiya: 404 / 403, admin o'chirish) → Task 9, 10, 11; 8 (chekka holatlar: raqam bo'shamaydi, avans, nofaol qoidasi, lokatsiyasiz a'zo) → Task 9 testlari; 9 (xato kodlari) → hammasi. `logic/products.md` 4 (`product_in_use`), 5 (`quantity`, `location_id`), 6 (`stock`, `last_price`, xaridlar) → Task 5, 6, 11. Spec API jadvali: 16 route → Task 11; `/app/products` `location_id`, `ProductDetail` → Task 11, 12.
- **Placeholder:** yo'q.
- **Tip izchilligi:** `Scope{CompanyID, LocationIDs}` ikkala paketda; `catalog.Money/Quantity/Zero/Text`; `warehouse.Supplier.Balance string` (handler `*string`); `Purchase.Items []Item` (ro'yxatda nil, `omitempty`); `PurchaseInput.Paid *string`; `ItemInput.Quantity/Price *string`; `CreatePurchase(ctx, scope, by, locationID, in)`, `UpdatePurchase(ctx, scope, by, id, in)` (`by` yangi bog'langan to'lov uchun), `DeletePurchase(ctx, scope, id)`; `AddPayment(ctx, companyID, by, supplierID, in)`, `UpdatePayment(ctx, companyID, supplierID, paymentID, in)`, `DeletePayment(ctx, companyID, supplierID, paymentID)`, `ListPayments(ctx, companyID, supplierID, page)`; `ListPurchases(ctx, scope, PurchaseListInput{LocationID, SupplierID, Page})`; sqlc nomlari: `SupplierStanding`, `ProductStanding`, `AddStock{Added, Removed}`, `NextPurchaseNumber`, `SetPurchaseTotal`, `GetPurchasePayment`, `UpdatePurchasePayment`, `DeletePurchasePayment`, `ListProductStock`, `CountProductPurchases`, `ListProductPurchases`, `CountProductPurchaseLines`, `CountLocationPurchases`.
