# Lokatsiyalar, 2-bosqich: admin paneldagi lokatsiyalar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platforma admini kompaniya sahifasida lokatsiyalarni ko'radi (har birida faol vazifalar soni), qo'shadi, nomini o'zgartiradi va bo'shini o'chiradi; faol vazifasi bor va yagona lokatsiya o'chirilmaydi (`logic/locations.md`, 3-bo'lim).

**Architecture:**
- **So'rovlar** (`locations.sql`): `ListLocations` (jonli, ID tartibida, `tasks_count`), `CreateLocation`, `RenameLocation` (jonli, RETURNING), `DeleteLocation` (soft, RETURNING), `CountLocations` (jonli), `CountLocationTasks` (faol vazifalar).
- **Servis** (`company/locations.go`): `AdminLocation{Location, TasksCount, CreatedAt}`; `Locations`, `AddLocation` (`fields.CleanName`, tranzaksiya `LockCompany` → 404 "Kompaniya topilmadi", `fields.Taken` → 409 `name_taken`), `RenameLocation` (404 "Lokatsiya topilmadi", 409), `DeleteLocation` (tranzaksiya `LockCompanyCustomers`: 404 → `last_location` → `location_in_use` → soft delete).
- **API** (`internal/admin`): `GET /admin/companies/{id}` `locations`; `POST /admin/companies/{id}/locations`, `PATCH …/{locationId}`, `DELETE …/{locationId}`; openapi `AdminLocation`, `LocationInput`, `CompanyDetail.locations`, `LocationNotFound`, `LocationConflict`.
- **Admin UI:** kompaniya sahifasida "Lokatsiyalar" bo'limi (`DataList`: nom, "Vazifalar", "Qo'shilgan", amallar), `AddLocationDialog`, `RenameLocationDialog`, `DeleteLocationButton`; `locationSchema`; mock; Vitest; e2e.

**Tech Stack:** Go, sqlc, testify, pgtest; Next.js, react-hook-form + zod, TanStack Query, MSW, Vitest, Playwright.

---

### Task 1: So'rovlar

**Files:** Modify `backend/internal/db/queries/locations.sql`, `backend/internal/db/locations_test.go`.

- [ ] **Test:** `TestListLocations` (jonli, ID tartibida, `tasks_count` faol vazifalar: o'chirilgani sanalmaydi; boshqa kompaniyaniki yo'q), `TestCreateLocation` (RETURNING; takror nom 23505), `TestRenameLocation` (jonli; o'chirilgan → ErrNoRows; begona → ErrNoRows), `TestDeleteLocation` (RETURNING id; ikkinchi marta ErrNoRows; begona ErrNoRows), `TestCountLocations` (jonli), `TestCountLocationTasks` (faol; o'chirilgan vazifa sanalmaydi).
- [ ] **RED** (kompilyatsiya: so'rov yo'q) → SQL → `make sqlc` → **GREEN**, commit `feat(db): the admin's location queries`.

### Task 2: `company.Locations`, `AddLocation`, `RenameLocation`, `DeleteLocation`

**Files:** Modify `backend/internal/company/locations.go`, `locations_test.go`.

- [ ] **Test:** `TestLocations` (ro'yxat, sanoq), `TestAddLocation` (nom tozalanadi; "Nomni kiriting", "Nom 60 belgidan oshmasin"; `name_taken` katta-kichik harf farqsiz "Bu nomli lokatsiya allaqachon bor"; o'chirilgan nom qayta; yo'q kompaniya 404 "Kompaniya topilmadi"), `TestRenameLocation` (404 "Lokatsiya topilmadi" (yo'q, o'chirilgan, begona); `name_taken`; o'z nomiga qayta — mumkin), `TestDeleteLocation` (yagona → 409 `last_location` "Kompaniyaning yagona lokatsiyasi o'chirilmaydi"; faol vazifali → 409 `location_in_use` "Bu lokatsiyada N ta vazifa bor" (o'chirilgan vazifa sanalmaydi); bo'sh → yashiriladi, nomi bo'shaydi; cheklangan xodimning qatori qoladi; 404), `TestDeleteLocationWaitsForAWriteOfTheSameCompany` (`holdCompany` naqshi: vazifa yozuvi bilan navbat).
- [ ] **RED** (stub `errors.New("not implemented")`) → **Kod** → **GREEN**, commit `feat(company): the admin adds, renames and deletes a company's locations`.

### Task 3: Admin API va openapi

**Files:** Modify `backend/internal/admin/handler.go`, `companies.go`, `json.go`, `companies_test.go`; `backend/openapi.yaml`; generate `packages/api-client/src/schema.d.ts`; `apps/admin/lib/types.ts` (`AdminLocation`).

- [ ] **Test** (`companies_test.go`): `TestGetCompany` `locations` = `[{id, name: "Asosiy", tasks_count: 0, created_at}]`; `TestLocations`: POST 201 (nom tozalangan), 400 "Nomni kiriting", 404 kompaniya, 409 `name_taken`; PATCH 200, 404 "Lokatsiya topilmadi" (begona ham), 409; DELETE 204, 404, 409 `last_location`, 409 `location_in_use` (vazifa SQL bilan yoziladi); sessiyasiz 401; `locationId` son emas → 404.
- [ ] **RED** → **Kod:** `locationID(w, r)` (`companyID` kabi), `addLocation`, `renameLocation`, `deleteLocation`, `adminLocationJSON{ID, Name, TasksCount, CreatedAt}`, `detailJSON.Locations`; `getCompany` `h.companies.Locations`. openapi: `AdminLocation`, `LocationInput`, `CompanyDetail.locations`, uch path, `LocationNotFound`, `LocationConflict`. `make api-client`; contract testi.
- [ ] **GREEN**, commit `feat(admin): the locations of a company in the admin API`.

### Task 4: Admin UI

**Files:** Modify `apps/admin/components/companies/company-page.tsx`, `company-page.test.tsx`, `apps/admin/lib/schemas.ts` (+`schemas.test.ts`), `apps/admin/mocks/data.ts`, `mocks/handlers.ts`; Create `apps/admin/components/companies/location-dialogs.tsx`.

- [ ] **Test** (`company-page.test.tsx`): "Lokatsiyalar" bo'limi (`region`), jadval ustunlari "Lokatsiya", "Vazifalar", "Qo'shilgan", "Amallar" (sr-only); satrlar; "Lokatsiya qo'shish" dialogi (nom; bo'sh → "Nomni kiriting"; takror → "Bu nomli lokatsiya allaqachon bor" `Refusal`); qo'shilgach ro'yxatda va toast "Lokatsiya qo'shildi"; "Nomini o'zgartirish" (qalam, dialog, toast "Nomi o'zgartirildi"); "O'chirish" (savatcha, `alertdialog` "Lokatsiyani o'chirasizmi?", toast "Lokatsiya o'chirildi"; 409 toast'da "Kompaniyaning yagona lokatsiyasi o'chirilmaydi"); telefonda kartochka (nom, "Vazifalar: N" inline, amallar). `schemas.test.ts`: `locationSchema`.
- [ ] Mock: `db.locations: Record<number, AdminLocation[]>` (seed har kompaniyaga "Asosiy", `tasks_count: 0`), detail'da `locations`, 3 handler (Go xabarlari va tartibi).
- [ ] **RED** → **Kod** → **GREEN**: `pnpm --filter @hisob24/admin test`, typecheck, lint; commit `feat(admin): the locations of a company on its page`.

### Task 5: e2e va yakun

- [ ] `apps/admin/e2e/companies.spec.ts` ga yangi test: "the admin adds a location, renames it, cannot delete the only one, deletes the second": 375px va desktop.
- [ ] `make lint`, `make test`, `make e2e`; spec'ga "2-bosqich qarorlari"; commit.
