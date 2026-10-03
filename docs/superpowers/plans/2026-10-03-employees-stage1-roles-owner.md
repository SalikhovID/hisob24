# Xodimlar, 1-bosqich: rollar, bitta owner, a'zolik ismi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rollar `owner` / `user` ga o'tadi, har kompaniyada bitta owner bo'ladi, ism a'zolikda saqlanadi, admin paneldagi "User qo'shish" o'rniga "Egasini almashtirish" keladi.

**Architecture:**
- **Baza:** migratsiya `00004` rol CHECK'ini almashtiradi, `user_companies.full_name` ni qo'shadi va `(company_id) WHERE role = 'owner'` unique indeksini qo'yadi. Mavjud a'zolar: har kompaniyada eng birinchi owner qoladi, qolganlari `user`.
- **Backend:** `company.Create` owner a'zoligini ism bilan yozadi. `company.ReplaceOwner` (kompaniya qatori lock, bitta transaction) `AddUser` o'rniga keladi. `PUT /admin/companies/{id}/owner` eski `POST …/users` o'rniga. `/app/me` tanlangan kompaniyadagi ismni beradi.
- **Frontend:** admin'da `ReplaceOwnerDialog`; ikkala ilovada rol nomlari `Egasi` / `Xodim`.

**Tech Stack:** Go 1.27 (pgx, sqlc, goose), Next 16, Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/roles.md`, `logic/user.md`. Dizayn: `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. Bu `.env` dagi `TEST_DATABASE_URL` ni beradi.
- sqlc so'rovi uchun RED: avval haqiqiy so'rov bilan bir xil parametrli, lekin ishlamaydigan stub yoziladi (`… WHERE false`), `make sqlc`, test mantiq bo'yicha yiqiladi. Keyin haqiqiy SQL, `make sqlc`, GREEN.
- TDD jurnali: `$SCRATCH/tdd-log.md` (har sikl uchun RED va GREEN chiqishi). Bosqich hisoboti shundan yoziladi.
- Har GREEN'dan keyin butun paket, keyin `GOTEST ./...` (frontend'da `pnpm --filter <ilova> test`), so'ng commit: Conventional Commits, inglizcha.
- Bosqich davomida `openapi.yaml` va frontend vaqtincha mos kelmasligi mumkin; push faqat oxirida, hammasi yashil bo'lganda.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00004_roles_owner_user.sql` | yangi |
| `backend/migrations/migrations_test.go` | 5 ta yangi test |
| `backend/internal/db/queries/users.sql` | + `AddCompanyUser`, `SetCompanyOwner`, `DemoteCompanyOwner`; `ListCompanyUsers`, `ListUserCompanies` o'zgaradi; `UpsertCompanyUser` o'chadi |
| `backend/internal/db/queries/companies.sql` | + `LockCompany` |
| `backend/internal/db/gen/*` | `make sqlc` (qo'lda tahrirlanmaydi) |
| `backend/internal/db/{users,companies}_test.go` | so'rov testlari |
| `backend/internal/company/create.go` | owner a'zoligi ism bilan |
| `backend/internal/company/members.go` | `ReplaceOwner`; `AddUser` o'chadi |
| `backend/internal/company/company_test.go` | servis testlari |
| `backend/internal/user/profiles.go` (+test) | `Membership.FullName` |
| `backend/internal/app/handler.go` (+test) | `me`: kompaniyadagi ism |
| `backend/internal/admin/{companies,handler}.go` (+test) | `replaceCompanyOwner`, route |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `PUT …/owner`, `MemberInput`, `Role: [owner, user]` |
| `apps/admin/components/companies/replace-owner-dialog.tsx` | yangi (`add-user-dialog.tsx` o'chadi) |
| `apps/admin/components/companies/company-page.tsx` (+test) | tugma |
| `apps/admin/lib/{schemas,roles}.ts` (+test), `mocks/{data,handlers}.ts`, `e2e/companies.spec.ts` | rolsiz forma, yangi endpoint |
| `apps/web/lib/roles.ts`, `mocks/data.ts`, `components/select-company.test.tsx`, `e2e/login.spec.ts` | `Xodim` |

---

### Task 1: Migratsiya `00004_roles_owner_user.sql` (5 sikl)

Testlar `backend/migrations/migrations_test.go` ga. Yordamchilar (birinchi siklda qo'shiladi):

```go
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 // INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id
func sqlState(err error) string                                      // pgconn.PgError.Code yoki ""
func provider(t *testing.T, pool *pgxpool.Pool) *goose.Provider      // goose.NewProvider(goose.DialectPostgres, stdlib.OpenDBFromPool(pool), migrations.FS)
func rolesOf(t *testing.T, pool *pgxpool.Pool, companyID int64) map[string]string // user_phone → role
```

- [ ] **M1 RED** `TestRolesAreOwnerAndUser`: yangi DB'da `role = 'user'` qabul qilinadi; `'manager'` → SQLSTATE `23514`; rol berilmasa `user`. Hozir yiqiladi: `'user'` eski CHECK'ni buzadi (`23514`).
- [ ] **M1 GREEN** migratsiya:
```sql
-- +goose Up
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
UPDATE user_companies SET role = 'user' WHERE role IN ('manager', 'staff');
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'user'));

-- +goose Down
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'owner';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'manager', 'staff'));
```
  Rol nomlari o'zgargani uchun shu siklda: Go testlardagi `manager` / `staff` fixture'lari → `user` (`db/users_test.go`, `company/company_test.go`, `admin/companies_test.go`, `app/handler_test.go`, `auth/user_auth_test.go`, `user/profiles_test.go`); `company/members.go` da `roles = {owner, user}`, xabar "Rol owner yoki user bo'lishi kerak". `TestAddUser` ning "a'zo yangi rol oladi" qismi olib tashlanadi (bitta owner qoidasi bilan mos emas; rol almashishi 4-task'da `ReplaceOwner` da tekshiriladi).
  Commit: `feat(db): roles are owner and user`
- [ ] **M2 RED** `TestACompanyHasOneOwner`: bir kompaniyaga ikkinchi owner → `23505`; boshqa kompaniyaga owner → xatosiz. Hozir: ikkinchi owner qabul qilinadi.
- [ ] **M2 GREEN** Up oxiriga `CREATE UNIQUE INDEX user_companies_one_owner ON user_companies (company_id) WHERE role = 'owner';`, Down boshiga `DROP INDEX user_companies_one_owner;`. Commit: `feat(db): a company has one owner`
- [ ] **M3 RED** `TestTheRolesMigrationKeepsEachCompanysFirstOwner`: `DownTo(3)` → Olma'ga ikki owner (`created_at` farqli), undan oldin qo'shilgan `manager` va `staff`; Nok'ga faqat `staff` → `UpTo(4)`. Kutiladi: Olma'da eng birinchi **owner** `owner`, qolgan uchtasi `user`; Nok'da `user`. Hozir: `UpTo` yiqiladi (`could not create unique index`).
- [ ] **M3 GREEN** M1'dagi `UPDATE` o'rniga:
```sql
-- Each company keeps its first owner; every other member becomes a user.
UPDATE user_companies uc SET role = 'user'
WHERE uc.role <> 'owner' OR uc.user_phone <> (
    SELECT o.user_phone FROM user_companies o
    WHERE o.company_id = uc.company_id AND o.role = 'owner'
    ORDER BY o.created_at, o.user_phone LIMIT 1);
```
  Commit: `feat(db): the roles migration keeps each company's first owner`
- [ ] **M4 RED** `TestTheRolesMigrationNamesEachMemberAfterTheUser`: `DownTo(3)` → ismli va ismsiz user, a'zoliklar → `UpTo(4)` → `user_companies.full_name` = `users.full_name` (ismsizda NULL). Hozir: `column "full_name" does not exist`.
- [ ] **M4 GREEN** Up boshiga:
```sql
-- The name a member goes by in the company; it starts as the user's name.
ALTER TABLE user_companies ADD COLUMN full_name TEXT;
UPDATE user_companies uc SET full_name = u.full_name FROM users u WHERE u.phone = uc.user_phone;
```
  Down oxiriga `ALTER TABLE user_companies DROP COLUMN full_name;`. `make sqlc` (`gen.UserCompany.FullName`). Commit: `feat(db): a member has a name of their own in each company`
- [ ] **M5 RED** `TestTheRolesMigrationDownBringsTheOldRolesBack`: owner va `user` a'zo → `DownTo(3)` → rollar `owner` / `staff`; `manager` va ikkinchi owner yana qabul qilinadi; `full_name` ustuni yo'q (`42703`). Hozir: `DownTo` yiqiladi (`check constraint … is violated by some row`).
- [ ] **M5 GREEN** Down'da eski CHECK'dan oldin `UPDATE user_companies SET role = 'staff' WHERE role = 'user';`. Commit: `feat(db): the roles migration can be undone`

---

### Task 2: So'rovlar (4 sikl)

Testlar `internal/db/users_test.go` va `companies_test.go` da. `addMember` yordamchisi Q1'dan keyin `AddCompanyUser` ga o'tadi.

- [ ] **Q1 `AddCompanyUser`**. RED `TestAddCompanyUser`: a'zo rol va ism bilan qo'shiladi; ikkinchi marta `pgx.ErrNoRows`, rol va ism o'zgarmaydi; `boss` roli → `23514`. Stub: `INSERT … SELECT $1, $2, $3, $4 WHERE false RETURNING *` → `no rows in result set`. GREEN:
```sql
-- name: AddCompanyUser :one
-- Adds a member with a role and the name they go by in the company. No row
-- (pgx.ErrNoRows) when the user is a member already: nothing changes.
INSERT INTO user_companies (user_phone, company_id, role, full_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_phone, company_id) DO NOTHING
RETURNING *;
```
  Commit: `feat(db): AddCompanyUser query`
- [ ] **Q2 `SetCompanyOwner`**. RED `TestSetCompanyOwner`: a'zo bo'lmagan user owner bo'ladi; `user` a'zo owner'ga ko'tariladi va yangi ism oladi (`created_at` o'zgarmaydi, a'zolik bitta); boshqa owner turganda → `23505`. Stub `… WHERE false` → `no rows`. GREEN:
```sql
-- name: SetCompanyOwner :one
-- Makes the user the company's owner under full_name, a member or not. The
-- owner before has to be demoted first: a company has one owner.
INSERT INTO user_companies (user_phone, company_id, role, full_name)
VALUES ($1, $2, 'owner', $3)
ON CONFLICT (user_phone, company_id) DO UPDATE SET role = 'owner', full_name = EXCLUDED.full_name
RETURNING *;
```
  Commit: `feat(db): SetCompanyOwner query`
- [ ] **Q3 `DemoteCompanyOwner`**. RED `TestDemoteCompanyOwner`: kompaniya owner'i `user` bo'ladi, boshqa kompaniya owner'i o'zgarmaydi. Stub `… AND false` → `expected "user", actual "owner"`. GREEN: `UPDATE user_companies SET role = 'user' WHERE company_id = $1 AND role = 'owner';` (`:exec`). Commit: `feat(db): DemoteCompanyOwner query`
- [ ] **Q4 `LockCompany`** (`companies.sql`). RED `TestLockCompany`: id qaytadi; yo'q kompaniya → `pgx.ErrNoRows`; tranzaksiya tugaguncha `FOR UPDATE NOWAIT` → `55P03`. Stub `FOR UPDATE` siz → `expected "55P03", actual ""`. GREEN: `SELECT id FROM companies WHERE id = $1 FOR UPDATE;` (`:one`). Commit: `feat(db): LockCompany query`

---

### Task 3: `company.Create` owner a'zoligini ism bilan yozadi (1 sikl)

- [ ] **RED** `TestCreate` kengayadi: owner a'zoligining `full_name` = "Ali Valiyev"; ikkinchi kompaniya shu raqam va "Boshqa Ism" bilan yaratilsa, `users.full_name` "Ali Valiyev" qoladi, lekin shu kompaniyadagi a'zolik ismi "Boshqa Ism". Hozir: a'zolik ismi NULL.
- [ ] **GREEN** `create.go`: `q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: phone, CompanyID: c.ID, Role: "owner", FullName: &ownerName})`. Commit: `feat(company): the owner's membership carries the name`

---

### Task 4: `company.ReplaceOwner` (6 sikl)

```go
// ReplaceOwner makes the user with phone the company's owner under fullName,
// in one transaction; the owner before stays in the company as a user. A
// phone that is no user yet becomes one; the owner's own phone only gets the
// new name.
func (s *Service) ReplaceOwner(ctx context.Context, companyID int64, phone, fullName string) (Member, error)
```

Test yordamchisi: `rolesOf(t, pool, companyID) map[string]string`, `nameIn(t, pool, companyID, phone) string`.

- [ ] **R1 RED** `TestReplaceOwner`: `ReplaceOwner(c, "90 222 33 44", " Yangi Egasi ")` → `Member{Phone: "998902223344", FullName: "Yangi Egasi", Role: "owner"}`; rollar `{998900000001: user, 998902223344: owner}`; eski owner ismi "Egasi" qoladi. Stub `return Member{}, errors.New("not implemented")`.
- [ ] **R1 GREEN** tx: `GetCompany` → `UpsertUser` → `DemoteCompanyOwner` → `SetCompanyOwner`. Commit: `feat(company): replace a company's owner`
- [ ] **R2** `TestReplaceOwnerPromotesAMember` (xarakteristika testi, R1 kodi bilan o'tishi kutiladi; o'tmasa RED sifatida tuzatiladi): `user` a'zo owner bo'ladi, ismi kiritilganiga almashadi, a'zoliklar soni 2 ta qoladi. `TestReplaceOwnerWithTheOwnersOwnPhone`: rol `owner` qoladi, faqat ism yangilanadi. `TestReplaceOwnerWithAUserOfAnotherCompany`: `users.full_name` va boshqa kompaniyadagi a'zolik o'zgarmaydi. Commit: `test(company): replacing the owner with a member, the owner and a user of another company`
- [ ] **R3 RED** `TestReplaceOwnerRefusals` (table): noma'lum kompaniya → `NotFound`; `12ab` → `Invalid` "Telefon raqami noto'g'ri"; bo'sh ism → `Invalid` "Ismni kiriting"; rad etilganda rollar o'zgarmaydi. **GREEN**: validatsiya, `pgx.ErrNoRows` → `errNotFound`. Commit: `feat(company): ReplaceOwner refuses a bad phone, no name and an unknown company`
- [ ] **R4 RED** `TestReplaceOwnerIsAtomic`: `pgtest.FailInserts(t, pool, "user_companies")` → xato; eski owner hali `owner`; yangi raqam `users` da yo'q. (R1 tx ichida bo'lsa darhol o'tadi: unda mutatsiya bilan tekshiriladi, ya'ni tx'siz variantda yiqilishi ko'rsatiladi.) Commit: `test(company): ReplaceOwner is atomic`
- [ ] **R5 RED** `TestReplaceOwnerWaitsForAnotherChangeOfTheSameCompany`:
```go
other, err := pool.Begin(ctx) // boshqa almashtirish: kompaniyani ushlab turibdi va o'z owner'ini qo'ygan
_, err = other.Exec(ctx, "SELECT id FROM companies WHERE id = $1 FOR UPDATE", c.ID)
_, err = other.Exec(ctx, "UPDATE user_companies SET role = 'user' WHERE company_id = $1", c.ID)
_, err = other.Exec(ctx, "INSERT INTO users (phone) VALUES ('998903333333')")
_, err = other.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ('998903333333', $1, 'owner', 'Oraliq Egasi')", c.ID)
go func() { m, err := s.ReplaceOwner(ctx, c.ID, "998902223344", "Yangi Egasi"); replaced <- result{m, err} }()
pgtest.WaitForLockWait(t, pool)
require.NoError(t, other.Commit(ctx))
got := <-replaced
require.NoError(t, got.err)
assert.Equal(t, map[string]string{"998900000001": "user", "998903333333": "user", "998902223344": "owner"}, rolesOf(t, pool, c.ID))
```
  Hozir: `duplicate key value violates unique constraint "user_companies_one_owner"` (lock yo'q, demote oraliq owner'ni ko'rmaydi).
- [ ] **R5 GREEN** `GetCompany` o'rniga `LockCompany`. Commit: `feat(company): owner replacements of one company take turns`

---

### Task 5: `PUT /admin/companies/{id}/owner` (2 sikl)

- [ ] **H1 RED**: `openapi.yaml` da `POST /admin/companies/{id}/users` o'rniga `PUT /admin/companies/{id}/owner` (`operationId: replaceCompanyOwner`, body `MemberInput {phone, full_name}`, 200 `Member`, 400 / 401 / 404); `AddMember` → `MemberInput`; `Role: [owner, user]`. `admin/companies_test.go`: `TestReplaceCompanyOwner`:
  - `PUT …/owner {"phone":"90 222 33 44","full_name":"Yangi Egasi"}` → 200, `{phone: "998902223344", full_name: "Yangi Egasi", role: "owner"}`;
  - `GET /admin/companies/{id}` → `users` da ikkita a'zo, eski owner `user`;
  - bo'sh ism → 400 `{"error":"validation_error","message":"Ismni kiriting"}`; `/admin/companies/999999/owner` → 404; cookie'siz → 401.

  Hozir: handler testi 405, contract testi (`TestRouterServesExactlyTheDocumentedAPI`) ro'yxatlar farqi bilan yiqiladi.
- [ ] **H1 GREEN** `admin/companies.go`: `replaceCompanyOwner` (`companyID` → `DecodeJSON` → `h.companies.ReplaceOwner` → `httpx.JSON(200, toMemberJSON(m))`); `handler.go`: `r.Put("/companies/{id}/owner", h.replaceCompanyOwner)`, eski route va `addCompanyUser` o'chadi. Commit: `feat(admin): PUT /admin/companies/{id}/owner replaces the owner`
- [ ] **H2 tozalash** (o'lik kod): `company.AddUser`, `roles` xaritasi va `TestAddUser*`; `UpsertCompanyUser` so'rovi va `TestUpsertCompanyUser`; `TestAddCompanyUser` (admin). `TestGet` (company) xodimni SQL fixture bilan qo'shadi. `make sqlc`, `GOTEST ./...`. Commit: `refactor(company): drop AddUser, the admin panel sets only the owner`

---

### Task 6: A'zolar ro'yxati a'zolik ismi bilan, owner birinchi (1 sikl)

- [ ] **RED** `TestListCompanyUsers` (db): a'zolik ismi `users.full_name` dan farqli → a'zolik ismi qaytadi; owner xodimdan keyin qo'shilgan bo'lsa ham birinchi turadi. Hozir: `users.full_name` va `created_at` tartibi.
- [ ] **GREEN**
```sql
-- name: ListCompanyUsers :many
-- The company's members under the names they go by there, the owner first.
SELECT user_phone AS phone, full_name, role, created_at
FROM user_companies
WHERE company_id = $1
ORDER BY (role = 'owner') DESC, created_at, user_phone;
```
  `TestGet` (company): `ReplaceOwner` dan keyin yangi owner birinchi. Commit: `feat(db): members are listed by their name in the company, the owner first`

---

### Task 7: `/app/me` tanlangan kompaniyadagi ismni beradi (3 sikl)

- [ ] **P1 RED** `TestListUserCompanies` (db): har kompaniya uchun `FullName` shu kompaniyadagi ism. Stub: so'rovga `NULL::text AS full_name` → `expected "Ali (hisobchi)", actual nil`. **GREEN**: `uc.full_name`. Commit: `feat(db): a user's companies come with the name in each`
- [ ] **P2 RED** `TestGetIsTheUserAndTheirCompanies` (user): `Membership.FullName` (stub maydon, to'ldirilmagan). **GREEN**: `profiles.go` to'ldiradi. Commit: `feat(user): a membership carries the name in the company`
- [ ] **P3 RED** `app/handler_test.go`:
  - `TestMeNamesTheUserAsTheChosenCompanyDoes`: a'zolik ismi "Ali (hisobchi)" → `user.full_name` shu;
  - a'zolik ismi NULL bo'lsa `users.full_name`;
  - kompaniya tanlanmagan token → `users.full_name`.

  **GREEN** `me`: token kompaniyasi topilganda `m.FullName != nil` bo'lsa `body.User.FullName = m.FullName`. Commit: `feat(app): /app/me names the user as the chosen company does`

---

### Task 8: API client

- [ ] `make api-client` → `packages/api-client/src/schema.d.ts`. `pnpm --filter @hisob24/api-client test`. Commit keyingi task bilan birga (frontend typecheck shu yerdan boshlab yangi kontraktga qaraydi).

---

### Task 9: Admin panel: "Egasini almashtirish" (4 sikl)

- [ ] **F1 RED** `lib/schemas.test.ts`: `ownerSchema.parse({phone: "+998 90 222 33 44", full_name: " Yangi "})` → `{phone: "998902223344", full_name: "Yangi"}`; noto'g'ri raqam va bo'sh ism → `["Telefon raqami noto'g'ri", "Ismni kiriting"]` (rol haqida xabar yo'q). Hozir: `ownerSchema` yo'q, shuning uchun avval stub `export const ownerSchema = memberSchema` → "Rolni tanlang" ortiqcha chiqadi. **GREEN**: `ownerSchema` (rolsiz), `memberSchema` o'chadi; `lib/roles.ts`: `{owner: "Egasi", user: "Xodim"}`. Commit: `feat(admin): the owner form takes a phone and a name`
- [ ] **F2 RED** `components/companies/company-page.test.tsx`:
  - "the owner is replaced from the dialog and leads the list": "Egasini almashtirish" → dialog → Telefon `90 777 88 99`, Ism `Yangi Egasi` → "Almashtirish" → dialog yopiladi, toast "Kompaniya egasi almashtirildi", jadval: `[+998 90 777 88 99, Yangi Egasi, Egasi]`, `[+998 90 123 45 67, Ali Valiyev, Xodim]`, `[+998 90 222 33 44, Vali Aliyev, Xodim]`;
  - "the replace-owner dialog says what is missing".

  Hozir: tugma topilmaydi. **GREEN**: `mocks/handlers.ts` da `PUT /admin/companies/:id/owner` (API kabi: validatsiya, eski owner → `user`, mavjud a'zo ko'tariladi, ro'yxat owner birinchi), `mocks/data.ts` (`staff` → `user`); `replace-owner-dialog.tsx`; `company-page.tsx`. `add-user-dialog.tsx` va uning testlari o'chadi. Commit: `feat(admin): replace a company's owner from its page`
- [ ] **F3** `e2e/companies.spec.ts`: "User qo'shish" qadamlari o'rniga egasini almashtirish (yangi raqam ko'rinadi, eski owner "Xodim"). `pnpm --filter @hisob24/admin test:e2e`. Commit: `test(admin): e2e replaces a company's owner`

---

### Task 10: User app: rol nomlari (1 sikl)

- [ ] **RED** `components/select-company.test.tsx` va `e2e/login.spec.ts`: Vali Olma Savdo'da "Xodim" (oldin "Menejer"). Hozir: "Menejer". **GREEN**: `lib/roles.ts` `{owner: "Egasi", user: "Xodim"}`; `mocks/data.ts`: `manager` / `staff` → `user`, Anor Servis'da ikkinchi owner (Zarina) → `user`. Commit: `feat(web): the roles are Egasi and Xodim`

---

### Task 11: Bosqich yakuni

- [ ] `make lint` → `make test` → `make e2e`: hammasi toza.
- [ ] Dizayn hujjatiga "1-bosqich qarorlari" (amalga oshirishda aniqlangan tafsilotlar).
- [ ] `git push origin main`.
- [ ] Hisobot: har funksiya uchun RED → GREEN (`$SCRATCH/tdd-log.md` dan). Tasdiq kutiladi.

## Self-review

- Spec qamrovi (1-bosqich): migratsiya (T1), so'rovlar (T2, T6, T7), `Create` (T3), `ReplaceOwner` (T4), endpoint + openapi (T5), `/app/me` ismi (T7), api-client (T8), admin dialogi (T9), web rol nomlari (T10). `HasCompany`, `GetCompanyAccess`, `/app/employees`, sidebar keyingi bosqichlarda.
- Nomlar izchil: `AddCompanyUser`, `SetCompanyOwner`, `DemoteCompanyOwner`, `LockCompany`, `ReplaceOwner`, `replaceCompanyOwner`, `MemberInput`, `ownerSchema`, `ReplaceOwnerDialog`.
