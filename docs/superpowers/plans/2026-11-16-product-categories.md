# Mahsulot kategoriyalari: reja

## Kontekst

Foydalanuvchi: «product larni categoriyasi bo'lishi kerak». Hozir `products` jadvalida kategoriya yo'q. `docs/design/README.md` 11.3 da «Mahsulot. Kategoriyalar…» «hozircha yo'q funksiyalar» ro'yxatida turibdi. Dizayn prototipi `228b1108` da ham mahsulot kategoriyasi yo'q, faqat moliya kategoriyalari bor. Shuning uchun UI kodda bor naqshlardan yig'iladi.

Maqsad: mahsulotlarni kategoriya bo'yicha guruhlash, ro'yxatda, «Qoldiq» jadvalida va hujjatdagi mahsulot tanlovida kategoriya bo'yicha filtrlash.

### Foydalanuvchi qarorlari (2026-11-16)

| Savol | Javob |
|---|---|
| Tuzilma | Bir darajali ro'yxat. Mahsulotda bitta kategoriya yoki kategoriyasiz |
| Kimga | Faqat mahsulotga. Xizmatga berilsa 400 |
| Majburiymi | Ixtiyoriy. Yangi mahsulot formasida boshida «Kategoriyasiz» turadi |
| Boshqaruv | Sozlamalar → «Mahsulot kategoriyalari», `settings.*` ruxsatlari. O'qish har a'zoga ochiq (forma va filtr uchun) |
| Nofaol holat | Yo'q. Amallar: qo'shish, nomini o'zgartirish, o'chirish, tartiblash |
| Mahsuloti bor kategoriyani o'chirish | Rad etiladi: 409 `category_in_use` «Bu kategoriyada N ta mahsulot bor» (faqat jonli mahsulotlar sanaladi) |
| Mavjud mahsulotlar | Migratsiya jonli mahsuloti bor har kompaniyada «Asosiy» kategoriyasini yaratadi va jonli mahsulotlarni (nofaollarini ham) unga biriktiradi. Mahsulotsiz va keyin ochilgan kompaniyalar bo'sh boshlaydi |
| «Asosiy» | Oddiy kategoriya: nomini o'zgartirsa ham, tartiblasa ham bo'ladi. Bo'shasa o'chiriladi |
| Qayerda | Mahsulot formasi, mahsulot sahifasi, ro'yxatda filtr va webdagi jadval ustuni. Ustiga: ombor «Qoldiq» jadvalida filtr va ustun, hujjatdagi mahsulot tanlovida filtr |

## Yondashuv

Alohida `product_categories` jadvali va `products.category_id` ustuni. Bu moliya kategoriyalari naqshi, faqat `kind` va `is_active` siz. Rad etilgan variantlar:
- `finance_categories` ga yangi tur qo'shish: ikki soha aralashib ketadi, `is_active` va `kind` ning ma'nosi boshqa;
- kategoriyani erkin matn qilib saqlash: yozuv xatolari chiqadi, sozlamada boshqarib bo'lmaydi.

## Dizayn

### Baza: `backend/migrations/00024_product_categories.sql`
- `product_categories (id, company_id → companies, name, position, created_at, updated_at, deleted_at, UNIQUE (company_id, id))`. Nom kompaniya ichida takrorlanmaydi, harf katta-kichikligi farq qilmaydi: `UNIQUE (company_id, lower(name)) WHERE deleted_at IS NULL`.
- `products.category_id BIGINT`:
  - FK `(company_id, category_id) → product_categories (company_id, id)`: kategoriya faqat o'z kompaniyasiniki bo'ladi;
  - `CHECK (kind = 'product' OR category_id IS NULL)`;
  - indeks `(company_id, category_id) WHERE deleted_at IS NULL`.
- Ma'lumot: `kind='product' AND deleted_at IS NULL` qatori bor har kompaniyaga «Asosiy» (position 1) qo'shiladi. Shu qatorlarning `category_id` si «Asosiy» ga qo'yiladi. Xizmatlar va o'chirilgan mahsulotlar NULL qoladi. `updated_at` ga tegilmaydi.
- Down: ustun, keyin jadval o'chiriladi.

### API (finance-categories naqshi, status kodlari ham o'shanday)
| Amal | Yo'l | Kim |
|---|---|---|
| Ro'yxat `[{id, name}]` tartibda | `GET /app/product-categories` | har a'zo |
| Qo'shish `{name}` (oxiriga) | `POST /app/product-categories` | `settings.create` |
| Nomini o'zgartirish `{name}` | `PATCH /app/product-categories/{id}` | `settings.edit` |
| Tartiblash `{ids}` | `PUT /app/product-categories/order` | `settings.edit` |
| O'chirish (yashirish) | `DELETE /app/product-categories/{id}` | `settings.delete` |

- Nom `fields.CleanName` (1–60). 409 `name_taken` «Bu nomli kategoriya allaqachon bor». 404 «Kategoriya topilmadi». 409 `order_changed`. 409 `category_in_use` «Bu kategoriyada N ta mahsulot bor».
- `Product` (ro'yxat, sahifa, yaratish va tahrirlash javobi) ga `category_id` va `category_name` qo'shiladi (null bo'lishi mumkin). `ProductInput` / `ProductUpdate` ga ixtiyoriy `category_id` qo'shiladi. PUT qoidasi o'zgarmaydi: yuborilmagan maydon bo'shaydi.
- Mahsulot tekshiruvi:
  - xizmatga kategoriya berilsa 400 «Xizmatga kategoriya berilmaydi» (sof tekshiruv, artikuldan keyin);
  - bazadagi tekshiruvlar tartibi: valyuta, keyin kategoriya. Kompaniyaning jonli kategoriyasi bo'lmasa 400 «Kategoriya noto'g'ri».
- Filtr `category_id`: `GET /app/products` va `GET /app/stock/summary` da. Qiymati: musbat son (shu kategoriya) yoki `none` (kategoriyasiz). Boshqa qiymat 400 «Kategoriya noto'g'ri». `StockSummaryItem` ga `category_name` qo'shiladi.

### Web (`apps/web`)
- **Sozlamalar.** `components/settings/product-categories-page.tsx` `FinanceCategoriesPage` naqshida, `Segmented` siz:
  - `OrderedRows` (tartiblash), `NameDialog`, `DeleteDialog`, `ActionSheet` («Nomini o'zgartirish», «O'chirish»);
  - route: `app/(app)/settings/product-categories/page.tsx`;
  - `use-settings-tab.ts`: `products` → `/settings/product-categories`;
  - hub (`settings-page.tsx`): «Mahsulot kategoriyalari» qatori soni bilan, «Dropdownlar» dan keyin.
- **Mahsulot formasi.** `product-dialog.tsx` da «Nomi» dan keyin «Kategoriya» qatori:
  - `SelectRow`, `none="Kategoriyasiz"`, variantlar sozlamadagi tartibda;
  - 8 va undan ko'p kategoriyada `search`;
  - varaq ostida izoh: «Kategoriyalar Sozlamalarda qo'shiladi»;
  - `lib/catalog.ts`: sxemaga `category_id` qo'shiladi (formada `""` bo'lsa `null` ketadi).
- **Mahsulot sahifasi.** «Ma'lumot» guruhining birinchi qatori `KeyValue` «Kategoriya». Bo'sh bo'lsa «—».
- **Ro'yxat** (`catalog-page.tsx`, `use-catalog-filter.ts`, faqat mahsulotlarda):
  - «Kategoriya» chipi `PickerSheet` ochadi: «Hamma kategoriyalar», kategoriyalar, oxirida «Kategoriyasiz» (`none`);
  - manzilda `?category=<id>|none`;
  - webdagi jadvalda «Nomi» dan keyin «Kategoriya» ustuni;
  - telefondagi qator o'zgarmaydi;
  - umumiy bo'lak `components/catalog/category-filter.tsx` (chip va varaq) «Qoldiq» da ham ishlatiladi.
- **«Qoldiq»** (`warehouse/stock-summary.tsx`): o'sha chip va filtr, webda «Mahsulot» dan keyin «Kategoriya» ustuni.
- **Hujjatdagi mahsulot tanlovi** (`warehouse/pickers.tsx` `ProductPicker`). U xarid, sotuv, ko'chirish, boshlang'ich qoldiq, inventarizatsiya va buyurtma tovarida ishlatiladi, shuning uchun bitta joyda o'zgaradi:
  - `SearchPickerSheet` ga ixtiyoriy `filters` joyi qo'shiladi (qidiruv bilan ro'yxat orasida);
  - kategoriya bor bo'lsa `ChoiceChips` chiqadi: «Hammasi» va kategoriyalar;
  - har ochilishda «Hammasi» ga qaytadi;
  - kategoriya tanlansa xizmatlar so'ralmaydi (sotuvda);
  - `useProductSuggestions` ga `categoryId` qo'shiladi.
- **Turlar, so'rovlar, mock'lar:**
  - `lib/types.ts` ga `ProductCategory`;
  - `lib/queries.ts` ga `productCategoriesKey`, `useProductCategories`, filtrlar;
  - MSW: `mocks/catalog.ts` (Go qoidalari), `mocks/data.ts` (`productCategories`, `ProductRow.category_id`, `seedCatalog` da bitta kategoriya va bitta kategoriyasiz mahsulot), `mocks/stock.ts`.

### Hujjatlar (avval hujjat, keyin kod)
- `docs/superpowers/specs/2026-11-16-product-categories-design.md`: yuqoridagi dizayn va qarorlar.
- `docs/superpowers/plans/2026-11-16-product-categories.md`: shu reja.
- `logic/products.md`:
  - tushunchalar;
  - 2-bo'lim ruxsatlari;
  - 3.1 maydon;
  - yangi «Kategoriyalar» bo'limi (qoidalar, o'chirish, «Asosiy» migratsiyasi);
  - 4 tekshiruv tartibi;
  - 5 ro'yxat filtri va ustuni;
  - 6 sahifa;
  - 7 chekka holatlar;
  - 8 xatolar.
- `logic/warehouse.md` 5: «Qoldiq» filtri va ustuni, mahsulot tanlovidagi chiplar.
- `logic/roles.md`: sozlamalar qatoriga «mahsulot kategoriyalari» qo'shiladi.
- `docs/design/README.md`:
  - 11.3 dan «Kategoriyalar» olib tashlanadi;
  - 12.1 «Sozlamalar» toastlariga «Kategoriya qo'shildi / nomi o'zgartirildi / o'chirildi» qo'shiladi.
- `CLAUDE.md` «Manbalar»: yangi spec qatori.

## Bosqichlar (har sikl: RED → GREEN → commit; har bosqich oxirida push gate, push, hisobot va tasdiq kutish)

### Bosqich 1: hujjatlar va backend (API, openapi, api-client, mock'lar)
Avval hujjatlar commit qilinadi: `docs: product categories`. Keyin sikllar:
1. `migrations`: `TestProductCategoriesKeepTheirRules`. Tekshiradi:
   - nom takrorlanmaydi (harf farqsiz), boshqa kompaniyada esa bo'ladi;
   - o'chirilgan kategoriyaning nomi bo'shaydi;
   - boshqa kompaniyaning kategoriyasiga bog'lab bo'lmaydi (23503);
   - xizmatga kategoriya berib bo'lmaydi (23514).
2. `migrations`: `TestTheProductCategoriesMigrationPutsTheProductsIntoAsosiy`. `DownTo(23)`, fixture'lar, `Up`:
   - «Asosiy» faqat mahsuloti bor kompaniyada yaratiladi, position 1;
   - faol va nofaol mahsulotlar unga biriktiriladi;
   - xizmat va o'chirilgan mahsulot NULL qoladi;
   - Down ustun va jadvalni olib tashlaydi.

   Helper'lar: `addCompany`, `addWarehouseFixture`.
3. `internal/db`: `product_categories.sql` so'rovlari:
   - `Create` (oxiriga), `List`, `Get`, `Rename`, `Delete` (yashirish), `Order`;
   - `CountCategoryProducts` (faqat jonli mahsulotlar);
   - test: `product_categories_test.go`.
4. `internal/db`: `products.sql`:
   - Create va Update `category_id` ni yozadi;
   - Get va List `category_id` hamda `c.name AS category_name` ni qaytaradi (oddiy ustun, sqlc nullability tuzog'i);
   - List va Count `category_id` / `uncategorized` bo'yicha filtrlaydi.
5. `internal/db`: `stock_moves.sql` `ListStockSummary` / `CountStockSummary` ga o'sha filtr va `category_name` qo'shiladi.
6. `internal/catalog/categories.go`, har biri alohida sikl:
   - `CreateCategory`: nom qoidalari, 409;
   - `RenameCategory`: 404, 409;
   - `DeleteCategory`: mahsuloti bor bo'lsa 409 soni bilan, bo'sh bo'lsa o'chadi va nomi bo'shaydi;
   - `OrderCategories`: 409 `order_changed`.

   Ishlatiladi: `s.write`, `fields.CleanName/Taken/SameIDs/ErrOrderChanged`.
7. `internal/catalog`: mahsulot kategoriyasi:
   - yaratish va tahrirlashda saqlanadi;
   - begona yoki o'chirilgan kategoriya 400 «Kategoriya noto'g'ri»;
   - xizmatga 400;
   - PUT da yuborilmasa bo'shaydi;
   - `Product` da `CategoryName` keladi.
8. `internal/catalog`: `List` filtri (`CategoryID`, `Uncategorized`).
9. `internal/warehouse`: `StockSummary` filtri va `CategoryName`.
10. `internal/app`:
    - kategoriya handlerlari va route'lar (`handler.go` dagi settings guruhlari, GET esa har a'zoga);
    - `permissions_test.go` ga yozuvlar;
    - `categoryParam` helper (`""` / `none` / son / 400);
    - `productJSON` maydonlari, `/app/products` va `/app/stock/summary` dagi param.
11. `internal/httpx/openapi_test.go` (route hujjatlanmagan bo'lsa yiqiladi) → `backend/openapi.yaml` → `make api-client`.
12. Web mock'lari va `mocks/handlers.test.ts` (kategoriya CRUD, filtrlar); `pnpm typecheck` toza.

Push gate: `make lint-go`, `make test-go`, `make lint-web`, `make test-web` (api-client o'zgargani uchun ikkala tomon). `seedCatalog` o'zgargan bo'lsa `catalog.spec.ts` ham yuradi (ikkala project). Hisobotga qator: «to'liq e2e yurmagan; o'zgargan umumiy kod: packages/api-client, backend/internal/db, backend/migrations».

### Bosqich 2: web, ya'ni sozlamalar, forma, sahifa va ro'yxat
1. `use-settings-tab.test.ts`: `settingsHref("products")`.
2. `product-categories-page.test.tsx`, har biri alohida sikl:
   - tartibdagi ro'yxat va bo'sh holat;
   - qo'shish, nomini o'zgartirish;
   - o'chirish (409 bo'lsa rad xabari);
   - tartiblash;
   - ruxsatsiz a'zoda amallar yo'q.

   Route ham shu bosqichda.
3. `settings-page.test.tsx`: «Mahsulot kategoriyalari» qatori va soni.
4. `lib/catalog.test.ts`: sxemadagi `category_id`.
5. `product-dialog.test.tsx`:
   - «Kategoriya» qatori bor;
   - tanlangan kategoriya saqlanadi, «Kategoriyasiz» bo'lsa `null` ketadi;
   - tahrirda joriy kategoriya ko'rinadi.
6. `product-page.test.tsx`: «Kategoriya» qatori.
7. `catalog-page.test.tsx`:
   - chip → varaq → so'rov va manzilda `category`;
   - «Kategoriyasiz»;
   - webdagi ustun.

   `category-filter.tsx` shu yerda yoziladi.
8. e2e (sahifalar orasidagi oqim, `mobile` va `desktop`): Sozlamalarda kategoriya qo'shiladi → mahsulot formasida tanlanadi → ro'yxatda chip bilan filtrlanadi. Testlar `settings.spec.ts` / `catalog.spec.ts` da.

Push gate: `make lint-web`, `make test-web`, `settings.spec.ts` va `catalog.spec.ts` (ikkala project). Hisobotga qator: «to'liq e2e yurmagan; o'zgargan umumiy kod: lib/…».

### Bosqich 3: web, ya'ni «Qoldiq» va hujjatdagi mahsulot tanlovi
1. `stock-summary.test.tsx`: chip filtri va «Kategoriya» ustuni.
2. `picker-sheet.test.tsx`: `filters` joyi qidiruv bilan ro'yxat orasida turadi.
3. `ProductPicker` testi (yangi `pickers.test.tsx`):
   - kategoriya bo'lsa chiplar chiqadi, bo'lmasa chiqmaydi;
   - chip so'rovni toraytiradi;
   - qayta ochilganda «Hammasi» turadi;
   - sotuvda kategoriya tanlansa xizmat so'ralmaydi.
4. e2e (375px dagi joylashuv): chiplar varaq ichida suriladi va varaqni kengaytirmaydi. Test mahsulot tanlovini qamragan spec'da (`warehouse.spec.ts`).

Push gate: `make lint-web`, `make test-web`, e2e: `warehouse.spec.ts`, `sales.spec.ts`, `orders.spec.ts`, `order-screen.spec.ts` (ikkala project; `ProductPicker` ularda ishlatiladi). Hisobotga qator: «o'zgargan umumiy kod: components/kit (picker-sheet)».

## Qayta ishlatiladigan narsalar
- Go:
  - `internal/finance/categories.go` va `queries/finance_categories.sql`: kategoriya CRUD va tartiblash naqshi;
  - `catalog.Service.write` (kompaniya qulfi: o'chirish va mahsulotga bog'lash bir-birini kutadi);
  - `currencyAllowed` (bazadagi tekshiruv naqshi);
  - `fields.*`;
  - `customer.SearchOf`.
- Web:
  - `components/settings/finance-categories-page.tsx`, `name-dialog.tsx`, `delete-button.tsx`;
  - `kit/ordered-rows.tsx`, `lib/use-reorder.ts`;
  - `kit/picker-sheet.tsx` (`SelectRow`, `PickerSheet` `none` / `search` bilan);
  - `kit/chips.tsx` (`Chip`, `ChoiceChips`);
  - `finance/expenses-page.tsx` (kategoriya chipi va varaq naqshi).

## Tekshiruv
- Har bosqichda yuqoridagi push gate. Testlar har siklda faqat o'zi yuradi (`go test ./internal/<paket> -run <Test>`, bitta vitest fayl).
- Migratsiyani haqiqiy ma'lumotda tekshirish (1-bosqich oxirida):
  - lokal `hisob24` dan `TEMPLATE` bilan `hisob24_it_cat` nusxa olinadi;
  - `goose up` qilinadi;
  - mahsuloti bor har kompaniyada bitta «Asosiy» borligi va jonli mahsulotlarning hammasi unga bog'langani SQL bilan ko'riladi;
  - nusxa o'chiriladi.
- 2- yoki 3-bosqichdan keyin ixtiyoriy smoke: `make dev`, brauzerda kategoriya qo'shish, mahsulotga berish, ro'yxat, «Qoldiq» va xarid formasidagi filtr.
- Deploy (test yoki prod) bu ishga kirmaydi, alohida so'rov bilan qilinadi.

## Eslatmalar
- sqlc: nullable ustun oddiy ustun bo'lib qaytsin. `make sqlc` eski gen fayllarni o'chirmaydi.
- `prettier` ishlatilmaydi, format qo'lda.
- Bir xil daraxtda boshqa sessiya ham commit qilishi mumkin: faqat o'z fayllarimni `add` qilaman, push oldidan `origin/dev..HEAD` ni tekshiraman.
- `go test ./...` 53300 xatosi bilan yiqilsa `-p 4` bilan qayta yuritiladi.
