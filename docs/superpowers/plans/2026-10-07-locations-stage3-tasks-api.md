# Lokatsiyalar, 3-bosqich: vazifalar lokatsiya bo'yicha (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A'zo faqat o'ziga ruxsatli lokatsiyalardagi vazifalarni ko'radi va o'zgartiradi: ro'yxat `location_id` bilan bitta lokatsiyaga, usiz ruxsatli hammasiga; ruxsatsiz lokatsiya 403 `forbidden`; ruxsatsiz lokatsiyadagi vazifa ID bo'yicha 404; mas'ul vazifa lokatsiyasida ishlashi shart (`logic/locations.md`, 6-bo'lim; `logic/tasks.md`, 4.1–4.2, 6).

**Architecture:**
- **So'rovlar:** `MemberInLocation(user_phone, company_id, location_id)`; `GetTask`, `ListTasks`, `CountTasks`, `UpdateTask`, `MoveTask`, `DeleteTask` ga `location_ids bigint[]` (`t.location_id = ANY(…)`).
- **Servis:** `task.Scope{CompanyID, LocationIDs}` yetti metodda `companyID` o'rniga; `Create` `locationID` scope'da bo'lishi shart (400 "Lokatsiyani tanlang"); `assigneeOf(ctx, q, companyID, locationID, raw)` → `MemberInLocation` (400 "Mas'ul bu lokatsiyada ishlamaydi"); `Update` o'zgargan mas'ulni vazifa lokatsiyasi bilan tekshiradi; `ListInput.LocationID` (0 = scope'ning hammasi).
- **API:** `taskScope(r)`, `allowedLocation(ctx, id)`; `createTask` ruxsatsiz `location_id` → 403; `listTasks` `?location_id=` (400 "Lokatsiya noto'g'ri" / 403); openapi.
- **Web mock:** vazifalar `locationsOf` bo'yicha ko'rinadi; `?location_id=`; 403; mas'ul qoidasi; `handlers.test.ts`.

---

### Task 1: `MemberInLocation` va vazifa so'rovlari `location_ids` bilan
- [ ] db testlari (`locations_test.go` `TestMemberInLocation`: egasi, cheklanmagan, cheklangan ichida / tashqarida, a'zo emas; `tasks_test.go`: `GetTask` / `ListTasks` / `CountTasks` / `UpdateTask` / `MoveTask` / `DeleteTask` `LocationIds` bilan: tashqaridagi vazifa ErrNoRows / ro'yxatda yo'q) → SQL → `make sqlc` → GREEN, commit.

### Task 2: `task.Scope`, lokatsiya va mas'ul qoidalari
- [ ] `tasks_test.go`: `TestScope` (cheklangan scope: boshqa lokatsiya vazifasi `Get` / `Update` / `Move` / `Delete` / `History` 404; `List` faqat scope; `LocationID` bitta lokatsiya; `Create` scope'dan tashqari 400), `TestAssigneeWorksInTheLocation` (qo'shishda 400 "Mas'ul bu lokatsiyada ishlamaydi"; tahrirda o'zgarganda 400, o'zgarmaganda qoladi; egasi va cheklanmagan xodim mumkin), mavjud testlar `Scope` bilan (`sh.scope()` yordamchisi: kompaniya + hamma lokatsiya).
- [ ] RED → kod → GREEN, commit.

### Task 3: Handlerlar va openapi
- [ ] `app/tasks_test.go`: `TestTasksAreTheLocationsTheMemberMayWorkIn` (cheklangan xodim: `GET /app/tasks` ruxsatli hammasi; `?location_id=<ruxsatsiz>` 403 `forbidden`; `?location_id=abc` 400 "Lokatsiya noto'g'ri"; `POST` ruxsatsiz `location_id` 403, ruxsatli 201; boshqa lokatsiya vazifasi `GET/PUT/PATCH/DELETE/history` 404; egasi hammasini ko'radi; cheklov keyingi so'rovdanoq); `POST` mas'ul lokatsiyada emas 400.
- [ ] RED → `taskScope`, `allowedLocation`, handlerlar → GREEN; openapi (`location_id` so'rov parametri, izohlar, 403 `Forbidden` ro'yxat va qo'shishda) → `make api-client`; commit.

### Task 4: Web mock
- [ ] `handlers.test.ts`: cheklangan xodim ro'yxati, `?location_id=` 403 / 400, boshqa lokatsiya vazifasi 404, mas'ul qoidasi (qo'shish va tahrir), egasi hammasi.
- [ ] RED → `mocks/tasks.ts` (`visibleTasks(member)`, `location_id`, mas'ul `worksIn`) → GREEN; commit.

### Task 5: Yakun
- [ ] `make lint`, `make test`, `make e2e`; spec'ga "3-bosqich qarorlari"; commit.
