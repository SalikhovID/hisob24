# Lokatsiyalar (filiallar) — dizayn

Sana: 2026-10-07. Holat: foydalanuvchi reja sifatida tasdiqlagan (reja savollari va `/interview` bilan); amalga oshirilmoqda. Qoidalar: `logic/locations.md`. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-07-locations-stage<N>-*.md`.

## Maqsad

Foydalanuvchining so'zlari: "stukturaga qo'shimcha qo'shish kerak, lokatsiya qo'shiladi, by default hammaga 1 donadan set qilib chiqish kerak, keyingi lokatsiyalar admin paneldan qo'shib beriladi, 2 va undan ortiq lokatsiyalar bo'lsa tepadan lokatsiyadan lokatsiyaga o'tib olish imkoni bo'ladi, xodimlarga lokatsiya bo'yicha cheklov ham qo'shsa bo'ladi, by default barcha lokatsiyaga ruxsati bo'ladi, lokatsiya faqat tasklarga aloqador, bir lokatsiyani tasklari boshqa lokatsiyada turganda ko'rsatilmaydi, inputlar sozlamalari, xodim va mijozlar umumiy".

Bungacha: kompaniya → mijozlar, vazifalar (bosqich, tur, maydon), xodimlar (rollar), sozlamalar; vazifa kompaniyaniki. Kerak: kompaniyaning **lokatsiyalari** (filiallar). Har kompaniya bitta tayyor lokatsiya bilan boshlaydi, qolganini platforma admini admin paneldan qo'shadi. Har vazifa aynan bitta lokatsiyada turadi; a'zo bir vaqtda bitta lokatsiyada ishlaydi va faqat shu lokatsiya vazifalarini ko'radi. Egasi xodimni ayrim lokatsiyalar bilan cheklashi mumkin; standart holat: hammasi. Mijozlar, xodimlar, sozlamalar (turlar, maydonlar, dropdownlar, bosqichlar), rollar lokatsiyaga bog'liq emas. `docs/SPEC.md` da yo'q yangi funksiya (Mijozlar, Vazifalar, Rollar kabi); qoidalar `logic/locations.md` da.

## Foydalanuvchi qarorlari (2026-10-07)

Reja savollari:

| # | Savol | Qaror |
|---|---|---|
| 1 | Vazifaning lokatsiyasi tahrirda o'zgaradimi | **Yo'q.** Yaratilganda joriy lokatsiyaga tushadi, keyin mijoz va tur kabi o'zgarmaydi; formada maydon yo'q |
| 2 | Mijoz sahifasidagi "Vazifalar" | **Ruxsatli hamma lokatsiya**, 2+ lokatsiyada har vazifada lokatsiya belgisi; API'da `location_id` berilmasa ruxsatli hammasi |
| 3 | Admin paneldagi amallar | **Qo'shish, nomini o'zgartirish, bo'shini o'chirish.** Faol vazifasi bor (409 `location_in_use`) va kompaniyaning yagona lokatsiyasi (409 `last_location`) o'chirilmaydi |
| 4 | Jarayon | **To'xtovsiz ketma-ket**, har GREEN'dan keyin commit, yakunda bitta hisobot; deploy alohida so'raladi (CLAUDE.md "tasdiqdan keyin" qoidasidan tasdiqlangan chetlanish, mijozlar 24 / vazifalar 22-qarorlari kabi) |

`/interview`:

| # | Savol | Qaror |
|---|---|---|
| 5 | Mas'ul va lokatsiya | **Formada yashiriladi, API rad etadi.** "Mas'ul" tanlovida faqat vazifa lokatsiyasida ishlaydigan a'zolar (egasi va "hammasi" xodimlar har doim); API 400 "Mas'ul bu lokatsiyada ishlamaydi". `GET /app/members` har a'zoning lokatsiyalarini qaytaradi |
| 6 | Cheklanayotgan xodim boshqa lokatsiyalarda mas'ul | **Vazifalar unda qoladi** (u ko'rmaydi); cheklash dialogi "Boshqa lokatsiyalarda N ta vazifaga mas'ul" deb ogohlantiradi, saqlash mumkin; "Mas'ul" filtrida u ko'rinaveradi |
| 7 | Telefonda tanlovchi joyi | **Topbar o'rtasida**, kompaniya nomi va profil orasida (select ~130px, nom qisqaradi, balandlik o'zgarmaydi); keng ekranda topbar'ning chap chetida |
| 8 | Havola orqali boshqa lokatsiya vazifasi ochilsa | **Tanlovchi o'zgarmaydi**, sahifa "Lokatsiya" faktini ko'rsatadi; "Vazifalar"ga qaytilsa joriy lokatsiya ro'yxati |
| 9 | Tayyor lokatsiya nomi | **"Asosiy"** (migratsiya mavjudlarga, `company.Create` yangisiga); admin nomini o'zgartiradi; kompaniya yaratish formasi o'zgarmaydi |
| 10 | Kompaniyada 3 ta, xodimga 1 ta ruxsat | **Topbar'da hech narsa**: tanlovchi faqat 2+ ruxsatli lokatsiyada |
| 11 | Admin xodimning yagona lokatsiyasini o'chirdi | **O'chiriladi, egasi tuzatadi**: xodim "Sizga lokatsiya biriktirilmagan" ko'radi, Xodimlar ro'yxatida "—", egasi dialogda yangisini beradi; admin to'silmaydi, huquq kengaymaydi |
| 12 | Matnlar (pastdagi jadval) | **Ma'qul** |

## Reja bilan tasdiqlangan qarorlar

1. **Atama "Lokatsiya"** (foydalanuvchining so'zi); kod: `locations`, `location_id`, `member_locations`.
2. **Joriy lokatsiya client'da**, token'da emas: brauzerda `location:<kompaniya>:<telefon>` (`useKept`), har vazifa so'rovida `location_id`. Kompaniya almashtirish kabi yangi token kerak emas, almashtirish bir zumda. Server har so'rovda a'zoning ruxsatli lokatsiyalar to'plamini bazadan o'qiydi (`GetCompanyAccess`, rollar kabi) va faqat shu to'plam ichida ishlaydi. Almashtirilganda ro'yxat 1-sahifaga qaytadi, tur / bosqich / qidiruv / mas'ul filtrlari qoladi.
3. **Tanlovchi topbar'da, har sahifada** (`SelectBox`, `aria-label="Lokatsiya"`, `MapPinIcon`), faqat ruxsatli lokatsiya 2+ bo'lsa. Tanlov vazifalar ro'yxati, kanban va qo'shish formasiga ta'sir qiladi, boshqa bo'limlarga emas.
4. **Cheklovni faqat egasi belgilaydi** (`requireOwner`, 403 `owner_only`), rollar kabi: aks holda `employees.edit` ruxsatli xodim o'ziga lokatsiya ochib olardi. Egasining o'zi hamma lokatsiyada (baza CHECK). Xodimlar sahifasida egasiga "Lokatsiyalar" dialogi (`MapPinIcon`), faqat kompaniyada 2+ lokatsiya bo'lsa.
5. **Standart: hammasi** (`user_companies.all_locations = true`); cheklangan xodim `member_locations` qatorlari bilan. Keyin qo'shilgan lokatsiya "hammasi" xodimga o'zi ochiladi, cheklanganga egasi qo'shadi. Bo'sh ro'yxat qabul qilinmaydi (400 "Kamida bitta lokatsiyani tanlang"); "Barchasi"ga qaytarish `null`.
6. **Ruxsatsiz lokatsiya bilan so'rov 403 `forbidden`** (`?location_id=`, `POST /app/tasks` `location_id`): begona, o'chirilgan yoki cheklov bilan yopilgan lokatsiya bir xil. Client `forbidden` da `/app/me` ni qayta so'raydi (`standingChanged`), tanlovchi ruxsatli birinchisiga tushadi. Ruxsatsiz lokatsiyadagi vazifa ID bo'yicha 404 "Vazifa topilmadi" (begona kompaniyaniki kabi).
7. **Lokatsiya yashiriladi** (`deleted_at`), bazadan o'chmaydi (bosqich va tur kabi); nomi bo'shaydi. Cheklangan xodimning qatorlariga tegilmaydi: ruxsatli to'plam faqat jonli lokatsiyalardan hisoblanadi (11-qaror).
8. **Lokatsiyasiz xodim** (0 ta ruxsatli): "Vazifalar" bo'limi menyuda qoladi (`tasks.view`), sahifa "Sizga lokatsiya biriktirilmagan" kartasini ko'rsatadi, qo'shish tugmasi yo'q; API: ro'yxat bo'sh, har vazifa 404, qo'shish 400.
9. **Tahrirda mas'ul** (5-qaror bilan): forma mas'ullarni **vazifaning** lokatsiyasi bo'yicha filtrlaydi; hozirgi mas'ul u yerda ishlamasa "Ism (bu lokatsiyada ishlamaydi)" varianti bilan tanlangan turadi (chiqarilgan a'zo kabi); o'zgartirilmasa qayta tekshirilmaydi (mavjud qoida), boshqasi tanlansa yangi mas'ul a'zo **va** shu lokatsiyada bo'lishi shart.
10. **Ogohlantirish soni** (6-qaror): dialog ochilganda har lokatsiya uchun `GET /app/tasks?assignee=<telefon>&location_id=<id>&page=1` (`useQueries`, egasi hammasini so'ray oladi) va `total` lar; tanlanmagan lokatsiyalar yig'indisi > 0 bo'lsa ogohlantirish. Yangi endpoint yo'q.
11. **Vazifa sahifasida "Lokatsiya" fakti** (2+ ruxsatli lokatsiyada), tarixga yozilmaydi (o'zgarmaydi). Ro'yxat va kanban sarlavhasi o'zgarmaydi: lokatsiyani tepadagi tanlovchi aytadi.
12. **Ruxsat katalogi o'zgarmaydi**: lokatsiya cheklovi ruxsat emas, a'zolikning o'z xususiyati; `tasks.*` ruxsatlari ruxsatli lokatsiyalar ichida amal qiladi.
13. **`Member` sxemasi umumiy** (app va admin, `/app/employees` va `/app/members`): `locations: Location[] | null` (null = hammasi). Admin UI a'zolar jadvalini o'zgartirmaydi.
14. **Egasi almashtirilganda** yangi egasi `all_locations = true` (qatorlari o'chadi); eski egasi xodim sifatida hammasida qoladi. Xodim o'chirilsa qatorlari a'zolik bilan ketadi (FK CASCADE); qayta qo'shilsa hammasida.
15. **Mock seed:** har kompaniyaga "Asosiy"; Nok Market (2) ga qo'shimcha "Chilonzor"; Nok Market'ga yangi xodim DILNOZA (`998906667788`, Telegram `TG_DILNOZA = 1005`) — mavjud testlar tegmaydi (Olma Savdo 1 lokatsiyali qoladi).

## Matnlar (12-qaror bilan tasdiqlangan)

| Joy | Matn |
|---|---|
| Tanlovchi | `aria-label` "Lokatsiya" |
| Vazifalar sahifasi, lokatsiyasiz | "Sizga lokatsiya biriktirilmagan" / "Kompaniya egasi lokatsiya biriktirishi kerak." |
| Xodimlar ustuni | "Lokatsiyalar": "Barchasi" / nomlar `, ` bilan / "—" |
| Cheklash dialogi | "Lokatsiyalarni o'zgartirish"; checkbox "Barcha lokatsiyalar"; izoh "Xodim faqat belgilangan lokatsiyalarning vazifalarini ko'radi va qo'shadi."; ogohlantirish "Boshqa lokatsiyalarda N ta vazifaga mas'ul"; xato "Kamida bitta lokatsiyani tanlang"; toast "Lokatsiyalar o'zgartirildi" |
| Vazifa API | "Lokatsiyani tanlang", "Mas'ul bu lokatsiyada ishlamaydi", ro'yxatda "Lokatsiya noto'g'ri" |
| Tahrir formasi | "Ism (bu lokatsiyada ishlamaydi)" |
| Vazifa sahifasi | fakt "Lokatsiya" |
| Mijoz sahifasi | ustun "Lokatsiya" (`Badge variant="outline"`) |
| Admin | bo'lim "Lokatsiyalar", "Lokatsiya qo'shish", "Nomini o'zgartirish", "O'chirish"; toast "Lokatsiya qo'shildi" / "Nomi o'zgartirildi" / "Lokatsiya o'chirildi"; 400 "Nomni kiriting" / "Nom 60 belgidan oshmasin"; 404 "Lokatsiya topilmadi"; 409 "Bu nomli lokatsiya allaqachon bor", "Bu lokatsiyada N ta vazifa bor", "Kompaniyaning yagona lokatsiyasi o'chirilmaydi" |

## Yondashuvlar

**Tanlangan:** `locations` jadvali + `tasks.location_id` (NOT NULL, kompaniya bo'yicha FK) + a'zolikda `all_locations` va `member_locations`; ruxsatli to'plam har so'rovda `GetCompanyAccess` bilan (`user.Access.LocationIDs`), `/app/me` da `locations`; joriy lokatsiya client'da, `location_id` parametr.

Rad etilganlar:
- *Token'da lokatsiya* (`switch-location`, kompaniya kabi): har almashtirish refresh token rotatsiyasi, `issue`/`Refresh`/`SwitchCompany` o'zgaradi, foydasi yo'q: lokatsiya faqat vazifalarga tegadi.
- *Cheklov rol ichida*: foydalanuvchi xodim bo'yicha so'radi; rol kompaniya bo'yicha umumiy.
- *`user_companies.location_ids BIGINT[]`*: FK yo'q, begona ID kiradi; jadval + FK loyiha uslubi.
- *"Qator yo'q = hammasi"* (bayroqsiz): lokatsiya o'chirilganda qatorlar yo'qolsa xodim kutilmaganda hammasini ko'rib qolardi; bayroq aniq va egasi uchun CHECK beradi.
- *Ogohlantirish uchun yangi endpoint* (`…/assigned-counts`): mavjud ro'yxat `total` i yetadi.

## Spec'dan chetlanishlar

| # | Spec / qoida | Yangi | Sabab |
|---|---|---|---|
| 1 | API ro'yxati (6-bo'lim) | admin: `/admin/companies/{id}/locations` (POST), `…/{locationId}` (PATCH, DELETE); app: `PUT /app/employees/{phone}/locations`; `GET /app/tasks` ga `?location_id=`; `POST /app/tasks` ga `location_id` | yangi funksiya |
| 2 | `/app/me` | + `locations` (ruxsatli, jonli, ID tartibida; kompaniya tanlanmagan bo'lsa `[]`) | tanlovchi shundan quriladi |
| 3 | `CompanyDetail` (admin) | + `locations: AdminLocation[]` (`tasks_count` bilan) | admin sahifasi |
| 4 | `Member` | + `locations: Location[] \| null` (`/app/employees`, `/app/members`, admin) | xodimlar jadvali, mas'ul tanlovi |
| 5 | `Task` | + `location_id` | vazifa sahifasi, mijoz sahifasidagi belgi |
| 6 | `POST /admin/companies` (5.3) | kompaniya bilan "Asosiy" lokatsiya ham yoziladi | 9-qaror |
| 7 | `logic/tasks.md` 3.3, 4.1, 4.2, 6 | doimiy maydon "Lokatsiya" (yaratishda, o'zgarmaydi); mas'ul shu lokatsiyada ishlashi shart; ro'yxat lokatsiya bo'yicha | 1, 5-qarorlar |

## Ma'lumotlar modeli: `backend/migrations/00010_locations.sql`

```sql
-- +goose Up
CREATE TABLE locations (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (company_id, id)                      -- vazifa va a'zo FK'lari uchun
);
CREATE UNIQUE INDEX locations_name ON locations (company_id, lower(name)) WHERE deleted_at IS NULL;

-- Har mavjud kompaniyaga tayyor lokatsiya; yangisiga company.Create (SeedLocation).
INSERT INTO locations (company_id, name) SELECT id, 'Asosiy' FROM companies;

ALTER TABLE tasks ADD COLUMN location_id BIGINT;
UPDATE tasks t SET location_id = l.id FROM locations l WHERE l.company_id = t.company_id;
ALTER TABLE tasks ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_location_fk FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id);
CREATE INDEX tasks_location ON tasks (location_id);

-- Standart: hamma lokatsiya. Egasi har doim hammasida (CHECK, rol CHECK'i kabi).
ALTER TABLE user_companies ADD COLUMN all_locations BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_companies ADD CONSTRAINT user_companies_owner_has_all_locations CHECK (role <> 'owner' OR all_locations);
CREATE TABLE member_locations (
    user_phone   TEXT NOT NULL,
    company_id   BIGINT NOT NULL,
    location_id  BIGINT NOT NULL,
    PRIMARY KEY (user_phone, company_id, location_id),
    FOREIGN KEY (user_phone, company_id) REFERENCES user_companies (user_phone, company_id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id)
);
CREATE INDEX member_locations_location ON member_locations (location_id);

-- +goose Down
DROP TABLE member_locations;
ALTER TABLE user_companies DROP COLUMN all_locations;   -- CHECK u bilan ketadi
ALTER TABLE tasks DROP COLUMN location_id;              -- FK va indeks u bilan ketadi
DROP TABLE locations;
```

Lokatsiyalar tartibi `id` bo'yicha (qayta tartiblash yo'q). Migratsiya testlari: har kompaniyaga "Asosiy" (mavjud vazifalar unga tushadi), egasi CHECK'i, begona lokatsiya FK 23503, nom indeksi, Down.

## API (`backend/openapi.yaml` → `make api-client`)

Sxemalar: `Location {id, name}`, `AdminLocation {id, name, tasks_count, created_at}`, `LocationInput {name}` (1–60), `EmployeeLocationsInput {location_ids: int64[] | null}`; `Me` + `locations: Location[]`; `Member` + `locations: Location[] | null`; `CompanyDetail` + `locations: AdminLocation[]`; `Task` + `location_id`; `TaskCreate` + `location_id` (required). Response'lar: `LocationNotFound` (404), `LocationConflict` (409 `name_taken`, `location_in_use`, `last_location`); `Forbidden` qayta ishlatiladi.

| Endpoint | Kim | Javob / rad |
|---|---|---|
| `GET /admin/companies/{id}` | admin | `CompanyDetail.locations` (jonli, ID tartibida, har birida faol vazifalar soni) |
| `POST /admin/companies/{id}/locations {name}` | admin | 201 `AdminLocation`; 400; 404 "Kompaniya topilmadi"; 409 `name_taken` |
| `PATCH /admin/companies/{id}/locations/{locationId} {name}` | admin | 200; 404 "Lokatsiya topilmadi"; 409 `name_taken` |
| `DELETE /admin/companies/{id}/locations/{locationId}` | admin | 204; 404; 409 `last_location`, `location_in_use` (shu tartibda); cheklangan xodimlar to'silmaydi (11-qaror) |
| `GET /app/me` | a'zo | + `locations` |
| `GET /app/members`, `GET /app/employees` | avvalgidek | `Member.locations` |
| `PUT /app/employees/{phone}/locations {location_ids}` | egasi (`requireOwner`, rollar guruhida) | 200 `Member`; 400 "Kamida bitta lokatsiyani tanlang"; 404 "Xodim topilmadi" / "Lokatsiya topilmadi" (begona, o'chirilgan); 409 `cannot_change_owner` |
| `GET /app/tasks?location_id=` | `tasks.view` | berilsa shu lokatsiya (ruxsatsiz → 403 `forbidden`; son emas → 400 "Lokatsiya noto'g'ri"), berilmasa ruxsatli hammasi (mijoz sahifasi, ogohlantirish sanog'i) |
| `POST /app/tasks {location_id, …}` | `tasks.create` | yo'q yoki 0 → 400 "Lokatsiyani tanlang"; ruxsatsiz → 403 `forbidden` (handler'da, `customers.create` tekshiruvi kabi). Tekshiruv tartibi: nom, muddat, lokatsiya, tur, bosqich, mas'ul (a'zo emas → "Mas'ul kompaniya a'zosi emas"; shu lokatsiyada emas → "Mas'ul bu lokatsiyada ishlamaydi"), maydonlar, mijoz |
| `PUT /app/tasks/{id}` | `tasks.edit` | o'zgargan mas'ul vazifa lokatsiyasida ishlashi shart (o'sha xabar); o'zgarmagani qayta tekshirilmaydi |
| `GET/PUT/DELETE /app/tasks/{id}`, `PATCH …/stage`, `GET …/history` | avvalgidek | ruxsatsiz lokatsiyadagi vazifa 404; ruxsatli, joriy bo'lmagan lokatsiyadagi vazifa ochiladi va o'zgartiriladi (havola orqali) |

Contract testi (`internal/httpx/openapi_test.go`) yangi route'larni o'zi talab qiladi.

## Backend

Qatlam: handler → service → sqlc.

- **So'rovlar.** Yangi `internal/db/queries/locations.sql`: `SeedLocation` ("Asosiy"), `ListLocations` (kompaniya, jonli, `tasks_count` subquery), `GetLocation` (jonli), `CreateLocation`, `RenameLocation`, `DeleteLocation` (soft, RETURNING), `CountLocations` (jonli), `CountLocationTasks` (faol vazifalar), `ListMemberLocations(user_phone, company_id)` (`id, name`: jonli va `uc.all_locations OR EXISTS member_locations`), `ListCompanyMemberLocations(company_id)` (`user_phone, location_id, name`, a'zolar ro'yxatlari uchun), `MemberInLocation(user_phone, company_id, location_id) :one` (EXISTS; mas'ul tekshiruvi), `SetMemberAllLocations` (`… AND role = 'user' RETURNING *`), `DeleteMemberLocations`, `AddMemberLocation`. `users.sql`: `GetCompanyAccess` + `all_locations` va `location_ids bigint[]` (array_agg subquery, bo'shi `'{}'`); `ListCompanyUsers` / `GetCompanyMember` + `all_locations`; `SetCompanyOwner` `DO UPDATE … all_locations = true`. `tasks.sql`: `CreateTask` + `location_id`; `GetTask`, `ListTasks`, `CountTasks`, `UpdateTask`, `MoveTask`, `DeleteTask` ga `t.location_id = ANY(sqlc.arg('location_ids')::bigint[])`; `GetTask`/`ListTasks` `t.location_id` ni qaytaradi. Har so'rovga `internal/db/*_test.go` da test.
- **`internal/user/profiles.go`.** `Access.LocationIDs []int64`; `Profiles.Locations(ctx, phone, companyID) []Location` (`/app/me` uchun).
- **`internal/company`.** `Location {ID, Name}`, `AdminLocation {Location, TasksCount, CreatedAt}`; `Member` + `AllLocations bool`, `Locations []Location`; `Members` va `member()` lokatsiyalarni `ListCompanyMemberLocations` bilan yig'adi. Yangi `locations.go`: `Locations`, `AddLocation` (`fields.CleanName`, `LockCompany` → 404, `fields.Taken` → 409), `RenameLocation`, `DeleteLocation` (tranzaksiya `LockCompanyCustomers` bilan: vazifa yozuvlari bilan navbat; 404 → `CountLocations` ≤ 1 → 409 `last_location` → `CountLocationTasks` > 0 → 409 `location_in_use` → soft delete), `SetEmployeeLocations(ctx, companyID, phone, ids *[]int64)` (telefon → `nil` hammasi / bo'sh 400 / har ID jonli va kompaniyaniki, takror bir marta → `SetMemberAllLocations` (qator yo'q → `whyNotAnEmployee`) → qatorlar; javob `member()`). `create.go`: `SeedLocation`. `members.go` `ReplaceOwner`: yangi egasining `member_locations` qatorlari o'chadi (`DeleteMemberLocations`), `SetCompanyOwner` bayroqni ko'taradi.
- **`internal/task`.** `Scope {CompanyID int64; LocationIDs []int64}` yetti vazifa metodida `companyID` o'rniga (`Create`, `Get`, `List`, `Update`, `Move`, `Delete`, `History`); bosqich va tur metodlari o'zgarmaydi. `Create(ctx, scope, by, typeID, locationID, in, cust)`: `locationID` 0 yoki scope'da yo'q → `errNoLocation` "Lokatsiyani tanlang" (muddatdan keyin, turdan oldin). `assigneeOf(ctx, q, companyID, locationID, raw)`: a'zo (`GetMemberName`) → `MemberInLocation` (yo'q → `errNotInLocation` "Mas'ul bu lokatsiyada ishlamaydi"); `Update` o'zgargan mas'ulni vazifaning lokatsiyasi bilan tekshiradi. `ListInput.LocationID` (0 = scope'ning hammasi). `Task.LocationID`. Bo'sh scope (lokatsiyasiz xodim): ro'yxat bo'sh, hamma vazifa 404, qo'shish 400.
- **`internal/app`.** `session.go`: `taskScope(r)` (`sessionCompany` + `currentAccess(ctx).LocationIDs`), `allowedLocation(ctx, id) bool`. `tasks.go`: `createTask` `location_id` ≠ 0 va ruxsatsiz → `forbidden(w)`; `listTasks` `?location_id=` (son emas → 400 "Lokatsiya noto'g'ri"; ruxsatsiz → 403); `taskJSON.LocationID`. `handler.go`: `me` ga `locations` (`h.profiles.Locations`); `requireOwner` guruhiga `PUT /employees/{phone}/locations` (`employees.go` `setEmployeeLocations`); `memberJSON` + `Locations *[]locationJSON` (null = hammasi; `/app/members` ham). `internal/admin`: `handler.go` ga 3 route, `companies.go` `addLocation` / `renameLocation` / `deleteLocation`, `json.go` `detailJSON.Locations`, `memberJSON.Locations`.
- **Testlar (TDD, table-driven, `pgtest`):** migratsiya; so'rovlar; `company/locations_test.go`; `user/profiles_test.go` (`LocationIDs`); `task/tasks_test.go` (`Scope`, lokatsiya va mas'ul tekshiruvlari); `app/*_test.go` (`?location_id=` 403/400/200, `POST` 403, `/app/me.locations`, `/app/members` lokatsiyalari, `PUT …/locations`, cheklov keyingi so'rovdanoq amal qiladi); `admin/companies_test.go`. Mutatsiya: `ListTasks` da `location_ids` sharti olib tashlansa cheklangan xodim testi yiqilishi; `GetCompanyAccess` `all_locations` ni e'tiborsiz qoldirsa yiqilishi.

Qayta ishlatiladi: `fields.CleanName` / `Taken` / `SameIDs`, `apperr`, `httpx.DecodeJSON` / `WriteError` / `JSON`, `pathID`, `company.whyNotAnEmployee`, `LockCompany`, `LockCompanyCustomers`, `GetMemberName`, `pgtest.New` / `FailInserts`, `newTestAPI` / `bearer`.

## User app (`apps/web`)

| Fayl | O'zgarish |
|---|---|
| `lib/types.ts` | `Location` |
| `lib/use-location.ts` (yangi) | `useLocation()`: `useMe().locations`, brauzerdagi tanlov `useKept(\`location:${companyId}:${phone}\`)`, `current` = eslangani (hali ruxsatli bo'lsa) yoki birinchisi yoki `null`; `choose(id)` |
| `lib/members.ts` (yangi) yoki `lib/tasks.ts` | `worksIn(member, locationId)` (`locations === null` yoki ichida); `assigneeOptions(members, locationId, task?)` (9-qaror: hozirgi mas'ul "(bu lokatsiyada ishlamaydi)" / "(chiqarilgan)") |
| `components/shell/location-switcher.tsx` (yangi) | 2+ lokatsiyada `SelectBox` (`aria-label="Lokatsiya"`, `MapPinIcon`, `h-8 w-fit max-w-[8.5rem] truncate`); 1 yoki 0 da hech narsa. `Topbar` ga: telefonda logo bloki va profil orasida (7-qaror), keng ekranda chapda; kompaniya nomi bloki `min-w-0 truncate` |
| `lib/queries.ts` | `TaskFilter.locationId: number \| null` (`location_id` parametr; `null` = berilmaydi), `StageFilter` ga ham; kalitlar filtr orqali o'zgaradi |
| `components/tasks/tasks-page.tsx`, `use-task-filter.ts` | `useLocation()`; `locationId` ro'yxat va kanban filtriga; lokatsiya almashganda `update({page: 1})` (2-qaror); `AddTaskDialog` ga `locationId`; lokatsiyasiz a'zo: "Sizga lokatsiya biriktirilmagan" kartasi, qo'shish tugmasi yo'q; `canAdd` ga `current !== null` |
| `components/tasks/task-board.tsx`, `task-dialog.tsx`, `task-form.tsx`, `edit-task-dialog.tsx` | `locationId` orqali o'tadi; `POST` tanasida `location_id`; `TaskFields` mas'ullarni `assigneeOptions` bilan (qo'shishda joriy, tahrirda vazifaning lokatsiyasi) |
| `components/tasks/task-page.tsx` | 2+ ruxsatli lokatsiyada `Fact "Lokatsiya"` (nomi `me.locations` dan; topilmasa chizilmaydi); `EditTaskDialog` ga `task.location_id` |
| `components/customers/customer-tasks.tsx` | `locationId: null` (ruxsatli hammasi); 2+ lokatsiyada "Lokatsiya" ustuni (`card: "tag"`, `Badge variant="outline"`) |
| `components/employees/employees-page.tsx` | 2+ lokatsiyada "Lokatsiyalar" ustuni: egasi va `locations === null` → "Barchasi", aks holda nomlar `, ` bilan, bo'sh → "—"; egasiga `EmployeeLocationsDialog` tugmasi (`user` qatorlarida) |
| `components/employees/employee-locations-dialog.tsx` (yangi) | `MapPinIcon` (`ActionTooltip` "Lokatsiyalarni o'zgartirish"); `CheckboxField` "Barcha lokatsiyalar" + har lokatsiyaga checkbox (`me.locations`, egasida hammasi; "Barchasi" belgilansa ro'yxat o'chiq); izoh; ogohlantirish (10-qaror); hech biri belgilanmasa "Kamida bitta lokatsiyani tanlang"; `PUT …/locations` → `employeesKey` va `membersKey` invalidatsiya, toast "Lokatsiyalar o'zgartirildi" |
| `lib/schemas.ts` | `employeeLocationsSchema` (`all` yoki kamida bitta ID) |
| `mocks/data.ts` | `LocationRow {id, companyId, name, deleted?}`, `db.locations` (har kompaniyaga "Asosiy", Nok Market'ga "Chilonzor"), `Membership.locationIds?: number[]` (yo'q = hammasi), `TaskRow.locationId`, DILNOZA (Nok Market xodimi, `TG_DILNOZA`), `locationsOf(phone, companyId)` (ruxsatli jonli), `worksIn`, `membersOf` ga `locations`, `seedTasks` lokatsiya bilan |
| `mocks/handlers.ts`, `mocks/tasks.ts` | `/app/me.locations`; `/app/members` va `/app/employees` da `locations`; `?location_id=` (403 / 400 / hammasi); `POST` `location_id` (400 / 403), mas'ul lokatsiyada emas 400 (qo'shish va tahrir); ID bo'yicha 404; `PUT /app/employees/{phone}/locations` (`ownerSession`, Go tartibi); `handlers.test.ts` mahkamlaydi |
| `test/locations.ts` (yangi) | `addLocation(companyId, name)`, `restrictTo(phone, companyId, ids)` fixture'lari (`giveRole` kabi) |
| `e2e/locations.spec.ts` (yangi) | Vali Nok Market'da: tanlovchi ko'rinadi, "Chilonzor"da vazifa qo'shadi, "Asosiy"ga o'tganda ko'rinmaydi, mijoz sahifasida belgi bilan ko'rinadi, vazifa sahifasida "Lokatsiya" fakti; egasi Dilnoza'ni "Chilonzor" bilan cheklaydi (dialog ogohlantiradi, chunki u "Asosiy"da mas'ul); Dilnoza kirgach tanlovchi yo'q, faqat "Chilonzor" vazifalari; "Asosiy"dagi vazifa formasida Dilnoza mas'ul sifatida yo'q; cheklov olingach ikkalasi. Olma Savdo'da (1 lokatsiya) tanlovchi yo'q. 375px va desktop |
| `README.md` | "Lokatsiyalar" bo'limi |

Vitest: `use-location.test.ts`, `location-switcher.test.tsx`, `topbar.test.tsx` (1 / 2+ lokatsiya), `tasks-page.test.tsx` (lokatsiya filtri, almashtirishda 1-sahifa, lokatsiyasiz holat, qo'shishda `location_id`), `task-dialog.test.tsx` / `edit-task-dialog.test.tsx` (mas'ul tanlovi lokatsiya bo'yicha, "(bu lokatsiyada ishlamaydi)"), `task-page.test.tsx` (fakt), `customer-tasks` (belgi), `employees-page.test.tsx` (ustun, dialog faqat egasiga), `employee-locations-dialog.test.tsx` (ogohlantirish, bo'sh tanlov), `handlers.test.ts`. Mavjud testlar o'zgarmaydi: Olma Savdo bitta lokatsiyali; `/app/me` fixture'lariga `locations` qo'shiladi.

## Admin panel (`apps/admin`)

| Fayl | O'zgarish |
|---|---|
| `lib/types.ts` | `AdminLocation`, `Location` |
| `components/companies/company-page.tsx` | "Ma'lumot" va "Userlar" orasida `<section aria-labelledby>` "Lokatsiyalar": `DataList` (nom, "Vazifalar" soni, "Qo'shilgan", amallar: `RenameLocationDialog` qalam, `DeleteLocationButton` savatcha (AlertDialog, 409 toast'da)); `SectionHeading` action `AddLocationDialog` ("Lokatsiya qo'shish", nom) |
| `components/companies/location-dialogs.tsx` (yangi) | uchta komponent, `RenameDialog` / `CompanyActions` naqshida; `keys.company(id)` invalidatsiya; toast'lar |
| `lib/schemas.ts` | `locationSchema` (nom 1–60) |
| `mocks/data.ts`, `mocks/handlers.ts` | `db.locations: Record<companyId, AdminLocation[]>` (har kompaniyaga "Asosiy"); 3 route (Go xabarlari bilan); detail'da `locations`; `member()` ga `locations: null` |
| `e2e/companies.spec.ts` yoki yangi `locations.spec.ts` | lokatsiya qo'shadi, nomini o'zgartiradi, yagonasini o'chira olmaydi, ikkinchisini o'chiradi |

## Hujjatlar

- `logic/locations.md` (yangi): tushunchalar, kim nima qila oladi (admin / egasi / xodim), tayyor lokatsiya, admin amallari va o'chirish qoidasi, xodim cheklovi (ogohlantirish, lokatsiyasiz qolish), joriy lokatsiya va tanlovchi, vazifalar bilan bog'liqlik (yaratish, mas'ul, ro'yxat, kanban, mijoz sahifasi, vazifa sahifasi, 404), chekka holatlar, xato kodlari.
- `logic/tasks.md`: 3.3 "Lokatsiya" doimiy maydon; 4.1 tekshiruv tartibi va "Mas'ul bu lokatsiyada ishlamaydi"; 4.2 mas'ul lokatsiyada ishlashi; 6-bo'lim ro'yxat lokatsiya bo'yicha, `location_id` filtri; 8-bo'lim chekka holatlar; 9-bo'lim xabarlar.
- `logic/roles.md`: 4.1 katalogdan tashqari "lokatsiya cheklovi faqat egasiniki"; 4.2 jadvaliga qator; 6-bo'lim egasi almashganda; 7-bo'lim `/app/me.locations`.
- `logic/user.md`: a'zolikda lokatsiyalar; xodim qo'shilganda va o'chirilganda nima bo'ladi.
- `CLAUDE.md` "Manbalar": `logic/locations.md`, shu hujjat.
- `README.md`: "Lokatsiyalar" (user app va admin).

## Bosqichlar (TDD: RED → GREEN → commit; har bosqich oxirida `make lint`, `make test`, `make e2e`)

0. **Hujjatlar.** `logic/locations.md`, `logic/tasks.md`, `logic/roles.md`, `logic/user.md`, shu hujjat, `CLAUDE.md`.
1. **Poydevor (backend).** Migratsiya 00010 (testlar bilan), `locations.sql`, `users.sql` o'zgarishlari, `SeedLocation` `company.Create` da, `user.Access.LocationIDs`, `Profiles.Locations`, `/app/me.locations`, `Member.Locations` (app, `/app/members`, admin), openapi + api-client, web va admin mock'larida yangi maydonlar (xatti-harakat o'zgarmaydi: mavjud testlar o'tadi).
2. **Admin lokatsiyalar.** `company/locations.go` (Locations, Add, Rename, Delete), admin handlerlar va 3 route, openapi, admin UI (bo'lim, uchta dialog), admin mock, Vitest, e2e.
3. **Vazifalar lokatsiya bo'yicha (backend).** `tasks.sql` o'zgarishlari, `task.Scope`, `Create` `locationID`, mas'ul lokatsiya tekshiruvi (`MemberInLocation`), `ListInput.LocationID`, `Task.LocationID`, handlerlar (`?location_id=`, `location_id`, 403 / 400 / 404), openapi, web mock vazifalar.
4. **Xodim cheklovi (backend).** `SetEmployeeLocations`, `PUT /app/employees/{phone}/locations`, `ReplaceOwner` tozalash, openapi, web mock.
5. **Web: tanlovchi va vazifalar.** `useLocation`, `LocationSwitcher`, `Topbar`, `TasksPage` / `TaskBoard` / `AddTaskDialog` / `EditTaskDialog` (mas'ul lokatsiya bo'yicha), `TaskPage`, `CustomerTasks`, lokatsiyasiz holat, mock seed (Chilonzor, Dilnoza), Vitest, e2e.
6. **Web: xodim cheklovi.** Xodimlar ustuni, `EmployeeLocationsDialog` (ogohlantirish bilan), sxema, Vitest, e2e, README.
7. **Yakuniy ko'rik.** Kod ko'rigi, mutatsiya tekshiruvi (fayl nusxadan tiklanadi, `-timeout` bilan), lokal haqiqiy stack'da tekshiruv, `git push origin main`, hisobot (har funksiya RED → GREEN).

Har bosqich boshida batafsil reja `docs/superpowers/plans/2026-10-07-locations-stage<N>-*.md`. Commit'lar faqat o'z fayllari bilan (`git add <yo'llar>`).

## Tekshiruv

- Har bosqichda `make lint` 0 issues, `make test` (Go, web, admin, api-client), `make e2e` toza; hech bir test o'chirilmaydi yoki o'tkazib yuborilmaydi.
- Lokal haqiqiy stack (`make dev`, vaqtinchalik DB, curl va Playwright vaqtinchalik spec, SMS kodi API log'idan, 12 xonali telefonlar, sinov nomlari ishga xos, "Smoke …" yozuvlarga tegilmaydi): admin kompaniyaga ikkinchi lokatsiya qo'shadi, nomini o'zgartiradi, yagonasini o'chira olmaydi; egasi tanlovchini ko'radi, ikkala lokatsiyada vazifa qo'shadi, ro'yxat va kanban faqat joriysini ko'rsatadi, mijoz sahifasi ikkalasini belgi bilan; `curl` `GET /api/app/tasks?location_id=<begona>` → 403, `POST` ruxsatsiz → 403, boshqa lokatsiya vazifasi ID bo'yicha → 404, cheklangan xodim mas'ul qilinsa → 400; egasi xodimni bitta lokatsiya bilan cheklaydi (ogohlantirish ko'rinadi), xodimda tanlovchi yo'q va faqat o'sha lokatsiya; cheklov olingach hammasi; vazifali lokatsiya o'chmaydi (409). Skrinshotlar: 375px topbar tanlovchi bilan (light, dark), Mini App (soxta Telegram skripti), desktop; 320px yon scroll yo'q.
- Yangi kompaniya (admin panel orqali) "Asosiy" bilan yaratilishi; migratsiya mavjud vazifalarni "Asosiy"ga tushirishi (lokal dump'da) tekshiriladi.
- Production deploy alohida so'raladi: migratsiya 00010 ma'lumot ko'chiradi (vazifalar → "Asosiy"), deploy'dan oldin dump.

## Chegara (bu ishga kirmaydi)

- Vazifani boshqa lokatsiyaga ko'chirish; lokatsiyalarni qayta tartiblash; egasining user app'dan lokatsiya qo'shishi.
- Lokatsiya bo'yicha mijozlar, xodimlar yoki sozlamalar; rolda lokatsiya; "Barcha lokatsiyalar" ko'rinishi ro'yxat va kanban'da.
- Lokatsiya manzili, telefoni, ish vaqti; bosh sahifada lokatsiya statistikasi; bot bildirishnomalari.
- Admin panelda xodimlarning lokatsiya cheklovini boshqarish yoki ko'rsatish.
- Cheklashda boshqa lokatsiyadagi vazifalarni avtomatik qayta biriktirish (6-qaror: qoladi).

## 1-bosqich qarorlari (2026-10-07)

Bajarildi: migratsiya `00010_locations.sql` (testlari bilan), `locations.sql` (`SeedLocation`, `GetLocation`, `ListMemberLocations`, `ListCompanyMemberLocations`, `DeleteMemberLocations`), `users.sql` (`GetCompanyAccess` `all_locations` + `location_ids`, `ListCompanyUsers` / `GetCompanyMember` `all_locations`, `SetCompanyOwner` `all_locations = true`), `tasks.sql` (`CreateTask` `location_id`; `GetTask` / `ListTasks` `location_id`), `company.Create` → `SeedLocation`, `company.Location`, `Member.AllLocations / Locations`, `company.Service.MemberLocations`, `ReplaceOwner` cheklovni olib tashlaydi, `user.Access.LocationIDs`, `task.Service.Create(…, locationID, …)` (400 "Lokatsiyani tanlang"), `Task.LocationID`, `/app/me.locations`, `memberJSON.Locations` (app, admin), openapi (`Location`, `Me.locations`, `Member.locations`, `Task.location_id`, `TaskCreate.location_id`) + TS client, web mock (`LocationRow`, `db.locations`, `Membership.locationIds`, `locationsOf`, `TaskRow.locationId`), admin mock, `test/locations.ts` (`addLocation`, `asosiyOf`, `restrictTo`). Reja: `docs/superpowers/plans/2026-10-07-locations-stage1-foundation.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Vazifaning lokatsiyasi 1-bosqichdayoq:** `tasks.location_id NOT NULL` bo'lgani uchun vazifa yozadigan har test va `task.Service.Create` lokatsiya oladi; bu qism 3-bosqichdan shu yerga ko'chdi. `Create` lokatsiyani kompaniyaning jonli lokatsiyasi sifatida tekshiradi (`GetLocation`; 400 "Lokatsiyani tanlang": yo'q, o'chirilgan, begona); a'zoga ruxsatli to'plam (403) 3-bosqichda `Scope` bilan keladi.
- **Kontraktda `TaskCreate.location_id` hozircha `required` emas** (xususiyat sifatida bor, izohda majburiyligi aytilgan): web ilova uni 5-bosqichgacha yubormaydi, `required` o'shanda qo'yiladi. Mock API bu orada `location_id` berilmasa kompaniyaning tayyor lokatsiyasiga yozadi (vaqtinchalik qoida, 5-bosqichda 400 "Lokatsiyani tanlang" bo'ladi).
- **`/app/me.locations` kompaniya servisidan** (`company.Service.MemberLocations`), `user.Profiles` dan emas: `user` paketi `company` ni import qila olmaydi (sikl), `Location` tipi `company` da.
- **`Member.Locations` semantikasi:** `AllLocations` true → `nil` (JSON `null`); false → cheklovning jonli lokatsiyalari, bo'sh bo'lsa `[]Location{}` (JSON `[]`). `Members` ro'yxati cheklovlarni bitta `ListCompanyMemberLocations` bilan yig'adi; `member()` (rename / rol javobi) `ListMemberLocations` bilan.
- **`GetCompanyAccess.location_ids`** `array_agg` subquery, bo'shi `'{}'`; `user.Access.LocationIDs` hech qachon nil emas.
- **Mavjud testlar o'zgardi (talab o'zgargani uchun):** migratsiya, `internal/db`, `internal/task`, `internal/app`, `internal/customer` (inuse) testlaridagi vazifa fixture'lari lokatsiya bilan; `TestAccess` `LocationIDs: []int64{}` bilan; `TestMe`, `TestListEmployees`, `TestListMembers`, admin `TestGetCompany` yangi maydon bilan; web `lib/tasks.test.ts` `Task` fixture'i `location_id` bilan; admin `company-page.test.tsx` a'zo fixture'i `locations: null` bilan. Hech biri o'chirilmadi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 19 paket, api-client 1, admin 228, web 584; `make e2e`: admin 40, web 98.

## 2-bosqich qarorlari (2026-10-07)

Bajarildi: `locations.sql` (`ListLocations` `tasks_count` bilan, `CreateLocation`, `RenameLocation`, `DeleteLocation`, `CountLocations`, `CountLocationTasks`), `company/locations.go` (`AdminLocation`, `Locations`, `AddLocation`, `RenameLocation`, `DeleteLocation`), `company.Detail.Locations`, admin handlerlar va uch route, openapi (`AdminLocation`, `LocationInput`, `CompanyDetail.locations`, `LocationNotFound`, `LocationConflict`) + TS client, admin UI (`company-page.tsx` "Lokatsiyalar" bo'limi, `location-dialogs.tsx`: `AddLocationDialog`, `RenameLocationDialog`, `DeleteLocationButton`), `locationSchema`, admin mock (`db.locations`, uch handler), Vitest, e2e. Reja: `docs/superpowers/plans/2026-10-07-locations-stage2-admin.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`AddLocation` `LockCompany` (FOR UPDATE) bilan,** `DeleteLocation` `LockCompanyCustomers` (FOR NO KEY UPDATE, vazifa yozuvlari bilan bir navbat) bilan: o'chirish sanagan `location_in_use` soni ostida vazifa qo'shilmaydi (`TestDeleteLocationWaitsForAWriteOfTheSameCompany`).
- **`DeleteLocation` tartibi:** 404 → `last_location` → `location_in_use` → yashirish; `member_locations` qatorlariga tegilmaydi (11-qaror), nomi bo'shaydi.
- **`RenameLocation` o'z nomiga (boshqa harf bilan) mumkin:** unique indeks `lower(name)` bitta qatorni o'zi bilan solishtirmaydi.
- **Admin UI toast'i "Lokatsiya nomi o'zgartirildi"** (12-qarordagi "Nomi o'zgartirildi" emas): kompaniya nomi dialogi ham o'sha toast'ni qoldiradi, sonner toast'i testdan tashqarida yashaydi va `findByText` ikkitasini topardi. O'chirish dialogi izohi "«X» lokatsiyasi o'chadi. Vazifasi bor yoki yagona lokatsiya o'chirilmaydi." (toast matnini takrorlamaydi: e2e `getByText` substring bilan topadi).
- **`DataList` jadval va kartochkani birga chizadi** (CSS bittasini yashiradi): Vitest'da tugmalar jadval ichidan (`within(table)`) olinadi.
- **Mavjud e2e testi o'zgardi:** `companies.spec.ts` "a company's actions…" `getByRole("button", { name: "Nomini o'zgartirish", exact: true })` — lokatsiya tugmasining nomi ("Nomini o'zgartirish: Asosiy") uni ham qamrab olardi.
- **Admin mock lokatsiya ID'lari 101–103** (kompaniya ID'lari bilan adashmasin), yangilari `db.nextId++`.
- **Tekshiruv:** admin Vitest 235, e2e 42.

## 3-bosqich qarorlari (2026-10-07)

Bajarildi: `MemberInLocation` so'rovi; `GetTask`, `ListTasks`, `CountTasks`, `UpdateTask`, `MoveTask`, `DeleteTask` `location_ids bigint[]` bilan (`= ANY`); `task.Scope{CompanyID, LocationIDs}` yetti metodda; `Create` lokatsiyani scope'dan tekshiradi (`GetLocation` tekshiruvi olib tashlandi: scope jonli lokatsiyalardan tuziladi); `ListInput.LocationID`; `assigneeOf(…, locationID, …)` → `MemberInLocation` (400 "Mas'ul bu lokatsiyada ishlamaydi"), `Update` o'zgargan mas'ulni vazifaning lokatsiyasi bilan; `taskScope(r)`, `allowedLocation(r, id)`, `listTasks` `?location_id=` (400 "Lokatsiya noto'g'ri" / 403 `forbidden`), `createTask` ruxsatsiz `location_id` → 403 (`customers.create` tekshiruvidan keyin, servisdan oldin); openapi (`location_id` so'rov parametri, izohlar, ro'yxatda 403 `Forbidden`); web mock (`scopeOf`, `visibleTasks`, `?location_id=`, 403, mas'ul `locationsOf` bilan; `location_id` berilmasa a'zoning birinchi ruxsatli lokatsiyasi). Reja: `docs/superpowers/plans/2026-10-07-locations-stage3-tasks-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`location_ids` so'rovlarda majburiy (`sqlc.arg`), `narg` emas:** scope berilmasa (`nil`) hech narsa chiqmaydi (fail-closed); lokatsiyasiz xodim ro'yxati bo'sh, vazifalari 404.
- **`List` scope'dan tashqaridagi `LocationID` bilan bo'sh sahifa qaytaradi** (xato emas): 403 ni handler beradi; servis darajasida ortiqcha `Forbidden` turi kiritilmadi (`apperr` da yo'q).
- **`POST /app/tasks` da 403 `location_id` ≠ 0 bo'lganda,** 0 yoki yo'q bo'lsa servis 400 "Lokatsiyani tanlang"; yo'q lokatsiya (999999) ham 403: a'zo ishlay olmaydigan lokatsiya bilan bir xil (6-qaror).
- **Mock'dagi vaqtinchalik qoida o'zgardi:** `location_id` berilmasa kompaniyaning tayyor lokatsiyasi emas, a'zoning **birinchi ruxsatli** lokatsiyasi (cheklangan xodim uchun to'g'ri); 5-bosqichda 400 bo'ladi. Eski mock testidagi "yo'q lokatsiya → 400" holati 403 ga o'zgardi (Go bilan bir xil).
- **Tekshiruv:** `make lint` 0; Go 19 paket; admin 235, web 585; e2e admin 42, web 98.

## 4-bosqich qarorlari (2026-10-07)

Bajarildi: `SetMemberAllLocations`, `AddMemberLocation` so'rovlari; `company.SetEmployeeLocations` (telefon → `nil` / bo'sh 400 / har ID jonli va kompaniyaniki 404, takror bir marta → tranzaksiyada `SetMemberAllLocations` (egasi 409 / a'zo emas 404) → `DeleteMemberLocations` → `AddMemberLocation` → `memberIn`); `memberIn(ctx, q, …)` tranzaksiyaga mos a'zo o'quvchi (`member`, `SetEmployeeRole`, `SetEmployeeLocations` undan); `PUT /app/employees/{phone}/locations` (`requireOwner` guruhida); openapi (`EmployeeLocationsInput`, path, `LocationOrEmployeeNotFound`); web mock handler. Reja: `docs/superpowers/plans/2026-10-07-locations-stage4-restriction-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **1-bosqich kamchiligi tuzatildi:** `SetEmployeeRole` javobi `Member` ni `AllLocations`siz qurar edi (JSON'da `locations: []` chiqardi); endi `memberIn` orqali to'liq (`TestSetEmployeeRoleTellsTheLocations`).
- **Lokatsiya ID'lari tranzaksiyadan oldin tekshiriladi** (`GetLocation` pool orqali), yozuv esa tranzaksiyada: rad etilgan so'rov hech narsani o'zgartirmaydi; `FailInserts member_locations` bayroqni ham qaytaradi (atomik).
- **Egasiga `null` ham 409** (`SetMemberAllLocations` `role = 'user'` sharti): egasiga tegilmaydi.
