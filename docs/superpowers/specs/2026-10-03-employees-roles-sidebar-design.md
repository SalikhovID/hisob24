# Xodimlar, rollar (owner / user) va user app sidebar — dizayn

Sana: 2026-10-03. Holat: foydalanuvchi tasdiqlagan (shu hujjat va `logic/` ko'rib chiqilgan); 0–4 bosqichlarning hammasi amalga oshirilgan (hujjat oxiridagi "N-bosqich qarorlari" bo'limlari). Har bosqichga alohida reja yozilgan: `docs/superpowers/plans/2026-10-03-employees-stage<N>-*.md`.

## Maqsad

Foydalanuvchining so'zlari (2026-10-03): "endi mana bunday tizim qo'shish kerak, o'ziga hodimlar qo'shish imkoniyati bo'lishi kerak, adminkadan qo'shilgan user har doim owner bo'lib qoladi, tizimdan qo'shilganlarini rollari user bo'lib qoladi. va sidebar tizim qilish kerak ../enwin/frontend dan ol dizaynini. agar boshqa kompaniyada mavjud raqam kiritilinsa demak multi-user bo'lib qolishi kerak bularni logic/ degan folder ochib user.md, roles.md qilib qanday ishlashligi kerakligi haqida malumot yozib ket".

Bu spec'dan tashqari yangi funksiya. Qoidalarning o'zi `logic/user.md` va `logic/roles.md` da, bu hujjat ularni qanday amalga oshirishni yozadi.

Hozirgi holat: kompaniyaga userlarni faqat platforma admini qo'shadi, rollar `owner/manager/staff`, user app'da bitta bo'sh dashboard bor. Multi-company poydevori tayyor: `users` (telefon PK) + `user_companies` (rol kompaniya bo'yicha), `/select-company`, `switch-company`.

## Qarorlar

Foydalanuvchi qarorlari:

1. Owner xodimni **qo'shadi, ismini tahrirlaydi, o'chiradi**.
2. **Ism har kompaniyada alohida** (`user_companies.full_name`).
3. Rollar faqat `owner` va `user`. Foydalanuvchi: "adminkadan faqat owner qo'shiladi, hozir qo'shilganlarini barchasini user qilib yubor, 1ta kompaniyada 1ta owner bo'lishi kerak". Mavjud ma'lumot: har kompaniyada eng birinchi owner qoladi, qolgan hamma a'zo `user` bo'ladi.
4. Admin paneldagi "User qo'shish" → **"Egasini almashtirish"**: kiritilgan raqam owner bo'ladi, oldingisi `user` bo'lib qoladi.
5. Sidebar **faqat user app'da** (`apps/web`), dizayn `../enwin/enwin-frontend` dan (`../enwin/frontend` yo'q).

Reja bilan tasdiqlangan qarorlar:

6. "Xodimlar" bo'limini faqat owner ko'radi va ishlatadi. `user` uchun API 403 `owner_only`.
7. Kirish huquqi = **kamida bitta kompaniyaga a'zolik** (oldin: `users` da bor bo'lish). Kompaniyasi qolmagan xodimga SMS ketmaydi, Mini App `no_access` aytadi, ochiq sessiyasi keyingi refresh'da tugaydi. `users` yozuvi o'chirilmaydi: kelajakdagi hujjatlar unga bog'lanadi.
8. A'zolik va rol **har so'rovda bazadan** tekshiriladi (oldingi obuna tekshiruvi o'rnida, bitta so'rov). JWT'dagi `role` ga ishonilmaydi. O'chirish va owner almashishi darhol kuchga kiradi.
   - A'zoligi yo'qolgan token 401 `unauthorized` oladi. Client buni mavjud yo'l bilan hal qiladi: refresh → kompaniyasiz token → `/select-company`, yoki sessiya tugaydi → `/login`. Frontend'da buning uchun yangi kod kerak emas.
9. Xodim qo'shish javobi raqam tizimda bor-yo'qligiga bog'liq emas: begona ism ko'rinmaydi, raqamlarni tekshirib bo'lmaydi. Qo'shilgan odamga xabar yuborilmaydi, rozilik so'ralmaydi.
10. Company ID doim access token'dan olinadi: owner faqat hozir tanlangan kompaniyasini boshqaradi.

## Tanlangan yondashuv: a'zolik asosida

Mavjud `users` + `user_companies` kengaytiriladi: rol qiymatlari, a'zolik ismi va "bitta owner" indeksi. Xodim = `user` rolidagi a'zo. Multi-user alohida mexanizmsiz chiqadi: bitta `users` qatori, bir nechta a'zolik.

Rad etilgan variantlar:

- Alohida `employees` jadvali (login user'dan ajratilgan yozuv): ikki manba paydo bo'ladi, multi-user uchun baribir `users` ga bog'lash kerak.
- Taklif → qabul qilish oqimi: so'ralmagan, qo'shimcha holatlar va ekranlar.
- Bitta global ism (`users.full_name`): begona kompaniya owner'i ismni o'zgartira olardi va raqam bo'yicha ismni bilib olardi.
- Rolni faqat JWT'dan o'qish: o'chirilgan xodim 15 daqiqagacha ishlay olardi.

## Spec'dan chetlanishlar

| # | Spec | Yangi | Sabab |
|---|---|---|---|
| 1 | `role IN ('owner','manager','staff')`, default `owner` | `('owner','user')`, default `user`, bir kompaniyada bitta owner (partial unique indeks) | 3-qaror |
| 2 | `POST /admin/companies/{id}/users {phone, full_name, role}` | `PUT /admin/companies/{id}/owner {phone, full_name}` | 4-qaror |
| 3 | Ism `users.full_name` da | asosiy ism `user_companies.full_name`; `users.full_name` zaxira | 2-qaror |
| 4 | "Raqam `users` jadvalida bo'lsa" (SMS 5.5.1, user bot 5.6.4, Mini App) | "kamida bitta kompaniyaga a'zo bo'lsa" | 7-qaror |
| 5 | User middleware faqat obunani tekshiradi | a'zolik + obuna + rol, bitta so'rov | 8-qaror |
| 6 | `/(app)` bo'sh dashboard va logout tugmasi | sidebar + topbar ichida; yangi sahifa `/employees` | yangi funksiya |
| 7 | API ro'yxati (6-bo'lim) | + `/app/employees` (GET, POST, PATCH, DELETE) | yangi funksiya |
| 8 | 2-bosqich 4-qarori: a'zo qayta qo'shilsa rol yangilanadi | user app'dan 409 `already_member`; admin paneldan faqat egasini almashtirish | owner tizim ichidan pasaytirilmasin |

## Ma'lumotlar modeli: `backend/migrations/00004_roles_owner_user.sql`

```sql
-- +goose Up
ALTER TABLE user_companies ADD COLUMN full_name TEXT;
UPDATE user_companies uc SET full_name = u.full_name FROM users u WHERE u.phone = uc.user_phone;

ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
-- Har kompaniyada eng birinchi owner qoladi, qolgan hamma a'zo user bo'ladi.
UPDATE user_companies uc SET role = 'user'
WHERE uc.role <> 'owner' OR uc.user_phone <> (
  SELECT o.user_phone FROM user_companies o
  WHERE o.company_id = uc.company_id AND o.role = 'owner'
  ORDER BY o.created_at, o.user_phone LIMIT 1);
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner','user'));
CREATE UNIQUE INDEX user_companies_one_owner ON user_companies (company_id) WHERE role = 'owner';
```

- Down: indeks va ustun olib tashlanadi, default va eski CHECK qaytadi, `user` → `staff`.
- `users.full_name` qoladi: user birinchi qo'shilgandagi ism, faqat kompaniya tanlanmaganda zaxira.
- "Kamida bitta owner" ilova oqimlari bilan saqlanadi: company owner bilan yaratiladi, user app owner'ga tegmaydi, almashtirish bitta transaction.

## API (`backend/openapi.yaml` → `make api-client`)

| Endpoint | Javob | Xatolar |
|---|---|---|
| `GET /app/employees` | 200 `Member[]` (owner birinchi, keyin qo'shilgan vaqti bo'yicha) | 401, 402, 403 `owner_only` |
| `POST /app/employees {phone, full_name}` | 201 `Member` | 400 `validation_error`, 409 `already_member` |
| `PATCH /app/employees/{phone} {full_name}` | 200 `Member` | 400, 404 `not_found`, 409 `cannot_change_owner` |
| `DELETE /app/employees/{phone}` | 204 | 404, 409 `cannot_change_owner` |
| `PUT /admin/companies/{id}/owner {phone, full_name}` | 200 `Member` | 400, 404 |

- `POST /admin/companies/{id}/users` o'chiriladi. `Role` enum: `[owner, user]`.
- `/app/me`: `user.full_name` = tanlangan kompaniyadagi ism (tanlanmagan bo'lsa `users.full_name`).
- `{phone}` saqlangan ko'rinishda (`998901234567`); noto'g'ri bo'lsa 404.
- Xabarlar matni: `logic/user.md`, 9-bo'lim.
- Contract testi (`internal/httpx/openapi_test.go`) router = openapi ekanini majburlaydi.

## Backend

Qatlam: handler → service → sqlc.

- **So'rovlar** (`internal/db/queries/`):
  - yangi: `HasCompany`, `AddCompanyUser` (`ON CONFLICT DO NOTHING RETURNING`), `SetCompanyOwner` (upsert, ismni ham yangilaydi), `DemoteCompanyOwner`, `RenameCompanyUser` va `RemoveCompanyUser` (ikkalasi `AND role = 'user'`), `GetCompanyAccess` (rol + obuna faolligi), `LockCompany`;
  - o'zgaradi: `ListCompanyUsers` (a'zolik ismi, owner birinchi), `ListUserCompanies` (+`full_name`);
  - o'chadi: `UserExists`, `UpsertCompanyUser`, `IsCompanySubscriptionActive`.
- **`internal/company`:**
  - `Create`: owner a'zoligi ism bilan yoziladi.
  - `ReplaceOwner` (`AddUser` o'rnida), bitta transaction: `LockCompany` → `UpsertUser` → `DemoteCompanyOwner` → `SetCompanyOwner`. Kompaniya qatori lock qilinadi, shunda ikki almashtirish navbat bilan bajariladi.
  - `Members`, `AddEmployee` (transaction: `UpsertUser` → `AddCompanyUser`), `RenameEmployee`, `RemoveEmployee`. Tahrir va o'chirish bitta `... AND role = 'user'` so'rovi; qator qaytmasa sababi aniqlanadi (owner → 409, a'zo emas → 404).
- **`internal/user`:** `Profiles.Access(phone, companyID)` (`SubscriptionActive` o'rnida); `Profiles.Get` a'zolik ismini qaytaradi; `Contacts.Save` a'zolik bo'yicha javob beradi.
- **`internal/auth`:** `SendCode`, `Verify`, `LoginWithTelegram` `HasCompany` ga o'tadi; `Refresh` a'zoligi qolmagan userga `ErrInvalidRefresh` qaytaradi.
- **`internal/app`:** `Services.Companies`; `requireAccess` (`requireSubscription` o'rnida: a'zo emas → 401, obuna → 402, rol context'ga), `requireOwner` (403); `employees.go` da to'rtta handler.
- **`internal/admin`:** `replaceOwner`, route `PUT /companies/{id}/owner`.
- **`cmd/api/main.go`:** bitta `company.NewService(pool)` admin va app'ga beriladi.

Qayta ishlatiladi: `user.NormalizePhone`, `apperr` (`Invalid`, `NotFound`, `Conflict`), `httpx.DecodeJSON / WriteError`, `pgtest.New / FailInserts / WaitForLockWait`, `telegramtest`.

## User app (`apps/web`)

### Sidebar

Manba: `enwin-frontend/components/layout/sidebar.tsx`, `topbar.tsx`, `hooks/use-sidebar.ts`, `app/(dashboard)/layout.tsx`.

Olinadi:

- karkas `flex h-dvh overflow-hidden`; aside `w-64 ↔ w-16`, `transition-all duration-300`, `border-r bg-sidebar`;
- sarlavha `h-14`: belgi + kompaniya nomi + chevron; yig'ilganda belgi ustiga borilsa `ChevronRight` chiqadi;
- bo'lim: `mx-2 px-3 py-2 rounded-md`, hover va joriy `bg-sidebar-accent`, ikonka `h-5 w-5`, `strokeWidth` 2.5 (joriy) / 1.5; yig'ilganda o'ng tomonda tooltip;
- telefonda chapdan `Sheet` (`w-72 p-0`), bo'lim tanlansa yopiladi;
- topbar `h-14 border-b px-4`: chapda menyu tugmasi, o'ngda mavzu + profil menyusi (ism, telefon, "Kompaniyani almashtirish", qizil "Chiqish");
- yig'ilgan holat `localStorage["sidebar_collapsed"]` da saqlanadi.

Olinmaydi: ichma-ich guruhlar (Collapsible, Popover), permission va modul filtri (o'rniga `ownerOnly`), ModulesCard, breadcrumbs, til va valyuta tanlagichi, lock screen, `next-intl`, Capacitor.

Moslashtiriladi:

- JS `useMobile` o'rniga CSS breakpoint (`md:`): SSR'da sakrash yo'q, admin panel ham shunday qurilgan;
- radix `asChild` o'rniga base-ui `render` (loyiha `base-nova` uslubida);
- ranglar hisob24 tokenlarida qoladi: `--sidebar-*` bor va Telegram mavzusiga ulangan;
- logo fayli yo'q, belgi sifatida "H" harfli kvadrat (2026-10-04'dan logotip bor: sarlavha `Logo` va ostida kompaniya nomi, yig'ilganda `LogoMark`; qarang `2026-10-04-logo-design.md`);
- Mini App'da "Chiqish" va mavzu tugmasi yashirin (mavjud qoida).

Bo'limlar (`lib/nav.ts`): Bosh sahifa `/`, Xodimlar `/employees` (`ownerOnly`).

### Fayllar

| Fayl | Vazifa |
|---|---|
| `app/(app)/layout.tsx` | `<AppShell>` |
| `app/(app)/employees/page.tsx` | `<EmployeesPage />` |
| `components/shell/app-shell.tsx` | sessiya darvozasi (402 → `/expired`, kompaniya yo'q → `/select-company`: Dashboard'dan ko'chadi), sidebar + topbar + `<main>` |
| `components/shell/sidebar.tsx`, `topbar.tsx` | yuqoridagi dizayn |
| `lib/nav.ts`, `lib/use-sidebar.ts` | bo'limlar; mobil ochiq/yopiq va desktop yig'ilgan holat (`useSyncExternalStore`) |
| `components/employees/employees-page.tsx` | ro'yxat (`DataList`: jadval yoki kartochka), "Egasi" / "Xodim" / "Siz"; `user` → `/` |
| `components/employees/employee-dialog.tsx` | qo'shish va ismni tahrirlash (rhf + zod) |
| `components/employees/remove-employee-button.tsx` | tasdiq bilan o'chirish |
| `components/phone-field.tsx` | `login/phone-step.tsx` dagi `+998` maydoni ajratiladi, ikkala joyda ishlatiladi |
| `components/dashboard.tsx` | faqat mazmun: header shell'ga ko'chadi |
| `lib/queries.ts`, `lib/roles.ts`, `lib/types.ts` | `useEmployees` va mutatsiyalar; `owner: "Egasi"`, `user: "Xodim"` |
| `mocks/data.ts`, `mocks/handlers.ts` | Go API bilan bir xil qoidalar (a'zolik tekshiruvi, 401 / 403 / 409) |

UI primitivlar: `sheet`, `dialog`, `alert-dialog`, `table`, `data-list` admin'dan nusxa olinadi ("Yopish" yozuvi bilan; umumiy paket keyinroq, kerak bo'lsa). `tooltip`, `dropdown-menu` shadcn'dan (`base-nova`).

`/select-company`, `/expired`, `/login` shell'siz qoladi.

## Admin panel (`apps/admin`)

- `components/companies/add-user-dialog.tsx` → `replace-owner-dialog.tsx`: "Egasini almashtirish", maydonlar Telefon va Ism, izoh "Oldingi egasi xodim bo'lib qoladi".
- `lib/schemas.ts` (`memberSchema` rolsiz), `lib/roles.ts`, `mocks/*`, `company-page.tsx` (tugma; ro'yxatda Egasi / Xodim).
- Sidebar'ga tegilmaydi.

## Testlar (TDD)

- **Go:**
  - migratsiya: yangi CHECK, bitta owner indeksi, eski ma'lumotning aylanishi (3-versiyaga tushib, yozib, 4 ga chiqib), ism to'ldirilishi, Down;
  - har yangi so'rovga db testi;
  - servislar: `ReplaceOwner` (to'rt holat, atomiklik `FailInserts` bilan, navbat `WaitForLockWait` bilan), `AddEmployee` (yangi raqam, boshqa kompaniyadagi raqam, `already_member`, atomiklik), `RenameEmployee`, `RemoveEmployee`;
  - auth: a'zoliksiz raqam (SMS, verify, Mini App), `Refresh` a'zoliksiz sessiyani tugatadi;
  - handler: 401 / 402 / 403 tartibi, o'chirilgan xodimning keyingi so'rovi, owner almashgandan keyin eski owner 403;
  - contract testi: openapi = router.
- **Vitest:** `useSidebar`, `Sidebar`, `Topbar`, `AppShell`, `EmployeesPage`, dialoglar; admin `ReplaceOwnerDialog`.
- **Playwright** (375px va desktop, MSW):
  - sidebar yig'iladi va reload'dan keyin shunday qoladi; telefonda menyu ochiladi va yopiladi; yon scroll yo'q; Mini App'da "Chiqish" yo'q;
  - owner xodim qo'shadi → xodim kiradi va "Xodimlar" ni ko'rmaydi;
  - boshqa kompaniyadagi raqam qo'shiladi → u login'da `/select-company` ni ko'radi;
  - tahrir; o'chirish → xodim kira olmaydi;
  - admin: egasini almashtirish.

### Mavjud testlarga ta'sir

Talab o'zgargani uchun o'zgaradi (test o'tishi uchun emas):

- `manager` / `staff` ishlatgan fixture'lar → `user`: 6 ta Go test fayli, web va admin mock'lari, "Menejer" kutgan testlar.
- Bir kompaniyada ikki owner yaratgan fixture'lar → ikkinchisi `user`.
- Kompaniyasiz user bilan kirgan testlar (`TestSendCode`, `TestLogout`, `TestMeNeedsAValidAccessToken`) → userga kompaniya beriladi.
- `TestAddUser*` (company, admin) va admin "User qo'shish" testlari → `ReplaceOwner` / "Egasini almashtirish" testlari.
- `TestUserExists`, `TestUpsertCompanyUser`, `TestSubscriptionActive` → o'rnidagi so'rovlar testlari.
- Dashboard'dagi "Chiqish" va mavzu testlari → Topbar testlariga ko'chadi; e2e'da "Chiqish" profil menyusi ichida.

## Bosqichlar

Har bosqich: TDD (RED → GREEN → commit), oxirida `make lint`, `make test`, `make e2e` → `git push origin main` → hisobot → tasdiq.

0. **Hujjatlar:** `logic/user.md`, `logic/roles.md`, shu hujjat.
1. **Rollar, bitta owner, a'zolik ismi** (backend + admin panel): migratsiya, so'rovlar, `Create`, `ReplaceOwner`, `PUT /admin/companies/{id}/owner`, `/app/me` dagi ism, admin dialogi, ikkala ilovada rol nomlari.
2. **Xodimlar API va kirish qoidalari** (backend): `HasCompany`, `Refresh`, `requireAccess`, `requireOwner`, `/app/employees` (GET, POST, PATCH, DELETE), openapi, web mock'lari.
3. **User app sidebar:** UI primitivlar, `useSidebar`, `Sidebar`, `Topbar`, `AppShell`, soddalashgan Dashboard, e2e.
4. **Xodimlar sahifasi:** `PhoneField`, ro'yxat, qo'shish, tahrirlash, o'chirish, e2e, README.

## Chegara

- Admin panel sidebar'i; admin paneldan xodim (`user`) qo'shish yoki o'chirish.
- Taklif va rozilik; qo'shilgan xodimga SMS yoki bot xabari; xodimlar soni limiti; xodimning o'zi kompaniyadan chiqishi; owner'ning o'z ismini user app'dan o'zgartirishi.
- Sidebar'da ichma-ich guruhlar va yangi biznes modullar.
- Production deploy alohida so'raladi: migratsiya 00004 prod'dagi rollarni o'zgartiradi.

## 1-bosqich qarorlari (2026-10-03)

Bajarildi: migratsiya `00004`, so'rovlar, `company.Create`, `company.ReplaceOwner`, `PUT /admin/companies/{id}/owner`, `/app/me` dagi ism, admin "Egasini almashtirish", ikkala ilovada rol nomlari. Reja: `docs/superpowers/plans/2026-10-03-employees-stage1-roles-owner.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`ReplaceOwner` tartibi.** Avval telefon va ism tekshiriladi (400), keyin tranzaksiya ichida kompaniya (404). Tranzaksiya: `LockCompany` → `UpsertUser` → `DemoteCompanyOwner` → `SetCompanyOwner`.
- **Kompaniya qatori lock qilinadi** (`SELECT … FOR UPDATE`).
  - Lock'siz ikki bir vaqtdagi almashtirishdan biri `user_companies_one_owner` indeksiga urilib yiqilardi (`23505`): ikkinchisining `UPDATE` i birinchisi qo'ygan owner'ni ko'rmaydi.
  - Lock bilan ular navbat bilan bajariladi va oxirgisi qoladi. Test `pgtest.WaitForLockWait` bilan deterministik.
- **Ism.**
  - `SetCompanyOwner` a'zo bo'lgan raqamning ismini kiritilgan ismga almashtiradi; a'zolikning `created_at` i o'zgarmaydi.
  - `users.full_name` mavjud userda hech qachon o'zgarmaydi (company yaratishda ham, egasini almashtirishda ham).
  - `/app/me`: a'zolik ismi NULL bo'lsa (ismsiz eski yozuv) `users.full_name` qaytadi.
- **A'zolar ro'yxati tartibi:** owner, keyin `created_at`, keyin telefon.
- **Migratsiya.**
  - `role` default'i `user` (oldin `owner`): rol berilmagan yozuv bitta owner indeksiga urilmasin.
  - Down: `user` → `staff`, indeks va `full_name` olib tashlanadi. Ikkinchi owner'lar qaytib owner bo'lmaydi (bu ma'lumot saqlanmaydi).
- **Admin panel.** Dialog sarlavhasi va tugmasi "Egasini almashtirish", yuborish tugmasi "Almashtirish", izoh "Kiritilgan raqam kompaniya egasi bo'ladi. Oldingi egasi xodim bo'lib qoladi.". `components/ui/native-select.tsx` endi ishlatilmaydi, UI to'plamida qoldirildi.
- **Testlar.**
  - `ReplaceOwner` ning uch holati (a'zo ko'tariladi, owner'ning o'z raqami, boshqa kompaniya useri) birinchi sikl kodi bilan darhol o'tdi: xatti-harakat `SetCompanyOwner` so'rovidan keladi va u o'z siklida RED → GREEN bo'lgan. Testlar mutatsiya bilan tekshirildi: `DemoteCompanyOwner` olib tashlansa uchtasi yiqiladi.
  - Atomiklik alohida sikl bo'ldi: birinchi versiya tranzaksiyasiz yozildi, `pgtest.FailInserts` testi uni yiqitdi, keyin tranzaksiya qo'shildi.
- **O'zgargan mavjud testlar** (talab o'zgargani uchun):
  - `manager` / `staff` fixture'lari → `user` (6 ta Go test fayli, ikkala ilova mock'i, "Menejer" → "Xodim").
  - `TestAddUser*`, `TestAddCompanyUser`, `TestUpsertCompanyUser`, admin "User qo'shish" va `memberSchema` testlari o'chirildi: kod o'chgan. O'rnida `TestReplaceOwner*`, `TestReplaceCompanyOwner`, `TestAddCompanyUser` (yangi so'rov), `TestSetCompanyOwner`, "Egasini almashtirish" va `ownerSchema` testlari.
  - `TestAdminRoutesNeedASession` ro'yxatida yangi route.
  - Web mock'da Anor Servis'ning ikkinchi owner'i (Zarina) `user` bo'ldi.

## 2-bosqich qarorlari (2026-10-03)

Bajarildi: kirish a'zolik bo'yicha (`HasCompany`), `Refresh` a'zoliksiz sessiyani tugatadi, `requireAccess` va `requireOwner`, `company` servisida xodimlar, `/app/employees` (GET, POST, PATCH, DELETE), web mock'ida kirish qoidalari. Reja: `docs/superpowers/plans/2026-10-03-employees-stage2-employees-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Tekshiruv tartibi** (`/app` ning `auth` dan tashqari qismi): token (401) → a'zolik (401 `unauthorized`) → obuna (402) → owner (403 `owner_only`). Muddati o'tgan kompaniyaning owner'i ham `/app/employees` da 402 oladi.
- **Rol manbai.** `requireAccess` rolni bazadan o'qib context'ga qo'yadi (`currentRole`), `requireOwner` shuni ishlatadi. Token'dagi `role` claim'i avvalgidek beriladi, lekin ruxsatda ishlatilmaydi. Mutatsiya bilan tekshirildi: claim'ga ishonilsa, egasi almashgandan keyingi test yiqiladi.
- **`Refresh`.** A'zoligi qolmagan user uchun token bekor qilingan holda qoladi, yangisi berilmaydi, javob 401 `invalid_refresh_token` (cookie o'chiriladi).
- **Xodim API'si.**
  - `{phone}` saqlangan ko'rinishda; noto'g'ri raqam 404 `not_found` ("Xodim topilmadi").
  - `PATCH` va `DELETE` bitta `… AND role = 'user'` so'rovi. Qator qaytmasa sabab `GetUserCompany` bilan aniqlanadi: owner → 409 `cannot_change_owner`, aks holda 404. Boshqa kompaniya xodimi ham 404: kompaniya doim token'dan olinadi.
  - `POST` javobi yangi raqam va boshqa kompaniyadagi raqam uchun bir xil (201, kiritilgan ism).
  - Kompaniya mavjudligi alohida tekshirilmaydi: uni `requireAccess` allaqachon tasdiqlagan.
- **`cmd/api/main.go`:** bitta `company.Service` admin va app API'siga beriladi.
- **Web.** `lib/api.ts` o'zgarmadi: mavjud "401 `unauthorized` → refresh → qayta yuborish" oqimi yangi qoidani o'zi hal qiladi. Buni ikki test ko'rsatadi (kompaniyadan chiqarilgan a'zo kompaniyasiz davom etadi; yagona kompaniyasidan chiqarilgan user sessiyasi tugaydi). Mock'dagi `/app/employees` handler'lari va a'zolik ismlari 4-bosqichda, sahifa testlari bilan yoziladi.
- **O'zgargan mavjud testlar** (talab o'zgargani uchun):
  - Kompaniyasiz user bilan kirgan yoki SMS kutgan testlarda userga kompaniya berildi: `TestSendCode`, `TestLogout`, `TestMeNeedsAValidAccessToken`, `TestAdminAndUserTokensDoNotCross`, Mini App cookie testlari (app); `TestSendCode*`, `TestLogoutRevokesTheRefreshToken` (auth); `TestSaveLinksAChatToAPhone` (user); `TestSharedContactIsKept` (userbot).
  - `TestRefreshFollowsTheMembershipAsItIsNow`: userga ikkinchi kompaniya berildi; yagona a'zolik o'chgan holat endi alohida testda (sessiya tugaydi).
  - O'chirildi (kodi o'chgan): `TestUserExists`, `TestIsCompanySubscriptionActive`, `TestSubscriptionActive`. O'rnida `TestHasCompany`, `TestGetCompanyAccess`, `TestAccess`.

## 3-bosqich qarorlari (2026-10-03)

Bajarildi: `app/(app)/layout.tsx` → `AppShell` (darvoza + qobiq), `Sidebar` (yig'iladigan ustun + telefonda `Sheet`), `Topbar` (menyu tugmasi, mavzu, profil menyusi), `lib/nav.ts`, `lib/use-sidebar.ts`; `Dashboard` faqat mazmun. Reja: `docs/superpowers/plans/2026-10-03-employees-stage3-sidebar.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Darvoza qobiqda.** `AppShell` `/app/me` ni kutadi: 402 → `/expired`, kompaniya tanlanmagan → `/select-company`, xato → sabab va "Qayta urinish". Sahifa faqat kompaniyasi bor sessiyada chiziladi, shuning uchun `(app)` ostidagi sahifalar yuklanish va yo'naltirishni o'zi qilmaydi.
- **Bo'limlar rol bo'yicha.** `navFor(role)`: rol hali noma'lum bo'lsa (server HTML'i, yuklanish) faqat hammaga ochiq bo'limlar ko'rinadi, `ownerOnly` bo'lim owner ekani ma'lum bo'lgach chiqadi. Joriy bo'lim: `/` faqat `/` da, boshqasi o'z yo'li va uning ostida.
- **Yig'ilgan holat** `localStorage["sidebar_collapsed"]` da (`"true"` / `"false"`), `useSyncExternalStore` bilan o'qiladi: server HTML'i doim yoyilgan, boshqa tabdagi o'zgarish ham ta'sir qiladi. Storage rad etsa (yopiq WebView) sidebar yoyilgan qoladi.
- **Keng va tor ekran** CSS bilan ajraladi (`md:`): ustun `hidden md:flex`, "Menyu" tugmasi `md:hidden`. `Sheet` doim mavjud, faqat tugma bilan ochiladi.
- **O'lchamlar** enwin'dagidek: 256px ↔ 64px, sarlavha va topbar 56px, sheet 288px.
- **Profil menyusi:** tugma nomi "Profil" (ekranda ism va ikonka; telefonda faqat ikonka). Ichida ism va telefon, "Kompaniyani almashtirish" (ishlatsa bo'ladigan boshqa kompaniya bo'lsa), "Chiqish". Dashboard'dagi "Kompaniyani almashtirish" havolasi ham qoldi.
- **Mini App:** mavzu tugmasi va "Chiqish" yo'q; profil menyusi ism va telefonni ko'rsatadi.
- **Logo fayli yo'q:** belgi sifatida `bg-sidebar-primary` kvadratda "H". (2026-10-04'da logotip bilan almashtirildi: `2026-10-04-logo-design.md`.)
- **Yordamchi nomlar** (o'zbekcha): "Menyu", "Bo'limlar", "Menyuni yig'ish", "Menyuni yoyish", "Profil".
- **"Xodimlar" sahifasi** hali yo'q (4-bosqich): havola owner'ga ko'rinadi, sahifa 404.
- **Ko'chgan testlar.** Dashboard'ning yo'naltirish va yuklash xatosi testlari `app-shell.test.tsx` ga, chiqish, mavzu va Telegram testlari `topbar.test.tsx` ga o'tdi. e2e'da sahifa mazmuni `main` ichidan qidiriladi (kompaniya nomi endi sidebar va topbar'da ham bor), chiqish profil menyusi orqali.
- **Tekshiruv.** Dizayn Playwright skrinshotlari bilan ko'rildi (desktop yoyilgan va yig'ilgan, telefon menyusi, profil menyusi). curl: sessiyasiz `/` → `/login`; cookie bilan server HTML'ida qobiq bor, `/login` va `/select-company` da yo'q.

## 4-bosqich qarorlari (2026-10-03)

Bajarildi: `/employees` sahifasi (`EmployeesPage`), `AddEmployeeDialog`, `RenameEmployeeDialog`, `RemoveEmployeeButton`, `PhoneField`, `lib/schemas.ts`, `useEmployees`; mock API'da `/app/employees`; e2e; README'da "Rollar va xodimlar". Reja: `docs/superpowers/plans/2026-10-03-employees-stage4-employees-page.md`. Backend o'zgarmadi.

Amalga oshirishda belgilangan tafsilotlar:

- **Ikki dialog.** Yuqoridagi jadvalda bitta `employee-dialog.tsx` yozilgan edi. Qo'shish (telefon va ism) va tahrirlash (faqat ism, telefon ko'rsatiladi) alohida fayllarda: maydonlari, so'rovi va matnlari boshqa, umumiy qismi `TextField` va `PhoneField` da.
- **Ro'yxat** `DataList` bilan: keng ekranda jadval (Telefon, Ism, Rol, Amallar), telefonda kartochkalar. Owner birinchi, "Egasi" belgisi va o'z qatorida "Siz"; amallar faqat `user` qatorlarida (owner kartochkasida "Amallar" qatori yo'q). Ro'yxatda faqat owner bo'lsa, "Hali xodim yo'q…" izohi chiqadi.
- **Rol darvozasi.** `user` `/employees` ni ochsa, hech narsa chizilmaydi, ro'yxat so'ralmaydi va u `/` ga qaytariladi. Sessiyasiz so'rovni avvalgidek `proxy.ts` `/login` ga yuboradi.
- **Kesh kaliti** `["employees", companyId]`: kompaniya almashsa, boshqa kompaniyaning ro'yxati ko'rinmaydi. Qo'shish, tahrirlash va o'chirishdan keyin ro'yxat qayta so'raladi.
- **Xabarlar.** Forma xatolari: "Telefon raqamini to'liq kiriting", "Ismni kiriting". API rad etsa (409 `already_member` va boshqalar), uning xabari dialog ichida chiqadi va dialog ochiq qoladi; o'chirish rad etilsa, xabar toast'da. Muvaffaqiyat: "Xodim qo'shildi", "Ism o'zgartirildi", "Xodim o'chirildi". Dialog har ochilganda toza holatdan boshlanadi.
- **Sessiya holati o'zgarsa.** Xodimlar sahifasi `/app/me` dan tashqari so'rov yuboradigan birinchi sahifa, shuning uchun query client'ga qoida qo'shildi: 402 `subscription_expired` yoki 403 `owner_only` kelsa, `/app/me` qayta so'raladi. Obuna tugagan bo'lsa, qobiq `/expired` ga olib boradi (SPEC: `/expired` obuna tugaganda ko'rsatiladi). Egasi almashtirilgan bo'lsa, "Xodimlar" bo'limi yo'qoladi va sahifa bosh sahifaga qaytaradi (`logic/roles.md`, 5-bo'lim). `/app/me` ning o'z rad javobi qayta so'ralmaydi, aks holda so'rov aylanib qolardi.
- **`PhoneField`** login'dagi `+998` maydonidan ajratildi; login va "Xodim qo'shish" bitta komponentni ishlatadi.
- **UI nusxalari** admin'dan olindi: `dialog` ("Yopish"), `alert-dialog`, `table`, `data-list`, `text-field`.
- **Mock API** (`mocks/`) Go API'ni takrorlaydi: tekshiruv tartibi (401 → 401 → 402 → 403), status, kod va xabarlar; ism a'zolikda saqlanadi, `/app/me` tanlangan kompaniyadagi ismni beradi. Buni `mocks/handlers.test.ts` mahkamlaydi.
- **e2e fixture.** Test tugaganda sahifalar mock o'chirilishidan oldin yopiladi: aks holda kechikkan `/app/me` so'rovi dev serverga o'tib, chiqishda "Failed to proxy" qatorini qoldirardi.
- **Tekshiruv.** curl (dev stack, user app origin'i orqali): sahifa sessiyasiz `/login` ga, sessiya bilan 200; qo'shish, tahrirlash, o'chirish va barcha rad javoblari. Haqiqiy brauzerda (Playwright, haqiqiy Go API, SMS kodi log'dan): owner oqimi desktop va 375px da, xodim va multi-user kirishi; skrinshotlar ko'rib chiqildi.

Shu bilan 0–4 bosqichlar tugadi.

## Production'ga deploy (2026-10-03)

Foydalanuvchi tasdig'i bilan `deploy/ship.sh` orqali `10fd427` deploy qilindi.

- **Oldin.** Prod'da migratsiya 3, 1 kompaniya va 1 user (owner) bor edi: migratsiya 00004 hech kimning rolini o'zgartirmadi va hech kim kirish huquqini yo'qotmadi. Deploy oldidan alohida dump olindi: `/var/backups/hisob24-v2/hisob24-pre-00004-20261003-1535.sql.gz` (backup rotatsiyasi uni 14 kundan keyin o'chiradi).
- **Keyin.** Migratsiya 4: rol faqat `owner` / `user`, `user_companies_one_owner` indeksi bor, a'zolik ismi to'ldirilgan; qatorlar soni o'zgarmagan. API, admin va web healthy, API log'ida xato yo'q.
- **Sessiyasiz tekshiruvlar** (prod'da SMS yuborilmadi): `/employees` sahifasi ochiladi (oldin 404), `/api/app/employees` 401 `unauthorized` (oldin 404), `PUT /admin/companies/{id}/owner` sessiya so'raydi, eski `POST …/users` 404, ikkala webhook sirsiz so'rovga 401 beradi.
- **Hodisa.** Build paytida lokal tarmoq sababli SSH ulanishi uzildi va `ship.sh` 255 bilan tugadi. Serverdagi `deploy/deploy.sh` esa oxirigacha bajarilgan edi: holat serverda tekshirib tasdiqlandi, hech narsa qayta ishga tushirilmadi.
- **Qaytarish nuqtasi.** Oldingi kod `/var/www/hisob24-v2.prev` da (migratsiya 3 gacha).
