# Mijozlar, 1-bosqich: sozlamalar API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompaniya egasi API orqali dropdownlar (variantlari bilan) va mijoz turlarini (maydonlari bilan) yaratadi, nomlaydi, tartiblaydi va o'chiradi; har a'zo ularni o'qiydi; har kompaniya tayyor turlar bilan boshlaydi.

**Architecture:**
- **Baza:** migratsiya `00005_customer_settings.sql`: `customer_dropdowns`, `customer_dropdown_options`, `customer_types`, `customer_fields`. Hammasi soft delete (`deleted_at`), nom unikalligi faqat o'chirilmaganlar ichida, tartib `position` ustunida. Mavjud kompaniyalarga tayyor turlar.
- **Servis:** yangi `internal/customer` paketi. Har yozuv bitta tranzaksiya va `LockCompany` bilan boshlanadi: kompaniyaning sozlama yozuvlari navbat bilan bajariladi.
- **API:** `/app/customer-dropdowns…` va `/app/customer-types…`: 2 ta o'quvchi route (har a'zo), 15 ta yozuvchi (faqat egasi). Yangi `requireCompany` (403 `company_required`).

**Tech Stack:** Go (chi, pgx, sqlc, goose).

Qoidalar: `logic/customers.md` (2, 3, 5, 9-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-04-customers-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`.
- sqlc so'rovi uchun RED: bir xil parametrli, ishlamaydigan stub (`… WHERE false`) → `make sqlc` → test mantiq bo'yicha yiqiladi → haqiqiy SQL → `make sqlc` → GREEN.
- TDD jurnali: `$SCRATCH/tdd-log.md`. Har GREEN'dan keyin paket testlari va commit; task oxirida `GOTEST ./...`.
- Har yangi route bilan bir siklda `openapi.yaml` ham yangilanadi (contract testi router = openapi ni talab qiladi).
- "O'chirish" hamma joyda soft delete: `deleted_at = now()`.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00005_customer_settings.sql` | yangi |
| `backend/migrations/migrations_test.go` | 4 ta yangi test |
| `backend/internal/db/queries/customer_dropdowns.sql`, `customer_types.sql` | yangi so'rovlar |
| `backend/internal/db/customer_dropdowns_test.go`, `customer_types_test.go` | so'rov testlari |
| `backend/internal/customer/customer.go` | `Service`, turlar, xatolar, `write` (lock + tranzaksiya), `cleanName` |
| `backend/internal/customer/dropdowns.go` (+`dropdowns_test.go`) | dropdownlar va variantlar |
| `backend/internal/customer/types.go` (+`types_test.go`) | turlar va maydonlar |
| `backend/internal/company/create.go` (+test) | `SeedCustomerTypes` |
| `backend/internal/app/session.go` | `requireCompany` |
| `backend/internal/app/customer_settings.go` (+`customer_settings_test.go`) | 17 ta handler |
| `backend/internal/app/handler.go` | `Services.Customers`, route'lar |
| `backend/cmd/api/main.go` | `customer.NewService(pool)` |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | yangi yo'llar va sxemalar |

---

### Task 1: Migratsiya `00005_customer_settings.sql` (4 sikl)

- [ ] **M1** `TestCustomerDropdownsAndOptions`: dropdown nomi kompaniyada katta-kichik harf farqsiz unikal (23505), boshqa kompaniyada bo'sh, o'chirilgan dropdown nomi qayta olinadi; variant nomi dropdown ichida shunday. GREEN: `customer_dropdowns`, `customer_dropdown_options`.
- [ ] **M2** `TestCustomerTypesAndFields`: tur nomi va maydon nomi unikalligi (faqat o'chirilmaganlar); `kind` CHECK (23514); tanlov turi dropdownsiz, matn dropdown bilan (23514); `is_unique` tanlov turida (23514); begona kompaniya dropdowni va turi (23503). GREEN: `customer_types`, `customer_fields`.
- [ ] **M3** `TestTheCustomerSettingsMigrationGivesEveryCompanyTheReadyTypes`: 4-versiyada kompaniya → 5 ga chiqish → "Jismoniy" [F.I.Sh. matn majburiy], "Yuridik" [Nomi matn majburiy; INN son majburiy takrorlanmas], tartib bilan. GREEN: migratsiyadagi `INSERT … SELECT FROM companies`.
- [ ] **M4** `TestTheCustomerSettingsMigrationDown`: 4 ga tushganda to'rt jadval yo'q. GREEN: `Down`.

### Task 2: Dropdown so'rovlari (`customer_dropdowns.sql`)

Har biri alohida sikl, test `internal/db/customer_dropdowns_test.go` da:

- [ ] `CreateCustomerDropdown :one`, `ListCustomerDropdowns :many` (kompaniyaniki, o'chirilmagan, `id` tartibida), `GetCustomerDropdown :one`, `RenameCustomerDropdown :one`, `DeleteCustomerDropdown :one` (soft; ikkinchi marta `ErrNoRows`).
- [ ] `AddCustomerDropdownOption :one` (o'rni oxirida; begona kompaniya dropdowni → `ErrNoRows`), `ListCustomerDropdownOptions :many` (dropdown va `position` tartibida), `UpdateCustomerDropdownOption :one` (`label`, `is_active` ixtiyoriy), `DeleteCustomerDropdownOption :one`, `ListCustomerDropdownOptionIDs :many`, `SetCustomerDropdownOptionPosition :exec`.

### Task 3: Tur va maydon so'rovlari (`customer_types.sql`)

- [ ] `CreateCustomerType :one` (o'rni oxirida), `ListCustomerTypes :many`, `GetCustomerType :one`, `RenameCustomerType :one`, `DeleteCustomerType :one`, `DeleteCustomerTypeFields :exec`, `ListCustomerTypeIDs :many`, `SetCustomerTypePosition :exec`.
- [ ] `AddCustomerField :one`, `ListCustomerFields :many` (kompaniyaning o'chirilmagan maydonlari, tur va `position` tartibida), `GetCustomerField :one`, `UpdateCustomerField :one`, `DeleteCustomerField :one`, `ListCustomerFieldIDs :many`, `SetCustomerFieldPosition :exec`, `CountDropdownFields :one`.
- [ ] `SeedCustomerTypes :exec` (bitta kompaniyaga tayyor turlar).

### Task 4: `customer` servisi

```go
type Option struct { ID int64; Label string; Active bool }
type Dropdown struct { ID int64; Name string; Options []Option }
type Field struct { ID int64; Label, Kind string; Required, Unique bool; DropdownID *int64 }
type Type struct { ID int64; Name string; Fields []Field }
type OptionPatch struct { Label *string; Active *bool }
type FieldInput struct { Label, Kind string; Required, Unique bool; DropdownID *int64 }
type FieldPatch struct { Label *string; Required, Unique *bool }

func (s *Service) Dropdowns(ctx, companyID) ([]Dropdown, error)
func (s *Service) CreateDropdown(ctx, companyID, name) (Dropdown, error)
func (s *Service) RenameDropdown(ctx, companyID, id, name) (Dropdown, error)
func (s *Service) DeleteDropdown(ctx, companyID, id) error
func (s *Service) AddOption(ctx, companyID, dropdownID, label) (Option, error)
func (s *Service) UpdateOption(ctx, companyID, dropdownID, optionID, OptionPatch) (Option, error)
func (s *Service) DeleteOption(ctx, companyID, dropdownID, optionID) error
func (s *Service) OrderOptions(ctx, companyID, dropdownID, ids) error
func (s *Service) Types(ctx, companyID) ([]Type, error)
func (s *Service) CreateType(ctx, companyID, name) (Type, error)
func (s *Service) RenameType(ctx, companyID, id, name) (Type, error)
func (s *Service) DeleteType(ctx, companyID, id) error
func (s *Service) OrderTypes(ctx, companyID, ids) error
func (s *Service) AddField(ctx, companyID, typeID, FieldInput) (Field, error)
func (s *Service) UpdateField(ctx, companyID, typeID, fieldID, FieldPatch) (Field, error)
func (s *Service) DeleteField(ctx, companyID, typeID, fieldID) error
func (s *Service) OrderFields(ctx, companyID, typeID, ids) error
```

Sikllar (har biri RED → GREEN):

- [ ] `CreateDropdown`: nom trim qilinadi; bo'sh → 400 "Nomni kiriting"; 61 belgi → 400 "Nom 60 belgidan oshmasin"; takror (harf farqsiz) → 409 `name_taken` "Bu nomli dropdown allaqachon bor"; boshqa kompaniyada bo'sh.
- [ ] `Dropdowns`: variantlari bilan, tartibda; boshqa kompaniyaniki yo'q; variantsiz dropdown bo'sh ro'yxat bilan.
- [ ] `RenameDropdown`: 404 "Dropdown topilmadi" (yo'q, begona, o'chirilgan); `name_taken`.
- [ ] `AddOption` (404, "Bu variant allaqachon bor"), `UpdateOption` (nom; nofaol va qayta faol; 404 "Variant topilmadi"), `DeleteOption` (soft, nomi bo'shaydi), `OrderOptions` (to'liq ro'yxat; to'liq bo'lmasa 409 `order_changed`).
- [ ] `DeleteDropdown` (soft, 404, nomi bo'shaydi).
- [ ] `CreateType`, `Types` (maydonlari bilan), `RenameType`, `OrderTypes`, `DeleteType` (maydonlari bilan o'chadi; 404 "Tur topilmadi").
- [ ] `AddField`: olti tur; tanlov turi o'z kompaniyasining o'chirilmagan dropdowni bilan, aks holda 400 "Dropdownni tanlang"; matn va son dropdownsiz; notanish tur → 400 "Maydon turini tanlang"; `Unique` tanlov turida → 400; takror nom → 409 "Bu nomli maydon allaqachon bor"; begona tur → 404.
- [ ] `UpdateField` (nom, majburiy, takrorlanmas; tur va dropdown o'zgarmaydi), `DeleteField`, `OrderFields`.
- [ ] `DeleteDropdown` maydonga ulangan bo'lsa → 409 `dropdown_in_use` "Bu dropdown N ta maydonda ishlatilgan"; maydon o'chirilgach o'chadi.
- [ ] Navbat: `TestSettingsWritesOfACompanyTakeTurns` (`pgtest.WaitForLockWait`): kompaniya qatorini ushlab turgan tranzaksiya tugamaguncha `CreateType` kutadi.
- [ ] `company.Create`: `TestCreateGivesTheCompanyTheReadyCustomerTypes`.

### Task 5: Handlerlar va openapi

- [ ] `requireCompany` va o'qish: `TestCustomerSettingsAreReadByEveryMember`: egasi va xodim 200; kompaniya tanlanmagan → 403 `company_required`; tokensiz 401; obunasi tugagan 402. Route'lar `GET /app/customer-dropdowns`, `GET /app/customer-types`.
- [ ] Yozuvlar faqat egasiga: `TestCustomerSettingsAreChangedByTheOwnerOnly` (xodim har yozuvchi route'da 403 `owner_only`).
- [ ] Dropdown va variant route'lari (7 ta), tur va maydon route'lari (8 ta): har biriga muvaffaqiyatli yo'l va asosiy rad javobi; ID raqam bo'lmasa 404.
- [ ] `cmd/api/main.go`; `make api-client`; `make lint`; `GOTEST ./...`.

## Self-review

- Spec qamrovi: maydon turlari va belgilari (T1 M2, T4 `AddField`), nom qoidalari (T4), tartib (T2–T4 `Order*`), nofaol variant (T4 `UpdateOption`), soft delete va nomning bo'shashi (T1, T4), `dropdown_in_use` (T4), tayyor turlar (T1 M3, T4 `company.Create`), ruxsatlar (T5). `type_in_use`, `field_in_use`, `option_in_use`, `duplicates_exist` mijozlar jadvaliga bog'liq: 3-bosqichda.
- Nomlar izchil: so'rov nomlari T2–T3 dagidek, servis metodlari T4 dagi imzolar bilan.
