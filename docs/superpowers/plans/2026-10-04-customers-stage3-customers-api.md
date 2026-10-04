# Mijozlar, 3-bosqich: mijozlar API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Kompaniyaning har a'zosi API orqali mijoz qo'shadi, ko'radi, tahrirlaydi va o'chiradi; ro'yxat qidiriladi, tur bo'yicha filtrlanadi va sahifalanadi; har o'zgarish tarixga yoziladi (tarixni egasi ko'radi); ishlatilayotgan tur, maydon va variant o'chirilmaydi.

**Architecture:**
- **Baza:** migratsiya `00006_customers.sql`: `customers` (soft delete, telefon faol mijozlar ichida unikal), `customer_values` (matn yoki son uchun bitta qator, har tanlangan variant uchun bitta qator), `customer_history` (o'zgarishlar JSONB'da, o'sha paytdagi nomlar bilan).
- **Tekshiruv:** sof funksiya `checkValues` (so'rovdagi javoblar → saqlanadigan javoblar yoki birinchi xato) va `diff` (eski va yangi javoblar → tarix yozuvi). Table-driven unit testlar.
- **Servis:** `customer.Service` ga `Create`, `Get`, `List`, `Update`, `Delete`, `History`. Har yozuv `write()` ichida (kompaniya lock qilinadi): telefon va takrorlanmas maydon tekshiruvi poygasiz.
- **API:** `/app/customers…` beshta route har a'zoga, `GET /app/customers/{id}/history` faqat egasiga. Takror telefon va takror qiymat 409 javobida `customer_id` bilan.

**Tech Stack:** Go (chi, pgx, sqlc, goose).

Qoidalar: `logic/customers.md` (3.1–3.5, 4–7-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-04-customers-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`.
- sqlc so'rovi uchun RED: bir xil parametrli, ishlamaydigan stub → `make sqlc` → test mantiq bo'yicha yiqiladi → haqiqiy SQL.
- TDD jurnali: `$SCRATCH/tdd-log.md`. Har GREEN'dan keyin paket testlari va commit.
- Har yangi route bilan bir siklda `openapi.yaml` ham yangilanadi.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00006_customers.sql` (+`migrations_test.go`) | yangi |
| `backend/internal/db/queries/customers.sql` (+`internal/db/customers_test.go`) | so'rovlar |
| `backend/internal/customer/values.go` (+`values_test.go`) | `Values`, `checkValues`, `Change`, `diff` |
| `backend/internal/customer/customers.go` (+`customers_test.go`) | `Create`, `Get`, `List`, `Update`, `Delete`, `History`, `TakenError` |
| `backend/internal/customer/{types,dropdowns}.go` (+`inuse_test.go`) | `type_in_use`, `field_in_use`, `option_in_use`, `duplicates_exist` |
| `backend/internal/app/customers.go` (+`customers_test.go`) | oltita handler |
| `backend/internal/app/handler.go` | route'lar |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `/app/customers…`, `Customer`, `CustomerPage`, `CustomerHistoryEntry`, `CustomerTaken` |

---

### Task 1: Migratsiya `00006_customers.sql`

- [ ] `TestCustomers`: telefon faqat `998` + 9 raqam (23514); bitta kompaniyada bitta raqam bitta faol mijoz (23505), boshqa kompaniyada va o'chirilgan mijozdan keyin bo'sh; begona kompaniya turi (23503); `created_by` user bo'lishi shart (23503).
- [ ] `TestCustomerValues`: uchtadan aynan bittasi (23514); mijozda maydon uchun bitta matn yoki son (23505); variant bir marta (23505), lekin bir nechta variant mumkin; yo'q maydon yoki variant (23503).
- [ ] `TestCustomerHistory`: `action` CHECK; `changes` sukut bo'yicha `[]`.
- [ ] `Down`: mavjud `TestInitDownRemovesTheSchema`.

### Task 2: So'rovlar (`customers.sql`)

- [ ] `CreateCustomer :one`, `GetCustomer :one` (faol, kompaniyaniki; qo'shgan a'zoning hozirgi ismi yoki o'sha paytdagisi), `GetCustomerByPhone :one`, `UpdateCustomer :one`, `DeleteCustomer :one` (soft).
- [ ] `AddCustomerValue :exec`, `DeleteCustomerValues :exec`, `ListCustomerValues :many` (maydon turi bilan, maydon va variant tartibida).
- [ ] `ListCustomers :many`, `CountCustomers :one` (tur filtri; qidiruv: telefon raqamlari, matn va son qiymatlari).
- [ ] `FindCustomerByValue :one` (takrorlanmas maydon), `CustomerFieldHasDuplicates :one`.
- [ ] `CountTypeCustomers :one`, `CountFieldCustomers :one`, `CountOptionCustomers :one` (faqat faol mijozlar).
- [ ] `AddCustomerHistory :exec`, `ListCustomerHistory :many`, `GetMemberName :one`.

### Task 3: Qiymat tekshiruvi va tarix farqi (`values.go`, unit)

```go
// string: matn; int64: butun son yoki bitta variant; []int64: bir nechta variant (dropdown tartibida)
type Values map[int64]any
type Change struct { Label, Old, New string }
func checkValues(fields []Field, options map[int64][]Option, was Values, raw map[string]json.RawMessage) (Values, error)
func diff(fields []Field, options map[int64][]Option, oldPhone, newPhone string, was, now Values) []Change
```

- [ ] matn: trim, bo'sh → yo'q, 500 belgi; son: butun, chegara; yagona tanlov; ko'p tanlov (takrorsiz, tartiblangan); majburiy; notanish kalit; nofaol variant faqat mijozda bor bo'lsa.
- [ ] `diff`: telefon, matn, son, variantlar (nomlari bilan), qo'shilgan va olib tashlangan qiymat; o'zgarmagan maydon yo'q.

### Task 4: Servis

- [ ] `Create`: mijoz va qiymatlari; kim qo'shgani; tarixda "created"; rad etishlar (telefon, tur, qiymat); `phone_taken` va `value_taken` (`TakenError` mijoz ID'si bilan); atomiklik (`FailInserts`).
- [ ] `Get`: qiymatlar turi bo'yicha yig'iladi; begona yoki o'chirilgan → 404.
- [ ] `List`: yangi birinchi, 20 tadan, jami; tur filtri; qidiruv (telefon raqamlari, matn harfma-harf, son); o'chirilganlar yo'q.
- [ ] `Update`: telefon va qiymatlar almashadi, tarixda farq; o'zgarishsiz saqlash yozilmaydi; nofaol variant saqlanadi; tur o'zgarmaydi; takror tekshiruvi o'zidan boshqa mijozlarga.
- [ ] `Delete`: soft, raqam bo'shaydi, tarixda "deleted"; qayta → 404.
- [ ] `History`: yangi birinchi.
- [ ] Sozlamalar: `DeleteType` → `type_in_use`, `DeleteField` → `field_in_use`, `DeleteOption` → `option_in_use` (o'chirilgan mijozlar sanalmaydi), `UpdateField` → `duplicates_exist`.
- [ ] Navbat: mijoz yozuvlari ham kompaniyani kutadi (xarakteristika, mutatsiya bilan).

### Task 5: Handlerlar va openapi

- [ ] `GET /app/customers`, `POST /app/customers`, `GET /app/customers/{id}`, `PUT /app/customers/{id}`, `DELETE /app/customers/{id}`: egasi va xodim; kompaniyasiz 403 `company_required`; 409 `customer_id` bilan.
- [ ] `GET /app/customers/{id}/history`: faqat egasi.
- [ ] `make api-client`, `make lint`, `GOTEST ./...`.

## Self-review

- Spec qamrovi: telefon qoidalari (T1, T4), qiymatlar va xabarlar (T3), takrorlanmaslik (T2, T4), nofaol variant (T3, T4), soft delete (T1, T4), kim qo'shgan (T2, T4), tarix (T3, T4, T5), qidiruv, filtr va sahifalash (T2, T4), o'chirish qoidalari (T4), ruxsatlar (T5).
