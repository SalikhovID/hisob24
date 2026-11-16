# Mahsulot kategoriyalari — dizayn

Sana: 2026-11-16. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), uchala bosqich amalga oshirilgan (`dev` branch, 2026-11-16). Reja: [`docs/superpowers/plans/2026-11-16-product-categories.md`](../plans/2026-11-16-product-categories.md).

## Kontekst

Foydalanuvchining so'zlari:

- «product larni categroriyasi bo'lishi kerak»
- mavjud mahsulotlar haqida: «joriylariga `Asosiy` degan categoriya avtomat ochilib shularga birikib qolsin»

Hozirgacha mahsulotda kategoriya yo'q edi: `docs/design/README.md` 11.3 da u «hozircha yo'q funksiyalar» ro'yxatida turardi. Dizayn prototipida (`228b1108`) ham mahsulot kategoriyasi yo'q, faqat moliya kategoriyalari bor. Shuning uchun ko'rinish kodda bor naqshlardan yig'iladi: moliya kategoriyalari sahifasi, xarajatlar ro'yxatidagi kategoriya chipi, `SelectRow`, `ChoiceChips`.

`docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan qilinadi. Qoidalar: [`logic/products.md`](../../../logic/products.md) (3.4 «Kategoriyalar», 4–8-bo'limlar), [`logic/warehouse.md`](../../../logic/warehouse.md) (5-bo'lim, «Qoldiq»).

## Foydalanuvchi qarorlari (2026-11-16)

| # | Savol | Qaror |
|---|---|---|
| 1 | Tuzilma | **Bir darajali** ro'yxat. Mahsulotda bitta kategoriya yoki kategoriyasiz |
| 2 | Kimga | **Faqat mahsulotga**. Xizmatga berilsa 400 |
| 3 | Majburiymi | **Ixtiyoriy**. Yangi mahsulot formasida boshida «Kategoriyasiz» turadi |
| 4 | Kim boshqaradi | **Sozlamalar → «Mahsulot kategoriyalari»**, `settings.*` ruxsatlari bilan. Ro'yxatni har a'zo o'qiydi (forma va filtr uchun) |
| 5 | Nofaol holat | **Yo'q**. Amallar: qo'shish, nomini o'zgartirish, o'chirish, tartiblash |
| 6 | Mahsuloti bor kategoriyani o'chirish | **Rad etiladi**: 409 `category_in_use` «Bu kategoriyada N ta mahsulot bor» |
| 7 | Mavjud mahsulotlar | Migratsiya **«Asosiy»** kategoriyasini yaratadi va mahsulotlarni unga biriktiradi |
| 8 | «Asosiy» qayerda yaratiladi | **Faqat jonli mahsuloti bor kompaniyada**. Mahsulotsiz va keyin ochilgan kompaniya bo'sh boshlaydi |
| 9 | «Asosiy» qanday kategoriya | **Oddiy**: nomi o'zgaradi, tartiblanadi, bo'shasa o'chiriladi |
| 10 | Kategoriya qayerda ko'rinadi | Mahsulot formasi, mahsulot sahifasi, ro'yxatdagi filtr va webdagi jadval ustuni. **Ustiga**: ombor «Qoldiq» jadvalida filtr va ustun, hujjatdagi mahsulot tanlovida filtr |

## Yondashuv

Alohida `product_categories` jadvali va `products.category_id` ustuni. Bu moliya kategoriyalari naqshi, faqat `kind` va `is_active` siz. Rad etilgan variantlar:

- `finance_categories` ga yangi tur qo'shish: ikki soha aralashib ketadi, `is_active` va `kind` ning ma'nosi boshqa;
- kategoriyani erkin matn qilib saqlash: yozuv xatolari chiqadi, sozlamada boshqarib bo'lmaydi.

## Baza: `00024_product_categories.sql`

```sql
CREATE TABLE product_categories (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,
    position   INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX product_categories_name ON product_categories (company_id, lower(name)) WHERE deleted_at IS NULL;

ALTER TABLE products
    ADD COLUMN category_id BIGINT,
    ADD CONSTRAINT products_category FOREIGN KEY (company_id, category_id) REFERENCES product_categories (company_id, id),
    ADD CONSTRAINT products_category_kind CHECK (kind = 'product' OR category_id IS NULL);
CREATE INDEX products_by_category ON products (company_id, category_id) WHERE deleted_at IS NULL;
```

- FK `(company_id, category_id)` mahsulotni faqat o'z kompaniyasining kategoriyasiga bog'laydi. `category_id` NULL bo'lsa FK tekshirilmaydi.
- Ma'lumot: `kind = 'product' AND deleted_at IS NULL` qatori bor har kompaniyaga «Asosiy» (`position` 1) qo'shiladi. Shu qatorlarning (faol va nofaol) `category_id` si «Asosiy» ga qo'yiladi. Xizmatlar va o'chirilgan mahsulotlar NULL qoladi. `updated_at` ga tegilmaydi: bu tahrir emas.
- Down: `products.category_id` (cheklovlari va indeksi bilan), keyin `product_categories` o'chiriladi.

## API

| Amal | Yo'l | Kim | Javob |
|---|---|---|---|
| Ro'yxat | `GET /app/product-categories` | har a'zo | `[{id, name}]`, sozlamadagi tartibda |
| Qo'shish | `POST /app/product-categories {name}` | `settings.create` | 201 `{id, name}`, oxiriga qo'shiladi |
| Nomini o'zgartirish | `PATCH /app/product-categories/{id} {name}` | `settings.edit` | 200 `{id, name}` |
| Tartiblash | `PUT /app/product-categories/order {ids}` | `settings.edit` | 204 |
| O'chirish | `DELETE /app/product-categories/{id}` | `settings.delete` | 204 (yashiriladi) |

- **Nom:** `fields.CleanName`, ya'ni chetidagi bo'shliqlarsiz, 1–60 belgi («Nomni kiriting», «Nom 60 belgidan oshmasin»). Kompaniyada takrorlanmaydi, harf farqsiz: 409 `name_taken` «Bu nomli kategoriya allaqachon bor». O'chirilgan kategoriyaning nomi bo'shaydi.
- **Topilmasa:** 404 `not_found` «Kategoriya topilmadi».
- **Tartiblash:** ro'yxatdagi hamma jonli kategoriya bir martadan sanalishi shart, aks holda 409 `order_changed`.
- **O'chirish:** jonli mahsulot (faol yoki nofaol) bog'langan bo'lsa 409 `category_in_use` «Bu kategoriyada N ta mahsulot bor». O'chirilgan mahsulotlar sanalmaydi.
- **`Product`** (ro'yxat, sahifa, yaratish va tahrirlash javobi): `category_id` (son yoki `null`) va `category_name` (matn yoki `null`) qo'shiladi.
- **`ProductInput` / `ProductUpdate`:** ixtiyoriy `category_id` qo'shiladi. PUT qoidasi o'zgarmaydi: yuborilmagan ixtiyoriy maydon bo'shaydi, ya'ni mahsulot kategoriyasiz bo'ladi.
- **Mahsulot tekshiruvi** (`validation_error`):
  - xizmatga kategoriya berilsa 400 «Xizmatga kategoriya berilmaydi». Bu sof tekshiruv, artikuldan keyin keladi;
  - bazadagi tekshiruvlar tartibi: narx valyutasi, keyin kategoriya. Kategoriya kompaniyaning jonli kategoriyasi bo'lmasa 400 «Kategoriya noto'g'ri».
- **Filtr `category_id`** `GET /app/products` va `GET /app/stock/summary` da:
  - musbat son: shu kategoriyadagi mahsulotlar;
  - `none`: kategoriyasiz mahsulotlar;
  - berilmasa: hammasi;
  - boshqa qiymat: 400 «Kategoriya noto'g'ri»;
  - begona yoki o'chirilgan kategoriya: bo'sh ro'yxat.
- **`StockSummaryItem`** ga `category_name` qo'shiladi.

## Servis

- **`internal/catalog/categories.go`:**
  - `Category{ID, Name}`, `Categories`, `CreateCategory`, `RenameCategory`, `DeleteCategory`, `OrderCategories`;
  - hammasi `catalog.Service.write` ichida yuradi. U kompaniya qulfini ushlaydi, shuning uchun kategoriyani o'chirish va mahsulotga bog'lash bir-birini kutadi;
  - ishlatiladi: `fields.CleanName`, `fields.Taken`, `fields.SameIDs`, `fields.ErrOrderChanged`.
- **`internal/catalog` mahsulot qismi:**
  - `Product` ga `CategoryID`, `CategoryName`; `Input` ga `CategoryID` qo'shiladi;
  - `check` xizmatning kategoriyasini rad etadi;
  - `categoryAllowed` `currencyAllowed` dan keyin yuradi;
  - `ListInput` ga `CategoryID` va `Uncategorized` qo'shiladi.
- **`internal/warehouse`:** `StockSummary` o'sha filtrni oladi, qatorda `CategoryName` keladi.
- **`internal/app`:**
  - kategoriya handlerlari: GET har a'zoga (formalar o'qiydigan ro'yxatlar yonida), qolganlari `settings.*` guruhlarida;
  - `categoryParam` helper ikkala ro'yxat uchun umumiy.

## Web (`apps/web`)

- **Sozlamalar → «Mahsulot kategoriyalari»** (`/settings/product-categories`, `settings.view`). `FinanceCategoriesPage` naqshi, `Segmented` siz:
  - qatorlar sozlamadagi tartibda (`OrderedRows`, «Tartiblash»);
  - qator `ActionSheet` ochadi: «Nomini o'zgartirish» (`settings.edit`) va «O'chirish» (`settings.delete`, rad javobi xabarda);
  - `+` kategoriya qo'shadi (`settings.create`);
  - bo'sh holat: «Hali kategoriya yo'q».
  - Hub'da qator «Dropdownlar» dan keyin, soni bilan. `settingsHref("products")`.
- **Mahsulot formasi** (`ProductDialog`): «Nomi» dan keyin «Kategoriya» qatori:
  - `SelectRow`, `none="Kategoriyasiz"`, variantlar sozlamadagi tartibda;
  - 8 va undan ko'p kategoriyada qidiruv;
  - varaq ostida izoh: «Kategoriyalar Sozlamalarda qo'shiladi».
- **Mahsulot sahifasi:** «Ma'lumot» guruhining birinchi qatori «Kategoriya». Bo'sh bo'lsa «—».
- **Mahsulotlar ro'yxati** (faqat mahsulotlarda):
  - «Kategoriya» chipi varaq ochadi: «Hamma kategoriyalar», kategoriyalar, oxirida «Kategoriyasiz»;
  - manzilda `?category=<id>|none`;
  - webdagi jadvalda «Nomi» dan keyin «Kategoriya» ustuni;
  - telefondagi qator o'zgarmaydi;
  - holat chiplaridagi sonlar kategoriyaga qaramaydi.
- **«Qoldiq»:** o'sha chip (umumiy `components/catalog/category-filter.tsx`), webda «Mahsulot» dan keyin «Kategoriya» ustuni.
- **Hujjatdagi mahsulot tanlovi** (`ProductPicker`). U xarid, sotuv, ko'chirish, boshlang'ich qoldiq, inventarizatsiya va buyurtma tovarida ishlatiladi:
  - `SearchPickerSheet` ga ixtiyoriy `filters` joyi qo'shiladi (qidiruv bilan ro'yxat orasida);
  - kompaniyada kategoriya bo'lsa `ChoiceChips` chiqadi: «Hammasi» va kategoriyalar;
  - har ochilishda «Hammasi» ga qaytadi;
  - kategoriya tanlansa faqat shu kategoriyadagi mahsulotlar chiqadi; sotuvda xizmatlar so'ralmaydi.

## Bosqichlar

1. Hujjatlar, baza, API, openapi, `packages/api-client`, MSW mock'lari.
2. Web: sozlamalar sahifasi, mahsulot formasi va sahifasi, ro'yxat filtri va ustuni, sahifalar orasidagi oqim uchun e2e.
3. Web: «Qoldiq» filtri va ustuni, hujjatdagi mahsulot tanlovidagi chiplar, chiplarning 375px dagi joylashuvi uchun e2e.

Har bosqich oxirida push gate, push va hisobot qilinadi. Keyingi bosqich foydalanuvchi tasdig'idan keyin boshlanadi.
