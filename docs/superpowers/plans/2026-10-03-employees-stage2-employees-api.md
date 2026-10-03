# Xodimlar, 2-bosqich: xodimlar API va kirish qoidalari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner user app API'si orqali xodim qo'shadi, ismini tahrirlaydi va o'chiradi; tizimga faqat kamida bitta kompaniyaga a'zo user kiradi; a'zolik va rol har so'rovda bazadan tekshiriladi.

**Architecture:**
- **Kirish:** `UserExists` (users'da bor) o'rniga `HasCompany` (a'zoligi bor): SMS, verify, Mini App, user bot. `Refresh` a'zoligi qolmagan sessiyani tugatadi.
- **Har so'rovda:** `requireSubscription` o'rniga `requireAccess`: bitta so'rov (`GetCompanyAccess`) a'zolik, rol va obunani o'qiydi. A'zo emas → 401 `unauthorized` (client o'zi refresh qiladi), obuna → 402, rol context'ga. `requireOwner` → 403 `owner_only`.
- **Xodimlar:** `company.Service` ga `Members`, `AddEmployee`, `RenameEmployee`, `RemoveEmployee`; `/app/employees` (GET, POST, PATCH, DELETE). Kompaniya ID doim access token'dan.

**Tech Stack:** Go 1.27 (chi, pgx, sqlc), Vitest + MSW (web mock'i).

Qoidalar: `logic/user.md` (3, 5, 6, 7-bo'limlar), `logic/roles.md` (4, 6-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`.

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`.
- sqlc so'rovi uchun RED: bir xil parametrli, ishlamaydigan stub → `make sqlc` → test mantiq bo'yicha yiqiladi → haqiqiy SQL.
- TDD jurnali: `$SCRATCH/tdd-log.md`. Har GREEN'dan keyin `GOTEST ./...` va commit.
- Har yangi route bilan bir siklda `openapi.yaml` ham yangilanadi (contract testi router = openapi ni talab qiladi).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/db/queries/users.sql` | + `HasCompany`, `GetCompanyAccess`, `RenameCompanyUser`, `RemoveCompanyUser`; `UserExists` o'chadi |
| `backend/internal/db/queries/companies.sql` | `IsCompanySubscriptionActive` o'chadi |
| `backend/internal/db/{users,companies}_test.go` | so'rov testlari |
| `backend/internal/auth/user_auth.go` (+test) | `HasCompany`; `Refresh` a'zoliksiz sessiyani tugatadi |
| `backend/internal/user/contacts.go` (+test) | `HasCompany` |
| `backend/internal/user/profiles.go` (+test) | `Access`, `ErrNotMember`; `SubscriptionActive` o'chadi |
| `backend/internal/company/employees.go` (+`employees_test.go`) | yangi: `Members`, `AddEmployee`, `RenameEmployee`, `RemoveEmployee` |
| `backend/internal/company/detail.go` | `Get` `Members` ni ishlatadi |
| `backend/internal/app/session.go` | `requireAccess`, `requireOwner`, `currentRole` |
| `backend/internal/app/employees.go` (+`employees_test.go`) | yangi: to'rtta handler, `memberJSON` |
| `backend/internal/app/handler.go` | `Services.Companies`, route'lar |
| `backend/cmd/api/main.go` | bitta `company.NewService(pool)` admin va app'ga |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | `/app/employees`, `RenameMember`, `OwnerOnly`, kirish tavsiflari |
| `apps/web/mocks/handlers.ts`, `apps/web/lib/api.test.ts` | mock kirish qoidalarini API kabi qiladi |
| `README.md` | Mini App: "kamida bitta kompaniyaga a'zo" |

---

### Task 1: Kirish = kamida bitta a'zolik (6 sikl)

- [ ] **A1 `HasCompany`** (db). RED `TestHasCompany`: a'zoligi bor user → `true`; a'zoliksiz user → `false`; notanish raqam → `false`. Stub (eski `UserExists` tanasi): a'zoliksiz userda `true` chiqadi. GREEN:
```sql
-- name: HasCompany :one
-- Whether the phone is a member of at least one company: only such a user
-- may sign in.
SELECT EXISTS (SELECT 1 FROM user_companies WHERE user_phone = $1);
```
  Commit: `feat(db): HasCompany query`
- [ ] **A2 `SendCode`**. RED `TestSendCodeToAUserOfNoCompanySendsNothing`: `users` da bor, a'zoligi yo'q → SMS ketmaydi, kod baribir saqlanadi. Hozir: SMS ketadi. GREEN: `SendCode` da `HasCompany`. SMS kutgan mavjud testlarda userga kompaniya beriladi (`addOwner` yordamchisi). Commit: `feat(auth): no code is texted to a user of no company`
- [ ] **A3 `Verify`**. RED `TestVerifyGivesAUserOfNoCompanyNothing`: to'g'ri kod bilan ham `ErrInvalidCode`. Hozir: kompaniyasiz token beriladi. GREEN: `Verify` da `HasCompany`. `signIn(…, nil)` ishlatgan testlar kompaniya oladi. Commit: `feat(auth): a user of no company cannot sign in with a code`
- [ ] **A4 `LoginWithTelegram`**. RED `TestLoginWithTelegramForAUserOfNoCompany`: `NoAccessError{Phone}`. Hozir: kiradi. GREEN: `HasCompany`. Mini App testlaridagi userlar kompaniya oladi (`app/telegram_test.go`). Commit: `feat(auth): the Mini App refuses a user of no company`
- [ ] **A5 `Contacts.Save`**. RED `TestSaveLinksAChatToAPhone`: a'zoligi bor → `true`; `users` da bor, a'zoliksiz → `false`. Hozir: a'zoliksiz ham `true`. GREEN: `HasCompany`. Keyin `UserExists` so'rovi va `TestUserExists` o'chadi (chaqiruvchi yo'q). Commit: `feat(user): the bot links an account only for a member of a company`
- [ ] **A6 `Refresh`**. RED `TestRefreshEndsTheSessionOfAUserWithNoCompanyLeft`: a'zolik o'chgach `Refresh` → `ErrInvalidRefresh`, jonli refresh token qolmaydi. Hozir: kompaniyasiz token beriladi. GREEN:
```go
// A user of no company may not sign in, so the session ends with the last
// membership: the token stays revoked and no new one is issued.
member, err := q.HasCompany(ctx, revoked.UserPhone)
if err != nil { return err }
if !member { ended = true; return nil }
```
  va tranzaksiyadan keyin `if ended { return Tokens{}, ErrInvalidRefresh }`. `TestRefreshFollowsTheMembershipAsItIsNow` da userga ikkinchi kompaniya beriladi (bittasidan chiqsa sessiya qoladi). Commit: `feat(auth): a session ends when its user has no company left`

---

### Task 2: A'zolik va rol har so'rovda bazadan (4 sikl)

- [ ] **B1 `GetCompanyAccess`** (db). RED `TestGetCompanyAccess`: faol kompaniya a'zosi → `(role, true)`; muddati o'tgan va bloklangan → `false`; a'zo emas va yo'q kompaniya → `pgx.ErrNoRows`. Stub `… AND false` → `no rows`. GREEN:
```sql
-- name: GetCompanyAccess :one
-- A user's standing in a company, read on every request: the role there and
-- whether the subscription lets the company be used. pgx.ErrNoRows when the
-- user is not its member.
SELECT uc.role, (c.end_date >= CURRENT_DATE AND c.is_active)::boolean AS active
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;
```
  Commit: `feat(db): GetCompanyAccess query`
- [ ] **B2 `Profiles.Access`**. RED `TestAccess` (table): owner faol → `{owner, true}`; `user` muddati o'tgan → `{user, false}`; bloklangan → `false`; a'zo emas → `ErrNotMember`. Stub `return Access{}, errors.New("not implemented")`. GREEN:
```go
type Access struct { Role string; Active bool }
var ErrNotMember = errors.New("not a member of the company")
func (p *Profiles) Access(ctx context.Context, phone string, companyID int64) (Access, error)
```
  Commit: `feat(user): a member's access to a company: role and subscription`
- [ ] **B3 `requireAccess`**. RED `TestAMemberTakenOutOfTheCompanyIsTurnedAwayAtOnce` (`app/handler_test.go`): a'zolik o'chirilgach eski access token bilan `GET /app/me` → 401 `{"error":"unauthorized",…}`. Hozir: 200. GREEN: `session.go` da `requireSubscription` → `requireAccess` (`Access`: `ErrNotMember` → `unauthorized(w)`; `!Active` → 402; rol `accessKey{}` bilan context'ga), `currentRole(ctx)`. Keyin `Profiles.SubscriptionActive`, `IsCompanySubscriptionActive` va ularning testlari o'chadi. Commit: `feat(app): membership is checked on every request`
- [ ] **B4** xarakteristika: mavjud 402 testlari va "kompaniya tanlanmagan token tekshirilmaydi" o'tishda davom etadi (`GOTEST ./internal/app/`).

---

### Task 3: `company` servisi: xodimlar (7 sikl)

```go
var (
	errAlreadyMember    = apperr.New(apperr.Conflict, "already_member", "Bu raqam kompaniyangizga allaqachon qo'shilgan")
	errOwnerProtected   = apperr.New(apperr.Conflict, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi")
	errEmployeeNotFound = apperr.New(apperr.NotFound, "not_found", "Xodim topilmadi")
)

func (s *Service) Members(ctx context.Context, companyID int64) ([]Member, error)
func (s *Service) AddEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error)
func (s *Service) RenameEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error)
func (s *Service) RemoveEmployee(ctx context.Context, companyID int64, phone string) error
```

- [ ] **C1 `Members`**. RED `TestMembers`: owner birinchi, keyin xodimlar qo'shilgan tartibda, shu kompaniyadagi ismlari bilan; boshqa kompaniya a'zolari yo'q. Stub `return nil, errors.New("not implemented")`. GREEN: `ListCompanyUsers` → `[]Member`; `Get` shuni ishlatadi. Commit: `feat(company): list a company's members`
- [ ] **C2 `AddEmployee`**. RED `TestAddEmployee`: `("90 222 33 44", " Vali ")` → `Member{998902223344, "Vali", "user"}`; `users` da "Vali" bilan yaratiladi. Stub. GREEN (tranzaksiyasiz, C4 talab qiladi): `NormalizePhone` → `UpsertUser` → `AddCompanyUser{Role: "user"}`. Commit: `feat(company): an owner's employee joins as a user`
- [ ] **C3 `AddEmployee` rad etishlar**. RED `TestAddEmployeeRefusals`: owner'ning o'z raqami va mavjud xodim → `Conflict` `already_member`, ism va rol o'zgarmaydi; `12ab` → `Invalid` "Telefon raqami noto'g'ri"; bo'sh ism → `Invalid` "Ismni kiriting". Hozir: `pgx.ErrNoRows` va xom xatolar. GREEN: `invalid(…)`, `ErrNoRows` → `errAlreadyMember`. Commit: `feat(company): AddEmployee refuses a member, a bad phone and no name`
- [ ] **C4 atomiklik**. RED `TestAddEmployeeIsAtomic`: `pgtest.FailInserts(user_companies)` → `users` da yangi raqam qolmaydi. Hozir: qoladi. GREEN: `pgx.BeginFunc`. Commit: `feat(company): AddEmployee is one transaction`
- [ ] **C5 multi-user** (xarakteristika, o'tishi kutiladi): `TestAddEmployeeWhoWorksInAnotherCompany`: boshqa kompaniya owner'i xodim bo'lib qo'shiladi → natija yangi raqamdagidek (kiritilgan ism, `user`); `users.full_name` va boshqa kompaniyadagi a'zolik o'zgarmaydi; userning a'zoliklari 2 ta. Mutatsiya bilan tekshiriladi. Commit: `test(company): an employee who works in another company becomes a user of both`
- [ ] **C6 `RenameEmployee`**. Avval so'rov (db): RED `TestRenameCompanyUser`: `user` ismi o'zgaradi; owner → `pgx.ErrNoRows`, ismi o'zgarmaydi; boshqa kompaniyadagi ismi o'zgarmaydi. Stub `… AND false`. GREEN:
```sql
-- name: RenameCompanyUser :one
-- Changes the name a user goes by in the company. No row for the owner (the
-- app never touches the owner) and for someone who is not a member.
UPDATE user_companies SET full_name = $3
WHERE user_phone = $1 AND company_id = $2 AND role = 'user'
RETURNING *;
```
  Keyin servis: RED `TestRenameEmployee`: ism almashadi; owner → `Conflict` `cannot_change_owner`; a'zo emas va noto'g'ri raqam → `NotFound` "Xodim topilmadi"; bo'sh ism → `Invalid`. Stub. GREEN: so'rov; qator qaytmasa `GetUserCompany` bilan sabab (owner → 409, aks holda 404). Commit'lar: `feat(db): RenameCompanyUser query`, `feat(company): rename an employee`
- [ ] **C7 `RemoveEmployee`**. So'rov: RED `TestRemoveCompanyUser`: `user` a'zoligi o'chadi, `users` qatori va boshqa kompaniyadagi a'zoligi qoladi; owner → `pgx.ErrNoRows`. GREEN:
```sql
-- name: RemoveCompanyUser :one
-- Takes a user out of the company; the user and their other companies stay.
-- No row for the owner and for someone who is not a member.
DELETE FROM user_companies
WHERE user_phone = $1 AND company_id = $2 AND role = 'user'
RETURNING user_phone;
```
  Servis: RED `TestRemoveEmployee`: o'chadi; owner → `cannot_change_owner`; a'zo emas → `NotFound`. Commit'lar: `feat(db): RemoveCompanyUser query`, `feat(company): remove an employee`

---

### Task 4: `/app/employees` (6 sikl)

`app.Services{Auth, Profiles, Companies}`; `memberJSON{phone, full_name, role, created_at}`; kompaniya `currentUser(ctx).CompanyID` dan. Testlar `internal/app/employees_test.go`, `newTestAPI` `Companies: company.NewService(pool)` oladi.

- [ ] **D1 faqat owner**. RED: openapi'ga `GET /app/employees` (200 `Member[]`, 401, 402, 403 `OwnerOnly`). `TestEmployeesAreForTheOwnerOnly`: `user` sessiyasi → 403 `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`; kompaniya tanlanmagan sessiya → 403; token'siz → 401; owner → 200. Hozir: 404 + contract testi. GREEN: `requireOwner`, route, `listEmployees`. Commit: `feat(app): GET /app/employees, for the owner only`
- [ ] **D2 ro'yxat mazmuni** (D1'da handler bo'sh massiv qaytarsa RED, aks holda xarakteristika): `TestListEmployees`: owner birinchi, maydonlar `phone, full_name, role, created_at`, faqat shu kompaniya. Commit: `test(app): the employees list is the company's members, the owner first`
- [ ] **D3 `POST`**. RED: openapi `POST /app/employees` (`MemberInput` → 201 `Member`, 400, 409 `Conflict`). `TestAddEmployee`: 201 `{phone, full_name, role: "user"}`; ro'yxatda paydo bo'ladi. `TestAddEmployeeRefusals`: o'z raqami → 409 `already_member`; `12ab` → 400; `user` sessiyasi → 403. GREEN: `addEmployee`. Commit: `feat(app): POST /app/employees adds an employee`
- [ ] **D4 multi-user oqimi** (xarakteristika): `TestAnEmployeeAddedByAnotherCompanyChoosesACompanyAtLogin`: Nok owner'i Olma owner'ining raqamini xodim qiladi → javob yangi raqamdagidek; u qayta kirganda `company_id: null`, `/app/me` da 2 ta kompaniya, har birida o'z ismi. Commit: `test(app): a phone added by a second company signs in to choose between them`
- [ ] **D5 `PATCH`**. RED: openapi `PATCH /app/employees/{phone}` (`RenameMember {full_name}` → 200 `Member`, 400, 404, 409). `TestRenameEmployee`: 200, ro'yxatda yangi ism; owner → 409 `cannot_change_owner`; yo'q raqam va boshqa kompaniya xodimi → 404 `{"error":"not_found","message":"Xodim topilmadi"}`; bo'sh ism → 400. GREEN: `renameEmployee`. Commit: `feat(app): PATCH /app/employees/{phone} renames an employee`
- [ ] **D6 `DELETE`**. RED: openapi `DELETE /app/employees/{phone}` (204, 404, 409). `TestRemoveEmployee`: 204, ro'yxatdan yo'qoladi; owner → 409; yo'q → 404. GREEN: `removeEmployee`. Keyin xarakteristika: `TestARemovedEmployeeIsOutAtOnce` (eski access token → 401 `unauthorized`; refresh → 401 `invalid_refresh_token`; `sms/send` → 200, SMS yo'q), `TestARemovedEmployeeKeepsTheirOtherCompanies` (refresh → 200, `company_id: null`, `/app/me` da qolgan kompaniya), `TestTheRoleIsReadAfreshOnEveryRequest` (egasi almashgach eski owner'ning eski token'i → 403, yangi owner'niki → 200). Commit'lar: `feat(app): DELETE /app/employees/{phone} removes an employee`, `test(app): removal and a change of owner take effect at once`

---

### Task 5: `main.go`, openapi tavsiflari, API client

- [ ] `cmd/api/main.go`: `companies := company.NewService(pool)` admin va app'ga. `go build ./...`.
- [ ] `openapi.yaml`: `sms/send`, `auth/telegram`, `Unauthorized` tavsiflarida "tizimda yo'q" → "hech bir kompaniyaga a'zo emas"; `/app/me` 401 tavsifi (a'zolik yo'qolsa). `make api-client`. Commit: `docs(api): who may sign in, and the employees API in the client`

---

### Task 6: Web mock API kabi (2 sikl)

`apps/web/lib/api.ts` o'zgarmaydi: testlar mavjud refresh oqimi yangi qoidani o'zi hal qilishini ko'rsatadi.

- [ ] **W1 RED** `lib/api.test.ts` "someone taken out of the company they work in goes on without it": Vali Olma Savdo'da ishlayapti → `db.members[VALI]` dan Olma olib tashlanadi → `call(api.GET("/app/me"))` → `company: null`, `companies` da faqat Nok Market, `accessToken()` `access:…:none:`. Hozir: token hali `:1:` (mock refresh'siz 200 qaytaradi). **GREEN** `mocks/handlers.ts`: `me` a'zolik yo'q bo'lsa 401 `unauthorized`; `refresh` a'zolikni qayta tekshiradi (yo'q bo'lsa kompaniyasiz). Commit: `test(web): the mock API checks membership on every request`
- [ ] **W2 RED** "someone taken out of their only company is signed out": Ali'ning yagona a'zoligi o'chadi → `call` 401 `unauthorized`, `accessToken()` null; keyin `sms/send` 200, lekin kod qo'yilmaydi (verify `invalid_code`). Hozir: 200. **GREEN**: mock `refresh` a'zoliksiz userga `invalid_refresh_token`; `sms/send`, `sms/verify`, `auth/telegram` "kamida bitta kompaniya" bo'yicha. Commit: `test(web): the mock API signs in only members of a company`

---

### Task 7: Bosqich yakuni

- [ ] `README.md`: Mini App bandida "raqam `users` jadvalida bo'lsa" → "kamida bitta kompaniyaga a'zo bo'lsa".
- [ ] Dizayn hujjatiga "2-bosqich qarorlari".
- [ ] `make lint` → `make test` → `make e2e`; real stack'da curl bilan tekshiruv (qo'shish, tahrirlash, o'chirish).
- [ ] `git push origin main`, hisobot (RED → GREEN), tasdiq.

## Self-review

- Spec qamrovi (2-bosqich): `HasCompany` (T1), `Refresh` (T1 A6), `requireAccess` (T2), `requireOwner` + `/app/employees` to'rtta amal (T4), servis (T3), openapi + client (T4, T5), web mock (T6). Web mock'dagi `/app/employees` handler'lari va a'zolik ismlari 4-bosqichda, sahifa testlari ularni talab qilganda yoziladi.
- Nomlar izchil: `HasCompany`, `GetCompanyAccess`, `RenameCompanyUser`, `RemoveCompanyUser`, `Profiles.Access`, `user.ErrNotMember`, `requireAccess`, `requireOwner`, `currentRole`, `Members`, `AddEmployee`, `RenameEmployee`, `RemoveEmployee`, `memberJSON`, `RenameMember`, `OwnerOnly`.
