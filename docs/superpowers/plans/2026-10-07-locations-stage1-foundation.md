# Lokatsiyalar, 1-bosqich: poydevor (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bazada lokatsiyalar paydo bo'ladi: `locations` jadvali, har kompaniyaga "Asosiy", `tasks.location_id`, a'zolikda `all_locations` va `member_locations`. API har so'rovda a'zoning ruxsatli lokatsiyalar to'plamini o'qiydi (`user.Access.LocationIDs`), `/app/me` ularni `locations` bilan qaytaradi, `Member` (app va admin) `locations` maydonini oladi (null = hammasi). Openapi, TS client va mock'lar shunga mos. Hozirgi userlar uchun xatti-harakat o'zgarmaydi: hamma hammasida, vazifalar "Asosiy"da.

**Architecture:**
- **Baza:** migratsiya `00010_locations.sql` (spec'dagi SQL). So'rovlar: yangi `locations.sql` (`SeedLocation`, `ListMemberLocations`, `ListCompanyMemberLocations`), `users.sql` (`GetCompanyAccess` + `all_locations`, `location_ids`; `ListCompanyUsers` / `GetCompanyMember` + `all_locations`; `SetCompanyOwner` `all_locations = true`).
- **Servis:** `company.Create` → `SeedLocation`; `company.Location`, `company.Member{AllLocations, Locations}`, `company.Service.MemberLocations` (`/app/me` uchun; `user` paketi `company` ni import qila olmaydi); `user.Access.LocationIDs`.
- **API:** `/app/me` `locations`; `memberJSON.Locations *[]locationJSON` (app va admin).
- **Kontrakt va mock:** openapi `Location`, `Me.locations`, `Member.locations` → `make api-client`; web `lib/types.ts` `Location`; web mock `LocationRow`, `db.locations`, `Membership.locationIds`, `locationsOf`, `/app/me`, `membersOf`; admin mock `member()`.

**Tech Stack:** Go (chi, pgx, sqlc, goose, testify, pgtest), openapi-typescript, MSW, Vitest.

Qoidalar: `logic/locations.md` (1, 4, 5-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-07-locations-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. sqlc so'rovi uchun RED: SQL yoziladi → `make sqlc` → test mantiq bo'yicha yiqiladi yoki stub. Migratsiya uchun RED tabiiy (jadval yo'q: 42P01).
- Har GREEN'dan keyin paket testlari va commit (faqat o'z fayllari).
- Mavjud testlar faqat yangi maydon kutilganda o'zgaradi; hech biri o'chirilmaydi.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00010_locations.sql` (+`migrations_test.go`) | jadvallar, seed, backfill, CHECK, Down |
| `backend/internal/db/queries/locations.sql` (+`internal/db/locations_test.go`) | `SeedLocation`, `ListMemberLocations`, `ListCompanyMemberLocations` |
| `backend/internal/db/queries/users.sql` (+`users_test.go`) | `GetCompanyAccess`, `ListCompanyUsers`, `GetCompanyMember`, `SetCompanyOwner` |
| `backend/internal/company/create.go`, `company.go`, `employees.go`, `locations.go` (yangi) (+testlar) | seed, `Location`, `Member` maydonlari, `MemberLocations` |
| `backend/internal/user/profiles.go` (+test) | `Access.LocationIDs` |
| `backend/internal/app/handler.go`, `employees.go` (+`handler_test.go`, `employees_test.go`, `members_test.go`) | `/app/me.locations`, `memberJSON.Locations` |
| `backend/internal/admin/json.go` (+`companies_test.go`) | `memberJSON.Locations` |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `Location`, `Me`, `Member` |
| `apps/web/lib/types.ts`, `mocks/data.ts`, `mocks/handlers.ts`, `test/locations.ts` (yangi) (+`handlers.test.ts`) | tip, seed, `locationsOf`, `/app/me`, `membersOf`, fixture |
| `apps/admin/mocks/data.ts`, `components/companies/company-page.test.tsx` | `locations: null` |

---

### Task 1: Migratsiya `00010_locations.sql`

**Files:** Create `backend/migrations/00010_locations.sql`; Modify `backend/migrations/migrations_test.go`.

- [ ] **Test** (`migrations_test.go`):
  - `TestTheLocationsMigrationGivesEveryCompanyAReadyLocationAndMovesItsTasksThere`: `DownTo(9)`, ikki kompaniya, Olma'ga bosqich, tur, mijoz turi, mijoz, user va bitta vazifa (`tasks` ga to'g'ridan-to'g'ri INSERT, `location_id`siz); `UpTo(10)` → har kompaniyada bitta jonli lokatsiya "Asosiy"; Olma'ning vazifasi `location_id` = Olma'ning "Asosiy"si; Nok'ning "Asosiy"si boshqa ID.
  - `TestLocations`: nom kompaniyada takrorlanmaydi (katta-kichik harf farqsiz, 23505), boshqa kompaniyada mumkin; o'chirilgan nom bo'shaydi; vazifa begona kompaniya lokatsiyasiga 23503; `location_id` NULL bo'lsa 23502 (not_null_violation).
  - `TestAMemberHasEveryLocationUnlessRestricted`: `user_companies` qatori standart `all_locations = true`; egasiga `all_locations = false` 23514 (check_violation); xodimga mumkin; `member_locations` begona kompaniya lokatsiyasi 23503; a'zolik o'chirilsa qatorlari ketadi (CASCADE).
  - `TestTheLocationsMigrationDownRemovesTheLocations`: `DownTo(9)` → `locations`, `member_locations` jadvallari yo'q, `tasks.location_id` va `user_companies.all_locations` ustunlari yo'q (42703 / 42P01).
- [ ] **RED** (42P01) → **Kod:** spec'dagi SQL (`docs/superpowers/specs/2026-10-07-locations-design.md`, "Ma'lumotlar modeli"), izohlar inglizcha, loyiha uslubida.
- [ ] **GREEN**, commit `feat(db): the locations, a company's tasks in one, a member's restriction`.

### Task 2: So'rovlar `locations.sql` va `users.sql`

**Files:** Create `backend/internal/db/queries/locations.sql`, `backend/internal/db/locations_test.go`; Modify `backend/internal/db/queries/users.sql`, `backend/internal/db/users_test.go`, `backend/internal/db/helpers_test.go` (`addLocation`, `restrictTo` yordamchilari).

- [ ] **Test:**
  - `TestSeedLocation`: Olma'ga "Asosiy" (RETURNING nom, kompaniya); ikkinchi marta 23505.
  - `TestListMemberLocations`: Olma'da Asosiy, Chilonzor, Yunusobod (o'chirilgan); egasi → [Asosiy, Chilonzor] ID tartibida; cheklanmagan xodim → o'sha; Chilonzor va Yunusobod bilan cheklangan xodim → [Chilonzor]; faqat Yunusobod bilan cheklangan → bo'sh; a'zo emas → bo'sh; Nok'ning lokatsiyasi chiqmaydi.
  - `TestListCompanyMemberLocations`: ikki cheklangan xodim, jonli va o'chirilgan lokatsiyalar → qatorlar `(user_phone, id, name)` telefon va ID tartibida, faqat jonli; "hammasi" xodim va egasi chiqmaydi.
  - `TestGetCompanyAccess` ga: egasi `AllLocations` true, `LocationIds` kompaniyaning jonli lokatsiyalari (ID tartibida); cheklangan xodim `AllLocations` false, faqat o'ziniki; lokatsiyasiz (hammasi o'chirilgan) → bo'sh `[]int64{}`.
  - `TestListCompanyUsers`, `TestGetCompanyMember` ga: `AllLocations`.
  - `TestSetCompanyOwner` ga: cheklangan xodim egasi qilinsa `AllLocations` true.
- [ ] **RED** → **Kod:**

```sql
-- name: SeedLocation :one
-- Gives a new company the ready location ("Asosiy"). The companies that
-- were there before got theirs from migration 00010.
INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING *;

-- name: ListMemberLocations :many
-- The locations a member may work in (logic/locations.md, section 5): every
-- live one of the company's for the owner and for a member without a
-- restriction, the live ones among the restriction's otherwise; in the
-- order they were added. Nothing for someone who is not a member.
SELECT l.id, l.name
FROM locations l
JOIN user_companies uc ON uc.company_id = l.company_id AND uc.user_phone = sqlc.arg('user_phone')
WHERE l.company_id = sqlc.arg('company_id') AND l.deleted_at IS NULL
  AND (uc.all_locations OR EXISTS (SELECT 1 FROM member_locations ml
       WHERE ml.user_phone = uc.user_phone AND ml.company_id = uc.company_id AND ml.location_id = l.id))
ORDER BY l.id;

-- name: ListCompanyMemberLocations :many
-- The restrictions of the company's members: each restricted member's live
-- locations, by member and in the order the locations were added. A member
-- without a restriction has no rows.
SELECT ml.user_phone, l.id, l.name
FROM member_locations ml
JOIN locations l ON l.id = ml.location_id AND l.deleted_at IS NULL
WHERE ml.company_id = $1
ORDER BY ml.user_phone, l.id;
```

`users.sql`: `GetCompanyAccess` `SELECT uc.role, uc.role_id, r.permissions, uc.all_locations, (SELECT COALESCE(array_agg(l.id ORDER BY l.id), '{}')::bigint[] FROM locations l WHERE l.company_id = uc.company_id AND l.deleted_at IS NULL AND (uc.all_locations OR EXISTS (...))) AS location_ids, (…)::boolean AS active`; `ListCompanyUsers` va `GetCompanyMember` SELECT'iga `uc.all_locations`; `SetCompanyOwner` `DO UPDATE SET role = 'owner', role_id = NULL, all_locations = true, full_name = EXCLUDED.full_name`.

- [ ] `make sqlc`, **GREEN**, commit `feat(db): the location queries; a member's standing tells their locations`.

### Task 3: `company.Create` seeds "Asosiy"; `company.Location`; `Member.Locations`; `MemberLocations`

**Files:** Modify `backend/internal/company/create.go`, `company.go`, `employees.go`, `members.go`; Create `backend/internal/company/locations.go`, `locations_test.go`; Modify `company_test.go`, `employees_test.go`.

- [ ] **Test:**
  - `company_test.go` `TestCreateSeedsTheReadyLocation`: yangi kompaniyada bitta lokatsiya "Asosiy".
  - `employees_test.go` `TestMembersTellTheirLocations`: egasi `AllLocations` true, `Locations` nil; cheklangan xodim `AllLocations` false, `Locations` [Chilonzor] (jonli); hamma lokatsiyasi o'chirilgan xodim `Locations` bo'sh, nil emas; `RenameEmployee` javobi ham (`member()`).
  - `locations_test.go` `TestMemberLocations`: egasi hammasi (ID tartibida, o'chirilgansiz), cheklangan faqat o'ziniki, a'zo emas → bo'sh (xato emas).
  - `members_test`/`TestReplaceOwner` ga: cheklangan xodim egasi qilinsa `all_locations` true va `member_locations` qatorlari yo'q.
- [ ] **RED** → **Kod:**

```go
// company.go
// Location is a location of a company, as the app names it.
type Location struct {
	ID   int64
	Name string
}

// Member … + AllLocations bool (the member may work in every location; the
// owner always) and Locations []Location (the restriction's live locations,
// nil when AllLocations).

// locations.go
// MemberLocations is the locations the member with phone may work in: every
// live one for the owner and for a member without a restriction, the live
// ones of the restriction otherwise; none for someone who is not a member.
func (s *Service) MemberLocations(ctx context.Context, companyID int64, phone string) ([]Location, error)

// employees.go: Members → ListCompanyUsers + ListCompanyMemberLocations (bir so'rov, telefon bo'yicha guruh);
// member → GetCompanyMember + (AllLocations bo'lmasa) ListMemberLocations.
// create.go: SeedTaskSettings dan keyin q.SeedLocation(ctx, c.ID).
// members.go ReplaceOwner: SetCompanyOwner dan keyin q.DeleteMemberLocations (Task 2 ga qo'shiladi: DELETE FROM member_locations WHERE user_phone = $1 AND company_id = $2).
```

- [ ] **GREEN**, commit `feat(company): a company starts with "Asosiy"; the members tell their locations`.

### Task 4: `user.Access.LocationIDs`

**Files:** Modify `backend/internal/user/profiles.go`, `profiles_test.go`.

- [ ] **Test** `TestAccess` ga: egasi `LocationIDs` = kompaniyaning jonli lokatsiyalari; cheklangan xodim faqat o'ziniki; kompaniyada lokatsiya yo'q (test fixture'i `companies` ga to'g'ridan-to'g'ri yozadi, migratsiya seed'i unga tegmaydi) → bo'sh; mavjud holatlar `LocationIDs: []int64{}` bilan.
- [ ] **RED** → **Kod:** `Access.LocationIDs []int64` (`row.LocationIds`; nil bo'lsa bo'sh slice).
- [ ] **GREEN**, commit `feat(user): a member's standing tells the locations they may work in`.

### Task 5: `/app/me.locations`, `memberJSON.Locations` (app va admin)

**Files:** Modify `backend/internal/app/handler.go`, `employees.go`, `handler_test.go`, `employees_test.go`, `members_test.go`; `backend/internal/admin/json.go`, `companies_test.go`.

- [ ] **Test:**
  - `TestMe`: `locations` = `[{"id":…,"name":"Asosiy"}]` (kompaniya `addCompany` bilan yaratilgan: testda lokatsiya `api.addLocation(t, olma, "Asosiy")` bilan qo'shiladi; `handler_test.go` ga `addLocation` va `restrictTo` yordamchilari); kompaniya tanlanmagan sessiyada `[]`; cheklangan xodimda faqat o'ziniki.
  - `TestListEmployees`: egasi `locations` null; cheklangan xodim `[{id, name}]`.
  - `TestListMembers`: `locations` maydoni bor.
  - admin `TestGetCompany`: `owner["locations"]` null.
- [ ] **RED** → **Kod:** `locationJSON{ID, Name}`; `meJSON.Locations []locationJSON` (`h.companies.MemberLocations`); `memberJSON.Locations *[]locationJSON` (null = hammasi, bo'sh ro'yxat `[]`); admin `json.go` xuddi shunday.
- [ ] **GREEN**, commit `feat(app,admin): /app/me tells the member's locations; the members tell theirs`.

### Task 6: openapi va TS client

**Files:** Modify `backend/openapi.yaml`; generate `packages/api-client/src/schema.d.ts`; Modify `apps/web/lib/types.ts`, `apps/admin/lib/types.ts`.

- [ ] openapi: `Location {id, name}` sxemasi; `Me` + `locations` (required); `Member` + `locations` (`type: [array, "null"]`, required); `/app/me` izohi. `make api-client`. Contract testi (`internal/httpx/openapi_test.go`) o'tadi (yangi route yo'q).
- [ ] `apps/web/lib/types.ts`: `export type Location = components["schemas"]["Location"]`; admin: `Location`.
- [ ] `pnpm typecheck` yiqilgan joylar (fixture'lar): keyingi task'larda tuzatiladi.
- [ ] commit `feat(api): the locations in the contract`.

### Task 7: Web va admin mock'lari

**Files:** Modify `apps/web/mocks/data.ts`, `apps/web/mocks/handlers.ts`, `apps/web/mocks/handlers.test.ts`; Create `apps/web/test/locations.ts`; Modify `apps/admin/mocks/data.ts`, `apps/admin/components/companies/company-page.test.tsx`; `/app/me` fixture'lari bo'lgan web testlar (`pnpm typecheck` ko'rsatganlari).

- [ ] **Test** (`handlers.test.ts`):
  - "/app/me tells the member's locations: the company's for the owner, the restriction's for a restricted employee, none before a company": Vali Olma Savdo'ga kirganda (xodim) `locations` = [Asosiy]; `addLocation(1, "Chilonzor")` va `restrictTo(VALI, 1, [chilonzor.id])` → Vali `[Chilonzor]`, Ali (egasi) `[Asosiy, Chilonzor]`; kompaniyasiz `[]`.
  - "/app/employees and /app/members tell each member's locations: null for every one": egasi null, Vali cheklangach `[{id, name: "Chilonzor"}]`.
- [ ] **RED** → **Kod:** `LocationRow {id, companyId, name, deleted?}`, `db.locations` (har kompaniyaga "Asosiy", `seedSettings` ichida), `Membership.locationIds?: number[]`, `locationsOf(phone, companyId): Location[]` (jonli, ID tartibida, Go `ListMemberLocations` qoidasi), `membersOf` → `locations: m.locationIds === undefined ? null : locationsOf(phone, companyId)`, `/app/me` → `locations`; `test/locations.ts`: `addLocation(companyId, name): LocationRow`, `restrictTo(phone, companyId, ids: number[] | null)`. Admin: `member()` ga `locations: null`, `company-page.test.tsx` fixture.
- [ ] **GREEN**: `pnpm test`, `pnpm typecheck`, `pnpm lint`; commit `feat(web,admin): the mock API tells the members' locations`.

### Task 8: Yakun

- [ ] `make lint`, `make test`, `make e2e` toza. Spec'ga "1-bosqich qarorlari" bo'limi (amalga oshirishda belgilangan tafsilotlar, test sonlari). Commit `docs: the decisions of stage 1 of the locations work`.
