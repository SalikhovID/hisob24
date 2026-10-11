# Jurnal, 2-bosqich: kassa poydevori (akkauntlar va moliya kategoriyalari) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bazada `bank_accounts` (har kompaniyada «Naqd» UZS) va `finance_categories` paydo bo'ladi; admin kompaniya sahifasida akkauntlarni qo'shadi / o'zgartiradi / nofaol qiladi / o'chiradi (API + «Kassa» bo'limi); `/app/me` akkauntlarni aytadi; egasi Sozlamalar → «Moliya kategoriyalari» da xarajat va kirim kategoriyalarini yuritadi (API + tab). Hujjatlar (to'lovlar akkaunt orqali, xarajat, kirim) keyingi bosqichlarda; `account_in_use` va `category_in_use` tekshiruvlari jurnal bilan keladi (3 va 9-bosqich).

**Architecture:**
- **Baza:** `00015_finance_setup.sql`; so'rovlar `bank_accounts.sql`, `finance_categories.sql`; `currencies.sql` ga `CountCurrencyBankAccounts`.
- **Servis:** yangi `internal/finance` (`finance.go`: `Service`, `write()`; `accounts.go`: `Account`, `Accounts`, `AddAccount`, `UpdateAccount`, `DeleteAccount`; `categories.go`: `Category`, `Categories`, `CreateCategory`, `UpdateCategory`, `DeleteCategory`, `OrderCategories`). `company.Create` «Naqd» yozadi. `currency.SetOfCompany` akkauntlarni ham sanaydi («Bu valyutada N ta akkaunt bor»).
- **API:** admin `POST/PATCH/DELETE /admin/companies/{id}/accounts…`, `CompanyDetail.accounts`; app `Me.accounts`, `GET/POST /app/finance-categories`, `PATCH/DELETE /app/finance-categories/{id}`, `PUT /app/finance-categories/order`.
- **Web:** `Me.accounts` tiplari va mocklari; sozlamalar tabi `finance` («Moliya kategoriyalari»): Xarajat va Kirim bo'limlari (`NameDialog`, nofaol, o'chirish, `SortableList`). **Admin:** «Kassa» bo'limi: akkauntlar jadvali, `account-dialogs.tsx`.

Qoidalar: `logic/finance.md` (1, 3, 6-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

## Kelishuvlar

- 1-bosqichdagi kabi: `GOTEST`, sqlc → `make sqlc`, har GREEN'dan keyin commit.
- Chetlanish (spec): `finance_categories.created_by` yo'q (vazifa turlari kabi sozlama qatori kim qo'shganini saqlamaydi).
- Akkaunt kategoriya o'chirilganda / nofaol qilinganda hujjat tekshiruvi (`account_in_use`, `category_in_use`) jurnal paydo bo'lganda qo'shiladi; hozir faqat `last_account` va nom qoidalari.
- Admin API'dagi akkaunt sxemasi `BankAccount` (platforma adminlari `AdminAccount` nomini olgan).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00015_finance_setup.sql` (+`migrations_test.go`) | ikki jadval, «Naqd» seed, Down |
| `backend/internal/db/queries/bank_accounts.sql`, `finance_categories.sql`, `currencies.sql` (+testlar) | so'rovlar |
| `backend/internal/finance/*.go` (+testlar) | servis |
| `backend/internal/company/create.go` (+test), `backend/internal/currency/currency.go` (+test) | «Naqd» seed; valyuta akkauntlari |
| `backend/internal/admin/accounts.go` (yangi), `handler.go`, `companies.go`, `json.go` (+`accounts_test.go`) | admin API |
| `backend/internal/app/finance.go` (yangi), `handler.go` (+`finance_test.go`, `permissions_test.go`, `handler_test.go`) | app API |
| `backend/cmd/api/main.go`, `backend/openapi.yaml`, `packages/api-client` | ulash, kontrakt |
| `apps/admin/components/companies/account-dialogs.tsx` (yangi), `company-page.tsx`, `lib/types.ts`, `lib/schemas.ts`, `mocks/*` (+testlar), `e2e/companies.spec.ts` | «Kassa» |
| `apps/web/lib/types.ts`, `components/settings/finance-categories-page.tsx` (yangi), `settings-page.tsx`, `use-settings-tab.ts`, `mocks/finance.ts` (yangi), `mocks/data.ts`, `mocks/handlers.ts` (+testlar), `e2e/settings.spec.ts` | «Moliya kategoriyalari», `Me.accounts` |

---

### Task 1: Migratsiya `00015_finance_setup.sql`

Testlar (`migrations_test.go`): `TestTheFinanceMigrationGivesEveryCompanyACashAccount` (DownTo 14 → kompaniyalar → UpTo 15 → har biriga «Naqd» UZS, faol), `TestBankAccountsKeepTheirRules` (nom kompaniyada takrorlanmas, harf farqsiz, o'chirilgani bo'sh (partial unique); valyuta katalogdan (23503)), `TestFinanceCategoriesKeepTheirRules` (`kind` expense | income (23514); nom tur ichida takrorlanmas, boshqa turda mumkin).

```sql
-- +goose Up
CREATE TABLE bank_accounts (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    currency_id BIGINT NOT NULL REFERENCES currencies(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  BIGINT REFERENCES admins(telegram_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX bank_accounts_name ON bank_accounts (company_id, lower(name)) WHERE deleted_at IS NULL;
INSERT INTO bank_accounts (company_id, name, currency_id) SELECT id, 'Naqd', 1 FROM companies;

CREATE TABLE finance_categories (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    position   INT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX finance_categories_name ON finance_categories (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
-- +goose Down
DROP TABLE finance_categories;
DROP TABLE bank_accounts;
```

### Task 2: So'rovlar

`bank_accounts.sql`: `CreateBankAccount :one` (name, currency_id, created_by), `ListBankAccounts :many` (jonli, id tartibida), `GetBankAccount :one`, `UpdateBankAccount :one` (`name = COALESCE(narg)`, `currency_id = COALESCE(narg)`, `is_active = COALESCE(narg)`, `updated_at`), `DeleteBankAccount :one` (yashirish), `CountActiveBankAccounts :one`. `currencies.sql`: `CountCurrencyBankAccounts :one` (jonli akkauntlar valyutada). `finance_categories.sql`: `CreateFinanceCategory :one` (position tur ichida max + 1), `ListFinanceCategories :many` (`sqlc.narg('kind')`), `GetFinanceCategory :one`, `UpdateFinanceCategory :one` (name / is_active COALESCE), `DeleteFinanceCategory :one`, `OrderFinanceCategories :exec` (tur ichida). Testlar `internal/db/bank_accounts_test.go`, `finance_categories_test.go`, `currencies_test.go`.

### Task 3: `internal/finance`

`Account{ID, Name, CurrencyID, Active, CreatedAt, UpdatedAt}`, `AccountInput{Name, CurrencyID}`, `AccountPatch{Name *string, CurrencyID *int64, Active *bool}`. Qoidalar (`logic/finance.md`, 3): nom `fields.CleanName` (1–60), 409 `name_taken` «Bu nomli akkaunt allaqachon bor»; valyuta katalogdan («Valyuta noto'g'ri») va yoqilgan (`currency.ErrNotAllowed`); nofaol qilish / o'chirish oxirgi faolni 409 `last_account` «Kompaniyada kamida bitta faol akkaunt qolsin»; 404 «Akkaunt topilmadi», kompaniya yo'q 404 «Kompaniya topilmadi». Yozuvlar `LockCompany` ostida. `Category{ID, Name, Kind, Active}`, `CategoryInput{Name, Kind}`, `CategoryPatch{Name *string, Active *bool}`: tur «Turni tanlang»; nom 1–60; 409 `name_taken` «Bu nomli kategoriya allaqachon bor»; 404 «Kategoriya topilmadi»; tartib `fields.SameIDs` → `fields.ErrOrderChanged`. Testlar table-driven.

### Task 4: `company.Create` «Naqd», `currency.SetOfCompany` akkauntlar

`TestCreate` → `bank_accounts` da «Naqd» UZS faol. `TestSetOfCompany` → USD akkaunt bor → 409 «Bu valyutada 1 ta akkaunt bor» (mahsulotlar oldin sanaladi).

### Task 5: Admin API + openapi + admin panel «Kassa»

Route'lar: `POST /admin/companies/{id}/accounts {name, currency_id}` 201 `BankAccount`; `PATCH …/{accountId} {name?, currency_id?, is_active?}` 200; `DELETE …/{accountId}` 204; `CompanyDetail.accounts`. Sxemalar `BankAccount {id, name, currency_id, is_active, created_at}`, `BankAccountInput`, `BankAccountPatch`, javob `AccountConflict` (name_taken, account_in_use, last_account). Testlar `accounts_test.go`. Admin web: `lib/types.ts` (`BankAccount`), `lib/schemas.ts` (`accountSchema`: nom, valyuta), `mocks/data.ts` (`db.accounts: Record<number, BankAccount[]>`; har kompaniyaga «Naqd»), `mocks/handlers.ts`, `company-page.tsx` «Kassa» bo'limi (`DataList`: «Akkaunt», «Valyuta», «Holat», «Qo'shilgan», «Amallar» (tahrirlash dialogi, nofaol / faollashtirish, o'chirish)), `account-dialogs.tsx` (`AddAccountDialog`, `EditAccountDialog` (nom, valyuta — kompaniyada yoqilganlardan; `SelectField` admin'da bormi — bo'lmasa `select-box` nusxasi), `ToggleAccountButton`, `DeleteAccountButton`); testlar; e2e `companies.spec.ts`.

### Task 6: App API: `Me.accounts`, moliya kategoriyalari + openapi + web

`Me.accounts: [{id, name, currency_id, is_active}]` (jonli, id tartibida; tanlanmagan kompaniyada `[]`). `GET /app/finance-categories?kind=` har a'zoga (tur bo'lmasa hammasi: expense keyin income); `POST` (`settings.create`), `PATCH /{id} {name?, is_active?}` (`settings.edit`), `DELETE` (`settings.delete`), `PUT /order {kind, ids}` (`settings.edit`; 409 `order_changed`). Sxemalar `FinanceCategory {id, name, kind, is_active}`, `FinanceCategoryInput`, `FinanceCategoryPatch`, `FinanceCategoryOrder {kind, ids}`, `FinanceKind` enum. Testlar `finance_test.go`, `permissions_test.go`. Web: `types.ts`, `mocks/data.ts` (`db.accounts`, `db.financeCategories`), `mocks/finance.ts`, `meOf.accounts`, `queries.ts` (`financeCategoriesKey`, `useFinanceCategories(companyId, kind)`), `use-settings-tab.ts` (`finance`), `settings-page.tsx` tab «Moliya kategoriyalari» → `FinanceCategories` (`finance-categories-page.tsx`: ikki `Section` — «Xarajat kategoriyalari», «Kirim kategoriyalari»; `NameDialog` qo'shish / nomini o'zgartirish, `SortableList`, nofaol / faollashtirish (`ActiveButton` kabi), `DeleteButton`); testlar; e2e `settings.spec.ts`.

### Task 7: Yakun

`make lint`, `make test`, `make e2e`; spec'ga 2-bosqich qarorlari; `git push origin dev`.
