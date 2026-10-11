# Jurnal, 1-bosqich: valyutalar va kurslar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bazada valyutalar katalogi, kompaniya valyutalari (UZS hammada), kurs qatorlari (tw-dobroe `currency_rate` kabi) va `convert_amount()` paydo bo'ladi; admin kompaniyada valyutani yoqadi / o'chiradi (API + admin panel «Valyutalar»); egasi Sozlamalar → «Valyuta kurslari» da kurs kiritadi (API + tab); `/app/me` yoqilgan valyutalar va joriy kurslarni aytadi; mahsulot narxi valyutali bo'ladi (API, dialog, ro'yxat, sahifa); userda timezone ustuni. Jurnal, hujjatlar va kassa keyingi bosqichlarda.

**Architecture:**
- **Baza:** `00014_currencies.sql` (spec'dagi SQL: `currencies` seed, `company_currencies`, `currency_rates`, `convert_amount`, `products.currency_id`, `users.timezone`; `customers (company_id, id)` kaliti 00008 dan bor); so'rovlar `internal/db/queries/currencies.sql`; `products.sql` va `users.sql` o'zgaradi.
- **Servis:** yangi `internal/currency` (`currency.go`: `Service`, `Currency`, `CompanyCurrency`, `Catalog`, `OfCompany`, `SetOfCompany`; `rates.go`: `Rates`, `RatesInput`, `History`, `SetRates`, `RateAt`, `Rate(raw)`, `RateText`). `company.Create` UZS yozadi. `catalog` narx valyutasini tekshiradi. `user.Access.Timezone`.
- **API:** admin `GET /admin/currencies`, `PUT /admin/companies/{id}/currencies`, `CompanyDetail.currencies`; app `Me.currencies` (tanlangan kompaniya; `locations` kabi), `GET/POST /app/currency-rates`, `Product.currency_id`.
- **Web:** `lib/currencies.ts` + `format.ts` (`formatMoney`, `formatRate`), mahsulot / xizmat dialoglarida valyuta tanlovi (2+ valyutada), ro'yxat va sahifada narx valyuta bilan, Sozlamalar «Valyuta kurslari» tabi; mocklar. **Admin:** kompaniya sahifasida «Valyutalar» bo'limi va dialogi; mocklar.

**Tech Stack:** Go 1.27 (chi, pgx/v5, sqlc, goose, testify, pgtest), openapi-typescript, Next 16, TanStack Query, react-hook-form + zod, MSW, Vitest, Playwright.

Qoidalar: `logic/currencies.md`, `logic/products.md` (3.1, 6). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: SQL yoziladi → `make sqlc` → test mantiq bo'yicha yiqiladi. Migratsiya uchun RED tabiiy (jadval yo'q: 42P01). Web: `cd apps/web && pnpm exec vitest run <fayl>`; admin: `cd apps/admin && pnpm exec vitest run <fayl>`.
- Har GREEN'dan keyin paket testlari va commit (faqat o'z fayllari).
- Chetlanish (spec'dan): valyutalar va kurslar `/app/me` da `Me.currencies` sifatida (tanlangan kompaniyaniki, `locations` kabi), `AppCompany` ichida emas: `companies[]` har kompaniya uchun so'rov talab qilardi.
- Chetlanish (`logic/products.md`): narx valyutasi tekshiruvi bazada, izohdan keyin (nom / artikul takrorlaridan oldin).
- Kurs JSON'da matn, bazadagidek 4 kasr bilan (`"12800.0000"`); UZS kursi `"1.0000"`. Pul 2 kasr.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00014_currencies.sql` (+`migrations_test.go`) | jadvallar, seed, funksiya, ustunlar, Down |
| `backend/internal/db/queries/currencies.sql` (+`internal/db/currencies_test.go`) | 11 so'rov |
| `backend/internal/db/queries/products.sql`, `users.sql` (+testlar) | `currency_id`; `timezone` |
| `backend/internal/currency/currency.go`, `rates.go` (+`currency_test.go`, `rates_test.go`) | servis |
| `backend/internal/company/create.go` (+`company_test.go`) | UZS seed |
| `backend/internal/user/profiles.go` (+`profiles_test.go`) | `Access.Timezone` |
| `backend/internal/catalog/catalog.go`, `products.go` (+testlar) | narx valyutasi |
| `backend/internal/admin/handler.go`, `companies.go`, `currencies.go` (yangi), `json.go` (+`currencies_test.go`) | admin API |
| `backend/internal/app/handler.go`, `currencies.go` (yangi), `catalog.go` (+`currencies_test.go`, `catalog_test.go`, `handler_test.go`, `permissions_test.go`) | app API |
| `backend/cmd/api/main.go` | ulash |
| `backend/openapi.yaml`, `packages/api-client` (generatsiya) | kontrakt |
| `apps/web/lib/types.ts`, `format.ts`, `currencies.ts` (yangi), `catalog.ts`, `queries.ts` (+testlar) | tiplar, format, hooklar |
| `apps/web/mocks/data.ts`, `currencies.ts` (yangi), `catalog.ts`, `handlers.ts` (+`handlers.test.ts`) | mock API |
| `apps/web/components/catalog/product-dialog.tsx`, `service-dialog.tsx`, `catalog-page.tsx`, `product-page.tsx` (+testlar) | valyuta |
| `apps/web/components/settings/currency-rates-page.tsx`, `rates-dialog.tsx` (yangi), `settings-page.tsx`, `use-settings-tab.ts` (+testlar), `apps/web/e2e/settings.spec.ts`, `catalog.spec.ts` | kurslar tabi |
| `apps/admin/lib/types.ts`, `queries.ts`, `components/companies/company-page.tsx`, `currencies-dialog.tsx` (yangi), `components/ui/checkbox.tsx` (yangi), `mocks/data.ts`, `mocks/handlers.ts` (+testlar), `e2e/companies.spec.ts` | admin «Valyutalar» |

---

### Task 1: Migratsiya `00014_currencies.sql`

**Files:** Create `backend/migrations/00014_currencies.sql`; Modify `backend/migrations/migrations_test.go`.

- [ ] **Step 1: Testlar** (`migrations_test.go` oxiriga):

```go
func TestCurrenciesAreSeeded(t *testing.T) {
	pool := pgtest.New(t)
	rows, err := pool.Query(t.Context(), "SELECT id, code, name, symbol FROM currencies ORDER BY position, id")
	require.NoError(t, err)
	type currency struct {
		ID                 int64
		Code, Name, Symbol string
	}
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[currency])
	require.NoError(t, err)
	assert.Equal(t, []currency{
		{1, "UZS", "O'zbek so'mi", "so'm"}, {2, "USD", "AQSH dollari", "$"}, {3, "EUR", "Yevro", "€"}, {4, "RUB", "Rossiya rubli", "₽"},
	}, got)
	var next int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO currencies (code, name, symbol, position) VALUES ('KZT', 'Tenge', 'T', 5) RETURNING id").Scan(&next))
	assert.EqualValues(t, 5, next, "the sequence continues after the seed")
}

func TestTheCurrenciesMigrationGivesEveryCompanyUZS(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	provider := newProvider(t, pool)
	_, err := provider.DownTo(ctx, 13)
	require.NoError(t, err)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	_, err = provider.UpTo(ctx, 14)
	require.NoError(t, err)

	rows, err := pool.Query(ctx, "SELECT company_id, currency_id FROM company_currencies ORDER BY company_id")
	require.NoError(t, err)
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[struct{ CompanyID, CurrencyID int64 }])
	require.NoError(t, err)
	assert.Equal(t, []struct{ CompanyID, CurrencyID int64 }{{olma, 1}, {nok, 1}}, got)
}

func TestCurrencyRatesKeepTheirRules(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)

	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, '998901111111') RETURNING id", c).Scan(&id))
	var uzs, eur string
	var status int16
	require.NoError(t, pool.QueryRow(ctx, "SELECT uzs::text, eur::text, status FROM currency_rates WHERE id = $1", id).Scan(&uzs, &eur, &status))
	assert.Equal(t, "1.0000", uzs, "the so'm is the base")
	assert.Equal(t, "0.0000", eur, "a currency not set is 0")
	assert.EqualValues(t, 1, status, "standard by default")

	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, uzs, set_by) VALUES ($1, 2, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "the so'm rate is always 1")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, -1, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "no negative rate")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, status, set_by) VALUES ($1, 3, '998901111111')", c)
	assert.Equal(t, "23514", sqlState(err), "a status is 1 or 2")
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, set_by) VALUES ($1, '998909999999')", c)
	assert.Equal(t, "23503", sqlState(err), "set by a user")
}

func TestConvertAmount(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO currency_rates (company_id, usd, eur, set_by) VALUES ($1, 12800.5, 13900, '998901111111')", c)
	require.NoError(t, err)
	for name, tc := range map[string]struct {
		amount   string
		from, to int64
		want     *string
	}{
		"usd to uzs": {"100", 2, 1, ptr("1280050.00")},
		"uzs to usd": {"1280050", 1, 2, ptr("100.00")},
		"uzs to uzs": {"15.5", 1, 1, ptr("15.50")},
		"eur to usd": {"100", 3, 2, ptr("1085.90")},
		"to a currency with no rate": {"100", 1, 4, nil},
	} {
		var got *string
		require.NoError(t, pool.QueryRow(ctx, "SELECT convert_amount($1::numeric, $2, $3, r)::text FROM currency_rates r WHERE r.company_id = $4", tc.amount, tc.from, tc.to, c).Scan(&got), name)
		assert.Equal(t, tc.want, got, name)
	}
}

func TestProductsCustomersAndUsersGetTheirCurrencyColumns(t *testing.T) {
	pool := pgtest.New(t)
	ctx := t.Context()
	c := addCompany(t, pool, "Olma")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901111111')")
	require.NoError(t, err)
	var currency int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', '998901111111') RETURNING currency_id", c).Scan(&currency))
	assert.EqualValues(t, 1, currency, "a price is in so'm unless said otherwise")
	_, err = pool.Exec(ctx, "INSERT INTO products (company_id, kind, name, unit, currency_id, created_by) VALUES ($1, 'product', 'Nok', 'kg', 9, '998901111111')", c)
	assert.Equal(t, "23503", sqlState(err), "a currency of the catalog")
	var timezone string
	require.NoError(t, pool.QueryRow(ctx, "SELECT timezone FROM users WHERE phone = '998901111111'").Scan(&timezone))
	assert.Equal(t, "Asia/Tashkent", timezone)
}

func ptr[T any](v T) *T { return &v }
```

- [ ] **Step 2: RED** `GOTEST ./migrations/ -run 'Currenc|ConvertAmount|CurrencyColumns' -v` → 42P01 (`currencies` yo'q).
- [ ] **Step 3: Migratsiya**:

```sql
-- +goose Up
-- The currencies (logic/currencies.md): a fixed catalog (so'm first), the
-- ones each company has turned on (the so'm always), the rates a company
-- keeps over time (one row holds every currency's rate against the so'm:
-- tw-dobroe's currency_rate; status 1 is a standard row from the settings,
-- 2 a document's own), and the conversion every sum goes through.
CREATE TABLE currencies (
    id       BIGSERIAL PRIMARY KEY,
    code     TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{3}$'),
    name     TEXT NOT NULL,
    symbol   TEXT NOT NULL,
    position INT NOT NULL
);
INSERT INTO currencies (id, code, name, symbol, position) VALUES
    (1, 'UZS', 'O''zbek so''mi', 'so''m', 1),
    (2, 'USD', 'AQSH dollari', '$', 2),
    (3, 'EUR', 'Yevro', '€', 3),
    (4, 'RUB', 'Rossiya rubli', '₽', 4);
SELECT setval('currencies_id_seq', 4);

CREATE TABLE company_currencies (
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    currency_id BIGINT NOT NULL REFERENCES currencies(id),
    added_by    BIGINT REFERENCES admins(telegram_id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, currency_id)
);
INSERT INTO company_currencies (company_id, currency_id) SELECT id, 1 FROM companies;

CREATE TABLE currency_rates (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    uzs         NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (uzs = 1),
    usd         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (usd >= 0),
    eur         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (eur >= 0),
    rub         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (rub >= 0),
    status      SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
    set_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    set_by_name TEXT,
    set_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX currency_rates_standard ON currency_rates (company_id, set_at DESC, id DESC) WHERE status = 1;

-- +goose StatementBegin
CREATE FUNCTION convert_amount(p_amount NUMERIC, p_from BIGINT, p_to BIGINT, r currency_rates) RETURNS NUMERIC
LANGUAGE SQL IMMUTABLE AS $$
    SELECT round(p_amount
        * CASE p_from WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END
        / NULLIF(CASE p_to WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END, 0), 2)
$$;
-- +goose StatementEnd

ALTER TABLE products ADD COLUMN currency_id BIGINT NOT NULL DEFAULT 1 REFERENCES currencies(id);
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent';
ALTER TABLE customers ADD CONSTRAINT customers_company_id_id_key UNIQUE (company_id, id);

-- +goose Down
ALTER TABLE customers DROP CONSTRAINT customers_company_id_id_key;
ALTER TABLE users DROP COLUMN timezone;
ALTER TABLE products DROP COLUMN currency_id;
DROP FUNCTION convert_amount(NUMERIC, BIGINT, BIGINT, currency_rates);
DROP TABLE currency_rates;
DROP TABLE company_currencies;
DROP TABLE currencies;
```

- [ ] **Step 4: GREEN** `GOTEST ./migrations/ -v` (hammasi, Down testi ham). **Commit** `feat(db): the currencies, the company currencies and the rates`.

### Task 2: So'rovlar `currencies.sql`, `products.sql`, `users.sql`

**Files:** Create `backend/internal/db/queries/currencies.sql`, `backend/internal/db/currencies_test.go`; Modify `products.sql`, `users.sql`, `internal/db/products_test.go`, `users_test.go`.

- [ ] **Step 1: So'rovlar**:

```sql
-- name: ListCurrencies :many
-- The catalog, the so'm first.
SELECT * FROM currencies ORDER BY position, id;

-- name: GetCurrency :one
SELECT * FROM currencies WHERE id = $1;

-- name: ListCompanyCurrencies :many
-- The currencies the company has turned on, in the catalog's order.
SELECT c.* FROM currencies c JOIN company_currencies cc ON cc.currency_id = c.id
WHERE cc.company_id = $1 ORDER BY c.position, c.id;

-- name: CompanyHasCurrency :one
SELECT EXISTS (SELECT 1 FROM company_currencies WHERE company_id = $1 AND currency_id = $2);

-- name: AddCompanyCurrency :exec
-- Turns a currency on for the company; one already on stays as it was.
INSERT INTO company_currencies (company_id, currency_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: RemoveCompanyCurrency :exec
DELETE FROM company_currencies WHERE company_id = $1 AND currency_id = $2;

-- name: CountCurrencyProducts :one
-- How many live products or services of the company carry their price in the currency.
SELECT count(*) FROM products WHERE company_id = $1 AND currency_id = $2 AND deleted_at IS NULL;

-- name: GetRateAt :one
-- The standard rate row in force at the moment: the newest set at or before it.
SELECT * FROM currency_rates WHERE company_id = $1 AND status = 1 AND set_at <= $2
ORDER BY set_at DESC, id DESC LIMIT 1;

-- name: GetFirstRate :one
-- The company's earliest standard rate row: what a moment before any rate falls back to.
SELECT * FROM currency_rates WHERE company_id = $1 AND status = 1 ORDER BY set_at, id LIMIT 1;

-- name: CreateRate :one
-- Enters a rate row: standard (1) from the settings, or a document's own (2).
INSERT INTO currency_rates (company_id, usd, eur, rub, status, set_by, set_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('usd'), sqlc.arg('eur'), sqlc.arg('rub'), sqlc.arg('status'), sqlc.arg('set_by'), sqlc.narg('set_by_name'))
RETURNING *;

-- name: ListRates :many
-- A page of the company's standard rate rows, the newest first, each with the name the setter goes by now.
SELECT r.id, r.usd, r.eur, r.rub, r.set_at, COALESCE(m.full_name, r.set_by_name) AS set_by_name
FROM currency_rates r
LEFT JOIN user_companies m ON m.user_phone = r.set_by AND m.company_id = r.company_id
WHERE r.company_id = $1 AND r.status = 1
ORDER BY r.set_at DESC, r.id DESC
LIMIT $2 OFFSET $3;

-- name: CountRates :one
SELECT count(*) FROM currency_rates WHERE company_id = $1 AND status = 1;
```

`products.sql`: `CreateProduct` ga `currency_id` (`sqlc.arg('currency_id')`), `UpdateProduct` ga `currency_id = sqlc.arg('currency_id')`; `GetProduct` va `ListProducts` SELECT'iga `p.currency_id` (`p.price` dan keyin). `users.sql` `GetCompanyAccess`: `JOIN users u ON u.phone = uc.user_phone`, SELECT'ga `u.timezone`.

- [ ] **Step 2: `make sqlc`**, testlar (`currencies_test.go`):

```go
package db_test

func TestListCurrencies(t *testing.T) {
	q, _ := setup(t)
	rows, err := q.ListCurrencies(t.Context())
	require.NoError(t, err)
	codes := []string{}
	for _, c := range rows { codes = append(codes, c.Code) }
	assert.Equal(t, []string{"UZS", "USD", "EUR", "RUB"}, codes)
}

func TestCompanyCurrencies(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	mustExec(t, pool, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1)", olma.ID)

	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 3, AddedBy: ptr(ownerID)}))
	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 2, AddedBy: ptr(ownerID)}))
	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 2, AddedBy: ptr(ownerID)}), "twice is once")
	rows, err := q.ListCompanyCurrencies(ctx, olma.ID)
	require.NoError(t, err)
	codes := []string{}
	for _, c := range rows { codes = append(codes, c.Code) }
	assert.Equal(t, []string{"UZS", "USD", "EUR"}, codes, "the catalog's order")
	has, err := q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: olma.ID, CurrencyID: 4})
	require.NoError(t, err)
	assert.False(t, has)
	require.NoError(t, q.RemoveCompanyCurrency(ctx, gen.RemoveCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 3}))
	has, err = q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: olma.ID, CurrencyID: 3})
	require.NoError(t, err)
	assert.False(t, has)
}

func TestCountCurrencyProducts(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	mustExec(t, pool, "INSERT INTO users (phone) VALUES ('998901234567')")
	mustExec(t, pool, `INSERT INTO products (company_id, kind, name, unit, currency_id, created_by, deleted_at) VALUES
		($1, 'product', 'Olma', 'kg', 2, '998901234567', NULL), ($1, 'service', 'Yetkazish', NULL, 2, '998901234567', NULL),
		($1, 'product', 'Nok', 'kg', 2, '998901234567', now()), ($1, 'product', 'Behi', 'kg', 1, '998901234567', NULL)`, olma.ID)
	n, err := q.CountCurrencyProducts(t.Context(), gen.CountCurrencyProductsParams{CompanyID: olma.ID, CurrencyID: 2})
	require.NoError(t, err)
	assert.EqualValues(t, 2, n, "the live ones in the currency")
}

func TestRates(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	mustExec(t, pool, "INSERT INTO users (phone) VALUES ('998901234567')")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ('998901234567', $1, 'owner', 'Ali')", olma.ID)
	usd := func(s string) pgtype.Numeric { var n pgtype.Numeric; require.NoError(t, n.Scan(s)); return n }
	zero := usd("0")

	first, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: usd("12700"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567"})
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE currency_rates SET set_at = now() - interval '2 days' WHERE id = $1", first.ID)
	second, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: usd("12800"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567", SetByName: ptr("Ali")})
	require.NoError(t, err)
	custom, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: usd("13000"), Eur: zero, Rub: zero, Status: 2, SetBy: "998901234567"})
	require.NoError(t, err)

	now, err := q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, SetAt: time.Now().Add(time.Minute)})
	require.NoError(t, err)
	assert.Equal(t, second.ID, now.ID, "the newest standard row, not a document's own")
	then, err := q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, SetAt: time.Now().Add(-24 * time.Hour)})
	require.NoError(t, err)
	assert.Equal(t, first.ID, then.ID, "the row in force a day ago")
	_, err = q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, SetAt: time.Now().Add(-72 * time.Hour)})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "before any rate")
	earliest, err := q.GetFirstRate(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, first.ID, earliest.ID)
	_ = custom

	rows, err := q.ListRates(ctx, gen.ListRatesParams{CompanyID: olma.ID, Limit: 20, Offset: 0})
	require.NoError(t, err)
	require.Len(t, rows, 2, "the standard rows alone")
	assert.Equal(t, second.ID, rows[0].ID)
	assert.Equal(t, "Ali", *rows[0].SetByName)
	total, err := q.CountRates(ctx, olma.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
}
```

`products_test.go`: `TestCreateProduct`da `CurrencyID: 2` berilsa qaytgan qatorda `CurrencyID == 2`; berilmasa (1) — mavjud chaqiruvlarga `CurrencyID: 1` qo'shiladi (sqlc param majburiy). `users_test.go` `GetCompanyAccess` testiga `assert.Equal(t, "Asia/Tashkent", row.Timezone)`.

- [ ] **Step 3: RED → GREEN** `GOTEST ./internal/db/ -run 'Currenc|Rates|Product|CompanyAccess' -v`. **Commit** `feat(db): the currency queries, the price currency and the timezone`.

### Task 3: `internal/currency`

**Files:** Create `backend/internal/currency/currency.go`, `rates.go`, `currency_test.go`, `rates_test.go`.

- [ ] **Step 1: Testlar** (`currency_test.go`, `pgtest`, `newService(t)` → `NewService(pool)`; fixtures: `addCompany`, `addUser`, `addMember`, `addProduct(currency)` SQL bilan):

```go
func TestCatalog(t *testing.T) {
	s, _ := newService(t)
	got, err := s.Catalog(t.Context())
	require.NoError(t, err)
	assert.Equal(t, []Currency{{1, "UZS", "O'zbek so'mi", "so'm"}, {2, "USD", "AQSH dollari", "$"}, {3, "EUR", "Yevro", "€"}, {4, "RUB", "Rossiya rubli", "₽"}}, got)
}

func TestOfCompanyTellsTheCurrentRates(t *testing.T) {
	// UZS alone → [{UZS, Rate "1.0000"}]; USD on with no rate → Rate nil; after a rate row → "12800.0000".
}

func TestSetOfCompany(t *testing.T) {
	// {2, 3} → UZS, USD, EUR (UZS kept even when not named; 1 may be named); then {2} → EUR removed;
	// an unknown id (9) → 400 "Valyuta noto'g'ri"; a duplicate id counts once;
	// a product priced in EUR → 409 currency_in_use "Bu valyutada 1 ta mahsulot bor"; removing nothing in use is fine.
}
```

`rates_test.go`:

```go
func TestRate(t *testing.T) { // table: "12800" ok, "12800.5" ok, "12800.1234" ok, "0" invalid, "12800.12345" invalid, "-1" invalid, "1,5" invalid, "" invalid
}

func TestSetRates(t *testing.T) {
	// USD on: SetRates{USD: "12800"} → Rates{USD "12800.0000", EUR "0.0000", RUB "0.0000", SetByName "Ali"}; History: 1 row.
	// Second SetRates{EUR …} with USD off → currency_not_allowed; with USD on and USD nil → USD carried from the previous row.
	// A bad rate → 400 "Kurs noto'g'ri"; nothing on but UZS and an empty input → 400 "Kursni kiriting".
}

func TestRateAt(t *testing.T) {
	// no rows → nil, nil; a row 2 days old and a newer one: at now → newer, at yesterday → older, at 3 days ago → the earliest.
}
```

- [ ] **Step 2: RED** (paket yo'q). **Step 3: Kod**:

```go
// Package currency keeps the currencies of the companies (logic/currencies.md):
// the catalog, which ones a company has turned on, and the rates it keeps.
package currency

const UZS int64 = 1

type Currency struct { ID int64; Code, Name, Symbol string }

// CompanyCurrency is a currency the company has turned on, with the rate in
// force now ("12800.0000"): "1.0000" for the so'm, nil while none was set.
type CompanyCurrency struct { Currency; Rate *string }

type Service struct { pool *pgxpool.Pool; q *gen.Queries }
func NewService(pool *pgxpool.Pool) *Service

func (s *Service) Catalog(ctx) ([]Currency, error)
func (s *Service) OfCompany(ctx, companyID int64) ([]CompanyCurrency, error)   // ListCompanyCurrencies + RateAt(now) → rates by column
// SetOfCompany turns on the currencies with the ids given and off the rest
// (the so'm stays on); refused when a live product is priced in one being turned off.
func (s *Service) SetOfCompany(ctx, companyID int64, ids []int64, adminID int64) ([]CompanyCurrency, error)
```

`rates.go`:

```go
var ratePattern = regexp.MustCompile(`^\d{1,10}(\.\d{1,4})?$`)
// Rate reads a rate the client sent: above zero, four decimals at most.
func Rate(raw string) (pgtype.Numeric, error)
// RateText is a stored rate as the API shows it ("12800.0000").
func RateText(n pgtype.Numeric) string

type Rates struct { ID int64; USD, EUR, RUB string; SetByName *string; SetAt time.Time }
type RatesInput struct { USD, EUR, RUB *string }
type RatesPage struct { Items []Rates; Total int64; Page, PageSize int }
var ErrNotAllowed = apperr.New(apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")

func (s *Service) History(ctx, companyID int64, page int) (RatesPage, error)
// SetRates enters a standard rate row as the member with phone by: each currency the
// company has on takes the rate given, or the previous standard row's.
func (s *Service) SetRates(ctx, companyID int64, by string, in RatesInput) (Rates, error)
// RateAt is the standard rate row in force at the moment (the newest set at or before
// it; the earliest when none was yet), nil when the company has none at all.
func RateAt(ctx, q *gen.Queries, companyID int64, at time.Time) (*gen.CurrencyRate, error)
// ColumnOf is the rate of the currency in the row: uzs 1, usd, eur, rub.
func ColumnOf(r gen.CurrencyRate, currencyID int64) pgtype.Numeric
```

- [ ] **Step 4: GREEN** `GOTEST ./internal/currency/ -v`. **Commit** `feat(currency): the catalog, the company currencies and the rates`.

### Task 4: `company.Create` UZS, `user.Access.Timezone`

**Files:** Modify `backend/internal/company/create.go`, `company_test.go`, `backend/internal/user/profiles.go`, `profiles_test.go`.

- [ ] `TestCreate`ga: `SELECT currency_id FROM company_currencies WHERE company_id = $1` → `[1]`. RED → `q.AddCompanyCurrency(ctx, {CompanyID: c.ID, CurrencyID: currency.UZS, AddedBy: &adminID})` (`currency` paketi import; `UZS` konstantasi). GREEN.
- [ ] `profiles_test.go` `Access` testiga `assert.Equal(t, "Asia/Tashkent", a.Timezone)`. RED → `Access.Timezone string` (`row.Timezone`). GREEN. **Commit** `feat: every company starts with the so'm; a user has a timezone`.

### Task 5: Admin API (valyutalar)

**Files:** Create `backend/internal/admin/currencies.go`, `currencies_test.go`; Modify `handler.go` (`Services.Currencies *currency.Service`, route'lar), `companies.go` (`getCompany` + currencies), `json.go` (`currencyJSON`, `detailJSON.Currencies`), `cmd/api/main.go`.

- [ ] **Testlar** (`currencies_test.go`):

```go
func TestListCurrencies(t *testing.T) {
	api := newTestAPI(t, true)
	cookie := api.login(t)
	rec := api.do(t, http.MethodGet, "/admin/currencies", "", cookie)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `[{"id":1,"code":"UZS","name":"O'zbek so'mi","symbol":"so'm"},{"id":2,"code":"USD","name":"AQSH dollari","symbol":"$"},{"id":3,"code":"EUR","name":"Yevro","symbol":"€"},{"id":4,"code":"RUB","name":"Rossiya rubli","symbol":"₽"}]`, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/admin/currencies", "").Code)
}

func TestSetCompanyCurrencies(t *testing.T) {
	// create company → detail currencies [UZS]; PUT {"currency_ids":[2,3]} → 200 [UZS, USD, EUR]; detail shows them;
	// PUT {"currency_ids":[9]} → 400 validation_error "Valyuta noto'g'ri"; PUT on company 999 → 404;
	// product priced in EUR (SQL) → PUT {"currency_ids":[2]} → 409 currency_in_use "Bu valyutada 1 ta mahsulot bor";
	// PUT {"currency_ids":[]} → [UZS] when nothing in use.
}
```

- [ ] Kod: `currencyJSON{ID, Code, Name, Symbol}`; `listCurrencies`; `setCompanyCurrencies` (`body.CurrencyIDs []int64`); `detailJSON.Currencies []currencyJSON`. Route'lar: `r.Get("/currencies", h.listCurrencies)`, `r.Put("/companies/{id}/currencies", h.setCompanyCurrencies)`. `main.go`: `Currencies: currency.NewService(pool)` admin va app `Services`da. GREEN, **Commit** `feat(admin): the currencies of a company`.

### Task 6: App API (`/app/me` valyutalari, kurslar)

**Files:** Create `backend/internal/app/currencies.go`, `currencies_test.go`; Modify `handler.go` (`Services.Currencies`, `meJSON.Currencies`, route'lar), `handler_test.go` (`TestMe` fixture), `permissions_test.go`.

- [ ] **Testlar**: `TestMeTellsTheCompanysCurrencies` (owner of Olma: `currencies` = `[{id:1, code:"UZS", name, symbol, rate:"1.0000"}]`; after `INSERT company_currencies (olma, 2)`: USD with `rate: null`; after a rate row: `"12800.0000"`; before a choice of company: `[]`). `TestCurrencyRates`: `GET /app/currency-rates` (settings.view: owner ok, employee without role 403 forbidden) → `{items: [], total: 0, page: 1, page_size: 20}`; `POST {"usd":"12800"}` with USD off → 400 `currency_not_allowed`; USD on → 201 `{id, usd:"12800.0000", eur:"0.0000", rub:"0.0000", set_by_name:…, set_at}`; GET → 1 item; `POST {"usd":"abc"}` → 400 «Kurs noto'g'ri»; `POST {}` with only UZS → 400 «Kursni kiriting»; employee with `settings.view` only → POST 403. `permissions_test.go` ro'yxatiga ikki route.
- [ ] Kod: `ratesJSON{ID int64; USD, EUR, RUB string; SetByName *string; SetAt time.Time}`, `listRates` (`allowed(access.SettingsView)`), `setRates` (`allowed(access.SettingsEdit)`), `meJSON.Currencies []companyCurrencyJSON` (`{id, code, name, symbol, rate *string}`) `claims.CompanyID != nil` bo'lsa `h.currencies.OfCompany`. GREEN, **Commit** `feat(api): the company's currencies in /app/me and the rates`.

### Task 7: Mahsulot narxi valyutasi

**Files:** Modify `backend/internal/catalog/catalog.go` (`Input.CurrencyID *int64`, `Product.CurrencyID int64`, `checked.CurrencyID`), `products.go` (`currencyAllowed(ctx, q, companyID, id)` yozuv ichida: `GetCurrency` yo'q → «Valyuta noto'g'ri»; `CompanyHasCurrency` false → `currency.ErrNotAllowed`), `catalog_test.go`/`products_test.go`, `backend/internal/app/catalog.go` (`productJSON.CurrencyID`, input `currency_id`), `catalog_test.go`.

- [ ] Testlar: servis — `Create` with `CurrencyID: nil` → 1; `CurrencyID: 2` with USD off → `currency_not_allowed`; on → 2; `9` → «Valyuta noto'g'ri»; `Update` the same. Handler — `POST /app/products {"currency_id":2}` → 201 `currency_id: 2` (USD on), 400 `currency_not_allowed` (off); `GET` lists `currency_id`. GREEN, **Commit** `feat(catalog): a price has a currency`.

### Task 8: Kontrakt va TS client

**Files:** Modify `backend/openapi.yaml`; run `make api-client`.

- [ ] Sxemalar: `Currency {id, code, name, symbol}`, `CompanyCurrency` (+ `rate: string|null`), `CurrencyIdsInput {currency_ids: int64[]}`, `Rates {id, usd, eur, rub, set_by_name, set_at}`, `RatesInput {usd?, eur?, rub?}` (pattern `^[0-9]{1,10}([.][0-9]{1,4})?$`), `RatesPage`; `CompanyDetail.currencies`; `Me.currencies`; `Product.currency_id` (required), `ProductInput.currency_id?`, `ProductUpdate.currency_id?`. Path'lar: `/admin/currencies` (get), `/admin/companies/{id}/currencies` (put: 200, 400, 404, 409 `currency_in_use`), `/app/currency-rates` (get, post). `GOTEST ./internal/httpx/ -run Documented` GREEN. `make api-client`, `pnpm typecheck`. **Commit** `feat(api): the currencies in the contract`.

### Task 9: Web lib: tiplar, format, `currencies.ts`, mocklar

**Files:** Modify `apps/web/lib/types.ts` (`Currency = Me["currencies"][number]`, `Rates`, `RatesInput`, `RatesPage`), `format.ts` (+`formatMoney`, `formatRate`), Create `lib/currencies.ts`, `lib/currencies.test.ts`; Modify `format.test.ts`, `queries.ts` (`ratesKey`, `useRates(companyId, page)`), `mocks/data.ts` (`db.currencies: Record<number, number[]>` standart `[1]`, Nok Market (2) `[1, 2]`; `db.rates: RateRow[]` Nok uchun bitta qator usd 12800; `currenciesOf(companyId)`), `mocks/currencies.ts` (yangi: `GET/POST /app/currency-rates`, `currentRate`), `mocks/catalog.ts` (`currency_id` tekshiruvi: katalogda yo'q «Valyuta noto'g'ri», yoqilmagan `currency_not_allowed`; `ProductRow.currencyId`), `mocks/handlers.ts` (`meOf` + `currencies`), `mocks/handlers.test.ts`.

- [ ] `format.ts`:

```ts
// formatMoney writes an amount with its currency: so'm after the number
// ("1 200 000 so'm"), any other currency's symbol ("150 $").
export function formatMoney(amount: string, currency: { code: string; symbol: string }): string {
  return `${formatAmount(amount)} ${currency.symbol}`
}
// formatRate writes a stored rate ("12800.0000") without the trailing zeros ("12 800", "12 800,5").
export function formatRate(rate: string): string {
  const [whole, decimals = ""] = rate.split(".")
  const trimmed = decimals.replace(/0+$/, "")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return trimmed ? `${grouped},${trimmed}` : grouped
}
```

`currencies.ts`: `UZS = 1`, `useCurrencies(): Currency[]` (`useMe().data?.currencies ?? []`), `isMulti(currencies)`, `currencyOf(currencies, id)` (fallback `{id, code: "UZS", symbol: "so'm", …}`), `currencyOptions(currencies)` → `[{value: "2", label: "USD — AQSH dollari"}]`, `rateLine(c)` → «1 USD = 12 800 so'm» | «Kurs kiritilmagan». Testlar.

- [ ] Vitest: `format.test.ts` (+`formatMoney`, `formatRate`), `currencies.test.ts`, `handlers.test.ts` (me currencies; rates; product currency 400s). **Commit** `feat(web): the currencies in the lib and the mocks`.

### Task 10: Web UI: narx valyutasi, «Valyuta kurslari» tabi

**Files:** Modify `apps/web/lib/catalog.ts` (`productSchema`/`serviceSchema` + `currency_id: z.string()` → `number` transform; `productDefaults(product)` `currency_id: String(product?.currency_id ?? 1)`), `components/catalog/product-dialog.tsx`, `service-dialog.tsx` (`useCurrencies()`; `isMulti` bo'lsa `SelectField name="currency_id" label="Valyuta"`), `catalog-page.tsx` («Narx» `formatMoney(p.price, currencyOf(currencies, p.currency_id))`), `product-page.tsx` (narx; oxirgi narx `formatMoney(last_price, UZS)`), testlar; Create `components/settings/currency-rates-page.tsx`, `rates-dialog.tsx`, testlar; Modify `settings-page.tsx` (tab «Valyuta kurslari», `value="currencies"`), `use-settings-tab.ts`, `settings-page.test.tsx`, `e2e/settings.spec.ts`, `e2e/catalog.spec.ts`.

- [ ] `CurrencyRatesPage({companyId, permissions})`: `useCurrencies()`; faqat UZS → `EmptyState` «Kompaniyada boshqa valyuta yo'q» / «Valyutani admin yoqadi. Yoqilgach, kurslari shu yerda kiritiladi.»; aks holda ro'yxat (`ul aria-label="Joriy kurslar"`: har valyuta `SettingRow` title «USD — AQSH dollari», detail `rateLine`), tepada `RatesDialog` («Kurslarni yangilash», `settings.edit`), pastda «Tarix» (`useRates`, `DataList`: «Sana», «USD», «EUR», «RUB» (faqat yoqilganlar), «Kiritgan»; `Pager`). `RatesDialog`: har yoqilgan non-UZS valyutaga `TextField` («1 USD = … so'm»), oldindan joriy kurs; zod `rateSchema` (vergul → nuqta, `^\d{1,10}(\.\d{1,4})?$`, > 0; «Kurs noto'g'ri», bo'sh «Kursni kiriting»); `POST /app/currency-rates` → `meKey` va `ratesKey` invalidatsiya, toast «Kurslar saqlandi».
- [ ] Vitest: `currency-rates-page.test.tsx` (Nok egasi Vali: USD joriy kursi «1 USD = 12 800 so'm»; dialog yangi kurs → ro'yxat yangilanadi; Olma egasi: bo'sh holat; `settings.view` only: tugma yo'q), `product-dialog.test.tsx` (Olma: valyuta maydoni yo'q; Nok: bor, USD tanlanib saqlanadi), `catalog-page.test.tsx` («Narx» «12 000 so'm» / «15 $»), `settings-page.test.tsx` (5 tab). e2e `settings.spec.ts` (Vali Nok'da kurs kiritadi), `catalog.spec.ts` (narx «so'm» bilan).
- [ ] GREEN; **Commit** `feat(web): prices with a currency and the currency rates`.

### Task 11: Admin panel «Valyutalar»

**Files:** Create `apps/admin/components/ui/checkbox.tsx` (`apps/web/components/ui/checkbox.tsx` nusxasi), `components/companies/currencies-dialog.tsx`, `currencies-dialog.test.tsx`; Modify `lib/types.ts` (`Currency`), `lib/queries.ts` (`keys.currencies`, `useCurrencies()`), `company-page.tsx` (section «Valyutalar»: `Badge` chiplari «UZS», «USD»…; action `CurrenciesDialog`), `company-page.test.tsx`, `mocks/data.ts` (`db.currencies: Record<number, number[]>`, katalog), `mocks/handlers.ts` (`GET /admin/currencies`, `PUT /admin/companies/:id/currencies` (UZS doim; `in use` holati mock'da `db.currencyUse[companyId]` bilan), detail `currencies`), `e2e/companies.spec.ts`.

- [ ] `CurrenciesDialog({company})`: `useCurrencies()` katalog; forma `{ ids: string[] }` (`CheckboxField` har USD/EUR/RUB; UZS «doim yoqilgan» belgisi, disabled); `PUT` → `keys.company(id)` invalidatsiya, toast «Valyutalar saqlandi»; 409 → `Refusal`.
- [ ] Vitest: company page shows «Valyutalar» with «UZS»; dialog ticks USD → chips «UZS», «USD»; 409 message shown. e2e: Olma'da USD yoqiladi.
- [ ] GREEN; **Commit** `feat(admin): a company's currencies`.

### Task 12: Yakun

- [ ] `make lint`, `make test`, `make e2e` toza; `git push origin dev`.

## Self-review

- Spec coverage: migratsiya (00014 hamma element), so'rovlar, servis (katalog, kompaniya valyutalari, kurslar: sanadagi kurs, o'z kursi `CreateRate status 2` keyingi bosqich uchun tayyor), admin API + UI, `/app/me`, kurslar API + tab, mahsulot narxi valyutasi, timezone, mocklar, e2e — hammasi vazifalarda.
- Chetlanishlar (`Me.currencies`, tekshiruv tartibi) spec'ning bosqich qarorlariga yoziladi.
