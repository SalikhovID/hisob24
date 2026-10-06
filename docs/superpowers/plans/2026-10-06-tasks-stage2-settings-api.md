# Vazifalar, 2-bosqich: sozlamalar API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompaniya egasi API orqali bosqichlarni (nom, rang, yakuniy, tartib), vazifa turlarini va ularning maydonlarini sozlaydi; har a'zo ularni va a'zolar ro'yxatini o'qiydi; har kompaniya tayyor bosqichlar va tur bilan boshlaydi; dropdown vazifa maydonida ishlatilganda ham o'chmaydi.

**Architecture:**
- **Baza:** migratsiya `00007_task_settings.sql`: `task_stages` (rang CHECK, `is_done`, tartib, soft delete), `task_types`, `task_fields` (`customer_fields` kabi, `is_unique` siz; dropdown `customer_dropdowns` dan); mavjud kompaniyalarga tayyor bosqich va tur.
- **So'rovlar:** `task_stages.sql`, `task_types.sql`; `customer_dropdowns.sql` dagi `CountCustomerDropdownFields` → `CountDropdownFields` (ikkala jadval); `SeedTaskSettings`.
- **Servis:** yangi `internal/task` (`Service`, `write`, bosqichlar, turlar, maydonlar) `internal/fields` ustida, `customer/types.go` namunasida. `company.Create` tranzaksiyasida `SeedTaskSettings`.
- **API:** 14 ta sozlama route'i (egasi guruhida 12, `requireCompany` da 2 ta GET) + `GET /app/members` (har a'zo); openapi va TS client.

**Tech Stack:** Go (chi, pgx, sqlc, goose, testify, pgtest).

Qoidalar: `logic/tasks.md` (2, 3-bo'limlar), `logic/roles.md` (4-bo'lim), `logic/customers.md` (5-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`.
- sqlc so'rovi uchun RED: test yangi so'rovni chaqiradi → `make sqlc` dan oldin kompilyatsiya bo'lmaydi, shuning uchun avval bir xil parametrli, ishlamaydigan stub SQL (`SELECT … WHERE false` yoki noto'g'ri qiymat) → `make sqlc` → test mantiq bo'yicha yiqiladi → haqiqiy SQL. Migratsiya testlari uchun RED tabiiy: jadval yo'q (`42P01`).
- Har GREEN'dan keyin paket testlari va commit. Bosqich oxirida `make lint`, `make test`, `make e2e`, push.
- `stage_in_use`, `type_in_use`, `field_in_use` 4-bosqichda (vazifalar jadvali bilan): bu bosqichda o'chirish faqat soft delete.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00007_task_settings.sql` (+`migrations_test.go`) | yangi jadvallar, seed, `Down` |
| `backend/internal/db/queries/task_stages.sql` (+`internal/db/task_stages_test.go`) | 6 so'rov |
| `backend/internal/db/queries/task_types.sql` (+`internal/db/task_types_test.go`) | 13 so'rov + `SeedTaskSettings` |
| `backend/internal/db/queries/customer_dropdowns.sql` (+`customer_types_test.go` dagi sanoq testi) | `CountDropdownFields` |
| `backend/internal/task/task.go`, `stages.go` (+`stages_test.go`), `types.go` (+`types_test.go`), `task_test.go` | servis |
| `backend/internal/customer/dropdowns.go` (+`dropdowns_test.go`) | `CountDropdownFields` |
| `backend/internal/company/create.go` (+`company_test.go`) | `SeedTaskSettings` |
| `backend/internal/app/task_settings.go` (+`task_settings_test.go`), `members.go` (+`members_test.go`), `handler.go`, `handler_test.go` | handlerlar, route'lar, `Services.Tasks` |
| `backend/cmd/api/main.go` | `task.NewService(pool, customers)` |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | 10 path, sxemalar |

---

### Task 1: Migratsiya `00007_task_settings.sql`

- [ ] **Test** (`migrations_test.go`):
  - `TestTaskStages`: nom kompaniyada harf farqsiz takrorlanmaydi (23505), boshqa kompaniyada mumkin; rang faqat to'qqiztadan biri (`'gold'` → 23514); `is_done` sukut bo'yicha false; o'chirilgan bosqich nomi bo'shaydi.
  - `TestTaskTypesAndFields`: `customer_types`/`customer_fields` dagi `TestCustomerTypesAndFields` kabi (olti tur, tanlov dropdownsiz 23514, matnga dropdown 23514, begona kompaniya dropdowni 23503, begona tur 23503, o'chirilgan nom bo'shaydi); `is_unique` ustuni yo'q (42703).
  - `TestTheTaskSettingsMigrationGivesEveryCompanyTheReadySettings`: `DownTo(6)`, ikki kompaniya, `UpTo(7)` → har birida bosqichlar `["Yangi blue", "Jarayonda amber", "Bajarildi green done"]` (`taskStagesOf` yordamchisi) va turlar `["Vazifa: "]` (`taskTypesOf`).
  - `Down`: mavjud `TestInitDownRemovesTheSchema`.
- [ ] **RED:** `GOTEST ./migrations/` — jadval yo'q.
- [ ] **Kod:** migratsiya (spec'dagi SQL: `task_stages`, `task_types`, `task_fields`, indekslar, seed, `Down`).
- [ ] **GREEN** + commit `feat(db): task stages, task types and their fields`.

### Task 2: `task_stages.sql`

- [ ] **Test** (`internal/db/task_stages_test.go`): `CreateTaskStage` (position max+1, kompaniyalar alohida, nom band 23505), `ListTaskStages` (tartib, o'chirilgansiz), `GetTaskStage` (begona/o'chirilgan → ErrNoRows), `UpdateTaskStage` (COALESCE: nom, rang, is_done; berilmagani qoladi; begona → ErrNoRows; nom band 23505), `DeleteTaskStage` (soft, ikkinchi marta ErrNoRows), `OrderTaskStages` (unnest WITH ORDINALITY; begona ID o'tkazib yuboriladi).
- [ ] **RED:** stub SQL'lar (`CreateTaskStage` position 0, `List` `WHERE false`, …) → `make sqlc` → test mantiq bo'yicha yiqiladi.
- [ ] **Kod:** haqiqiy SQL (`customer_types.sql` va `customer_dropdowns.sql` namunasida).
- [ ] **GREEN** + commit `feat(db): the task stage queries`.

### Task 3: `task_types.sql`, `CountDropdownFields`, `SeedTaskSettings`

- [ ] **Test** (`internal/db/task_types_test.go`): `CreateTaskType`, `ListTaskTypes`, `GetTaskType`, `RenameTaskType`, `DeleteTaskType`, `OrderTaskTypes`, `AddTaskField` (is_unique yo'q), `ListTaskFields`, `GetTaskField`, `UpdateTaskField` (label, required), `DeleteTaskField`, `DeleteTaskTypeFields`, `OrderTaskFields` — `customer_types_test.go` dagi 13 testning nusxasi jadval nomlari bilan; `TestSeedTaskSettings` (bosqichlar va tur, boshqa kompaniya bo'sh). `customer_types_test.go` da `TestCountCustomerDropdownFields` → `TestCountDropdownFields`: mijoz maydoni 2 + vazifa maydoni 1 (o'chirilgani sanalmaydi) = 3.
- [ ] **RED:** stub SQL → `make sqlc` → yiqiladi (`CountDropdownFields` nomi o'zgargani uchun `internal/customer` kompilyatsiya bo'lmaydi: `dropdowns.go` da chaqiruv ham o'sha siklda yangilanadi, test mantiq bo'yicha yiqiladi).
- [ ] **Kod:** haqiqiy SQL.
- [ ] **GREEN** + commit `feat(db): the task type and field queries; a dropdown counts both kinds of field`.

### Task 4: `internal/task` — `Service` va bosqichlar

**Files:** `backend/internal/task/task.go`, `stages.go`, `task_test.go` (yordamchilar: `newService`, `addCompany`, `refused`, `holdCompany`, `waits` — `customer_test.go` dan nusxa), `stages_test.go`.

```go
// Stage is a kanban column a task is in.
type Stage struct { ID int64; Name, Color string; Done bool }
type StageInput struct { Name, Color string; Done bool }
type StagePatch struct { Name, Color *string; Done *bool }
func (s *Service) CreateStage(ctx, companyID int64, in StageInput) (Stage, error)
func (s *Service) Stages(ctx, companyID int64) ([]Stage, error)
func (s *Service) UpdateStage(ctx, companyID, id int64, patch StagePatch) (Stage, error)
func (s *Service) DeleteStage(ctx, companyID, id int64) error
func (s *Service) OrderStages(ctx, companyID int64, ids []int64) error
```

- [ ] **Test:** `TestCreateStage` (trim, rang, done; "Nomni kiriting"; "Rangni tanlang" bo'sh va `gold` uchun; `name_taken` "Bu nomli bosqich allaqachon bor"; boshqa kompaniya nom oladi), `TestStages` (tartib), `TestUpdateStage` (nom, rang, done alohida; berilmagani qoladi; noto'g'ri rang; nom band; begona → "Bosqich topilmadi"), `TestDeleteStage` (soft; nom bo'shaydi; ikkinchi marta 404; begona 404), `TestOrderStages` (`order_changed` holatlari, yangi oxiriga).
- [ ] **RED:** stub (`not implemented`) → yiqiladi. **Kod** → **GREEN** + commit `feat(task): the stages of a company's tasks`.

### Task 5: `internal/task/types.go` — turlar va maydonlar

```go
type Field = fields.Field
type Type struct { ID int64; Name string; Fields []Field }
type FieldInput struct { Label, Kind string; Required bool; DropdownID *int64 }
type FieldPatch struct { Label *string; Required *bool }
CreateType, Types, RenameType, OrderTypes, DeleteType, AddField, UpdateField, DeleteField, OrderFields
```

- [ ] **Test** (`types_test.go`): `customer/types_test.go` ning nusxasi: `Unique` holatlari olib tashlanadi ("Faqat matn va son maydoni takrorlanmas bo'ladi" yo'q), qolgani bir xil; `TestAddField` da `Field.Unique` doim false.
- [ ] **RED:** stub → **Kod** → **GREEN** + commit `feat(task): the task types and their fields`.

### Task 6: Navbat

- [ ] **Test** (`task_test.go`): `TestAWriteWaitsForAnotherWriteOfTheSameCompany` — 12 yozuv (`CreateStage`, `UpdateStage`, `DeleteStage`, `OrderStages`, `CreateType`, `RenameType`, `OrderTypes`, `DeleteType`, `AddField`, `UpdateField`, `DeleteField`, `OrderFields`) `waits` bilan. Xarakteristika: `write` 4-taskdan `LockCompanyCustomers` bilan yozilgan, shuning uchun bu test darhol o'tadi; mutatsiya (lock olib tashlanadi) bilan 12 tasi ham yiqilishi tekshiriladi va qaytariladi.
- [ ] Commit `test(task): a write waits for another write of the same company`.

### Task 7: Dropdown vazifa maydonida ham ishlatiladi; tayyor sozlamalar

- [ ] **Test** (`customer/dropdowns_test.go`): `TestADropdownATaskFieldUsesIsNotDeleted` — vazifa turi va maydoni SQL bilan (`task_types`, `task_fields`), `DeleteDropdown` → `dropdown_in_use` "Bu dropdown 1 ta maydonda ishlatilgan"; maydon o'chirilgach o'chadi. **RED** (hozir 0 sanaladi) → **Kod:** `dropdowns.go` `CountDropdownFields` (3-taskda yangilangan) → **GREEN**.
- [ ] **Test** (`company/company_test.go`): `TestCreateGivesTheReadyTaskSettings` — `mustCreate` → `task_stages` `["Yangi blue", "Jarayonda amber", "Bajarildi green done"]`, `task_types` `["Vazifa"]` (migratsiya testidagi bilan bir xil ta'rif). **RED** → **Kod:** `create.go` da `SeedTaskSettings` → **GREEN**.
- [ ] Commit `feat(company): every company starts with the ready task stages and type`.

### Task 8: Handlerlar va route'lar

**Files:** `backend/internal/app/task_settings.go`, `members.go`, `handler.go` (`Services.Tasks *task.Service`, `tasks` maydoni, route'lar), `handler_test.go` (`newTestAPIWith` da `Tasks: task.NewService(pool, customers)`), `task_settings_test.go`, `members_test.go`, `cmd/api/main.go`.

JSON: `stageJSON{id, name, color, is_done}`, `taskFieldJSON{id, label, kind, required, dropdown_id}`, `taskTypeJSON{id, name, fields}`.

- [ ] **Test** (`task_settings_test.go`): `TestListTaskStages` (xodim o'qiydi; kompaniyasiz 403 `company_required`; tokensiz 401; obuna 402), `TestCreateTaskStage` (201, nom band 409, rang 400, xodim 403), `TestUpdateTaskStage` (200, qisman), `TestDeleteTaskStage` (204; 404), `TestOrderTaskStages` (204; `order_changed`), `TestListTaskTypes`, `TestCreateTaskType`, `TestOrderTaskTypes`, `TestRenameTaskType`, `TestDeleteTaskType`, `TestAddTaskField` (201; `is_unique` javobda yo'q; dropdown xatolari 400), `TestUpdateTaskField`, `TestDeleteTaskField`, `TestOrderTaskFields` — `customer_settings_test.go` namunasida. `members_test.go`: `TestListMembers` — xodim ham o'qiydi (egasi birinchi), kompaniyasiz 403, `/app/employees` xodimga 403 ligicha qoladi.
- [ ] **RED:** route'lar yo'q → 404 (contract testi `TestRouterServesExactlyTheDocumentedAPI` ham openapi bilan birga yangilanmaguncha yiqiladi — 9-task bilan bitta siklda).
- [ ] **Kod:** handlerlar, route'lar (egasi guruhiga 12, `requireCompany` ga `GET /task-stages`, `GET /task-types`, `GET /members`), `main.go`.
- [ ] **GREEN** + commit `feat(api): the task settings and the members list`.

### Task 9: openapi va api-client

- [ ] `openapi.yaml`: 10 path (yuqoridagi), sxemalar `TaskStage`, `StageColor` (enum), `StageInput`, `StagePatch`, `TaskField`, `TaskType`, `TaskFieldInput`, `TaskFieldPatch`; javoblar `TaskSettingNotFound`, `TaskSettingConflict`; `GET /app/members` (`Member`); `CustomerSettingConflict` izohi `dropdown_in_use` ikkala maydon turini sanashini aytadi.
- [ ] `make api-client` → `packages/api-client/src/schema.d.ts`.
- [ ] `GOTEST ./internal/httpx/` (contract) o'tadi; `pnpm --filter @hisob24/api-client test`.
- [ ] Commit `docs(api): the task settings and members endpoints`.

### Task 10: bosqich yakuni

- [ ] `make lint`, `make test`, `make e2e`; lokal haqiqiy stack'da curl tekshiruvi (spec "Tekshiruv": egasi bosqich, tur, maydon yaratadi va tartiblaydi; xodim 403; `GET /app/members` 200; sinov ma'lumoti aniq nom bilan, tozalanadi; satrlar soni solishtiriladi).
- [ ] `git push origin main`; spec'ga "2-bosqich qarorlari".
