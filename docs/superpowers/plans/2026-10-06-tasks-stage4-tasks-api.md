# Vazifalar, 4-bosqich: vazifalar API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Har a'zo API orqali vazifa qo'shadi (mavjud yoki yangi mijoz bilan, bitta tranzaksiyada), ko'radi, tahrirlaydi, bosqichini ko'chiradi, o'chiradi; ro'yxat muddat bo'yicha, filtrlar va qidiruv bilan, 20 tadan; har o'zgarish tarixga yoziladi (egasiga); vazifada ishlatilayotgan bosqich, tur, maydon, mijoz va variant o'chirilmaydi; mijoz takliflari uchun `GET /app/customers?phone=`.

**Architecture:**
- **Baza:** migratsiya `00008_tasks.sql`: `customers` ga `UNIQUE (company_id, id)`; `tasks` (tur, bosqich, mijoz kompaniya ichida FK; `deadline DATE`; `assignee_phone` + `assignee_name` nusxasi; `created_by` + nusxa; soft delete), `task_values`, `task_history`.
- **Servis:** `internal/task/tasks.go` (`Create`, `Get`, `List`, `Update`, `Move`, `Delete`, `History`), `input.go` (sof: nom, muddat, bosh maydonlar farqi). `Service` `*customer.Service` ni oladi: yangi mijoz `customers.CreateIn` bilan o'sha tranzaksiyada. `TakenError` mijoznikidek handler'ga `customer_id` bilan boradi.
- **Sozlamalarga:** `stage_in_use`, `type_in_use`, `field_in_use` (`internal/task`), `customer_in_use`, `option_in_use` vazifalar bilan (`internal/customer`), `ListInput.Phone` (`internal/customer`).
- **API:** 7 route (`requireCompany`; tarix `requireOwner`) + `GET /app/customers?phone=`; openapi va TS client.

**Tech Stack:** Go (chi, pgx, sqlc, goose, testify, pgtest).

Qoidalar: `logic/tasks.md` (4–9-bo'limlar), `logic/customers.md` (5, 6-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md` ("Ma'lumotlar modeli", "API", "Backend").

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: stub SQL → `make sqlc` → mantiq bo'yicha yiqiladi → haqiqiy SQL. Migratsiya uchun RED tabiiy (42P01).
- Har GREEN'dan keyin paket testlari va commit. Mutatsiya: `Create` atomikligi `FailInserts("tasks")` bilan (yangi mijoz ham yozilmaydi); navbat testi kengayadi.
- Ochiq tranzaksiyali testlarda `t.Cleanup` rollback.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00008_tasks.sql` (+`migrations_test.go`) | jadvallar, `customers` cheklovi, `Down` |
| `backend/internal/db/queries/tasks.sql` (+`internal/db/tasks_test.go`) | 17 so'rov |
| `backend/internal/db/queries/customers.sql` (+`customers_test.go`) | `CountCustomerTasks`; `ListCustomers`/`CountCustomers` ga `phone` |
| `backend/internal/task/input.go` (+`input_test.go`), `tasks.go` (+`tasks_test.go`), `task.go`, `stages.go`, `types.go` (+`inuse_test.go`), `task_test.go` | servis |
| `backend/internal/customer/customers.go`, `dropdowns.go` (+`inuse_test.go`, `customers_test.go`) | `customer_in_use`, `option_in_use` vazifalar, `Phone` filtri |
| `backend/internal/app/tasks.go` (+`tasks_test.go`), `customers.go` (+`customers_test.go`), `handler.go`, `handler_test.go`, `cmd/api/main.go` | handlerlar, route'lar |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `/app/tasks…`, `Task`, `TaskCreate`, `TaskUpdate`, `TaskMove`, `TaskPage`, `TaskCustomer`, `TaskAssignee`, `TaskHistoryEntry`; `GET /app/customers` `phone` |

---

### Task 1: Migratsiya `00008_tasks.sql`

- [ ] **Test:** `TestTasks` (muddat majburiy 23502; nom majburiy; begona kompaniya turi / bosqichi / mijozi 23503; `assignee_phone` user bo'lishi shart 23503, NULL mumkin; `created_by` 23503; o'chirilgan vazifaning mijozi va bosqichi bo'shamaydi — cheklov yo'q, faqat `deleted_at`), `TestTaskValues` (mijoz javoblaridek: uchtadan bittasi 23514, bitta skalyar 23505, variant bir marta 23505, yo'q maydon 23503), `TestTaskHistory` (action CHECK, `changes` sukut `[]`), `TestCustomersAreOneCompanys` (`UNIQUE (company_id, id)` mavjud: 23505 … aslida `tasks` dan begona mijozga FK 23503 bilan sinaladi). `Down`: mavjud test.
- [ ] **RED** → **Kod** → **GREEN**, commit `feat(db): tasks, their answers and their history`.

### Task 2: So'rovlar

`tasks.sql`:

```
CreateTask :one, GetTask :one (mijoz telefoni va nomi, mas'ul va qo'shgan ismlari COALESCE bilan), ListTasks :many, CountTasks :one
  (filtrlar: type_id, stage_id, assignee_phone, customer_id; search/digits: nom, vazifa matn va son javoblari, mijoz telefoni va matn javoblari; ORDER BY deadline, id),
UpdateTask :one (title, deadline, stage_id, assignee_phone, assignee_name; updated_at), MoveTask :one (stage_id; updated_at), DeleteTask :one (soft),
AddTaskValue :exec, DeleteTaskValues :exec, ListTaskValues :many (maydon turi bilan, tartibda),
CountStageTasks :one, CountTypeTasks :one, CountTaskFieldTasks :one, CountOptionTasks :one (faol vazifalar),
AddTaskHistory :exec, ListTaskHistory :many
```

`customers.sql`: `CountCustomerTasks :one` (faol vazifalar); `ListCustomers` / `CountCustomers` ga `sqlc.narg('phone')` (`c.phone LIKE '998' || phone || '%'`).

Mijoz nomi `GetTask`/`ListTasks` da:

```sql
(SELECT v.text_value FROM customer_fields f
   LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
 WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
 ORDER BY f.position, f.id LIMIT 1) AS customer_name
```

- [ ] **Test** (`internal/db/tasks_test.go`, `customers_test.go`): har so'rovga, mijozlardagi namunada (filtrlar, qidiruv, tartib, sanoqlar, telefon prefiksi).
- [ ] **RED** (stub) → **Kod** → **GREEN**, commit `feat(db): the task queries; customers by phone prefix`.

### Task 3: `input.go` — sof tekshiruv va farq

```go
func taskTitle(raw string) (string, error)                 // trim; "Vazifa nomini kiriting"; "Vazifa nomi 200 belgidan oshmasin"
func taskDeadline(raw string) (time.Time, error)           // ""→"Muddatni kiriting"; time.DateOnly emas→"Muddat noto'g'ri"
type head struct { Title string; Deadline time.Time; StageName string; AssigneeName string }
func diffHead(was, now head) []fields.Change               // "Nomi", "Muddat" (dd.mm.yyyy), "Bosqich", "Mas'ul"
```

- [ ] **Test** (table-driven) → **RED** → **Kod** → **GREEN**, commit `feat(task): the task's own fields are checked and compared`.

### Task 4: Servis

```go
type Customer struct { ID int64; Phone string; Name *string }
type Member struct { Phone string; Name *string }
type Task struct { ID, TypeID, StageID int64; Title string; Deadline time.Time; Customer Customer; Assignee *Member;
                   Values fields.Values; CreatedByName *string; CreatedAt, UpdatedAt time.Time }
type Input struct { Title, Deadline string; StageID int64; AssigneePhone *string; Values map[string]json.RawMessage }
type NewCustomer struct { TypeID int64; Phone string; Values map[string]json.RawMessage }
type CustomerInput struct { ID *int64; New *NewCustomer }   // one of; neither → "Mijozni tanlang"
func NewService(pool, customers *customer.Service) *Service
Create(ctx, companyID, by, typeID, in, cust) (Task, error); Get; List(ctx, companyID, ListInput{Search; TypeID, StageID, CustomerID; Assignee; Page}) (Page, error)
Update(ctx, companyID, id, by, in) (Task, error); Move(ctx, companyID, id, by, stageID) (Task, error); Delete(ctx, companyID, id, by) error; History
```

- [ ] **Test** (`tasks_test.go`, `newShop` yordamchisi: kompaniya, egasi, xodim, mijoz turi va mijoz, bosqichlar, vazifa turi maydonlari bilan):
  - `TestCreate`: mavjud mijoz bilan (javoblar, mas'ul ismi nusxasi, qo'shgan ismi, tarix "created"); yangi mijoz bilan (mijoz yoziladi, uning tarixida "created"; takror telefon `phone_taken` `customer_id` bilan; yangi mijoz ham, vazifa ham yozilmaydi); `TestCreateRefusals` tartibi (nom, muddat, tur, bosqich, mas'ul, maydon, mijoz: "Mijozni tanlang" yo'q / begona / o'chirilgan mijozda); `TestCreateIsAtomic` (`FailInserts("tasks")` → mijoz ham yo'q).
  - `TestGet` (mijoz nomi va telefoni, mas'ul chiqarilgach nusxa ismi, begona 404), `TestList` (tartib muddat keyin id, 20 tadan, filtrlar, qidiruv: nom, vazifa matni, mijoz nomi, telefon raqamlari, o'chirilgansiz), `TestUpdate` (nom, muddat, bosqich, mas'ul, javoblar; farq tarixda; o'zgarishsiz yozilmaydi; chiqarilgan mas'ul o'zgartirilmasa qoladi, o'zgartirilsa a'zo bo'lishi shart; nofaol variant saqlanadi), `TestMove` (bosqich; tarixda "Bosqich"; o'sha bosqich → yozilmaydi; begona bosqich → "Bosqichni tanlang"), `TestDelete` (soft; tarix "deleted"; qayta 404), `TestHistory` (yangi birinchi; o'chirilgan 404; xodim ko'rmasligi API da).
- [ ] **RED** → **Kod** → **GREEN**, commit `feat(task): tasks are entered, listed, changed, moved and deleted`.

### Task 5: Ishlatilayotgan narsa o'chirilmaydi; mijoz telefon prefiksi

- [ ] **Test** (`task/inuse_test.go`): `stage_in_use` "Bu bosqichda N ta vazifa bor", `type_in_use` "Bu turda N ta vazifa bor", `field_in_use` "Bu maydon N ta vazifada to'ldirilgan" (o'chirilgan vazifa sanalmaydi). (`customer/inuse_test.go`): `customer_in_use` "Bu mijozda N ta vazifa bor"; `option_in_use` "Bu variant N ta vazifada tanlangan" (mijozlar yo'q, vazifalar bor); (`customers_test.go`): `List` `Phone` prefiksi.
- [ ] **RED** → **Kod** → **GREEN**, commit `feat: what the tasks use is not deleted; customers by phone prefix`.
- [ ] Navbat: `task_test.go` ga `Create`, `Update`, `Move`, `Delete` (mutatsiya bilan tekshiriladi).

### Task 6: Handlerlar, openapi, client

- [ ] **Test** (`app/tasks_test.go`): `TestCreateTask` (mavjud va yangi mijoz; 201 JSON shakli: `customer`, `assignee`, `deadline`; 409 `phone_taken` `customer_id` bilan; 400 xabarlari; kompaniyasiz 403), `TestListTasks` (filtrlar, `?page=`, `?assignee=`, noto'g'ri param 400: "Vazifa turi noto'g'ri", "Bosqich noto'g'ri", "Mijoz noto'g'ri", "Mas'ul noto'g'ri"), `TestGetTask`, `TestUpdateTask`, `TestMoveTask`, `TestDeleteTask`, `TestTaskHistory` (egasiga 200, xodimga 403). (`app/customers_test.go`): `?phone=` (prefiks; noto'g'ri → 400 "Telefon raqami noto'g'ri"). `handler_test.go`, `main.go`: `task.NewService(pool, customers)`.
- [ ] **RED** → **Kod** → **GREEN**; openapi (7 path + `phone` parametri + sxemalar + `TaskNotFound`, `TaskTaken` javoblari), `make api-client`, contract testi; commit `feat(api): the tasks`.

### Task 7: bosqich yakuni

- [ ] `make lint`, `make test`, `make e2e`; lokal haqiqiy stack'da curl (spec "Tekshiruv": mavjud va yangi mijoz bilan vazifa, takror telefon 409, ro'yxat filtrlari va qidiruv, ko'chirish va tarix, ishlatilayotgan narsalar o'chmaydi, `?phone=`; sinov ma'lumoti tozalanadi).
- [ ] `git push origin main`; spec'ga "4-bosqich qarorlari".
