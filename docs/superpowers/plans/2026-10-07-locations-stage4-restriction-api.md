# Lokatsiyalar, 4-bosqich: xodim cheklovi (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egasi xodimni lokatsiyalar bilan cheklaydi yoki cheklovni olib tashlaydi (`PUT /app/employees/{phone}/locations {location_ids}`; `logic/locations.md`, 5-bo'lim); keyingi so'rovdanoq amal qiladi.

**Architecture:**
- **So'rovlar** (`locations.sql`): `SetMemberAllLocations(user_phone, company_id, all_locations)` (`role = 'user'` RETURNING *), `AddMemberLocation`; mavjud `DeleteMemberLocations`, `GetLocation`.
- **Servis** (`company/locations.go`): `SetEmployeeLocations(ctx, companyID, phone, ids *[]int64) (Member, error)`: telefon (404 "Xodim topilmadi") → `nil` hammasi / bo'sh 400 "Kamida bitta lokatsiyani tanlang" / har ID jonli va kompaniyaniki (404 "Lokatsiya topilmadi"), takror bir marta → tranzaksiya: `SetMemberAllLocations` (qator yo'q → `whyNotAnEmployee`: egasi 409 `cannot_change_owner`, a'zo emas 404) → `DeleteMemberLocations` → `AddMemberLocation` × → `member()`.
- **API:** `requireOwner` guruhida `PUT /employees/{phone}/locations` (`employees.go` `setEmployeeLocations`); openapi `EmployeeLocationsInput`, path, `LocationOrEmployeeNotFound`.
- **Web mock:** `PUT /app/employees/:phone/locations` (`ownerSession`, Go tartibi); `handlers.test.ts`.

---

### Task 1: So'rovlar
- [ ] `locations_test.go`: `TestSetMemberAllLocations` (xodim: false/true RETURNING; egasi ErrNoRows; a'zo emas ErrNoRows), `TestAddMemberLocation` (qator; takror 23505; begona lokatsiya 23503). RED → SQL → `make sqlc` → GREEN, commit.

### Task 2: `SetEmployeeLocations`
- [ ] `company/locations_test.go` `TestSetEmployeeLocations`: cheklash (`Member.AllLocations` false, `Locations` nomlar bilan, ID tartibida; takror bir marta), hammasiga qaytarish (`nil` → true, qatorlar yo'q), bo'sh → 400, o'chirilgan / begona / yo'q ID → 404 "Lokatsiya topilmadi" (hech narsa o'zgarmaydi), egasi → 409 `cannot_change_owner`, a'zo emas → 404 "Xodim topilmadi", noto'g'ri telefon → 404; `TestSetEmployeeLocationsIsAtomic` (`FailInserts member_locations` → bayroq ham o'zgarmaydi). RED (stub) → kod → GREEN, commit.

### Task 3: API, openapi, mock
- [ ] `app/employees_test.go` `TestSetEmployeeLocations`: egasi 200 (javobda `locations`), xodim `owner_only`, kompaniyasiz `owner_only`, 400 / 404 / 409 xabarlari, cheklov keyingi `GET /app/tasks` da darhol (403 `location_id` bilan). RED → handler, route → GREEN; openapi + `make api-client`; contract testi; commit.
- [ ] `handlers.test.ts`: "the owner restricts an employee to some locations, or lifts the restriction" (Go xabarlari; `/app/me.locations` darhol o'zgaradi). RED → `mocks/handlers.ts` → GREEN; commit.

### Task 4: Yakun
- [ ] `make lint`, `make test`, `make e2e`; spec'ga "4-bosqich qarorlari"; commit.
