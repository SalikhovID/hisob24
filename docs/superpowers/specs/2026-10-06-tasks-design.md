# Vazifalar (tasklar) bo'limi — dizayn

Sana: 2026-10-06. Holat: foydalanuvchi tasdiqlagan (reja tasdig'i va `/interview` bilan); amalga oshirilmoqda. Qoidalar: `logic/tasks.md`. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-06-tasks-stage<N>-*.md`.

## Maqsad

Foydalanuvchining so'zlari: "tasklar bo'limini qilish kerak, sozlamalarda column lar yaratib olinadi, va tasklar qo'shiladi, tasklarni type bo'ladi va huddi client kabi type'lar yaratilinadi va type larga input turlari biriktiriladi, title, deadline va client biriktirish majburiy bo'ladi va bu o'zgarmaydigan inputlar bo'ladi … client phone number yozayotganda bazada bor client bo'lsa … recomendatsiyalar … bor clientni tanlasa … inputlar disabled … task view, list va list sahifasida kanban".

Hozir user app'da Mijozlar, Xodimlar, Sozlamalar bor. Kerak: har vazifa bitta mijozga biriktiriladi, turi bor (tur maydonlari mijoz turlaridagidek sozlanadi), bosqichda (kanban ustunida) turadi. Ro'yxat jadval yoki kanban ko'rinishida. `docs/SPEC.md` da yo'q yangi funksiya (Mijozlar kabi); qoidalar `logic/tasks.md` ga yoziladi.

## Foydalanuvchi qarorlari (2026-10-06, savol-javob)

1. Kanban ustuni **"Bosqich"** deb ataladi (kod: `task_stages`, `/app/task-stages`, `stage_id`). Jadval "Ustunlar" menyusi bilan adashmaydi.
2. Muddat faqat **sana** (`DATE`, `YYYY-MM-DD`, ko'rinishi `dd.mm.yyyy`).
3. Bosqichda nom, **rang** va **"Yakuniy"** belgisi (`is_done`). Muddati o'tgan vazifa qizil, yakuniy bosqichdagi emas.
4. **Ixtiyoriy mas'ul xodim** (kompaniya a'zosi). Ro'yxat va kartada ko'rinadi, filtrlanadi.
5. Forma **keng dialog** (`sm:max-w-3xl`): tepada vazifa turi, chapda mijoz, o'ngda vazifa; telefonda bitta ustun.
6. Tahrirda **mijoz o'zgarmaydi** (mijoz turi kabi).
7. Kanban'da karta **sudrab** boshqa bosqichga o'tkaziladi (dnd-kit). Bosqich ichida tartib qo'lda emas.
8. Har kompaniya **tayyor bosqichlar** (Yangi, Jarayonda, Bajarildi — yakuniy) **va bitta tur** ("Vazifa", maydonsiz) bilan boshlaydi.
9. Mas'ul tanlash uchun yangi **`GET /app/members`** har a'zoga (telefon, ism, rol). `/app/employees` o'zgarmaydi.
10. **Mijoz sahifasida "Vazifalar" bo'limi** bor. Vazifasi bor mijoz o'chirilmaydi (409 `customer_in_use`).
11. **Tarix** mijozlardagidek: egasiga, maydon darajasida; kanban'da ko'chirish ham yoziladi.
12. Tartib: **muddati yaqini birinchi** (`deadline ASC, id ASC`) ro'yxatda ham, bosqich ichida ham.

`/interview` (2026-10-06) qarorlari:

13. Vazifasi bor bosqich **o'chirilmaydi** (409 `stage_in_use`), tur va maydon kabi; ko'chirib o'chirish yo'q.
14. Yakuniy bosqich vazifalari hamma joyda ko'rinadi; kanban'da **yakuniy ustun yig'ilgan** (sarlavha va soni, bosilsa ochiladi, tanlov brauzerda eslanadi; yig'ilgan ustunga ham tashlash mumkin).
15. Birinchi kirishda `/tasks` **kanban** ko'rinishida ochiladi; keyin tanlov eslanadi.
16. Muddat: sana **+ nisbiy matn** ("Bugun", "N kun qoldi", "N kun kechikdi"); muddati o'tgan va yakuniy bo'lmagan — qizil. Yakuniy bosqichda nisbiy matn yo'q, faqat sana.
17. Formada **muddat bo'sh, mas'ul tanlanmagan** boshlanadi.
18. Ruxsat: **har a'zo har vazifani** tahrirlaydi, ko'chiradi, o'chiradi (mijozlardagidek).
19. Mijoz takliflari **`GET /app/customers?phone=<raqamlar>`** (yangi parametr, telefon prefiksi bo'yicha); `search` ishlatilmaydi (u INN kabi son javoblarini ham topardi).
20. Ro'yxatda **alohida "Mijoz" ustuni** (nom va telefon, mijoz sahifasiga havola; yashirish mumkin); "Vazifa" ustuni faqat nom.
21. Kanban'da **har bosqich sarlavhasida "+"**: dialog shu bosqich tanlangan holda ochiladi.
22. Jarayon: 6 bosqich **to'xtovsiz ketma-ket** (mijozlardagi 24-qaror kabi), yakunda bitta hisobot; deploy alohida so'raladi.
23. Mas'ul kompaniyadan chiqarilsa **biriktirilgan qoladi**, ismi `assignee_name` nusxasidan; tahrirda "Ism (chiqarilgan)" varianti; "Mas'ul" filtrida faqat hozirgi a'zolar; qayta qo'shilsa yana a'zo sifatida.

Reja bilan tasdiqlanadigan qarorlar (men tanladim, e'tiroz bo'lsa ayting):

- Ruxsat mijozlardagidek: bosqich, tur va maydon sozlamalari faqat egasida; vazifalarni har a'zo ko'radi, qo'shadi, tahrirlaydi, o'chiradi, ko'chiradi; tarix faqat egasiga.
- Dropdownlar umumiy: vazifa maydonlari ham `customer_dropdowns` dan variant oladi (jadval va `/app/customer-dropdowns` nomi o'zgarmaydi; `/settings` da "Dropdownlar" bo'limi ikkalasiga xizmat qiladi).
- Vazifa maydonida "Takrorlanmasin" yo'q (faqat nom, tur, dropdown, majburiylik).
- Nom 200 belgigacha; o'tgan sana ham qabul qilinadi (vazifa allaqachon kechikkan bo'lishi mumkin).
- Yangi mijoz vazifa bilan **bitta tranzaksiyada** yaratiladi (`POST /app/tasks` ichida `customer`): ikkisi birga yoziladi yoki hech biri.
- Rang: 9 ta tayyor rang (`slate, red, orange, amber, green, teal, blue, violet, pink`), erkin hex emas (dark rejim va kontrast nazorati uchun).
- Kanban bosqichlari sahifalanadi: har bosqich `GET /app/tasks?stage_id=…&page=` bilan 20 tadan, ostida "Yana" tugmasi. Yangi endpoint yo'q.
- Klaviatura va barmoq uchun har kartada "Bosqich" menyusi ham bor (sudrashsiz ko'chirish).
- Ko'rinish tanlovi (`?view=list|board`) manzilda; oxirgisi brauzerda eslab qolinadi (`localStorage`, kompaniya va user bo'yicha, "Ustunlar" kabi).
- Mas'ul ko'rsatishda a'zoning hozirgi ismi, chiqarilgan bo'lsa `assignee_name` nusxasi (`created_by_name` kabi); tahrirda u o'zgartirilmasa qayta tekshirilmaydi (23-qaror).
- Nisbiy muddat brauzerning lokal sanasidan: farq 0 → "Bugun", N > 0 → "N kun qoldi", N < 0 → "N kun kechikdi"; ekran o'quvchiga ham shu matn. Vazifa sahifasida to'liq sana va nisbiy matn birga.
- `?phone=` 1–9 ta raqam (boshqa belgi → 400 "Telefon raqami noto'g'ri"); `search` bilan birga berilsa ikkalasi ham qo'llanadi (frontend faqat `phone` yuboradi). Taklif 3 ta raqamdan boshlanadi, 5 tagacha ko'rsatiladi.
- Kanban'dagi yig'ilgan yakuniy ustun holati `localStorage` da (`tasks_board_collapsed:<kompaniya>:<telefon>`), ko'rinish tanlovi `tasks_view:<kompaniya>:<telefon>`.
- Admin panelga tegilmaydi. Mijozlar moduli faqat ikki joyda o'zgaradi: `customer_in_use`, dropdown va variant "ishlatilgan" sanog'ida vazifalar ham hisoblanadi.

## Yondashuvlar

**Tanlangan: mijozlar modelini takrorlash + umumiy maydon mantiqini ajratish.** Vazifalar o'z jadvallari bilan (`task_types`, `task_fields`, `tasks`, `task_values`, `task_history`), mijozlardagi bilan bir xil shaklda. Maydon tekshiruvi va tarix farqi (`checkValues`, `diff`, `kindOf`, `asText`…) `internal/customer` dan yangi `internal/fields` paketiga ko'chiriladi, ikkala servis undan foydalanadi. Frontend'da ham: `Answer` (maydon input'i turi bo'yicha) va forma sxemasi qismlari `components/field-answer.tsx` va `lib/fields.ts` ga ajratiladi. Ortiqcha nusxa yo'q, mijozlar kodi va testlari xatti-harakatini o'zgartirmaydi.

Rad etilganlar:

- *Nusxa ko'chirish* (`values.go` va `customer-form.tsx` ni `task` ga ko'chirish): ~900 satr kod va test ikki marta; keyin bitta tuzatish ikki joyda.
- *Umumiy jadvallar* (`entity_types` + `entity` ustuni, bitta `values` jadvali): mavjud jadval, so'rov, openapi va frontend'ni qayta nomlash; deploy'dagi ma'lumotni ko'chirish. Foyda kam, xavf ko'p.
- *Ikki so'rov* (frontend avval `POST /app/customers`, keyin `POST /app/tasks`): vazifa rad etilsa mijoz yetim qoladi; CLAUDE.md "ko'p qadamli yozuv tranzaksiya ichida" qoidasiga zid.

## Spec'dan chetlanishlar

| # | Spec / qoida | Yangi | Sabab |
|---|---|---|---|
| 1 | API ro'yxati (6-bo'lim) | `/app/task-stages`, `/app/task-types`, `/app/tasks`, `/app/members` (22 route); `GET /app/customers` ga `?phone=` | yangi funksiya, 19-qaror |
| 2 | `logic/roles.md` 4-bo'lim | "A'zolar ro'yxatini ko'rish (mas'ul tanlash uchun)": owner ✓, user ✓; vazifa sozlamalari faqat owner | 9 va ruxsat qarori |
| 3 | `logic/customers.md` 5-bo'lim | mijoz o'chirilmaydi: `customer_in_use`; dropdown va variant sanog'ida vazifalar ham | 10-qaror |
| 4 | Xato formati `{error, message}` | `POST /app/tasks` ham `phone_taken` / `value_taken` da `customer_id` qaytaradi (mijozlardagi chetlanish) | yangi mijoz vazifa ichida |
| 5 | `POST /admin/companies` (5.3) | kompaniya bilan tayyor bosqich va tur ham yoziladi | 8-qaror |

## Ma'lumotlar modeli

`backend/migrations/00007_task_settings.sql`:

```sql
CREATE TABLE task_stages (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color IN ('slate','red','orange','amber','green','teal','blue','violet','pink')),
    is_done BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id));
CREATE UNIQUE INDEX task_stages_name ON task_stages (company_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE task_types (… customer_types bilan bir xil …);          -- task_types_name indeksi
CREATE TABLE task_fields (                                            -- customer_fields kabi, is_unique yo'q
    id, company_id, type_id, label, kind (olti tur CHECK), dropdown_id, required, position, created_at, deleted_at,
    FOREIGN KEY (company_id, type_id) REFERENCES task_types (company_id, id),
    FOREIGN KEY (company_id, dropdown_id) REFERENCES customer_dropdowns (company_id, id),
    CHECK ((kind IN ('string','int')) = (dropdown_id IS NULL)));
CREATE UNIQUE INDEX task_fields_label ON task_fields (type_id, lower(label)) WHERE deleted_at IS NULL;
-- Mavjud har kompaniyaga: Yangi (blue, 1), Jarayonda (amber, 2), Bajarildi (green, is_done, 3); tur "Vazifa" (1).
```

`backend/migrations/00008_tasks.sql`:

```sql
ALTER TABLE customers ADD CONSTRAINT customers_company_id_id_key UNIQUE (company_id, id);  -- vazifa FK uchun

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    type_id BIGINT NOT NULL,
    stage_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    deadline DATE NOT NULL,
    assignee_phone TEXT REFERENCES users(phone) ON UPDATE CASCADE,
    assignee_name TEXT,                       -- biriktirilgan paytdagi ismi
    created_by TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES task_types (company_id, id),
    FOREIGN KEY (company_id, stage_id) REFERENCES task_stages (company_id, id),
    FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id));
CREATE INDEX tasks_due ON tasks (company_id, deadline, id) WHERE deleted_at IS NULL;   -- ro'yxat tartibi
CREATE INDEX tasks_stage ON tasks (stage_id); tasks_type (type_id); tasks_customer (customer_id); tasks_assignee (assignee_phone);

CREATE TABLE task_values (… customer_values kabi: task_id, field_id → task_fields, option_id → customer_dropdown_options, text_value, int_value …);
CREATE TABLE task_history (… customer_history kabi: task_id, action, actor_phone, actor_name, changes JSONB, created_at …);
```

Ikkala `Down` jadvallarni teskari tartibda o'chiradi (00008 `customers` cheklovini ham).

## API (`backend/openapi.yaml` → `make api-client`)

Tekshiruv tartibi mijozlardagidek: token → a'zolik → obuna → kompaniya (403 `company_required`) → egasi (403 `owner_only`).

| Endpoint | Kim | Javob / rad |
|---|---|---|
| `GET /app/task-stages` | a'zo | `[{id, name, color, is_done}]` tartibda |
| `POST /app/task-stages {name, color, is_done}` · `PATCH …/{id} {name?, color?, is_done?}` · `DELETE …/{id}` · `PUT /app/task-stages/order {ids}` | egasi | 400 "Rangni tanlang"; 409 `name_taken` "Bu nomli bosqich allaqachon bor", `stage_in_use` "Bu bosqichda N ta vazifa bor", `order_changed` |
| `GET /app/task-types` | a'zo | turlar maydonlari bilan (`TaskType`, `TaskField`: `is_unique` yo'q) |
| `POST /app/task-types {name}` · `PATCH …/{id}` · `DELETE …/{id}` · `PUT /app/task-types/order` · `POST …/{id}/fields {label, kind, required, dropdown_id?}` · `PATCH …/{id}/fields/{fieldId} {label?, required?}` · `DELETE …/{id}/fields/{fieldId}` · `PUT …/{id}/fields/order` | egasi | mijoz turlaridagi xabarlar; `type_in_use` "Bu turda N ta vazifa bor", `field_in_use` "Bu maydon N ta vazifada to'ldirilgan" |
| `GET /app/members` | a'zo | `[Member]` (egasi birinchi, keyin qo'shilish tartibida) — `company.Service.Members` qayta ishlatiladi |
| `GET /app/tasks?search=&type_id=&stage_id=&assignee=&customer_id=&page=` | a'zo | `{items, total, page, page_size}`, `deadline ASC, id ASC`, 20 tadan |
| `POST /app/tasks` | a'zo | 201 `Task`; 400 `validation_error`; 409 `phone_taken` / `value_taken` (`customer_id` bilan) |
| `GET /app/tasks/{id}` · `PUT /app/tasks/{id} {title, deadline, stage_id, assignee_phone, values}` · `DELETE /app/tasks/{id}` | a'zo | 404 "Vazifa topilmadi" |
| `PATCH /app/tasks/{id}/stage {stage_id}` | a'zo | `Task`; kanban'da ko'chirish; tarixga "Bosqich: eski → yangi" |
| `GET /app/tasks/{id}/history` | egasi | mijoz tarixi formati |
| `GET /app/customers?phone=<raqamlar>` | a'zo | mavjud ro'yxat javobi; telefoni `998<raqamlar>` bilan boshlanadigan faol mijozlar, 20 tagacha (mijoz tanlash takliflari) |

- `POST /app/tasks` tanasi: `{type_id, title, deadline, stage_id, assignee_phone?, values, customer}`; `customer` yo `{id}` (mavjud, kompaniyaniki, faol) yo `{type_id, phone, values}` (yangi, mijoz qoidalari bilan).
- `Task`: `{id, type_id, stage_id, title, deadline: "YYYY-MM-DD", customer: {id, phone, name}, assignee: {phone, full_name} | null, values, created_by_name, created_at, updated_at}`. `customer.name` SQL'da: mijoz turining tartib bo'yicha birinchi matn maydonidagi javob (frontend `customerName` bilan bir xil qoida), yo'q bo'lsa `null`.
- Tekshiruv tartibi (qo'shish): nom → muddat → tur → bosqich → mas'ul → turda yo'q maydon → maydonlar tartibida → mijoz (`id`: topilmadi → "Mijozni tanlang"; yangi: mijoz tekshiruvi, keyin `phone_taken`, `value_taken`). Tahrirda avval vazifaning o'zi (404); o'zgarmagan mas'ul qayta tekshirilmaydi (a'zolikdan chiqqan bo'lsa ham qoladi).
- Xabarlar: "Vazifa nomini kiriting", "Vazifa nomi 200 belgidan oshmasin", "Muddatni kiriting", "Muddat noto'g'ri", "Vazifa turini tanlang", "Bosqichni tanlang", "Mas'ul kompaniya a'zosi emas", "Mijozni tanlang"; "Bu turda bunday maydon yo'q" va maydon xabarlari mijozlardagi bilan so'zma-so'z bir xil.
- Qidiruv: nom (ILIKE, harfma-harf), vazifaning matn javoblari, mijozning matn javoblari (nomi); faqat raqamli qidiruv mijoz telefonida va butun son javoblarida ham. Filtrlar birga ishlaydi. `assignee` — a'zo telefoni.
- Tarix `changes`: "Nomi", "Muddat" (`dd.mm.yyyy`), "Bosqich", "Mas'ul" (ism, bo'shi `""`), keyin maydonlar tartibida. O'zgarishsiz saqlash yozilmaydi.
- Mijozlar API'siga: `DELETE /app/customers/{id}` → 409 `customer_in_use` "Bu mijozda N ta vazifa bor"; `DELETE …/options/{optionId}` → mijozlardan keyin vazifalar: `option_in_use` "Bu variant N ta vazifada tanlangan"; `dropdown_in_use` ikkala maydon turini sanaydi.

## Backend

Qatlam: handler → service → sqlc. Har yozuv `write()` (`LockCompanyCustomers`, o'sha lock: mijoz va vazifa yozuvlari bitta navbatda).

- **Yangi paket `internal/fields`** (1-bosqich, refaktoring): `internal/customer/values.go` dan `Values`, `CheckValues`, `Change`, `DiffValues` (telefonsiz; mijoz telefonni, vazifa o'z maydonlarini oldiga qo'shadi), `AsText`, `Kind*`, `KindOf`, `Field`, `Option`; `customer.go` dan `CleanName`, `Taken`, `SameIDs`, `ErrOrderChanged`. Testlar (`values_test.go` va tegishli qismlar) ko'chadi, mazmuni o'zgarmaydi. `internal/customer` ulardan foydalanadi; `store`, `valueRows`, `answersOf` (gen turlari har paketda o'ziniki) joyida qoladi.
- **`internal/customer`:** `Create` ikkiga bo'linadi: `CreateIn(ctx, q, companyID, by, typeID, in)` (tranzaksiya ichidagi qism, eksport) va `Create` (`write` + `CreateIn`). `Delete` da `CountCustomerTasks` → `customer_in_use`. `DeleteOption` da `CountOptionTasks`; `CountCustomerDropdownFields` so'rovi `task_fields` ni ham sanaydi. `ListInput.Phone` (prefiks) → `ListCustomers` / `CountCustomers` ga `phone` narg (`c.phone LIKE '998' || phone || '%'`, `customers_phone` indeksi).
- **Yangi paket `internal/task`:** `task.go` (`Service`, `write`, xatolar), `stages.go` (`CreateStage`, `Stages`, `UpdateStage`, `DeleteStage`, `OrderStages`), `types.go` (turlar va maydonlar, `customer/types.go` namunasida), `tasks.go` (`Create` — ichida `customers.CreateIn` yoki mavjud mijoz tekshiruvi, `Get`, `List`, `Update`, `Move`, `Delete`, `History`), `input.go` (sof: `taskTitle`, `taskDeadline` (`time.DateOnly`), `diff` sarlavha qismlari; table-driven). `Service` `*customer.Service` ni oladi (`CreateIn` uchun).
- **`internal/company/create.go`:** tranzaksiya ichida `SeedTaskSettings` (migratsiya bilan bir xil natija, alohida testlar).
- **So'rovlar:** `internal/db/queries/task_stages.sql`, `task_types.sql`, `tasks.sql`; `customers.sql` ga `CountCustomerTasks`; `customer_dropdowns.sql` / `customer_types.sql` dagi sanoqlar. Har so'rovga `internal/db` da test.
- **`internal/app`:** `task_settings.go`, `tasks.go`, `members.go` (`listMembers` — `listEmployees` bilan bir xil JSON); `handler.go` da `Services.Tasks` va 22 route (egasi guruhida 12: bosqich, tur va maydon yozuvlari; `requireCompany` guruhida 10: uchta GET, vazifalarning 6 tasi va tarix `requireOwner` bilan). `cmd/api/main.go` da `task.NewService(pool, customers)`.

Qayta ishlatiladi: `LockCompanyCustomers`, `GetMemberName`, `ListCompanyUsers`, `user.NormalizePhone` / `FormatPhone`, `apperr`, `httpx.DecodeJSON` / `WriteError` / `JSON`, `pathID`, `writeCustomerError` (`TakenError` uchun), sahifalash va `likeEscaper` / `searchOf` (`customer/customers.go`; `searchOf` `fields` ga yoki `internal/search` ga ko'chirilishi mumkin), testlarda `pgtest.New` / `FailInserts` / `WaitForLockWait`, `newTestAPI`, `signIn`, `bearer`, contract testi `httpx/openapi_test.go`.

## User app (`apps/web`)

**Bo'limlar** (`lib/nav.ts`): Bosh sahifa, Mijozlar, **Vazifalar `/tasks`** (hamma, `ListTodoIcon`), Xodimlar, Sozlamalar. `proxy.ts`: `/tasks` himoyalangan.

**Umumiy bo'laklar (1-bosqich refaktoring):** `components/field-answer.tsx` (`Answer`, `Labeled` — `customer-form.tsx` dan; `disabled` qo'llab-quvvatlaydi), `lib/fields.ts` (`kindLabels`, `kinds`, `isChoice`, `fieldKey`, `answerText`, `readAnswer`, `answersDefaults`, `answersIssues`, `fieldColumns(types, skip?)` — `lib/customer-fields.ts` va `lib/customers.ts` dan; `nameFieldOf`, `customerName`, `customerSchema` mijozda qoladi va ulardan quriladi), `components/history-list.tsx` (`CustomerHistory` ko'rinishi; `CustomerHistory` va `TaskHistory` so'rov bilan o'raydi), `lib/use-hidden-columns.ts` (kalit prefiksi parametr: `customers` / `tasks`), `components/settings/field-dialog.tsx` (API chaqiruvlari va `unique` bayrog'i prop orqali). Mavjud testlar o'zgarmaydi (faqat import yo'li).

**Sozlamalar** (egasi, `/settings`): sarlavha izohi "Mijozlar va vazifalar sozlamalari"; bo'limlar: "Mijoz turlari", **"Vazifa turlari"** (sudraladigan, nom → `/settings/task-types/[id]`, "Tur qo'shish"), **"Bosqichlar"** (sudraladigan; qatorda rang nuqtasi, nom, "Yakuniy" belgisi; "Bosqich qo'shish"), "Dropdownlar" (izohi: "Mijoz va vazifa maydonlari variantlarni shu ro'yxatlardan oladi").

- `components/settings/stage-dialog.tsx`: nom, rang (9 ta swatch `radiogroup`, har biri o'zbekcha nomi bilan: Kulrang, Qizil, To'q sariq, Sariq, Yashil, Moviy, Ko'k, Binafsha, Pushti), "Yakuniy bosqich" checkbox (izoh: "Bu bosqichdagi vazifa bajarilgan hisoblanadi: muddati o'tgan deb belgilanmaydi."). Qo'shish va tahrirlash.
- `/settings/task-types/[id]` (`task-type-page.tsx`): maydonlar ro'yxati (`customer-type-page.tsx` namunasida, "Mijoz nomi" va "Takrorlanmas" belgilarisiz), izoh: "Nomi, muddat va mijoz har vazifada bor va majburiy, mas'ul ixtiyoriy: ularni maydon qilib qo'shish shart emas."
- Rang class'lari `lib/stage-colors.ts` da to'liq satrlar (Tailwind v4 dinamik class'ni ko'rmaydi): nuqta `bg-<rang>-500`, belgi `bg-<rang>-500/10 text-<rang>-800 dark:text-<rang>-300` (kontrast ≥ 4.5:1 skrinshotda tekshiriladi).

**Vazifalar** (hamma a'zo), `/tasks` (`components/tasks/tasks-page.tsx`):

- Sarlavha "Vazifalar · N ta" (filtrsiz jami, mijozlardagidek), "Vazifa qo'shish".
- Asboblar: tur tablari ("Barchasi" + turlar), qidiruv ("Nomi, mijoz yoki telefon"), "Bosqich" select ("Barcha bosqichlar" + bosqichlar; faqat ro'yxatda), "Mas'ul" select ("Barcha", "Men", hozirgi a'zolar), ko'rinish tugmalari (Ro'yxat | Kanban, `radiogroup`), "Ustunlar" (faqat ro'yxatda). Manzil: `?view=&type=&search=&stage=&assignee=&page=` (`use-task-filter.ts`, `use-customer-filter.ts` namunasida); `view` yo'q bo'lsa brauzerda eslangani, u ham yo'q bo'lsa kanban (`use-task-view.ts`).
- **Muddat** (`deadline.tsx`): `dd.mm.yyyy` va yonida nisbiy matn ("Bugun", "3 kun qoldi", "2 kun kechikdi"); muddati o'tgan va yakuniy bo'lmagan — `text-destructive`; yakuniy bosqichda faqat sana. Ro'yxatda, kartada va vazifa sahifasida bitta komponent.
- **Ro'yxat** (`DataList`): "Vazifa" (nom → `/tasks/[id]`, oddiy havola; yashirilmaydi), "Mijoz" (nom → `/customers/[id]`, ostida telefon; ismsiz mijoz telefon bilan; avatarsiz, chunki qator vazifaniki), "Turi" (tag, faqat "Barchasi" da), "Bosqich" (tag, rangli `StageBadge`), "Muddat" (inline), "Mas'ul", maydon ustunlari (`fieldColumns`), "Qo'shgan", "Qo'shilgan"; pager footer'da. Kartada ikkita havola bor (vazifa va mijoz), shuning uchun butun kartochka bosilmaydi, nomning o'zi bosiladi.
- **Kanban** (`task-board.tsx`): bosqichlar yonma-yon (`overflow-x-auto`, desktop `w-72`, telefonda `w-[85vw] snap-x`); sarlavha: nuqta, nom, soni, "+" ikonka tugmasi (`aria-label` "Vazifa qo'shish: <bosqich>", dialog shu bosqich bilan); yakuniy bosqich ustuni yig'ilgan (`w-12`, vertikal nom va soni, tugma bilan ochiladi; `aria-expanded`); kartalar (`task-card.tsx`): nom (havola), mijoz nomi, muddat (nisbiy matn bilan), mas'ul, "Barchasi" da tur belgisi; har kartada "Bosqich" menyusi (klaviatura va barmoq uchun); ostida "Jami: N" va "Yana" (keyingi sahifa, `useInfiniteQuery` har bosqichga). Sudrash: `DndContext` + `useDraggable` / `useDroppable` + `DragOverlay`, sensorlar `SortableList` dagidek (pointer 4px, touch 150ms); yig'ilgan ustunga ham tashlanadi; tashlangach `PATCH …/stage`, karta darhol yangi bosqichda o'z o'rnida (muddat bo'yicha), rad etilsa qaytadi va sabab toast'da (bosqich o'chirilgan bo'lsa bosqichlar qayta so'raladi); har ko'chirish ekran o'quvchiga o'zbekcha aytiladi. Bosqich yo'q: egasiga "Sozlamalarni ochish", xodimga "Kompaniya egasi bosqichlarni sozlashi kerak." Tur yo'q: mijozlardagi kabi.
- **Qo'shish dialogi** (`task-dialog.tsx` + `task-form.tsx`, `sm:max-w-3xl`): tepada vazifa turi (`radiogroup`, bitta turda chiqmaydi); `md:grid-cols-2`: chapda `fieldset` "Mijoz" — mijoz turi tugmalari, telefon (`customer-picker.tsx`), turning maydonlari; o'ngda `fieldset` "Vazifa" — "Nomi", "Muddat" (`type="date"`, bo'sh boshlanadi), "Bosqich" (select; ochilgan joyiga qarab birinchi bosqich yoki "+" bosilgan bosqich), "Mas'ul" (select, "Tanlanmagan" boshida + hozirgi a'zolar; tahrirda chiqarilgan mas'ul "Ism (chiqarilgan)" varianti bilan), turning maydonlari. Telefonda ketma-ket: tur, mijoz, vazifa.
  - **Mijoz tanlash** (`customer-picker.tsx`): telefon maydoni `combobox`; 3 va undan ko'p raqam yozilganda 300 ms pauzadan keyin `GET /app/customers?phone=<raqamlar>` (`useCustomerSuggestions`), ostida `listbox` (5 tagacha: nom yoki telefon, telefon, tur); strelkalar, Enter, Escape, bosish. Tanlangach: mijoz turi tanlangan va `disabled`, telefon va maydonlar to'ldirilgan va `disabled`, ustida "Mavjud mijoz" kartasi (mijoz sahifasiga havola) va "Boshqa mijoz" tugmasi (bog'lanishni yechadi, mijoz qismi bo'shaydi). Bog'langan mijozning maydonlari tekshirilmaydi (keyin majburiy qilingan bo'sh maydon to'sqinlik qilmaydi). Yuborilganda `customer: {id}` yoki `{type_id, phone, values}`.
  - 409 `phone_taken` (`customer_id` bilan): rad xabari yonida "Shu mijozni biriktirish" tugmasi (`GET /app/customers/{id}` → tanlangan holat), "Mijozni ochish" havolasi ham.
  - Zod sxemasi (`lib/tasks.ts`: `taskSchema(type, customerType | null)`) turdan va mijoz turidan quriladi; xabarlari API'niki bilan bir xil; hamma xato birdan.
  - Mijoz turi yo'q bo'lsa (egasi hammasini o'chirgan) yangi mijoz yaratib bo'lmaydi: faqat mavjud mijoz tanlanadi, forma buni aytadi.
- **Tahrirlash dialogi:** o'sha forma; chapda faqat "Mavjud mijoz" kartasi (tanlash yo'q), o'ng ustun tahrirlanadi; tur o'zgarmaydi (dialog izohida aytiladi). `PUT /app/tasks/{id}`.
- **`/tasks/[id]`** (`task-page.tsx`): orqaga "Vazifalar"; sarlavha vazifa nomi, izoh "Tur · Bosqich · dd.mm.yyyy (N kun qoldi)" (muddati o'tgan bo'lsa qizil); "Tahrirlash" (asosiy), "O'chirish" (konturli), "Bosqich" select (darhol `PATCH`, toast "Bosqich o'zgartirildi"). "Mijoz" bo'limi: `Identity` (nom, tur · telefon, havola `/customers/[id]`). "Ma'lumot": Nomi, Muddat, Bosqich, Mas'ul, maydonlar tartibida (bo'shi "—"), Qo'shgan, Qo'shilgan. "Tarix" faqat egasiga. Yo'q vazifa: "Vazifa topilmadi".
- **Mijoz sahifasi:** "Vazifalar" bo'limi (`components/customers/customer-tasks.tsx`): `useTasks(companyId, {customerId})`, `DataList` (nom → vazifa, bosqich, muddat), "Jami: N", 20 dan ko'p bo'lsa pager; bo'sh: "Bu mijozda vazifa yo'q". O'chirish 409 bo'lsa sabab toast'da (mavjud `DeleteCustomerButton` shunday qiladi).
- Sahifalar to'liq enda, `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md` qoidalarida; sahifa kodidan oldin `apps/web/node_modules/next/dist/docs/` dagi tegishli qo'llanma o'qiladi (`AGENTS.md`).

Qayta ishlatiladi: `DataList`, `Identity`, `Avatar`, `PageHeader`, `ListLoading` / `Failed` / `EmptyState`, `PendingButton`, `Refusal`, `ActionTooltip`, `TextField`, `SelectField`, `CheckboxField`, `PhoneField` (`disabled` va listbox uchun kengaytiriladi yoki picker `InputGroup` dan o'zi quradi), `NativeSelect`, `Tabs`, `Pager`, `SearchInput`, `ColumnsMenu`, `SortableList`, `SettingRow`, `NameDialog`, `DeleteButton`, `useReorder`, `useOwner`, `lib/phone.ts`, `lib/format.ts`, `ApiError.customerId`, `@dnd-kit/*` (bor).

Yangi fayllar: `components/tasks/*` (`tasks-page`, `task-board`, `task-card`, `stage-badge`, `deadline`, `task-dialog`, `task-form`, `customer-picker`, `task-page`, `task-history`, `delete-task-button`, `use-task-filter`, `use-task-view`), `components/settings/{stage-dialog,task-type-page}.tsx`, `components/customers/customer-tasks.tsx`, `lib/tasks.ts`, `lib/stage-colors.ts`, `lib/fields.ts`, `components/field-answer.tsx`, `components/history-list.tsx`, `app/(app)/tasks/page.tsx`, `app/(app)/tasks/[id]/page.tsx`, `app/(app)/settings/task-types/[id]/page.tsx`, `mocks/task-settings.ts`, `mocks/tasks.ts`, `e2e/tasks.spec.ts`.

Mavjud fayllarga: `lib/nav.ts`, `proxy.ts`, `lib/types.ts`, `lib/queries.ts` (`useTaskStages`, `useTaskTypes`, `useMembers`, `useTasks`, `useStageTasks`, `useTask`, `useTaskHistory`, `useCustomerSuggestions`, kalitlar), `components/settings/settings-page.tsx`, `components/customers/customer-page.tsx`, `mocks/data.ts` (`StageRow`, `TaskTypeRow`, `TaskRow`, `TaskHistoryRow`, `seedTaskSettings` har kompaniyaga, `seedTasks()`), `mocks/handlers.ts` (+`handlers.test.ts` qoidalari: tekshiruv tartibi, xabarlar, `customer_in_use`, `stage_in_use`, qidiruv, tartib, tarix), `mocks/customers.ts` (o'chirishda vazifalar), `mocks/customer-settings.ts` (sanoqlar).

Muddat "bugun" i brauzerning lokal sanasi (`formatDate` kabi); e2e `Asia/Tashkent` da; mock va e2e seed'lari muddatni haqiqiy sanadan hisoblaydi (`addDays(today, -1)`), `TODAY` konstantasidan emas.

## Mavjud testlarga ta'sir (talab o'zgargani uchun)

- `lib/nav.test.ts`, `components/shell/sidebar.test.tsx`: bo'limlarga "Vazifalar" (hamma) qo'shiladi.
- `proxy.test.ts`: `/tasks` himoyalangan.
- `components/settings/settings-page.test.tsx`: ikki yangi bo'lim va yangi izoh matni.
- `mocks/handlers.test.ts`, `backend/internal/customer/inuse_test.go`: mijoz o'chirishda `customer_in_use`; dropdown va variant sanog'ida vazifalar.
- `backend/internal/customer/customers_test.go`, `backend/internal/app/customers_test.go`, `mocks/customers.ts`: `?phone=` prefiks filtri (yangi testlar, eskilar o'zgarmaydi).
- Refaktoring (1-bosqich) testlarni ko'chiradi, mazmunini o'zgartirmaydi. Hech bir test o'chirilmaydi va o'tkazib yuborilmaydi.

## Bosqichlar

To'xtovsiz ketma-ket (22-qaror; CLAUDE.md "tasdiqdan keyin" qoidasidan tasdiqlangan chetlanish, mijozlardagi 24-qaror kabi). Har bosqich: boshida batafsil reja `docs/superpowers/plans/2026-10-06-tasks-stage<N>-*.md`, keyin TDD (RED → GREEN → commit, Conventional Commits), oxirida `make lint`, `make test`, `make e2e` → `git push origin main`. Yakunda bitta hisobot (har funksiya uchun RED → GREEN). Production deploy alohida so'raladi.

0. **Hujjatlar.** `logic/tasks.md` (tushunchalar, ruxsatlar, bosqich, tur, maydon, vazifa, qidiruv, tarix, o'chirish, chekka holatlar, xato kodlari), `logic/roles.md` (4 va 7-bo'lim), `logic/customers.md` (5-bo'lim: `customer_in_use`, sanoqlar; dropdownlar umumiy), `docs/superpowers/specs/2026-10-06-tasks-design.md` (shu reja mazmuni), `CLAUDE.md` "Manbalar".
1. **Umumiy maydon mantiqi (refaktoring).** Backend: `internal/fields` ajratiladi, `internal/customer` unga o'tadi, `CreateIn` eksport; frontend: `lib/fields.ts`, `components/field-answer.tsx`, `components/history-list.tsx`, `useHiddenColumns` prefiksi, `FieldDialog` prop'lari. Xatti-harakat o'zgarmaydi: mavjud testlar to'liq o'tadi (ko'chirilgan testlar bilan). Bu bosqichda yangi test faqat yangi interfeys uchun (masalan `CreateIn` tranzaksiya ichida ishlashi).
2. **Sozlamalar API.** Migratsiya 00007 (cheklovlar, tayyor bosqich va tur mavjud kompaniyalarga, `Down`); `company.Create` da `SeedTaskSettings`; bosqichlar (rang, yakuniy, tartib, soft delete); turlar va maydonlar; `GET /app/members`; `dropdown_in_use` da vazifa maydonlari; navbat testi (`WaitForLockWait`); 15 route; openapi va api-client. (`stage_in_use`, `type_in_use`, `field_in_use` 4-bosqichda, vazifalar jadvali bilan.)
3. **Sozlamalar sahifalari.** `/settings` dagi ikki yangi bo'lim, bosqich dialogi (rang swatch'lari), `/settings/task-types/[id]`, mock API (15 route), `handlers.test.ts`, e2e (375px va desktop; sudrash sichqoncha bilan, telefonda klaviatura).
4. **Vazifalar API.** Migratsiya 00008; `input.go` sof tekshiruv va tarix farqi (table-driven); servis (`Create` mavjud va yangi mijoz bilan, atomiklik `FailInserts`, `phone_taken` / `value_taken`; `Get`; `List` tartib, sahifa, filtrlar, qidiruv; `Update` farq tarixga, o'zgarishsiz saqlash yozilmaydi, nofaol variant saqlanadi, chiqarilgan mas'ul o'zgartirilmasa qoladi, mijoz va tur o'zgarmaydi; `Move`; `Delete`; `History`); `customer_in_use`, `option_in_use` (vazifalar), `stage_in_use`, `type_in_use`, `field_in_use`; `GET /app/customers?phone=`; 7 route; openapi va api-client.
5. **Vazifalar sahifalari.** Mock API (vazifalar 7 route, `?phone=`, seed'lar), `lib/tasks.ts`, `Deadline`, "Vazifalar" bo'limi, ro'yxat (filtrlar, "Ustunlar", pager), kanban (default ko'rinish, sudrash, menyu, "+" sarlavhada, yig'ilgan yakuniy ustun, "Yana"), qo'shish dialogi (mijoz tanlash `?phone=` bilan, yangi mijoz, 409 → biriktirish), tahrirlash, vazifa sahifasi (bosqich select, mijoz, tarix), mijoz sahifasidagi "Vazifalar", e2e, README ("Vazifalar" bo'limi), hujjatlar holati.
6. **Yakuniy ko'rik.** Kod ko'rigi (mijozlardagi kabi), mutatsiya tekshiruvi (fayl nusxadan tiklanadi), lokal haqiqiy stack'da tekshiruv (pastda), push.

## Tekshiruv

- Har bosqichda: `make lint` 0 issues, `make test` (Go, web, admin, api-client) va `make e2e` toza.
- 2 va 4-bosqich, lokal stack'da curl bilan (user app origin'i orqali, mijozlardagi skript namunasida): egasi bosqich (rang, yakuniy), tur va maydon yaratadi, tartiblaydi; xodim sozlamada 403, `GET /app/members` 200; xodim vazifa qo'shadi — mavjud mijoz bilan va yangi mijoz bilan (bitta so'rov, takror telefon 409 `customer_id` bilan, yangi mijoz yozilmagan); ro'yxat filtrlari, qidiruv (nom, mijoz nomi, telefon), tartib muddat bo'yicha; `PATCH …/stage` va tarixda "Bosqich"; vazifasi bor mijoz, bosqich, tur, maydon va variant o'chmaydi; tarix egasiga 200, xodimga 403. Sinov ma'lumoti shu ishga xos nom bilan, aniq nomi bo'yicha tozalanadi; satrlar soni boshlang'ich holat bilan solishtiriladi; mavjud "Smoke …" yozuvlarga tegilmaydi.
- 3 va 5-bosqich: Playwright e2e (MSW) va vaqtinchalik skrinshot spec'i bilan ko'rik (375px va desktop, light va dark; `apps/*/e2e` da, commit'dan oldin o'chiriladi); yon scroll yo'qligi (kanban'ning gorizontal scroll'i `main` ichida); haqiqiy Go API bilan brauzerda bitta to'liq oqim: egasi bosqich va tur sozlaydi, xodim yangi mijoz bilan vazifa qo'shadi, ikkinchisida telefon yozib taklifdan mavjud mijozni tanlaydi (maydonlar to'ldirilgan va `disabled`), kanban'da sudrab ko'chiradi (desktop) va menyu bilan (telefon), "+" bilan bosqich tanlangan dialog ochadi, yakuniy ustunni ochib yopadi, muddati o'tgan vazifa qizil va "N kun kechikdi" bilan, tahrirlaydi, egasi tarixni va mijoz sahifasidagi vazifalarni ko'radi, vazifasi bor mijoz va bosqich o'chmaydi, vazifani o'chiradi.
- Yangi kompaniya (admin panel orqali) tayyor bosqich va tur bilan yaratilishi tekshiriladi.
- Stage rang belgilarining kontrasti (light, dark) skrinshotda o'lchanadi.

## Chegara (bu ishga kirmaydi)

- Bosqich ichida qo'lda tartib; turga xos bosqichlar; WIP limitlari; vazifali bosqichni ko'chirib o'chirish.
- Vazifaning mijozini yoki turini almashtirish; o'chirilganlarni tiklash.
- Eslatmalar va bildirishnomalar (bot orqali), takrorlanuvchi vazifalar, izohlar, fayllar, bosh sahifada "Mening vazifalarim" bloki, Excel eksport.
- Muddatda vaqt; mas'ulga ko'ra ruxsatlar (hamma hamma vazifani ko'radi).
- Admin panel.

## 1-bosqich qarorlari (2026-10-06)

Bajarildi: `internal/fields` (`Field`, `Option`, `Kind*`, `KindOf`, `CleanName`, `Taken`, `SameIDs`, `ErrOrderChanged`, `Invalid`; `Values`, `CheckValues`, `Change`, `DiffValues`), `internal/customer` unga o'tdi, `customer.CreateIn`; `apps/web`: `lib/fields.ts`, `components/field-answer.tsx` (`FieldAnswer`), `components/history-list.tsx` (`HistoryList`). Reja: `docs/superpowers/plans/2026-10-06-tasks-stage1-shared-fields.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Aliaslar.** `customer.Field`, `Option`, `Values`, `Change` va `Kind*` `fields` dagilarning aliasi: `internal/app` va mijoz testlari o'zgarmadi. `asText` eksport qilinmadi (tashqarida ishlatilmaydi).
- **Ko'chirish ham TDD bilan.** Yangi joyda avval test, keyin kompilyatsiya bo'ladigan stub (mantiq bo'yicha yiqildi), keyin kod. Mijoz paketidagi `values_test.go` da faqat telefon holatlari (`TestDiff`) qoldi.
- **`CreateIn` testi.** Ochiq tranzaksiya testning bazani o'chiradigan cleanup'ini to'sib qo'ygan edi (jarayon osilib qoldi): testdagi har tranzaksiyaga `t.Cleanup` rollback qo'shildi. Chaqiruvchining rollback'i mijozni va tarixini olib ketadi, commit saqlaydi.
- **Frontend.** `lib/customer-fields.ts` yo'qoldi: `kindLabels`, `kinds`, `isChoice` `lib/fields.ts` ga, `nameFieldOf` `lib/customers.ts` ga. `fieldColumns` `lib/fields.ts` da hech qaysi maydonni o'tkazib yubormaydi; mijozlarning nusxasi nom maydonini olib tashlab chaqiradi. `readAnswers(fields, entries, refuse)` xatoni kalit bilan aytadi, sxema uni `path: ["values", key]` ga aylantiradi. `FieldAnswer` forma yo'lini (`name`) o'zi oladi (vazifa formasi mijoz maydonlarini `customer.values.*` ostida ushlaydi). `HistoryList` o'z `HistoryEntry` shakli bilan (`CustomerHistoryEntry` unga mos; `TaskHistoryEntry` ham shunday bo'ladi).
- **Rejadan farq.** `useHiddenColumns` prefiksi va `FieldDialog` prop'lari 5- va 3-bosqichga qoldirildi: ularni talab qiladigan test o'sha yerda.
- **Tekshiruv.** `make lint` 0 issues; `make test`: Go 17 paket (yangi `fields`), web 391, admin 217, api-client 1; `make e2e`: admin 40, web 78.
