# Kompaniya rollari (ruxsat matritsasi) va tor ekrandagi pastki tab-bar — dizayn

Sana: 2026-10-06. Holat: foydalanuvchi reja sifatida tasdiqlagan; bosqichlar amalga oshirilmoqda (hujjat oxiridagi "N-bosqich qarorlari" bo'limlari to'ldirib boriladi). Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-06-roles-stage<N>-*.md`.

## Maqsad

Foydalanuvchining so'zlari (2026-10-06): "role tizim qo'shish kerak, role yaratilinadi, va hodimga role set qilinsa faqat shu role bo'yicha ishlashi kerak, va telegram bor ochilganda sidebar emas pasda buttonlar chiqishi kerak".

Bungacha: rollar ikkita (`owner` / `user`, `logic/roles.md`); xodim Mijozlar va Vazifalar bilan ishlaydi, Xodimlar, Sozlamalar va tarix faqat egasiniki. Ruxsat `requireOwner` (403 `owner_only`) va frontend'da `ownerOnly` / `useOwner` / `role === "owner"` bilan tekshiriladi. Telefonda bo'limlar topbar'dagi "Menyu" tugmasi orqali chapdan chiqadigan `Sheet` da.

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan (Xodimlar, Mijozlar va Vazifalar kabi). Qoidalarning o'zi `logic/roles.md` (yangilangan), `logic/user.md`, `logic/customers.md` va `logic/tasks.md` da; bu hujjat ularni qanday amalga oshirishni yozadi.

Ikki mustaqil qism:

1. **Rollar.** Egasi kompaniyada rollar yaratadi (nom + ruxsat matritsasi: bo'lim × amal), xodimga rol biriktiradi; rolli xodim faqat rol ruxsatlari bilan ishlaydi. Rolsiz xodim hozirgidek ishlayveradi.
2. **Pastki tab-bar.** Tor ekranda (768px dan tor: Telegram Mini App ham, mobil brauzer ham) sidebar va `Sheet` o'rniga pastda bo'lim tugmalari. Keng ekranda sidebar o'zgarmaydi.

## Foydalanuvchi qarorlari (2026-10-06)

| # | Savol | Qaror |
|---|---|---|
| 1 | Ruxsat turi | **Bo'lim + amal darajasida** (ko'rish / qo'shish / tahrirlash / o'chirish) |
| 2 | Rolni kim yaratadi | **Egasi, user app ichida.** Rollar kompaniyaga tegishli. Egasiga rol berilmaydi, u hamma narsani qila oladi |
| 3 | Rolsiz xodim | **Hozirgidek:** Mijozlar + Vazifalar. Rol berilsa, faqat shu rol ruxsatlari |
| 4 | Pastki tugmalar qayerda | **Telefon enida har doim** (Telegram va mobil brauzer); sidebar faqat keng ekranda |

## Reja bilan tasdiqlangan qarorlar

1. **Ruxsat katalogi** (18 ta, `bo'lim.amal`): `customers` va `tasks`: `view, create, edit, delete, history`; `employees` va `settings`: `view, create, edit, delete`. "Tarix" alohida amal, chunki hozir u faqat egasiniki (rolsiz xodim ko'rmaydi). Bosh sahifa hammaga.
2. **Rollarni boshqarish va biriktirish faqat egasiniki** (`requireOwner` qoladi). Aks holda `employees.edit` ga ega xodim o'ziga yoki hamkasbiga keng rol berib, huquqini oshirib olardi. `employees.*` ruxsatlari xodimlar ro'yxati, qo'shish, ism, o'chirish uchun; rol ustuni ko'rinadi, lekin o'zgartirilmaydi.
3. **Amal "ko'rish"siz bo'lmaydi:** rolda `customers.create` bo'lsa, `customers.view` ham bo'lishi shart (API 400, forma avtomatik belgilaydi).
4. **Rollar UI'si Sozlamalarda:** `/settings` tablariga (parallel ish, `2026-10-06-selects-settings-tabs-pager-design.md`) to'rtinchi tab "Rollar" (`/settings?tab=roles`, faqat egasiga ko'rinadi), rol sahifasi `/settings/roles/new` va `/settings/roles/[id]` (nom + matritsa + Saqlash). Xodimlar sahifasida har xodim qatorida "Rolni o'zgartirish" dialogi.
5. **Rol o'chirilmaydi, agar xodimlarga biriktirilgan bo'lsa:** 409 `role_in_use` "Bu rol N ta xodimga biriktirilgan" (loyihadagi `*_in_use` qoidasi). Hech kimda bo'lmagan rol bazadan o'chadi (soft delete emas: unga hech narsa havola qilmaydi, nomi darhol bo'shaydi).
6. **Yangi 403 kodi `forbidden`** "Bu amal uchun ruxsatingiz yo'q" (ruxsat yetmaganda). `owner_only` faqat rollar va biriktirish uchun qoladi. Client `forbidden` da ham `/app/me` ni qayta so'raydi (hozir `owner_only` da bo'lgani kabi).
7. **Ikki bo'limga tegadigan amallar:** yangi mijoz bilan vazifa qo'shish `tasks.create` **va** `customers.create` talab qiladi (API ikkalasini tekshiradi); mavjud mijozni tanlash uchun takliflar `customers.view` bilan so'raladi. UI: `customers.create` bo'lmasa, vazifa formasida "yangi mijoz" qismi yo'q; `customers.view` bo'lmasa takliflar so'ralmaydi; ikkalasi ham bo'lmasa "Vazifa qo'shish" ko'rinmaydi. Mijoz sahifasidagi "Vazifalar" bo'limi `tasks.view` bo'lsa chiqadi.
8. **Rolsiz xodimning ruxsati** (`access.Default`): `customers.view/create/edit/delete`, `tasks.view/create/edit/delete`. Bu hozirgi qoida bilan aynan bir xil, migratsiya hech kimning huquqini o'zgartirmaydi.
9. **Telegram qobig'i:** tab-bar bilan birga Mini App balandligi `--tg-viewport-stable-height` dan, pastki xavfsiz zona `env(safe-area-inset-bottom)` / `--tg-safe-area-inset-bottom` dan olinadi (`viewport-fit=cover`); `disableVerticalSwipes()` chaqiriladi (bor bo'lsa), aks holda kanban kartasini sudraganda Mini App yig'ilib qoladi. Bu `2026-10-04-crud-ui-refresh-design.md` da "qobiq ishi" deb kechiktirilgan band.

## Tanlangan yondashuv: a'zolikka biriktirilgan rol, ruxsat to'plami har so'rovda

Mavjud `users` + `user_companies` kengaytiriladi: `roles` jadvali (kompaniyaniki, `permissions TEXT[]`) va `user_companies.role_id`. A'zolik roli (`owner` / `user`) o'zgarmaydi: kompaniya roli uning ustidagi qatlam. Ruxsat katalogi kodda (`internal/access`), amaldagi ruxsat to'plami har so'rovda bazadan hisoblanadi va `/app/me` da interfeysga beriladi; interfeys menyu, sahifa darvozalari va tugmalarni shundan quradi, API esa har route'da `requirePermission` bilan tekshiradi.

Rad etilgan variantlar:

- Faqat bo'lim bo'yicha ruxsat (amalsiz): foydalanuvchi amal darajasini tanladi.
- Rollarni admin paneldan yaratish: egasi o'zi boshqaradi (2-qaror).
- Rol biriktirishni `employees.edit` ga qo'shish: huquq oshirish yo'li ochiladi.
- Rollarni Xodimlar sahifasida boshqarish: Sozlamalar "egasi sozlaydigan narsalar" joyi, `Section` + `SettingRow` naqshi va tablar tayyor.
- Ruxsatlarni alohida `role_permissions` jadvalida saqlash: har so'rovda qo'shimcha join; `TEXT[]` yetarli, katalog kodda tekshiriladi.
- Ruxsatni JWT'ga yozish: o'zgarish 15 daqiqagacha kuchga kirmasdi (a'zolik qoidasi bilan bir xil sabab).
- Pastki tugmalarni faqat Telegram'da ko'rsatish: foydalanuvchi tor ekranda har doim bo'lishini tanladi; `Sheet` butunlay olib tashlanadi.

## Spec'dan chetlanishlar

| # | Spec (`docs/SPEC.md`) | Yangi | Sabab |
|---|---|---|---|
| 1 | `user_companies` da faqat `role` | + `role_id` → `roles` (kompaniya bo'yicha FK), `roles` jadvali | kompaniya rollari |
| 2 | API ro'yxati (6-bo'lim) | + `/app/roles` (GET, POST), `/app/roles/{id}` (PUT, DELETE), `PUT /app/employees/{phone}/role` | yangi funksiya |
| 3 | `/app/me`: user + company'lari | + `permissions`, `AppCompany.role_name`, `Member.role_id` / `role_name` | interfeys ruxsatni shundan oladi |
| 4 | 2026-10-03 dizayni: faqat owner tekshiruvi (`owner_only`) | ruxsat tekshiruvi (`forbidden`); `owner_only` faqat rollar uchun | 1, 6-qarorlar |
| 5 | 2026-10-03 dizayni: telefonda `Sheet` | pastki tab-bar | 4-qaror |

## Ma'lumotlar modeli: `backend/migrations/00009_roles.sql`

```sql
-- +goose Up
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',   -- "customers.view" kabi kalitlar, katalog kodda
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, id)                     -- a'zolikning FK'si uchun: rol va a'zolik bitta kompaniyaniki
);
CREATE UNIQUE INDEX roles_name ON roles (company_id, lower(name));

ALTER TABLE user_companies ADD COLUMN role_id BIGINT;
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_fk
    FOREIGN KEY (company_id, role_id) REFERENCES roles (company_id, id);   -- o'chirish RESTRICT (default)
ALTER TABLE user_companies ADD CONSTRAINT user_companies_owner_has_no_role
    CHECK (role <> 'owner' OR role_id IS NULL);
CREATE INDEX user_companies_role_id ON user_companies (role_id);

-- +goose Down
ALTER TABLE user_companies DROP COLUMN role_id;   -- FK va CHECK u bilan ketadi
DROP TABLE roles;
```

- `role_id IS NULL` = rolsiz xodim (standart ruxsat) yoki egasi.
- `SetCompanyOwner` (`users.sql`) `DO UPDATE SET role = 'owner', role_id = NULL, …` bo'ladi: rolli xodim egasi qilinsa, CHECK buzilmasin.
- Begona kompaniyaning roli biriktirilsa FK 23503 → 404 "Rol topilmadi".
- Rol o'chirilmaydi, agar a'zolik unga havola qilsa (FK); servis avval sanab 409 `role_in_use` beradi.

## Ruxsat katalogi: yangi `backend/internal/access`

Kichik, bazasiz paket (`company`, `user`, `app` undan foydalanadi, sikl yo'q):

```go
type Permission string           // "customers.view" …
var All []Permission             // katalog tartibida (18 ta)
var Default []Permission         // rolsiz user: customers.* va tasks.* (history'siz)
type Set map[Permission]bool     // Has(p), List() (katalog tartibida)
func Parse(raw []string) ([]Permission, error)  // noma'lum → 400 "Ruxsat noto'g'ri"; takror olib tashlanadi;
                                                 // amal ko'rishsiz → 400 "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"
func Effective(role string, rolePerms []string) Set  // owner → All; user, rol yo'q → Default; user, rol bor → rolniki
```

Bo'lim va amal nomlari (o'zbekcha) frontend katalogida (`lib/permissions.ts`), API faqat kalitlarni biladi.

## API (`backend/openapi.yaml` → `make api-client`)

Yangi route'lar (hammasi `requireOwner`):

| Endpoint | Javob | Xatolar |
|---|---|---|
| `GET /app/roles` | 200 `CompanyRole[]` (nom bo'yicha) | 401, 402, 403 `owner_only` |
| `POST /app/roles {name, permissions}` | 201 `CompanyRole` | 400 `validation_error`, 409 `name_taken` "Bu nomli rol allaqachon bor" |
| `PUT /app/roles/{id} {name, permissions}` | 200 `CompanyRole` | 400, 404 "Rol topilmadi", 409 `name_taken` |
| `DELETE /app/roles/{id}` | 204 | 404, 409 `role_in_use` "Bu rol N ta xodimga biriktirilgan" |
| `PUT /app/employees/{phone}/role {role_id: int\|null}` | 200 `Member` | 404 `not_found` ("Xodim topilmadi" / "Rol topilmadi"), 409 `cannot_change_owner` |

Sxemalar: `Permission` (enum, 18 kalit), `CompanyRole {id, name, permissions, members_count}`, `RoleInput {name, permissions}`; `Member` + `role_id: int|null`, `role_name: string|null`; `AppCompany` + `role_name: string|null` (egasi va rolsiz xodimda null); `Me` + `permissions: Permission[]` (tanlangan kompaniyadagi amaldagi ruxsatlar; kompaniya tanlanmagan bo'lsa `[]`). Yangi response `Forbidden` (403 `forbidden`).

Mavjud route'larda `requireOwner` → `requireCompany` + `requirePermission(...)`:

| Route'lar | Ruxsat |
|---|---|
| `GET /app/employees` / `POST` / `PATCH {phone}` / `DELETE {phone}` | `employees.view` / `create` / `edit` / `delete` |
| `customer-dropdowns`, `…/options`, `customer-types`, `…/fields`, `task-stages`, `task-types`, `…/fields`: `POST` / `PATCH`, `PUT …/order` / `DELETE` | `settings.create` / `edit` / `delete` |
| `GET /app/customers`, `GET /app/customers/{id}` / `POST` / `PUT` / `DELETE` / `GET …/history` | `customers.view` / `create` / `edit` / `delete` / `history` |
| `GET /app/tasks`, `GET /app/tasks/{id}` / `POST` / `PUT`, `PATCH …/stage` / `DELETE` / `GET …/history` | `tasks.view` / `create` / `edit` / `delete` / `history` |
| `POST /app/tasks` yangi mijoz bilan (`customer.id` yo'q) | qo'shimcha `customers.create` (handler ichida) |

`GET /app/members`, `GET /app/customer-dropdowns`, `GET /app/customer-types`, `GET /app/task-stages`, `GET /app/task-types` avvalgidek har a'zoga (formalar uchun). Tekshiruv tartibi: token 401 → a'zolik 401 → obuna 402 → kompaniya tanlangan 403 `company_required` → ruxsat 403 `forbidden`. Contract testi (`internal/httpx/openapi_test.go`) yangi route'larni o'zi talab qiladi.

Talab o'zgarishi: kompaniya tanlanmagan token bilan Xodimlar API endi `company_required` (avval `owner_only`); xodim uchun rad javobi `forbidden` (avval `owner_only`). `logic/user.md` 7–9-bo'limlar yangilandi.

## Backend

Qatlam: handler → service → sqlc.

- **So'rovlar.** `users.sql`: `ListCompanyUsers` va `ListUserCompanies` ga `LEFT JOIN roles` (`role_id`, `role_name`); `GetCompanyAccess` ga `r.permissions` (NULL → nil); `SetCompanyOwner` ga `role_id = NULL`; yangi `SetCompanyUserRole :one` (`… AND role = 'user' RETURNING *`). Yangi `roles.sql`: `CreateRole`, `ListRoles` (a'zolar soni bilan), `GetRole`, `UpdateRole`, `DeleteRole`, `CountRoleMembers` — hammasi `company_id` bilan.
- **`internal/user/profiles.go`.** `Access{Role, Permissions access.Set, Active}`; `Membership.RoleName`.
- **`internal/app/session.go`.** `requireAccess` ruxsat to'plamini context'ga qo'yadi (`currentPermissions`); yangi `requirePermission(p)` (403 `forbidden`); `requireOwner` o'zgarmaydi. `handler.go` route guruhlari yuqoridagi jadval bo'yicha; `me` javobida `permissions` va `role_name`; `employees.go` `memberJSON` ga `role_id`, `role_name`; `tasks.go` `createTask` yangi mijozda `customers.create` ni tekshiradi; yangi `roles.go` handlerlari.
- **`internal/company`.** `Member` ga `RoleID *int64`, `RoleName *string`; yangi `roles.go`: `Roles`, `CreateRole`, `UpdateRole`, `DeleteRole`, `SetEmployeeRole`. Nom `fields.CleanName` (60 belgi, "Nomni kiriting"), takror `fields.Taken` → `name_taken`. `SetEmployeeRole`: egasi → 409 `cannot_change_owner`, a'zo emas → 404 (`whyNotAnEmployee` qayta ishlatiladi), FK 23503 → 404 "Rol topilmadi".
- **`internal/admin/json.go`.** `memberJSON` ga ikki maydon (sxema umumiy); admin UI o'zgarmaydi.
- **Testlar (TDD, table-driven, `pgtest`):** `access` (Parse: noma'lum, takror, ko'rishsiz amal; Effective: uch holat); migratsiya (CHECK, FK begona rol 23503, nom indeksi, Down); har so'rovga db testi; servis (nom tekshiruvi, `name_taken`, `role_in_use`, egasiga rol, begona rol, biriktirish / olib tashlash); handler (har bo'lim uchun `forbidden` / o'tish, rolsiz xodim hozirgidek, rol o'zgargach keyingi so'rov darhol rad etiladi, egasi hamma yerda o'tadi, yangi mijozli vazifa ikki ruxsatni so'raydi, `company_required` tartibi); mutatsiya: token'dagi `role` claim'iga ishonilsa test yiqilishi (mavjud), ruxsat bazadan o'qilmasa yiqilishi.

Qayta ishlatiladi: `fields.CleanName`, `fields.Taken`, `apperr`, `httpx.DecodeJSON / WriteError`, `pgtest`, `company.whyNotAnEmployee`.

## User app (`apps/web`): ruxsatlar

- **`lib/permissions.ts`:** `Permission` tipi (`lib/types.ts` orqali api-client'dan), `can(permissions, p)`, UI katalogi: bo'limlar (`customers` "Mijozlar", `tasks` "Vazifalar", `employees` "Xodimlar", `settings` "Sozlamalar") va amallar (`view` "Ko'rish", `create` "Qo'shish", `edit` "Tahrirlash", `delete` "O'chirish", `history` "Tarix"; tarix faqat mijoz va vazifada).
- **`lib/use-owner.ts` → `lib/use-gate.ts`:** umumiy `useGate(allowed)`; `useOwner()` (rollar sahifalari) va `usePermission(p)` (qolgan sahifalar) shundan. Ruxsati yo'q user bosh sahifaga qaytariladi (hozirgidek).
- **`lib/nav.ts`:** `ownerOnly` → `permission?: Permission` (`customers.view`, `tasks.view`, `employees.view`, `settings.view`); `navFor(permissions | undefined)`; tab-bar ham shu ro'yxatdan.
- **`lib/query-client.ts`:** `standingChanged` ga `forbidden`.
- **Sahifalar** (ruxsat bo'lmasa tugma chizilmaydi): `EmployeesPage` (gate `employees.view`; qo'shish / ism / o'chirish; rol dialogi faqat egasiga); `SettingsPage`, tur va dropdown sahifalari (gate `settings.view`; qo'shish / tahrir, tartib, nofaol / o'chirish; "Rollar" tabi faqat egasiga); `CustomersPage` (gate `customers.view`; qo'shish; "Sozlamalarni ochish" `settings.view` bilan); `CustomerPage` (tahrir / o'chirish / tarix; "Vazifalar" bo'limi `tasks.view`); `TasksPage` va `TaskBoard` (gate `tasks.view`; qo'shish 7-qaror bilan; sudrash va bosqich menyusi `tasks.edit`); `TaskPage` (tahrir, bosqich / o'chirish / tarix); vazifa formasi (yangi mijoz qismi `customers.create`, takliflar `customers.view`).
- **`RoleBadge {role, name?}`:** egasi "Egasi" (nuqta bilan), xodim rol nomi yoki "Xodim". Dashboard kartasida ham.
- **Mock API (`mocks/`):** `db.roles: RoleRow[]`, `Membership.roleId`; `gate.ts`: `permissionsOf`, `permittedSession(request, p)` (Go tartibi: 401 → 401 → 402 → `company_required` → `forbidden`), `forbidden()`; rollar handlerlari; `/app/me` da `permissions` va `role_name`; `membersOf` da rol maydonlari. `handlers.test.ts` mahkamlaydi.
- **Testlar:** `permissions.test.ts`, `nav.test.ts`, `use-gate.test.tsx`, sahifa testlarida rolli xodim fixture'lari (tugmalar yo'q, sahifa qaytaradi), `role-badge.test.tsx`.

## User app: rollar sahifalari

| Fayl | Vazifa |
|---|---|
| `components/settings/settings-page.tsx`, `use-settings-tab.ts` | to'rtinchi tab "Rollar" (`roles`, faqat egasiga; `settingsHref("roles")`): `Section` + `SettingRow` (nom havola, izoh: bo'limlar ro'yxati · "N ta xodim"), o'chirish (`DeleteButton`, 409 xabari toast'da), "Rol qo'shish" → `/settings/roles/new` |
| `components/settings/role-form.tsx` | nom (`TextField`) + matritsa: md'dan jadval (qatorlar bo'limlar, ustunlar amallar, yo'q katak bo'sh), telefonda bo'lim bo'yicha checkbox guruhlari (`CheckboxField`); amal belgilansa "Ko'rish" ham belgilanadi, "Ko'rish" olib tashlansa bo'lim tozalanadi; `Refusal`, `PendingButton` "Yaratish" / "Saqlash"; muvaffaqiyat toast "Rol yaratildi" / "Rol saqlandi" → `/settings?tab=roles` |
| `components/settings/role-page.tsx` | `/settings/roles/[id]`: `useOwner`, `useRoles`, topilmasa "Rol topilmadi"; `PageHeader` (back `/settings?tab=roles`, yorliq "Sozlamalar"), forma, o'chirish |
| `app/(app)/settings/roles/new/page.tsx`, `…/roles/[id]/page.tsx` | route'lar (dropdown sahifasi naqshida), `metadata` "Yangi rol — Hisob24", "Rol — Hisob24" |
| `components/employees/employee-role-dialog.tsx` | xodim qatorida `ShieldIcon` tugma (`ActionTooltip` "Rolni o'zgartirish"); dialog: `SelectBox` (`select-field.tsx`, `empty="Rolsiz"`) + rollar, izoh "Rolsiz xodim mijozlar va vazifalar bilan ishlaydi"; rol yo'q bo'lsa `/settings?tab=roles` ga havola; `PUT …/role` → toast "Rol o'zgartirildi" |
| `lib/queries.ts` | `rolesKey`, `useRoles(companyId)` (faqat egasi so'raydi) |
| `lib/schemas.ts` | `roleSchema` (nom 1–60, `permissions`) |

Matnlar: "Rollar", "Rol qo'shish", "Yangi rol", "Rol nomi", "Ruxsatlar", "Rolni o'chirasizmi?", "«Sotuvchi» roli o'chadi. Xodimga biriktirilgan rol o'chirilmaydi.", "Hali rol yo'q" + "Rol xodimga qaysi bo'limlarda nima qilishi mumkinligini belgilaydi."

## User app: pastki tab-bar

| Fayl | O'zgarish |
|---|---|
| `components/shell/tab-bar.tsx` (yangi) | `<nav aria-label="Bo'limlar">`, `md:hidden`, `border-t bg-sidebar`; `navFor(permissions)` dan 3–5 tugma (ikonka 20px + nom 11px, `truncate`), balandlik 56px + `padding-bottom: max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px))`; joriy: `aria-current="page"`, ikonka `strokeWidth` 2.5 va `bg-sidebar-accent` plashka (sidebar'dagi kabi, rang emas), qolganlari `text-muted-foreground` 1.5 |
| `components/shell/app-shell.tsx` | `<main>` ostida `<TabBar />`; shell balandligi Telegram'da `--tg-viewport-stable-height` (CSS, `html[data-telegram]`) |
| `components/shell/sidebar.tsx` | `Sheet` va `open / onOpenChange` olib tashlanadi; faqat `Column` (`hidden md:flex`) qoladi |
| `components/shell/topbar.tsx` | "Menyu" tugmasi yo'q; telefonda logo + kompaniya nomi + profil qoladi |
| `lib/use-sidebar.ts` | `open / setOpen` olib tashlanadi, `collapsed` qoladi |
| `components/telegram-sync.tsx` | `webApp.disableVerticalSwipes?.()` |
| `app/layout.tsx` | `export const viewport = { viewportFit: "cover" }` |
| `app/globals.css` | `html[data-telegram]`: shell balandligi, `overscroll-behavior: none` |
| `types/telegram.d.ts` | `disableVerticalSwipes?` |
| `e2e/helpers.ts`, `e2e/shell.spec.ts`, `e2e/miniapp.spec.ts` | `sections()` telefonda tab-bar'ni qaytaradi; "Menyu" / `Sheet` ssenariylari → tab-bar ssenariylari (joriy belgisi, xodimda "Xodimlar" yo'q, 320 / 375px da yon scroll yo'q, Mini App'da tab-bar ko'rinadi) |

`/login`, `/select-company`, `/expired` qobiqsiz, tab-bar'siz qoladi.

## Hujjatlar

- `logic/roles.md` qayta yozildi (0-bosqich): a'zolik va kompaniya rollari, katalog, kim nimaga ega, ikki bo'limli amallar, rollarni boshqarish, tekshiruv tartibi, interfeys, chekka holatlar, xato kodlari.
- `logic/user.md`: xodim qo'shish / ism / o'chirish ruxsati, tekshiruv tartibi (`company_required`, `forbidden`), 8–9-bo'limlar.
- `logic/customers.md`, `logic/tasks.md` 2-bo'lim: rolli xodim qatori va ikki bo'limli amallar; 7-bo'lim tarix; 9-bo'lim `forbidden`.
- `docs/superpowers/plans/2026-10-06-roles-stage<N>-*.md`: har bosqichga TDD rejasi.
- `README.md` "Rollar va xodimlar": kompaniya rollari va tab-bar (4 va 5-bosqichlarda).

## Testlar (TDD)

- **Go:** `access` unit testlar; migratsiya; so'rovlar; `company` rollar servisi; `requirePermission` va route'lar (har bo'lim uchun o'tish / `forbidden`); `/app/me` `permissions`; contract testi.
- **Vitest:** `permissions`, `nav`, `useGate`, `TabBar`, `AppShell`, `Topbar`, `Sidebar`, `RoleBadge`, `RoleForm`, `RolePage`, `EmployeeRoleDialog`, sahifa testlarida ruxsat bo'yicha tugmalar; mock handler'lar.
- **Playwright** (375px va desktop, MSW): egasi rol yaratadi va xodimga biriktiradi → xodim kirgach menyuda faqat ruxsatli bo'limlar, sahifada ruxsatsiz tugmalar yo'q, rol olib tashlangach hozirgidek; tab-bar telefonda, sidebar desktop'da; Mini App'da tab-bar.

## Mavjud testlarga ta'sir (talab o'zgargani uchun)

- Go: Xodimlar va sozlamalar handler testlarida xodim uchun `owner_only` → `forbidden`; kompaniyasiz token → `company_required`; `TestGetCompanyAccess`, `TestListCompanyUsers`, `TestListUserCompanies` yangi maydonlar bilan; `TestSetCompanyOwner` rolli xodim holati.
- Web: `nav.test.ts` (ruxsatlar bilan), `use-owner.test.tsx` → `use-gate.test.tsx`, sahifa testlari fixture'larida `/app/me` `permissions`; `role-badge.test.tsx`; `sidebar.test.tsx` (`Sheet` yo'q), `topbar.test.tsx` ("Menyu" yo'q), `app-shell.test.tsx` (tab-bar); e2e `shell.spec.ts`, `helpers.ts`, `miniapp.spec.ts`.
- Admin: `mocks/data.ts` `member()` ga `role_id: null, role_name: null`.

Hech bir test o'chirilmaydi yoki o'tkazib yuborilmaydi; o'zgargan har test sababi bilan hisobotda.

## Bosqichlar

Har bosqich: TDD (RED → GREEN → commit), oxirida `make lint`, `make test`, `make e2e` → `git push origin main` → hisobot → tasdiq.

0. **Hujjatlar:** `logic/*.md`, shu hujjat.
1. **Ruxsat poydevori (backend):** `access` paketi, migratsiya `00009`, so'rovlar, `Profiles.Access`, `requirePermission` va route'lar, `/app/me` (`permissions`, `role_name`), `Member` maydonlari, openapi + api-client, admin va web mock'lari (hozirgi userlar uchun xatti-harakat o'zgarmaydi: mavjud testlar o'tadi, yangilari qo'shiladi).
2. **Rollar API (backend):** `roles.sql`, `company/roles.go`, handlerlar, openapi + client, web mock'ida rollar.
3. **Ruxsatlar UI'da (web):** `permissions.ts`, nav, darvozalar, tugmalar, tarix, ikki bo'limli amallar, `RoleBadge`, query-client; mock gate.
4. **Rollar sahifalari (web):** Sozlamalar "Rollar", rol formasi va sahifalari, xodim rol dialogi, e2e, README.
5. **Pastki tab-bar (web):** `TabBar`, `Sheet` olib tashlash, Telegram balandligi va xavfsiz zona, e2e, README.

5-bosqich mustaqil: kerak bo'lsa oldinroq qilinadi.

### Parallel ish bilan kelishuv

Boshqa sessiya select'lar, `/settings` tablari va pager ustida ishlayapti (`80cfe02`, spec `2026-10-06-selects-settings-tabs-pager-design.md`; `settings-page.tsx`, `task-page.tsx`, `tasks-page.tsx`, `task-form.tsx`, `select-field.tsx`, `pager.tsx` ga tegadi). To'qnashmaslik uchun:

- 0–2-bosqichlar (hujjatlar, backend, openapi, api-client, `apps/web/mocks/*`) o'sha ish bilan kesishmaydi, darhol boshlanadi.
- 3–5-bosqichlar (web komponentlari) o'sha ish `main` ga push qilingandan keyin, fayllar qayta o'qilib boshlanadi: "Rollar" tabi `useSettingsTab` ustiga, rol tanlovi `SelectBox` bilan, e2e'da `choose` yordamchisi.
- Agar u ish cho'zilsa, 5-bosqich (tab-bar: `shell/*`, `nav.ts`, `use-sidebar.ts`, `telegram-sync.tsx`, `globals.css`) oldinroq qilinadi: u o'sha fayllarga tegmaydi.
- Commit'lar faqat o'z fayllari bilan (`git add <yo'llar>`), hech qachon `-A`.

## Chegara

- Admin panelda kompaniya rollarini ko'rsatish yoki boshqarish; admin panel uchun tab-bar.
- Xodim qo'shish dialogida rol tanlash (rol keyin biriktiriladi); tayyor rollar; rolni nusxalash; rol o'zgarishlari tarixi.
- "Faqat o'zi qo'shgan mijozlar / o'ziga biriktirilgan vazifalar" cheklovi.
- Telegram BackButton / MainButton; push-xabarlar.
- Production deploy alohida so'raladi: migratsiya 00009 qo'shimcha, hech kimning huquqini o'zgartirmaydi.

## Tekshiruv

- `make lint`, `make test`, `make e2e` toza.
- Mutatsiya: `requirePermission` o'rniga `requireCompany` qolsa rolli xodim testi yiqiladi; `Effective` da rol e'tiborsiz qolsa yiqiladi.
- Lokal haqiqiy stack (`make dev`, Playwright vaqtinchalik spec, SMS kodi API log'idan): egasi rol yaratadi ("Sotuvchi": mijozlar hammasi, vazifalar ko'rish + qo'shish), xodimga biriktiradi; xodim kirgach: tab-bar'da faqat Bosh sahifa, Mijozlar, Vazifalar; vazifa sahifasida tahrir / o'chirish yo'q; `curl` bilan `PUT /api/app/tasks/{id}` → 403 `forbidden`; rol olib tashlangach xodim yana hozirgidek ishlaydi. Skrinshotlar: 375px tab-bar (egasi 5 tugma, xodim 3 tugma), 320px yon scroll yo'q, desktop sidebar o'zgarmagan, soxta Telegram skripti bilan Mini App.

## 1-bosqich qarorlari (2026-10-06)

Bajarildi: `internal/access` (katalog, `Set`, `Parse`, `Effective`), migratsiya `00009_roles.sql`, so'rovlar (`GetCompanyAccess`, `ListCompanyUsers`, `ListUserCompanies`, `SetCompanyOwner`, yangi `GetCompanyMember`), `user.Access.Permissions`, `company.Member.RoleID / RoleName`, `requirePermission` va route'lar, yangi mijozli vazifada `customers.create`, `/app/me` `permissions` + `role_name`, `memberJSON` rol maydonlari (app, admin), openapi + TS client, admin va web mock'lari, `lib/permissions.ts`, `query-client` `forbidden`. Reja: `docs/superpowers/plans/2026-10-06-roles-stage1-permissions.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`access.Effective(role, hasRole, rolePerms)`:** rol borligi alohida argument (`role_id IS NOT NULL`), bo'sh massiv bilan NULL farqiga tayanilmaydi: bo'sh ruxsatli rol ham rol.
- **`access.Parse`** katalog tartibida yuradi: bir nechta bo'lim buzilgan bo'lsa, katalogda birinchi kelgani aytiladi ("«Vazifalar» bo'limida avval «Ko'rish» ni belgilang").
- **Context'da `user.Access`** (`accessKey`): rol ham, ruxsatlar ham bitta qiymat. `currentRole` olib tashlandi (`golangci-lint` `unused`); `requireOwner` `currentAccess(ctx).Role` ni o'qiydi va 2-bosqichgacha route'siz, `//nolint:unused` bilan.
- **Test konstantasi `noPermission`** (`{"error":"forbidden",…}`): `forbidden` nomi production yordamchisi `forbidden(w)` bilan to'qnashdi.
- **`GetCompanyMember`** yangi so'rov: `RenameEmployee` javobi rol nomini ham qaytaradi (`RenameCompanyUser` RETURNING'da join yo'q).
- **openapi summary'lari** `(employees.view ruxsati)` ko'rinishida: `(ruxsat: employees.view)` ichidagi ikki nuqta YAML'da xato berdi.
- **Mock API:** `permittedSession` = `memberSession` + ruxsat; `permissionsOf` hozircha egasi → katalog, xodim → standart (rollar mock'ka 2-bosqichda keladi, `role_name` va `role_id` null).
- **O'zgargan mavjud testlar** (talab o'zgargani uchun): Go'da ruxsatli route'larda `owner_only` → `forbidden` (`customer_settings`, `task_settings`, `members`, `customers`, `tasks`, `employees` testlari), `TestEmployeesAreForTheOwnerOnly` → `TestEmployeesNeedTheirPermission` (kompaniyasiz token → `company_required`), `TestAccess` ruxsat to'plami bilan, `TestGetCompanyAccess` / `TestListCompanyUsers` / `TestListUserCompanies` / `TestSetCompanyOwner` rol bilan, `TestMe` / `TestListEmployees` yangi maydonlar bilan, admin `TestGetCompany` rol maydonlari; web `handlers.test.ts` (`forbidden`, `company_required`, `/app/me` `permissions`, a'zolarda rol maydonlari), `query-client.test.tsx` (`forbidden`); admin `company-page.test.tsx` a'zo obyekti rol maydonlari bilan. Hech biri o'chirilmadi.
- **Tekshiruv:** `make lint` toza; `make test`: Go barcha paketlar, api-client 1, admin 228, web 521; `make e2e`: admin 40, web 90.

## 2-bosqich qarorlari (2026-10-06)

Bajarildi: `roles.sql` (`CreateRole`, `ListRoles`, `GetRole`, `UpdateRole`, `DeleteRole`, `CountRoleMembers`), `users.sql` `SetCompanyUserRole`, `company/roles.go` (`Roles`, `CreateRole`, `UpdateRole`, `DeleteRole`, `SetEmployeeRole`), `app/roles.go` va route'lar (`requireOwner`), openapi (`/app/roles`, `/app/roles/{id}`, `/app/employees/{phone}/role`; `CompanyRole`, `RoleInput`, `EmployeeRoleInput`; `RoleNotFound`, `RoleOrEmployeeNotFound`, `RoleConflict`) + TS client, web mock (`db.roles`, `Membership.roleId`, `mocks/roles.ts`, `permissionsOf` rol bilan, `rolesOf`, `roleOf`), `lib/permissions.ts` (`Section`, `sectionLabels`, `sectionOf`). Reja: `docs/superpowers/plans/2026-10-06-roles-stage2-roles-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Rollar API `requireCompany`siz, to'g'ridan-to'g'ri `requireOwner` ostida:** kompaniyasiz token `owner_only` oladi (`logic/roles.md`, 9-bo'lim), ruxsatli route'lardagi `company_required` emas.
- **`UpdateRole` va `SetEmployeeRole` tranzaksiyada:** yozuvdan keyin javob uchun `GetRole` / `GetCompanyMember` o'qiladi (RETURNING'da a'zolar soni va rol nomi yo'q). `DeleteRole`: `GetRole` (404) → `MembersCount > 0` (409 `role_in_use`) → `DELETE`; FK baribir himoya qiladi.
- **`SetEmployeeRole` tartibi:** telefon (404 "Xodim topilmadi") → rol kompaniyaniki (404 "Rol topilmadi") → `SetCompanyUserRole` (qator yo'q: egasi 409 `cannot_change_owner`, a'zo emas 404). Egasiga berilayotgan rol begona bo'lsa, "Rol topilmadi" birinchi.
- **`ListRoles` tartibi** `lower(name), id`; `CountRoleMembers` parametri `*int64` (`role_id` nullable ustun), servis uni ishlatmaydi: `GetRole` dagi `members_count` yetarli, so'rov kelajak uchun qoldi.
- **Handler testlarida `ownerOnly` konstantasi** `roles_test.go` da qayta kiritildi (1-bosqichda `noPermission` ga almashgan edi): rollar API uchun kerak.
- **Mock:** `rolesHandlers` `ownerSession` bilan; `parsePermissions` Go `access.Parse` bilan bir xil xabarlar; xodim roli `Membership.roleId`; `handlers.test.ts` dagi "rol bilan ishlash" testi egasiga qaytish uchun qayta kirmaydi (mock SMS 60 soniya cheklovi), tokenini `setAccessToken` bilan tiklaydi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go barcha paketlar, api-client 1, admin 228, web 525; `make e2e`: admin 40, web 90.

## 3-bosqich qarorlari (2026-10-06)

Bajarildi: `lib/permissions.ts` (`can`, `sectionLabels`, `sectionOf`), `lib/use-gate.ts` (`useGate`, `useOwner`, `usePermission`; `lib/use-owner.ts` o'chirildi), `lib/nav.ts` (`permission`, `navFor(permissions)`), `Sidebar`, `RoleBadge {role, name}`, `Dashboard`, `EmployeesPage`, `SettingsPage` va tur / dropdown sahifalari, `CustomersPage`, `CustomerPage`, `TasksPage`, `TaskBoard`, `TaskCard`, `TaskPage`, `AddTaskDialog` / `CustomerSection`; `test/roles.ts` (`giveRole`). Reja: `docs/superpowers/plans/2026-10-06-roles-stage3-permissions-ui.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`useGate(allowed)`** `Gate {company, user, permissions}` qaytaradi; kompaniya tanlanmagan sessiya hech qayerga yo'naltirilmaydi (qobiq uni `/select-company` ga olib boradi). `useOwner` rollar sahifalari uchun qoldi (4-bosqich).
- **Menyu noma'lum sessiyada faqat Bosh sahifa** (avval Mijozlar va Vazifalar ham): ilovada qobiq `/app/me` ni sahifadan oldin oladi, shuning uchun ko'rinishda farq yo'q.
- **Ro'yxat sahifalari (`CustomersPage`, `TasksPage`) darvoza ochilguncha hech narsa chizmaydi**, Xodimlar va Sozlamalar kabi: begona sahifa sarlavhasini ko'rmaydi.
- **`customers.create ⇒ customers.view`** (katalog qoidasi): "Vazifa qo'shish" `tasks.create` **va** `customers.view` bilan; spec'dagi "`customers.view` bo'lmasa takliflar so'ralmaydi" qoidasi ortiqcha bo'lib chiqdi (bunday holat bo'lmaydi) va qilinmadi.
- **`customers.create` siz vazifa formasi** `taskSchema` ga `customerType = null` beradi: yangi mijoz "Mijozni tanlang" bilan rad etiladi; formada "Yangi mijoz qo'shish ruxsatingiz yo'q: mavjud mijozni biriktiring." va tur tanlovi yo'q; biriktirilgan mavjud mijozning turi va maydonlari ko'rinadi (qulflangan).
- **Kanban:** `TaskBoard {canAdd, canMove}`; `TaskCard.onMove` ixtiyoriy: yo'q bo'lsa bosqich menyusi chizilmaydi va `useDraggable` o'chiq; ustun "+" `onAdd` bo'lmasa yo'q.
- **Sozlamalar:** har ro'yxatda uchta ruxsat (`create` qo'shish tugmasi, `edit` nom / belgilar / tartib (`SortableList disabled`) / nofaol variant, `delete` o'chirish); tur va dropdown sahifalari ham.
- **Mijoz sahifasida "Vazifalar" bo'limi `tasks.view` bilan**, tarix `customers.history`; vazifa sahifasida tahrir va bosqich `tasks.edit`, o'chirish `tasks.delete`, tarix `tasks.history`.
- **Yangi va o'zgargan testlar:** `use-gate.test.tsx`, `nav.test.ts` (ruxsatlar bilan qayta yozildi), `permissions.test.ts` (`can`, `sectionLabels`), `sidebar.test.tsx`, `role-badge.test.tsx`, `dashboard.test.tsx`, `employees-page.test.tsx`, `settings-page.test.tsx`, `customer-type-page.test.tsx`, `task-type-page.test.tsx`, `dropdown-page.test.tsx`, `customers-page.test.tsx`, `customer-page.test.tsx`, `tasks-page.test.tsx`, `task-page.test.tsx`, `task-board.test.tsx`, `task-dialog.test.tsx` — har birida rolli xodim holati (`giveRole`). Hech bir test o'chirilmadi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go barcha paketlar, api-client 1, admin 228, web 555; `make e2e`: admin 40, web 90.

## 4-bosqich qarorlari (2026-10-06)

Bajarildi: Sozlamalarda "Rollar" tabi (`useSettingsTab` `"roles"`, `Roles` bo'limi, `useRoles`, `summaryOf`), `RoleForm` (nom + ruxsat matritsasi), `RolePage` / `NewRolePage` va route'lar (`/settings/roles/new`, `/settings/roles/[id]`), `EmployeeRoleDialog`, `roleSchema`, matritsa katalogi (`actions`, `actionLabels`, `actionsOf`, `permissionOf`, `toggled`), e2e `roles.spec.ts`, README. Reja: `docs/superpowers/plans/2026-10-06-roles-stage4-roles-pages.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **"Rollar" tabi faqat egasiga** (`gate.company.role === "owner"`); `?tab=roles` manzili boshqa a'zoga Mijozlar tabini ochadi (`shown`). `settingsHref("roles")` orqaga havolalar va saqlashdan keyingi manzil.
- **Ro'yxat izohi:** `summaryOf(permissions) · holders(members_count)` — "Mijozlar, Vazifalar · 1 ta xodim", bo'sh rolda "Ruxsat yo'q", hech kimda "Hech kimda".
- **Matritsa bitta DOM:** har bo'lim `role="group"` (nomi bo'lim), har amal `Checkbox` + `label` (md'dan `sr-only`, sarlavha qatori amallarni aytadi; telefonda label ko'rinadi, guruhlar ustma-ust). Yo'q katak (Xodimlar / Sozlamalar tarixi) bo'sh joy. `toggled` qoidasi: amal `view` ni olib keladi, `view` olib tashlansa bo'lim tozalanadi.
- **`RoleForm` yaratishda `POST`, o'zgartirishda `PUT`;** muvaffaqiyatda `router.push(settingsHref("roles"))` va toast ("Rol yaratildi" / "Rol saqlandi"); `RolePage` formaga `key` beradi, saqlangan rol qayta yuklanganda forma undan boshlanadi. Rol o'chirish sahifa sarlavhasida ham, muvaffaqiyatda rollar tabi.
- **`EmployeeRoleDialog`** `SelectBox` (`empty="Rolsiz"`), rollar faqat dialog ochilganda so'raladi (`useRoles(open ? companyId : null)`); rol yo'q bo'lsa "Hali rol yo'q. Sozlamalarda rol yarating" havolasi. Tugma faqat egasiga va faqat `user` qatorlarida; `employees.*` ruxsatli xodim ko'rmaydi.
- **e2e `roles.spec.ts`** bitta uzun oqim (uch marta kirish): `test.setTimeout(120_000)` va `db.cooldown = false` (mock SMS daqiqasi; `login.spec.ts` dagidek). Birinchi urinish shu daqiqa cheklovida to'xtab qolgan edi.
- **Yangi testlar:** `role-form.test.tsx`, `role-page.test.tsx`, `settings-page.test.tsx` (tab, ro'yxat, o'chirish), `employees-page.test.tsx` (rol dialogi), `permissions.test.ts` (`actionsOf`, `toggled`, `summaryOf`), `schemas.test.ts` (`roleSchema`); egasining tablari testi 4 tabni kutadi (talab o'zgardi).
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go barcha paketlar, api-client 1, admin 228, web 575; `make e2e`: admin 40, web 92.
