# Mijozlar: turlar, maydonlar, dropdownlar va tarix — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan (reja tasdig'i bilan), amalga oshirilmoqda. Qoidalar: `logic/customers.md`. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-04-customers-stage<N>-*.md`.

## Maqsad

Foydalanuvchining so'zlari (2026-10-04): "endi mijozlar ni qo'shish kerak, mijoz yaratishda type bo'ladi va type ga qarab inputlar sozlanadi … phone har doim majburiy … list sahifasida barcha typelarda mavjud ustunlar bo'ladi va nimalar ko'rinishi kerak va nimalarni hide qilish kerakligini ham sozlasa bo'ladigan … dropdownlar ham sozlamalarda qo'shiladi".

Hozir user app'da faqat Bosh sahifa va Xodimlar bor. Kerak bo'lgani: kompaniya egasi sozlamalarda mijoz turlarini, har turning maydonlarini va dropdown ro'yxatlarini tuzadi. Mijoz qo'shishda tur tugmalari chiqadi va tanlangan turning maydonlari forma bo'ladi. Telefon har doim bor va majburiy.

Bu `docs/SPEC.md` da yo'q yangi funksiya (Xodimlar kabi). Qoidalar `logic/customers.md` ga yoziladi. Quyidagi qarorlar ikki savol-javob va `/interview` (2026-10-04) natijasi.

## Foydalanuvchi qarorlari

**Ruxsat va qamrov**

1. Sozlamalar (tur, maydon, dropdown) faqat egasida. Mijozlarni egasi ham, xodim ham ko'radi, qo'shadi, tahrirlaydi, o'chiradi.
2. Qamrov: ro'yxat, qo'shish, mijoz sahifasi, tahrirlash, o'chirish, qidiruv, tur filtri, sahifalash, o'zgarishlar tarixi.
3. Tarix maydon darajasida (eski va yangi qiymat). Uni faqat egasi ko'radi.

**Maydonlar**

4. Olti tur: matn, butun son, dropdown (bitta), dropdown (bir nechta), radio (variantlardan bittasi, radio tugmalar), checkbox (variantlardan bir nechtasi, checkboxlar). Variantlar dropdown ro'yxatidan olinadi.
5. Maydonlar har turning ichida aniqlanadi. Ro'yxatda bir xil nomli maydonlar bitta ustun bo'ladi.
6. Turlar, maydonlar va variantlar tartibi sudrab o'zgartiriladi (drag and drop).
7. Butun son oddiy (qoidasiz). Matn va butun son maydoniga ixtiyoriy "Takrorlanmasin" belgisi qo'yiladi. Mavjud takrorlar bo'lsa, belgini yoqish rad etiladi.
8. Variantni nofaol qilish mumkin: yangi tanlovlarda chiqmaydi, eski mijozlarda qoladi.

**Mijoz**

9. Telefon har doim bor, majburiy, faqat +998, faol mijozlar ichida unikal.
10. Turning birinchi matn maydoni mijoz nomi. Ro'yxatda nom va telefon bitta katakda.
11. Mijozning turi tahrirda o'zgarmaydi.
12. Kim qo'shgani saqlanadi; ro'yxatda "Qo'shgan" ustuni bor.
13. Takror telefon yoki takrorlanmas qiymat: 409, xabar va mavjud mijozga havola.
14. Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi.

**O'chirish**

15. Hamma narsa soft delete: mijoz, tur, maydon, variant, dropdown. Bu yozuvlar bazadan o'chmaydi, faqat `deleted_at` bilan belgilanadi. O'chirilgan mijoz interfeysda ko'rinmaydi, tiklash bu ishga kirmaydi. O'chirish ham tarixga yoziladi.
16. Faol mijozda ishlatilayotgan narsa o'chirilmaydi: 409 va "N ta … ishlatilgan".

**Ro'yxat va interfeys**

17. Ustunlarni har user ro'yxat sahifasida o'ziga sozlaydi; tanlov brauzerda saqlanadi.
18. Qidiruv: telefon, matn va butun son maydonlari bo'yicha.
19. Tartib faqat "yangi birinchi". Kutilgan hajm: kompaniyada bir necha minggacha mijoz.
20. Mijoz nomi bosilsa alohida sahifa ochiladi. Ro'yxatda qator tugmalari yo'q.
21. Qo'shish oynasi birinchi tur (yoki tanlangan tab) bilan ochiladi va saqlangach yopiladi.
22. `/settings` da ikki ro'yxat va ichki sahifalar. Variantlar ro'yxati "Dropdownlar" deb ataladi.
23. Tayyor turlar mavjud va yangi kompaniyalarga yoziladi: Jismoniy ("F.I.Sh." majburiy), Yuridik ("Nomi" majburiy; "INN" majburiy va takrorlanmas).

**Jarayon**

24. Bosqichlar orasida tasdiq kutilmaydi: hammasi ketma-ket bajariladi. Production deploy alohida so'raladi.

## Reja bilan tasdiqlanadigan qarorlar

- Qiymatlar alohida jadvalda saqlanadi (matn, son va variant alohida ustunlarda), JSONB'da emas: qidiruv, takror tekshiruvi va "ishlatilganmi" sanog'i oddiy so'rovlar bo'ladi.
- Kompaniyaning mijoz va sozlama yozuvlari navbat bilan bajariladi: har yozuv kompaniya qatorini lock qiladi (mavjud `LockCompany`). Shunda takror, "ishlatilganmi" va tartib tekshiruvlari poygasiz.
- Maydonning turi va dropdowni yaratilgandan keyin o'zgarmaydi; nomi, majburiyligi va takrorlanmasligi o'zgaradi. "Majburiy" keyin yoqilsa, mavjud mijozlarga tegilmaydi.
- Takrorlanmaslik bitta maydon (ya'ni tur) ichida; matnda katta-kichik harf farqsiz. O'chirilgan mijozlar hisobga olinmaydi.
- Nofaol variant uni tanlagan mijozning tahririda saqlanadi, boshqalarga taklif qilinmaydi.
- Tur o'chirilsa, maydonlari ham o'chirilgan deb belgilanadi. O'chirilgan nom qayta ishlatilishi mumkin.
- Tur tabi tanlansa, ustunlar shu turning maydonlari; "Barchasi" da hamma turlarning birlashmasi.
- Tarix qiymatlarni o'sha paytdagi nomlari bilan matn qilib saqlaydi. O'zgarish bo'lmagan saqlash tarixga yozilmaydi.
- "Qo'shgan": a'zoning shu kompaniyadagi hozirgi ismi; a'zolikdan chiqarilgan bo'lsa, qo'shgan paytdagi ismi.
- Cheklovlar: nom 60 belgi, matn qiymati 500 belgi, butun son ±9 007 199 254 740 991.
- Yangi kutubxona: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (`../h24` dagi `SortableList` ko'chiriladi).
- Admin panelga tegilmaydi.

## Tanlangan yondashuv

Turning o'z maydonlari, umumiy dropdown ro'yxatlari va qiymatlar alohida jadvalda (har matn yoki son uchun bitta qator, har tanlangan variant uchun bitta qator).

Rad etilgan variantlar:

- Umumiy maydonlar kutubxonasi (`../h24` dagi model: maydon bir marta yaratiladi va turlarga ulanadi): sozlamada uchinchi ekran va qo'shimcha tushuncha; foydalanuvchi maydonlarni tur ichida tasvirlagan va bir xil nomli maydonlarni bitta ustunga birlashtirishni tanlagan.
- `customers.values` JSONB: o'qish soddaroq, lekin qidiruv (matn, son), takrorlanmaslik va "ishlatilganmi" sanog'i turlarni ajratmaydigan JSONB ifodalari bilan yozilardi.
- Ishlatilgan narsani baza foreign key'i bilan himoyalash (`ON DELETE RESTRICT`): hamma narsa soft delete bo'lgani uchun tekshiruv so'rov bilan, kompaniya qatori lock ostida qilinadi.

## Spec'dan chetlanishlar

| # | Spec / qoida | Yangi | Sabab |
|---|---|---|---|
| 1 | API ro'yxati (6-bo'lim) | + `/app/customer-types`, `/app/customer-dropdowns`, `/app/customers` (23 ta route) | yangi funksiya |
| 2 | Xato formati `{error, message}` | `phone_taken` va `value_taken` da qo'shimcha `customer_id` | 13-qaror |
| 3 | `CLAUDE.md`: keyingi bosqichga tasdiqdan keyin o'tiladi | shu ishda bosqichlar to'xtovsiz ketma-ket | 24-qaror |
| 4 | Frontend stack | + dnd-kit (`apps/web`) | 6-qaror |
| 5 | `POST /admin/companies` (5.3) | kompaniya bilan birga tayyor mijoz turlari ham yoziladi | 23-qaror |

## Ma'lumotlar modeli

`backend/migrations/00005_customer_settings.sql`:

```sql
CREATE TABLE customer_dropdowns (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id));           -- maydon va dropdowni bitta kompaniyaniki
CREATE UNIQUE INDEX customer_dropdowns_name ON customer_dropdowns (company_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE customer_dropdown_options (
    id BIGSERIAL PRIMARY KEY,
    dropdown_id BIGINT NOT NULL REFERENCES customer_dropdowns(id),
    label TEXT NOT NULL,
    position INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ);
CREATE UNIQUE INDEX customer_dropdown_options_label ON customer_dropdown_options (dropdown_id, lower(label)) WHERE deleted_at IS NULL;

CREATE TABLE customer_types (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id));
CREATE UNIQUE INDEX customer_types_name ON customer_types (company_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE customer_fields (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    type_id BIGINT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('string','int','dropdown','multi_dropdown','radio','checkbox')),
    dropdown_id BIGINT,
    required BOOLEAN NOT NULL DEFAULT false,
    is_unique BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES customer_types (company_id, id),
    FOREIGN KEY (company_id, dropdown_id) REFERENCES customer_dropdowns (company_id, id),
    CHECK ((kind IN ('string','int')) = (dropdown_id IS NULL)),
    CHECK (NOT is_unique OR kind IN ('string','int')));
CREATE UNIQUE INDEX customer_fields_label ON customer_fields (type_id, lower(label)) WHERE deleted_at IS NULL;
```

Shu migratsiya har mavjud kompaniyaga tayyor turlarni yozadi (23-qaror). Yangi kompaniyaga ularni `company.Create` o'z tranzaksiyasida yozadi (`SeedCustomerTypes` so'rovi).

`backend/migrations/00006_customers.sql`:

```sql
CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    type_id BIGINT NOT NULL,
    phone TEXT NOT NULL CHECK (phone ~ '^998[0-9]{9}$'),
    created_by TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES customer_types (company_id, id));
CREATE UNIQUE INDEX customers_phone ON customers (company_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX customers_newest ON customers (company_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX customers_type ON customers (type_id);

-- Matn yoki son uchun bitta qator, har tanlangan variant uchun bitta qator.
CREATE TABLE customer_values (
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    field_id BIGINT NOT NULL REFERENCES customer_fields(id),
    option_id BIGINT REFERENCES customer_dropdown_options(id),
    text_value TEXT,
    int_value BIGINT,
    CHECK (num_nonnulls(option_id, text_value, int_value) = 1));
CREATE UNIQUE INDEX customer_values_scalar ON customer_values (customer_id, field_id) WHERE option_id IS NULL;
CREATE UNIQUE INDEX customer_values_option ON customer_values (customer_id, field_id, option_id) WHERE option_id IS NOT NULL;
CREATE INDEX customer_values_field ON customer_values (field_id);
CREATE INDEX customer_values_option_id ON customer_values (option_id) WHERE option_id IS NOT NULL;

CREATE TABLE customer_history (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    action TEXT NOT NULL CHECK (action IN ('created','updated','deleted')),
    actor_phone TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    actor_name TEXT,
    changes JSONB NOT NULL DEFAULT '[]',     -- [{"label":"INN","old":"301234567","new":"301234568"}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX customer_history_customer ON customer_history (customer_id, id DESC);
```

Ikkala migratsiyaning `Down` i jadvallarni teskari tartibda o'chiradi.

## API (`backend/openapi.yaml` → `make api-client`)

Kompaniya doim access token'dan. Tekshiruv tartibi: token (401) → a'zolik (401) → obuna (402) → kompaniya tanlangan (403 `company_required`, yangi) → egasi (403 `owner_only`).

| Endpoint | Kim | Javob / rad |
|---|---|---|
| `GET /app/customer-dropdowns` | a'zo | dropdownlar variantlari bilan (`is_active` bilan) |
| `POST /app/customer-dropdowns {name}` · `PATCH …/{id} {name}` · `DELETE …/{id}` | egasi | 409 `name_taken`, `dropdown_in_use` |
| `POST …/{id}/options {label}` · `PATCH …/{id}/options/{optionId} {label?, is_active?}` · `DELETE …/{id}/options/{optionId}` · `PUT …/{id}/options/order {ids}` | egasi | 409 `name_taken`, `option_in_use`, `order_changed` |
| `GET /app/customer-types` | a'zo | turlar maydonlari bilan |
| `POST /app/customer-types {name}` · `PATCH …/{id} {name}` · `DELETE …/{id}` · `PUT /app/customer-types/order {ids}` | egasi | 409 `name_taken`, `type_in_use`, `order_changed` |
| `POST …/{id}/fields {label, kind, required, is_unique, dropdown_id?}` · `PATCH …/{id}/fields/{fieldId} {label?, required?, is_unique?}` · `DELETE …/{id}/fields/{fieldId}` · `PUT …/{id}/fields/order {ids}` | egasi | 409 `name_taken`, `field_in_use`, `duplicates_exist`, `order_changed` |
| `GET /app/customers?search=&type_id=&page=` | a'zo | `{items, total, page, page_size}`, yangi birinchi, 20 tadan |
| `POST /app/customers {type_id, phone, values}` | a'zo | 201; 400 `validation_error`; 409 `phone_taken`, `value_taken` (`customer_id` bilan) |
| `GET /app/customers/{id}` · `PUT /app/customers/{id} {phone, values}` · `DELETE /app/customers/{id}` | a'zo | 404 `not_found`; `PUT` da 409 yuqoridagidek |
| `GET /app/customers/{id}/history` | egasi | yozuvlar, yangi birinchi: `{action, actor_name, created_at, changes}` |

- `Customer`: `{id, type_id, phone, values, created_by_name, created_at, updated_at}`. `values` kaliti maydon ID'si: matn → string, butun son → integer, dropdown va radio → variant ID'si, ko'p tanlovli dropdown va checkbox → variant ID'lari massivi. Bo'sh qiymat saqlanmaydi.
- Qiymat tekshiruvi bitta sof funksiya, turning maydonlari tartibida, birinchi xato qaytadi: notanish maydon; matn (trim, 500 belgi); butun son (kasr va eksponentasiz, chegara ichida); variant shu maydon dropdownidan, o'chirilmagan va faol (yoki mijozda allaqachon tanlangan nofaol); majburiy maydon bo'sh.
- `SPEC` dan chetlanish: `phone_taken` va `value_taken` javobida `{error, message}` yoniga `customer_id` qo'shiladi.
- Xabarlar: "Telefon raqami noto'g'ri", "Mijoz turini tanlang", "«INN» maydonini to'ldiring", "«Manba» ni tanlang", "«INN» butun son bo'lishi kerak", "«Manba» uchun variant noto'g'ri", "Bu raqamli mijoz allaqachon bor", "Bu «INN» boshqa mijozda bor", "Bu turda 3 ta mijoz bor", "Bu maydon 3 ta mijozda to'ldirilgan", "Bu variant 3 ta mijozda tanlangan", "Bu dropdown 2 ta maydonda ishlatilgan", "Bu maydonda takrorlangan qiymatlar bor", "Ro'yxat o'zgargan. Sahifani yangilang", "Avval kompaniyani tanlang".

## Backend

Qatlam: handler → service → sqlc.

- **So'rovlar:** `internal/db/queries/customer_dropdowns.sql`, `customer_types.sql`, `customers.sql`. Har so'rovga `internal/db` da test.
- **Yangi paket `internal/customer`:** `customer.go` (`Service`, turlar, xatolar), `dropdowns.go`, `types.go`, `values.go` (sof tekshiruv va tarix farqi, table-driven unit testlar), `customers.go` (`List`, `Get`, `Create`, `Update`, `Delete`, `History`). Har yozuv bitta transaction: `LockCompany` → tekshiruv → yozuv → tarix.
- **`internal/company/create.go`:** tranzaksiya ichida `SeedCustomerTypes`.
- **`internal/app`:** `customer_settings.go`, `customers.go`; `session.go` da `requireCompany`; `handler.go` da `Services.Customers` va route'lar. `cmd/api/main.go` da `customer.NewService(pool)`.

Qayta ishlatiladi:

- `LockCompany` (`backend/internal/db/queries/companies.sql`), `user.NormalizePhone` (`backend/internal/user/phone.go`), `apperr.New`, `httpx.DecodeJSON` / `WriteError` / `JSON`.
- Sahifalash va `likeEscaper` namunasi: `backend/internal/company/list.go`.
- Testlar: `pgtest.New`, `pgtest.FailInserts`, `pgtest.WaitForLockWait`; `newTestAPI`, `signIn`, `bearer` (`backend/internal/app/handler_test.go`); contract testi `backend/internal/httpx/openapi_test.go`.

## User app (`apps/web`)

**Bo'limlar** (`lib/nav.ts`): Bosh sahifa, Mijozlar `/customers` (hamma), Xodimlar (egasi), Sozlamalar `/settings` (egasi). Xodim `/settings…` ni ochsa, bosh sahifaga qaytadi.

**Sozlamalar** (egasi):

- `/settings`: "Mijoz turlari" (sudraladigan ro'yxat: nomi, maydonlari; "Tur qo'shish") va "Dropdownlar" (nomi, variantlari; "Dropdown qo'shish"). Nom o'z sahifasiga havola.
- `/settings/customer-types/[id]`: maydonlarning sudraladigan ro'yxati (nomi, turi va dropdowni, "Majburiy", "Takrorlanmas", birinchi matn maydonida "Mijoz nomi" belgisi). "Maydon qo'shish" dialogi: nom, tur, tanlov turlarida dropdown, "Majburiy", matn va sonda "Takrorlanmasin". Tahrirlash, o'chirish. Izoh: telefon har doim bor.
- `/settings/dropdowns/[id]`: variantlarning sudraladigan ro'yxati, ostida tez qo'shish satri (yozib Enter), nom o'zgartirish, nofaol qilish yoki faollashtirish, o'chirish.
- Sudrash: tutqich orqali (sichqoncha va barmoq), klaviaturada strelkalar bilan. Tartib darhol ko'rinadi, API rad etsa qaytadi.
- Rad javobi (409) o'chirishda toast'da, dialogda dialog ichida chiqadi (Xodimlar'dagidek).

**Mijozlar** (hamma a'zo):

- `/customers`. Ustunlar: "Mijoz" (`Identity`: nom, ostida telefon; nomsiz mijoz telefon bilan ataladi; nom mijoz sahifasiga havola, telefonda butun kartochka), "Turi", turlarning maydonlari (nom maydoni ustun bo'lmaydi), "Qo'shgan", "Qo'shilgan".
- Tepada: tur tablari ("Barchasi" + turlar), qidiruv, "Ustunlar" menyusi. Filtr va sahifa manzilda (`?type=&search=&page=`).
- "Ustunlar": checkbox'li menyu ("Turi", maydon ustunlari, "Qo'shgan", "Qo'shilgan"). Yashirilganlar `localStorage` da kompaniya va user bo'yicha; storage rad etsa hammasi ko'rinadi (`lib/use-sidebar.ts` namunasi).
- "Mijoz qo'shish" dialogi: tur tugmalari (radiogroup), telefon (`PhoneField`), keyin turning maydonlari: matn, butun son (`inputMode="numeric"`), dropdown (`NativeSelect`), ko'p tanlovli dropdown (checkbox'li menyu), radio, checkbox guruhi. Ixtiyoriy maydon yonida xira "ixtiyoriy". Zod sxemasi turdan quriladi, xabarlari API'niki bilan bir xil. 409 `customer_id` bilan kelsa, rad xabari yonida "Mijozni ochish" havolasi.
- `/customers/[id]`: orqaga havola, avatar va nom, "Jismoniy · +998 …", "Tahrirlash" va "O'chirish". "Ma'lumot": turning barcha maydonlari tartibida (bo'shi "—"), "Qo'shgan", "Qo'shilgan". "Tarix" faqat egasiga: kim, qachon, qaysi maydon, eski va yangi qiymat. Tahrirlash o'sha forma bilan dialogda, tur o'zgarmaydi. O'chirish tasdiq bilan, keyin ro'yxatga qaytadi.
- Tur yo'q (egasi hammasini o'chirgan): egasiga Sozlamalarga havola, xodimga "Kompaniya egasi mijoz turlarini sozlashi kerak".
- Sahifalar to'liq enda, `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md` qoidalarida.

Qayta ishlatiladi: `DataList`, `Identity`, `PageHeader`, `ListLoading` / `Failed` / `EmptyState`, `PendingButton`, `Refusal`, `ActionTooltip`, `TextField`, `PhoneField`, `ui/dropdown-menu` (`DropdownMenuCheckboxItem`), `lib/phone.ts`, `lib/format.ts`. Admin'dan nusxa: `ui/native-select.tsx`, `ui/tabs.tsx`, `components/pager.tsx`, `companies/search-input.tsx` va `use-company-filter.ts` namunasi. shadcn'dan (`base-nova`): `ui/checkbox.tsx`, `ui/radio-group.tsx`. `../h24/packages/ui/src/components/sortable-list.tsx` dan: `components/sortable-list.tsx` (o'zbekcha matnlar bilan).

Yangi fayllar: `components/customers/*`, `components/settings/*` (umumiy `NameDialog`, `DeleteButton`, `FieldDialog`), `lib/customers.ts` (nom maydoni, ustunlar, qiymat matni, forma sxemasi; testlari bilan), `lib/use-hidden-columns.ts`, `lib/use-owner.ts` (Xodimlar sahifasidagi egalik darvozasi ajratiladi), `app/(app)/customers/page.tsx`, `app/(app)/customers/[id]/page.tsx`, `app/(app)/settings/…`.

Mavjud fayllarga o'zgarish: `lib/api.ts` (`ApiError` javobdagi qo'shimcha maydonni, ya'ni `customer_id` ni olib yuradi); `DataList` ga ixtiyoriy `Column.key` (ikkala ilovadagi nusxada: maydon "Turi" deb atalsa ham ustunlar aralashmaydi).

Mock API (`mocks/data.ts`, `mocks/handlers.ts`) Go API qoidalarini takrorlaydi va `mocks/handlers.test.ts` bilan mahkamlanadi. Sahifa kodidan oldin `apps/web/node_modules/next/dist/docs/` dagi tegishli qo'llanma o'qiladi (`apps/web/AGENTS.md`).

## Mavjud testlarga ta'sir (talab o'zgargani uchun)

- `lib/nav.test.ts`, `components/shell/sidebar.test.tsx`: bo'limlar ro'yxatiga "Mijozlar" (hamma) va "Sozlamalar" (egasi) qo'shiladi.
- `proxy.test.ts`: `/customers`, `/settings` ham himoyalangan (xarakteristika).
- `data-list.test.tsx` (ikkala ilova), `lib/api.test.ts`: yangi testlar qo'shiladi.
- Hech bir test o'chirilmaydi va o'tkazib yuborilmaydi.

## Bosqichlar

To'xtovsiz ketma-ket (24-qaror). Har bosqich: boshida batafsil reja `docs/superpowers/plans/` ga, keyin TDD (RED → GREEN → commit), oxirida `make lint`, `make test`, `make e2e` → `git push origin main`. Yakunda bitta hisobot: har funksiya uchun RED → GREEN.

0. **Hujjatlar.** `logic/customers.md`, `logic/roles.md` (4 va 7-bo'lim), `docs/superpowers/specs/2026-10-04-customers-design.md`, `CLAUDE.md` "Manbalar".
1. **Sozlamalar API.**
   - Migratsiya 00005: cheklovlar (nom unikalligi faqat o'chirilmaganlar ichida, tur CHECK'i, tanlov turi dropdownsiz bo'lmaydi, takrorlanmaslik faqat matn va sonda, begona kompaniya dropdowni 23503), tayyor turlar mavjud kompaniyalarga, `Down`.
   - `company.Create` yangi kompaniyaga tayyor turlarni yozadi.
   - Dropdownlar va variantlar: yaratish, ro'yxat, nom, nofaol qilish, tartib, soft delete; `name_taken`, `dropdown_in_use`, `order_changed`; begona kompaniya → 404.
   - Turlar va maydonlar: yaratish, ro'yxat, nom, tartib, soft delete (maydonlari bilan); maydon qo'shish (olti tur), tahrirlash, o'chirish.
   - Yozuvlar navbat bilan (`LockCompany`, `WaitForLockWait` testi); `requireCompany`; 17 route; openapi va api-client.
2. **Sozlamalar sahifalari.** UI nusxalari, `SortableList`, mock API, "Sozlamalar" bo'limi, `/settings`, tur sahifasi, dropdown sahifasi, e2e (375px va desktop, sudrash sichqoncha bilan).
3. **Mijozlar API.**
   - Migratsiya 00006: telefon faqat +998 va faol mijozlar ichida unikal, qiymat qatori cheklovlari, tarix, `Down`.
   - Qiymat tekshiruvi va tarix farqi (table-driven).
   - `Create` (atomiklik `FailInserts` bilan, `phone_taken`, `value_taken`, kim qo'shgani, tarix), `Get`, `List` (tartib, sahifa, tur filtri, qidiruv: telefon, matn, son; harfma-harf), `Update` (farq tarixga; o'zgarishsiz saqlash yozilmaydi; nofaol variant saqlanadi), `Delete` (soft; raqam bo'shaydi), `History`.
   - Sozlamalarga qo'shimcha: `type_in_use`, `field_in_use`, `option_in_use` (faqat faol mijozlar sanaladi), `duplicates_exist`.
   - 6 route; xodim tarixdan boshqa hammasini qila oladi; openapi va api-client.
4. **Mijozlar sahifalari.** Mock API, `lib/customers.ts`, `ApiError` qo'shimcha maydoni, "Mijozlar" bo'limi, ro'yxat, qo'shish dialogi (olti tur), mijoz sahifasi (ma'lumot, tahrirlash, o'chirish, tarix), tab + qidiruv + pager, "Ustunlar", e2e, README, hujjatlar holati.

## Tekshiruv

- Har bosqichda: `make lint`, `make test`, `make e2e` toza.
- 1 va 3-bosqich: lokal stack'da curl bilan (user app origin'i orqali). Egasi dropdown, tur va maydon yaratadi, tartibini o'zgartiradi; xodim yozuvchi sozlama amalida 403 oladi; mijoz qo'shiladi; takror telefon va takror INN 409 (`customer_id` bilan); ishlatilgan maydon, variant va tur o'chmaydi; o'chirilgan mijozning raqami bilan yangi mijoz qo'shiladi; tarix egasiga 200, xodimga 403. Sinov ma'lumoti shu ishga xos nom bilan yaratiladi va aniq nomi bo'yicha tozalanadi; satrlar soni boshlang'ich holat bilan solishtiriladi.
- 2 va 4-bosqich: Playwright e2e (MSW) va vaqtinchalik skrinshot spec'i bilan ko'rik (375px va desktop, light va dark); yon scroll yo'qligi; haqiqiy Go API bilan brauzerda bitta to'liq oqim (egasi sozlaydi, xodim mijoz qo'shadi, egasi tarixni ko'radi).
- Yangi kompaniya (admin panel orqali) tayyor turlar bilan yaratilishi tekshiriladi.
- Testdan keyin yozilgan kod uchun mutatsiya tekshiruvi (fayl nusxadan tiklanadi).

## Chegara (bu ishga kirmaydi)

- O'chirilgan mijozlarni ko'rish va tiklash; maydon va turlarni nofaol qilish; mijoz turini almashtirish.
- Boshqa maydon turlari (sana, fayl, kasr son, xodimga havola); xonalar soni kabi son qoidalari; chet el raqamlari.
- Variant nomi bo'yicha qidiruv; saralashni o'zgartirish; Excel import va eksport.
- Ustun tanlovini bazada saqlash; bir vaqtda tahrirda ziddiyatni aniqlash; soniga limitlar.
- Admin panel; production deploy (alohida so'raladi).

## 1-bosqich qarorlari (2026-10-04)

Bajarildi: migratsiya `00005`, 26 ta so'rov, `internal/customer` servisi (dropdownlar, variantlar, turlar, maydonlar), `company.Create` dagi tayyor turlar, `requireCompany`, 17 ta route, openapi va TS client. Reja: `docs/superpowers/plans/2026-10-04-customers-stage1-settings-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Ruxsat tartibi.** Yozuvchi sozlama route'lari mavjud `requireOwner` guruhida (Xodimlar API'si bilan birga): kompaniya tanlanmagan token ham 403 `owner_only` oladi. 403 `company_required` faqat a'zo route'larida (`GET /app/customer-dropdowns`, `GET /app/customer-types`).
- **Navbat.** Har yozuv `write()` orqali: bitta tranzaksiya, boshida `LockCompany`. Test 15 ta yozuvni qamraydi (`TestAWriteWaitsForAnotherWriteOfTheSameCompany`). Mutatsiya: lock olib tashlansa 13 tasi yiqiladi; `CreateDropdown` va `CreateType` kompaniyaga foreign key orqali baribir kutadi.
- **Tartib.** Yangi tur, maydon va variant `max(position) + 1` oladi. `PUT …/order {ids}`: `ids` hozirgi yozuvlarning har birini bir marta nomlashi shart, aks holda 409 `order_changed` (kam, ortiqcha, begona yoki takror ID).
- **O'chirish.** Hamma joyda `deleted_at`. Tur o'chirilsa, maydonlari ham shu tranzaksiyada o'chirilgan deb belgilanadi. O'chirilgan dropdown nomi o'zgartirilmaydi va variant olmaydi (404).
- **Dropdown ishlatilishi.** Faqat o'chirilmagan maydonlar sanaladi; begona kompaniya dropdowni avval 404 beradi, soni oshkor bo'lmaydi.
- **Tayyor turlar** ikki joyda yoziladi: mavjud kompaniyalarga migratsiya, yangisiga `SeedCustomerTypes` (`company.Create` tranzaksiyasi ichida). Ikkalasi bir xil natija berishi alohida testlar bilan mahkamlangan.
- **Maydon tekshiruvi.** Xabarlar: "Maydon turini tanlang", "Dropdownni tanlang" (yo'q, begona yoki o'chirilgan dropdown), "Matn va son maydoniga dropdown ulanmaydi", "Faqat matn va son maydoni takrorlanmas bo'ladi".
- **Yo'ldagi ID** raqam bo'lmasa, yozuv topilmagan hisoblanadi (404).
- **`Down`** alohida test olmadi: mavjud `TestInitDownRemovesTheSchema` jadvallar qo'shilganda yiqildi va `Down` yozilgach o'tdi.
- **Keyinga qolgan:** `type_in_use`, `field_in_use`, `option_in_use`, `duplicates_exist` mijozlar jadvaliga bog'liq, 3-bosqichda.
- **Tekshiruv.** `make lint` 0 issues; `make test`: Go 16 paket, web 247, admin 216, api-client 1; `make e2e`: admin 40, web 62. Lokal haqiqiy stack (Go API + user app origin'i, curl): 32 / 32: admin kompaniya yaratadi va u tayyor turlar bilan chiqadi, egasi dropdown, variant, tur va maydonlarni boshqaradi, xodim o'qiydi va yozuvda 403 oladi. Sinov ma'lumoti o'chirilgan, satrlar soni boshlang'ich holatga qaytgan. Lokal baza 5-versiyada: mavjud 6 kompaniya tayyor turlarni oldi.
