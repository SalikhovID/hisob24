# Rollar, 2-bosqich: rollar API (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egasi API orqali kompaniya rollarini ko'radi, yaratadi, o'zgartiradi, o'chiradi (biriktirilgan rol o'chirilmaydi) va xodimga rol biriktiradi yoki olib tashlaydi; hammasi faqat egasiga (`owner_only`). openapi, TS client va web mock API shunga mos.

**Architecture:**
- **So'rovlar** `roles.sql`: `CreateRole`, `ListRoles` (a'zolar soni bilan, nom bo'yicha), `GetRole`, `UpdateRole`, `DeleteRole`, `CountRoleMembers`; `users.sql`: `SetCompanyUserRole` (`… AND role = 'user'`).
- **Servis** `internal/company/roles.go`: `Role{ID, Name, Permissions []access.Permission, MembersCount}`; `Roles`, `CreateRole`, `UpdateRole`, `DeleteRole` (tranzaksiya: 404 → 409 `role_in_use` → DELETE), `SetEmployeeRole` (tranzaksiya: rol kompaniyaniki 404 → `SetCompanyUserRole`, qator yo'q → `whyNotAnEmployee` → `member`). Nom `fields.CleanName`, takror `fields.Taken` → 409 `name_taken`, ruxsatlar `access.Parse`.
- **API** `internal/app/roles.go`: 5 handler, route'lar `requireOwner` ostida (`requireCompany`siz: kompaniyasiz token `owner_only`), `requireOwner` dagi `nolint` olib tashlanadi.
- **Kontrakt va mock:** openapi (`/app/roles`, `/app/roles/{id}`, `/app/employees/{phone}/role`; `CompanyRole`, `RoleInput`, `EmployeeRoleInput`; `RoleNotFound`, `RoleConflict`) → `make api-client`; web mock: `db.roles`, `Membership.roleId`, `mocks/roles.ts`, `permissionsOf` rol bilan, `role_name` / `role_id`; `lib/permissions.ts` `sectionLabels`.

**Tech Stack:** Go (chi, pgx, sqlc, testify, pgtest), openapi-typescript, MSW, Vitest.

Qoidalar: `logic/roles.md` (5, 7, 9, 10-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md` ("API", "Backend").

---

## Kelishuvlar

1-bosqichdagidek: `GOTEST` `.env` bilan; sqlc so'rovi uchun stub → `make sqlc` → RED → haqiqiy SQL; har GREEN'dan keyin commit (faqat o'z fayllari).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/db/queries/roles.sql` (yangi), `users.sql` (+`internal/db/roles_test.go`, `users_test.go`) | 7 so'rov |
| `backend/internal/company/roles.go` (+`roles_test.go`) | servis |
| `backend/internal/app/roles.go` (+`roles_test.go`), `handler.go`, `session.go` | handlerlar, route'lar |
| `backend/openapi.yaml`, `packages/api-client/src/schema.d.ts` | kontrakt |
| `apps/web/lib/permissions.ts` (+test), `mocks/data.ts`, `mocks/roles.ts` (yangi), `mocks/handlers.ts` (+`handlers.test.ts`) | mock API |

---

### Task 1: So'rovlar

```sql
-- name: CreateRole :one
INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3) RETURNING *;
-- name: ListRoles :many   (r.*, members_count; ORDER BY lower(r.name), r.id)
-- name: GetRole :one      (id, company_id; members_count)
-- name: UpdateRole :one   (SET name, permissions, updated_at = now() WHERE id AND company_id RETURNING *)
-- name: DeleteRole :one   (DELETE … RETURNING id)
-- name: CountRoleMembers :one
-- name: SetCompanyUserRole :one  (UPDATE user_companies SET role_id = sqlc.narg('role_id') WHERE user_phone AND company_id AND role = 'user' RETURNING *)
```

- [x] **Test** (`roles_test.go`): yaratish (ruxsatlar saqlanadi, bo'sh ro'yxat `{}`), ro'yxat nom bo'yicha katta-kichik harfsiz va `MembersCount`, `GetRole` begona kompaniya → `ErrNoRows`, `UpdateRole` (nom va ruxsatlar almashadi, `updated_at` o'sadi, begona → `ErrNoRows`, takror nom → 23505), `DeleteRole` (biriktirilgan → 23503; bo'sh → id), `CountRoleMembers`; (`users_test.go`) `SetCompanyUserRole`: xodimga rol, `nil` olib tashlaydi, egasi → `ErrNoRows`, a'zo emas → `ErrNoRows`, begona rol → 23503.
- [x] **RED** (stub) → **Kod** + `make sqlc` → **GREEN**, commit `feat(db): the company role queries`.

### Task 2: Servis

- [x] **Test** (`company/roles_test.go`): `Roles` (bo'sh, nom bo'yicha, soni), `CreateRole` (nom tozalanadi, ruxsatlar katalog tartibida; "Nomni kiriting", 60 belgi, `name_taken` katta-kichik harfsiz, `Parse` xatolari), `UpdateRole` (hammasi almashadi; 404; `name_taken`; o'z nomi qoladi), `DeleteRole` (bo'sh rol o'chadi va nomi bo'shaydi; biriktirilgan → `role_in_use` "Bu rol 1 ta xodimga biriktirilgan" va rol qoladi; 404), `SetEmployeeRole` (rol beriladi va `Member.RoleName` qaytadi; `nil` olib tashlaydi; egasi → `cannot_change_owner`; a'zo emas va noto'g'ri raqam → "Xodim topilmadi"; begona rol → "Rol topilmadi"; atomiklik shart emas: bitta UPDATE).
- [x] **RED** → **Kod** → **GREEN**, commit `feat(company): the company roles and the employee's role`.

### Task 3: Handlerlar va route'lar

- [x] **Test** (`app/roles_test.go`): `TestRolesAreTheOwners` (xodim, `employees.*` rolli xodim ham, va kompaniyasiz token → 403 `owner_only`; token yo'q 401); `TestRolesCRUD` (201 javob `{id, name, permissions, members_count: 0}`, ro'yxat, PUT 200, 409 `name_taken`, 400 "Ruxsat noto'g'ri" va "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang", 404 "Rol topilmadi", DELETE 204, yana 404, bo'lmagan JSON 400); `TestDeleteRoleInUse` (409 → olib tashlash → 204); `TestSetEmployeeRole` (200 `role_id`/`role_name`; xodimning `/app/me` `permissions` darhol rolniki; `null` → rolsiz; egasi 409 `cannot_change_owner`; begona raqam 404 "Xodim topilmadi"; begona kompaniya roli 404 "Rol topilmadi").
- [x] **Kod:** `roles.go` (`roleJSON`, `listRoles`, `createRole`, `updateRole`, `deleteRole`, `setEmployeeRole`), `handler.go` (`requireOwner` guruhi: `GET/POST /roles`, `PUT/DELETE /roles/{id}`, `PUT /employees/{phone}/role`), `session.go` (`nolint` olib tashlanadi).
- [x] **GREEN**, commit `feat(app): the roles API, the owner's alone`.

### Task 4: openapi, TS client, mock

- [x] **openapi:** 3 path, 3 sxema, `RoleNotFound` (404 "Rol topilmadi" / "Xodim topilmadi"), `RoleConflict` (409 `name_taken`, `role_in_use`), `OwnerOnly`; `make api-client`; contract testi.
- [x] **Web test** (`handlers.test.ts`): egasi rol yaratadi (`permissions` katalog tartibida, `members_count`), ro'yxat nom bo'yicha, o'zgartiradi, takror nom 409, noto'g'ri ruxsat 400 (ikki xabar), xodimga biriktiradi → xodimning `/app/me` `permissions` rolniki va `company.role_name`, `/app/employees` da `role_id`/`role_name`, biriktirilgan rol o'chirilmaydi 409 `role_in_use`, olib tashlangach 204; xodim rollar API'ga `owner_only`; kompaniyasiz `owner_only`; egasiga rol 409 `cannot_change_owner`. (`lib/permissions.test.ts`): `sectionLabels` to'rt bo'lim.
- [x] **Kod:** `lib/permissions.ts` `sectionLabels`; `data.ts` `RoleRow`, `db.roles`, `Membership.roleId`, `permissionsOf` rol bilan, `roleNameOf`, `rolesOf`, `toRole`, `companiesOf` / `membersOf` rol maydonlari; `mocks/roles.ts` (`parsePermissions` Go'dagidek, `cleanName`, 5 handler); `handlers.ts` `...rolesHandlers`.
- [x] **GREEN**, commit `feat(api,web): the roles contract and the mock roles API`.

### Task 5: Yakun

- [x] `make lint`, `make test`, `make e2e`; spec "2-bosqich qarorlari"; `git push origin main`.
