# Ombor: mahsulotlar, xizmatlar, ta'minotchilar, xaridlar — dizayn va reja

Sana: 2026-10-07. Holat: foydalanuvchi reja sifatida tasdiqlagan (reja savollari va `/interview` bilan); amalga oshirilmoqda. Qoidalar: `logic/products.md`, `logic/warehouse.md`. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-07-inventory-stage<N>-*.md`.

## Kontekst

Foydalanuvchining so'zlari: "endi tamonochilar, productlar va servislar crudlari qo'shilishlari kerak. so'ng supplierdan tovar olish sahifasi (kutish keldi degan statuslar yoq, shunchaki sotib olsa skladga tushadi) har bir location bu har bir sklad."

Hozir user app'da: Mijozlar, Vazifalar (lokatsiya bo'yicha), Xodimlar (rollar, lokatsiya cheklovi), Sozlamalar. Kerak: **ta'minotchilar**, **mahsulotlar** va **xizmatlar** CRUD'lari, so'ng **xarid** (ta'minotchidan tovar olish): statussiz, saqlangan zahoti joriy lokatsiya (= ombor) **qoldig'ini** oshiradi. Savollarga javobida foydalanuvchi to'lov hisobini ham so'radi: ta'minotchi bo'yicha **qarz** (xaridlar − to'lovlar), avans mumkin, to'lov ta'minotchi sahifasidan va xarid formasidan. Ikki yangi bo'lim bilan tab-bar 7 ta bo'ladi: telefonda **«Yana»** menyusi, menyu tartibini a'zo o'zi sozlaydi (serverda saqlanadi).

`docs/SPEC.md` da yo'q yangi funksiya (Mijozlar, Vazifalar, Lokatsiyalar kabi). Admin panelga tegilmaydi (faqat lokatsiya o'chirish qoidasi kengayadi).

## Foydalanuvchi qarorlari (2026-10-07)

Reja savollari:

| # | Savol | Qaror |
|---|---|---|
| 1 | Bo'limlar | **Ikki bo'lim:** «Mahsulotlar» (Mahsulotlar, Xizmatlar tablari) va «Ombor» (Xaridlar, Ta'minotchilar tablari); telefonda «Yana» menyusi |
| 2 | Ta'minotchi maydonlari | **Nom, telefon, izoh.** Nom majburiy va kompaniyada takrorlanmas; telefon ixtiyoriy (+998); izoh ixtiyoriy |
| 3 | Mahsulot maydonlari | **Nom, birlik, sotuv narxi, artikul, izoh.** Nom majburiy va takrorlanmas; birlik majburiy; narx ixtiyoriy; artikul ixtiyoriy va takrorlanmas. Xarid narxi xaridning o'zida |
| 4 | O'lchov birligi | **Tayyor ro'yxat** kodda: dona, kg, g, l, ml, m, m², quti, juft, komplekt |
| 5 | To'lov | **To'langan summa va qarz** |
| 6 | Xaridni o'zgartirish | **Tahrirlash va o'chirish mumkin;** qoldiq farq bo'yicha qayta hisoblanadi |
| 7 | Rolsiz xodim | **Hammasi:** yangi bo'limlarda ko'rish, qo'shish, tahrirlash, o'chirish |
| 8 | Jarayon | **To'xtovsiz ketma-ket:** har GREEN'dan keyin commit, bosqich oxirida lint / test / e2e va push, yakunda bitta hisobot; deploy alohida so'raladi |
| 9 | Qarz modeli | **Ta'minotchi balansi:** qarz = jonli xaridlar jami − jonli to'lovlar jami; to'lov aniq xaridga bog'lanmaydi; xarid formasidagi «To'langan» shu xaridga bog'langan to'lov sifatida yoziladi |
| 10 | Avans | **Ha:** balans manfiy bo'lsa «Avans» |
| 11 | To'lov joyi | **Ta'minotchi sahifasi + xarid formasi;** to'lovni tahrirlash va o'chirish mumkin |

`/interview`:

| # | Savol | Qaror |
|---|---|---|
| 12 | Tab-bar'da qaysi 4 tasi | **A'zo o'zi sozlaydi** (standart: menyu tartibida birinchi 4 tasi) |
| 13 | Sozlash qayerda saqlanadi | **Serverda**, a'zolikda, har kompaniyada alohida (`user_companies.nav_order`); `/app/me` qaytaradi, boshqa qurilmada ham bir xil |
| 14 | Sozlash usuli | **Sudrab tartiblash** (SortableList): birinchi 4 tasi tab-bar'da, qolgani «Yana»da; «Standart holat» tugmasi |
| 15 | Sidebar | **Bitta tartib:** sidebar ham shu tartibda |
| 16 | «Menyuni sozlash» kirishi | **«Yana» sheet'i pastida + topbar profil menyusida** (ikkalasi bitta dialog) |
| 17 | Mahsulotlar ro'yxatidagi «Qoldiq» | **Joriy lokatsiya** (topbar tanlovchisi) |
| 18 | Xarid formasida narx | **Oxirgi xarid narxi** oldindan to'ladi (`Product.last_price`), bo'lmasa bo'sh |
| 19 | «To'langan summa» standarti | **0**, «To'liq» tugmasi jamini tushiradi |
| 20 | Ishlatilgan mahsulot | **«Nofaol» holati** (`is_active`): mahsulot, xizmat va ta'minotchida; nofaol xarid takliflarida chiqmaydi, qayta faollashtiriladi |
| 21 | Mahsulot sahifasida xaridlari | **Ha:** «Xaridlar» bo'limi (sana, ta'minotchi, miqdor, narx, lokatsiya) |
| 22 | Sanaladigan birlikda butun miqdor | **Yo'q:** har birlikda 3 kasrgacha |
| 23 | `/purchases` filtrlari | **Faqat lokatsiya va sahifa** |
| 24 | Xarid raqami | **Kompaniya ichida tartib raqami** («№ 12», `purchases.number`, o'chirilganda bo'shamaydi) |

## Reja bilan tasdiqlanadigan qarorlar

1. **Atamalar.** Mahsulotlar (`products`), Xizmatlar (`kind = 'service'`), Ta'minotchilar (`suppliers`), Xaridlar (`purchases`), Ombor (bo'lim nomi; «sklad» foydalanuvchining so'zi), Qoldiq (`stock`), To'lov (`supplier_payments`), Qarz / Avans (`balance`), Nofaol (`is_active = false`).
2. **Mahsulot va xizmat bitta jadvalda** (`products.kind`): xizmat birliksiz va artikulsiz mahsulot (nom, narx, izoh). Bitta CRUD, bitta ro'yxat komponenti (`kind` bilan); nom takrorlanmasligi har tur ichida alohida. Go'da `catalog.Product{Kind}`. Xizmat xaridga kirmaydi (400).
3. **Pul va miqdor JSON'da matn** (billing `amount` kabi: `"150000.50"`), Go'da `pgtype.Numeric`, tekshiruv regex bilan; **arifmetika faqat bazada** (`SUM(quantity * price)`, balans, qoldiq, oxirgi narx). Narx ≤ 12 xona butun, 2 kasr; miqdor ≤ 9 xona butun, 3 kasr, > 0, har birlikda (22-qaror). Formada vergul ham qabul qilinadi («1,5» → `1.5`), `inputMode="decimal"`.
4. **Qoldiq alohida jadvalda** (`stock`: lokatsiya × mahsulot), xarid tranzaksiyasida yangilanadi (upsert `+`, tahrirda farq, o'chirishda `−`); `CHECK (quantity >= 0)` buzilsa 409 `stock_insufficient` (hozir faqat xarid bor, manfiy bo'lmaydi; kelajakdagi sotuv uchun qoida).
5. **Xarid joriy lokatsiyaga tushadi** (topbar tanlovchisi; vazifalar kabi), lokatsiya keyin o'zgarmaydi; ta'minotchi, sana, izoh, qatorlar va to'langan summa tahrirlanadi. Xaridlar ro'yxati joriy lokatsiyaniki (`?location_id=`), berilmasa ruxsatli hammasi (ta'minotchi sahifasi). Ruxsatsiz lokatsiya 403 `forbidden`, ruxsatsiz lokatsiyadagi xarid 404 (vazifa qoidasi). Lokatsiyasiz a'zo: «Sizga lokatsiya biriktirilmagan».
6. **Xarid raqami** (24-qaror): `purchases.number`, kompaniyada 1 dan, `UNIQUE (company_id, number)`; `write()` qulfi ostida `MAX(number) + 1` (o'chirilganlar ham sanaladi, raqam bo'shamaydi). Hamma joyda «№ 12»: ro'yxatda «№ 12 · Ta'minotchi», sahifa sarlavhasi «Xarid № 12».
7. **Bir xaridda bir mahsulot bir marta** (400 ««X» ikki marta kiritilgan»). Ikki narxda olingan bo'lsa, ikki xarid.
8. **Bog'langan to'lov.** «To'langan» > 0 bo'lsa `supplier_payments` ga `purchase_id` bilan qator (sanasi xarid sanasi); tahrirda o'zgaradi / paydo bo'ladi / 0 bo'lsa yashirinadi; xarid o'chirilsa u ham; ta'minotchi almashtirilsa ergashadi. Ta'minotchi sahifasida xaridga havola bilan ko'rinadi, faqat xarid orqali tahrirlanadi (409 `payment_linked`).
9. **Oxirgi xarid narxi** (18-qaror): `Product.last_price` — mahsulotning oxirgi jonli xarid qatori narxi (`purchased_on DESC, purchase id DESC`), API hisoblaydi (`GET /app/products` va `/{id}`); formada mahsulot tanlanganda narx maydoniga tushadi (foydalanuvchi o'zgartiradi), mahsulot sahifasida «Oxirgi xarid narxi» fakti.
10. **Balans kompaniya bo'yicha** (hamma lokatsiya), ro'yxatlar a'zoning ruxsatli lokatsiyalari bo'yicha. `Supplier.balance` faqat `purchases.view` bo'lganga (aks holda `null`, ustun chizilmaydi).
11. **Nofaol** (20-qaror): `products.is_active`, `suppliers.is_active`; `PATCH …/{id} {is_active}` (`products.edit` / `suppliers.edit`); ro'yxatlarda «Faol» / «Nofaol» tablari (`?status=`, standart faol); nofaol yozuv sahifasida «Nofaol» belgisi va «Faollashtirish»; xarid takliflari (`Picker`) faqat faollarni oladi (`?status=active`); nofaol mahsulotning qoldig'i, xaridlari, nofaol ta'minotchining balansi ko'rinaveradi; mavjud xaridda nofaol mahsulot / ta'minotchi tahrirda qoladi (o'zgartirilmasa qayta tekshirilmaydi, boshqasi tanlansa faol bo'lishi shart: 400 «Mahsulot nofaol» / «Ta'minotchi nofaol»).
12. **O'chirish yashirish** (`deleted_at`), nomlar bo'shaydi. Jonli xarid qatori bor mahsulot (409 `product_in_use` «Bu mahsulot N ta xaridda bor»), jonli xaridi yoki to'lovi bor ta'minotchi (409 `supplier_in_use` «Bu ta'minotchida N ta xarid bor» / «… N ta to'lov bor») o'chirilmaydi (nofaol qilinadi); xizmat va to'lov erkin o'chiriladi; xarid o'chirilsa qoldiq qaytadi. **Admin** jonli xaridi bor lokatsiyani o'chira olmaydi (409 `location_in_use` «Bu lokatsiyada N ta xarid bor», vazifa tekshiruvidan keyin).
13. **Ruxsat katalogiga uch bo'lim:** `products` (mahsulotlar va xizmatlar), `suppliers`, `purchases` (xaridlar va to'lovlar), har birida view / create / edit / delete (tarix yo'q). Rolsiz xodimning standart to'plamiga 12 tasi ham. Xarid qo'shish tugmasi `purchases.create` + `suppliers.view` + `products.view` bo'lsa (pickerlar shu ro'yxatlarni so'raydi). Mahsulot sahifasidagi «Xaridlar» va ta'minotchi sahifasidagi balans, xaridlar, to'lovlar `purchases.view` bilan.
14. **Menyu tartibi serverda** (12–16): `user_companies.nav_order TEXT[]` (bo'lim kalitlari: `home`, `customers`, `tasks`, `products`, `warehouse`, `employees`, `settings`; NULL = standart), `PUT /app/me/nav {sections}` (kalitlar katalogdan, takror bir marta, `null` standartga; 400 «Bo'lim noto'g'ri»), `/app/me` da `nav_order` (tanlangan kompaniyaniki, kompaniyasiz `null`). Client: ruxsatli bo'limlar saqlangan tartibda, ro'yxatda yo'qlari standart tartibda oxiriga. Sidebar va tab-bar bir tartibda; tab-bar ≤ 5 bo'limda hammasi, 6+ da birinchi 4 + «Yana» (`EllipsisIcon`; pastdan `Sheet`, qolgan bo'limlar; joriy sahifa ulardan birida bo'lsa «Yana» belgilangan). «Menyuni sozlash» dialogi (`NavOrderDialog`: `SortableList`, «Standart holat», «Saqlash» → toast «Menyu tartibi saqlandi») «Yana» pastidan va topbar profil menyusidan ochiladi.
15. **Standart menyu tartibi:** Bosh sahifa, Mijozlar, Vazifalar, Mahsulotlar, Ombor, Xodimlar, Sozlamalar. Egasi standartda: bar'da Bosh sahifa, Mijozlar, Vazifalar, Mahsulotlar; «Yana»da Ombor, Xodimlar, Sozlamalar. Rolsiz xodim 5 ta: «Yana» yo'q.
16. **Bo'lim tablari manzil bilan:** `/products` va `/services`; `/purchases` va `/suppliers`. Har sahifa tepasida bo'lim tab tasmasi (`SectionTabs`, sozlamalar tablari ko'rinishida, havolalar), faqat a'zo ko'ra oladigan tablar. «Ombor» a'zo ko'ra oladigan birinchi tabiga ochiladi (`NavItem.tabs`, `navFor` manzilni hisoblaydi, `isCurrent` tablarning hammasini biladi).
17. **Xarid formasi sahifa** (`/purchases/new`, `/purchases/[id]/edit`), dialog emas. Mahsulot, xizmat, ta'minotchi, to'lov va menyu formalari dialog.
18. **Picker** (`components/picker.tsx`): nom bo'yicha qidiradigan combobox (`CustomerPicker` naqshi, 300 ms, 5 taklif, klaviatura): ta'minotchi (`GET /app/suppliers?search=&status=active`) va mahsulot (`GET /app/products?kind=product&status=active&search=`, nom yoki artikul; taklifda birlik va oxirgi narx). Tanlangani chip bo'lib turadi, «×» bilan bo'shaydi.
19. **Tartib:** mahsulotlar, xizmatlar, ta'minotchilar nom bo'yicha (`lower(name)`); xaridlar va to'lovlar yangi birinchi (`purchased_on DESC, id DESC` / `paid_on DESC, id DESC`). Sahifada 20 ta. `/purchases` da filtr yo'q (23-qaror).
20. **Uzunliklar:** nom 1–120 («Nomni kiriting», «Nom 120 belgidan oshmasin»), artikul ≤ 60, izoh ≤ 500, telefon `user.NormalizePhone` → `^998\d{9}$` («Telefon raqami noto'g'ri»), takror hisoblanmaydi. Sana `YYYY-MM-DD`, har qanday (o'tgan ham, kelgusi ham).
21. **Tarix yo'q** (o'zgarishlar tarixi) — chegarada; «Qo'shgan» va «Qo'shilgan» mavjud naqshda.
22. **Pul ko'rinishi:** admin'dagi `formatAmount` web'ga (minglar NBSP bilan, kasr vergul bilan, `.00` tashlanadi); `formatQuantity` (ortiqcha nollarsiz + birlik: «1,5 kg», «12 dona»). Jadval ustuni sarlavhasi birlikni aytadi («Jami, so'm»), faktlarda «1 200 000 so'm».
23. **Yozuvlar navbat bilan:** har yozuv `write()` (bitta tranzaksiya, `LockCompanyCustomers`) — mijoz va vazifa yozuvlari bilan bir navbat; raqam, qoldiq, balans va «ishlatilganmi» tekshiruvlari poygasiz.

## Spec'dan chetlanishlar

| # | Spec / qoida | Yangi | Sabab |
|---|---|---|---|
| 1 | API ro'yxati (6-bo'lim) | `/app/products*` (7), `/app/suppliers*` (6), `/app/suppliers/{id}/payments*` (4), `/app/purchases*` (5), `PUT /app/me/nav` (1): 23 route | yangi funksiya |
| 2 | `/app/me` | + `nav_order` | 13-qaror |
| 3 | `logic/roles.md` 4.1, 4.2, 4.3, 8 | katalogga uch bo'lim; standart to'plam; xarid formasi uchun uch ruxsat; menyu tartibi va «Yana» | 7, 13, 14-qarorlar |
| 4 | `logic/locations.md` 1, 3, 6 | lokatsiya xaridlarga ham tegadi; jonli xaridi bor lokatsiya o'chirilmaydi | 5, 12-qarorlar |
| 5 | `logic/user.md` 1 | a'zolikda `nav_order` | 13-qaror |
| 6 | `CLAUDE.md`: keyingi bosqichga tasdiqdan keyin | to'xtovsiz ketma-ket | 8-qaror |

## Ruxsatlar

`internal/access`: `ProductsView … ProductsDelete`, `SuppliersView … SuppliersDelete`, `PurchasesView … PurchasesDelete`; `All` tartibi: customers, tasks, products, suppliers, purchases, employees, settings; `Default` += 12; `sectionNames` += «Mahsulotlar», «Ta'minotchilar», «Xaridlar». `openapi.yaml` `Permission` enum; `lib/permissions.ts` (`allPermissions`, `defaultPermissions`, `Section`, `sectionLabels`, `sections`) — rol formasi va `summaryOf` o'zidan yangilanadi.

## Ma'lumotlar modeli

`backend/migrations/00011_catalog.sql`:

```sql
-- +goose Up
CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    kind            TEXT NOT NULL CHECK (kind IN ('product', 'service')),
    name            TEXT NOT NULL,
    unit            TEXT CHECK (unit IN ('dona','kg','g','l','ml','m','m2','quti','juft','komplekt')),
    sku             TEXT,
    price           NUMERIC(14,2) CHECK (price >= 0),      -- sotuv narxi (mahsulot) / narx (xizmat), ixtiyoriy
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id),
    CHECK ((kind = 'product') = (unit IS NOT NULL)),      -- mahsulot birlikli, xizmat birliksiz
    CHECK (kind = 'product' OR sku IS NULL)
);
CREATE UNIQUE INDEX products_name ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX products_sku ON products (company_id, lower(sku)) WHERE deleted_at IS NULL AND sku IS NOT NULL;
CREATE INDEX products_list ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
-- +goose Down
DROP TABLE products;
```

`backend/migrations/00012_nav_order.sql`:

```sql
-- +goose Up
-- A member's own order of the app's sections (logic/roles.md, section 8): NULL is the default order.
ALTER TABLE user_companies ADD COLUMN nav_order TEXT[];
-- +goose Down
ALTER TABLE user_companies DROP COLUMN nav_order;
```

`backend/migrations/00013_warehouse.sql`:

```sql
-- +goose Up
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    name            TEXT NOT NULL,
    phone           TEXT CHECK (phone ~ '^998[0-9]{9}$'),
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX suppliers_name ON suppliers (company_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE purchases (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    number          INT NOT NULL,                           -- kompaniya ichida 1 dan, bo'shamaydi
    location_id     BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchased_on    DATE NOT NULL,
    note            TEXT,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),   -- qatorlar yig'indisi, bazada hisoblanadi
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id),
    UNIQUE (company_id, number),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE INDEX purchases_newest ON purchases (company_id, purchased_on DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX purchases_supplier ON purchases (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX purchases_location ON purchases (location_id) WHERE deleted_at IS NULL;

CREATE TABLE purchase_items (
    purchase_id BIGINT NOT NULL REFERENCES purchases(id),
    product_id  BIGINT NOT NULL REFERENCES products(id),
    quantity    NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    price       NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    position    INT NOT NULL,
    PRIMARY KEY (purchase_id, product_id)                 -- bir xaridda bir mahsulot bir marta
);
CREATE INDEX purchase_items_product ON purchase_items (product_id);

CREATE TABLE stock (
    company_id  BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (location_id, product_id),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id)
);

CREATE TABLE supplier_payments (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchase_id     BIGINT REFERENCES purchases(id),      -- xarid bilan kiritilgan to'lov, bo'lsa
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    paid_on         DATE NOT NULL,
    note            TEXT,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE UNIQUE INDEX supplier_payments_purchase ON supplier_payments (purchase_id) WHERE purchase_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX supplier_payments_newest ON supplier_payments (supplier_id, paid_on DESC, id DESC) WHERE deleted_at IS NULL;
-- +goose Down
DROP TABLE supplier_payments; DROP TABLE stock; DROP TABLE purchase_items; DROP TABLE purchases; DROP TABLE suppliers;
```

Migratsiya testlari (`migrations_test.go`): nom indekslari (tur ichida, harf farqsiz, o'chirilgan bo'shaydi), artikul indeksi, xizmat birlik CHECK'i, `nav_order` ustuni, raqam yagonaligi (23505), begona kompaniya FK'lari (23503), `stock` CHECK (23514), bog'langan to'lov yagonaligi, Down.

## API (`backend/openapi.yaml` → `make api-client`)

Sxemalar: `Unit` (enum), `Product {id, kind, name, unit, sku, price, note, is_active, quantity, last_price, created_by_name, created_at, updated_at}` (`quantity`: so'ralgan lokatsiya qoldig'i, xizmatda `null`; `last_price`: oxirgi xarid narxi yoki `null`), `ProductInput {kind, name, unit?, sku?, price?, note?}`, `ProductUpdate` (`kind`siz), `ActiveInput {is_active}`, `ProductDetail` (+ `stock: StockLine[]`, `StockLine {location_id, location_name, quantity}`), `ProductPage`, `ProductPurchase {purchase_id, number, purchased_on, supplier: {id, name}, location_id, quantity, price, amount}`, `ProductPurchasePage`; `Supplier {id, name, phone, note, is_active, balance, created_by_name, created_at, updated_at}` (`balance` `purchases.view` siz `null`), `SupplierInput`, `SupplierDetail` (+ `purchases_total`, `payments_total`), `SupplierPage`; `Payment {id, supplier_id, purchase_id, purchase_number, amount, paid_on, note, created_by_name, created_at}`, `PaymentInput {amount, paid_on, note?}`, `PaymentPage`; `Purchase {id, number, location_id, supplier: {id, name}, purchased_on, note, total, paid, items_count, created_by_name, created_at, updated_at}`, `PurchaseItem {product_id, name, unit, quantity, price, amount}`, `PurchaseDetail` (+ `items`), `PurchaseInput {supplier_id, purchased_on, note?, paid?, items: [{product_id, quantity, price}]}`, `PurchaseCreate` (= input + `location_id`), `PurchasePage`; `NavOrderInput {sections: string[] | null}`; `Me` + `nav_order`. Pul va miqdor `string` (`pattern`). Xato javoblari mavjud uslubda.

| Endpoint | Ruxsat | Qoida |
|---|---|---|
| `PUT /app/me/nav {sections}` | a'zo (`requireCompany`) | kalitlar katalogdan, takror bir marta, `null` standart; 200 `Me` |
| `GET /app/products?kind=product\|service&status=active\|inactive&search=&page=&location_id=` | `products.view` | `kind` berilmasa `product`, `status` berilmasa `active`; qidiruv nomda (va artikulda); `location_id` ruxsatsiz 403, son emas 400 «Lokatsiya noto'g'ri», berilmasa `quantity` ruxsatli lokatsiyalar yig'indisi |
| `POST /app/products` | `products.create` | tekshiruv: tur («Turni tanlang»), nom, birlik (mahsulotda «Birlikni tanlang», xizmatda bo'lmasin), artikul, narx («Narx noto'g'ri»), izoh; 409 `name_taken` «Bu nomli mahsulot / xizmat allaqachon bor», `sku_taken` «Bu artikulli mahsulot allaqachon bor» |
| `GET /app/products/{id}` | `products.view` | `stock` ruxsatli lokatsiyalar bo'yicha (xizmatda `[]`), `last_price`; begona / o'chirilgan 404 «Mahsulot topilmadi» |
| `PUT /app/products/{id}` | `products.edit` | tur o'zgarmaydi; qolgani almashadi |
| `PATCH /app/products/{id} {is_active}` | `products.edit` | nofaol / faol |
| `DELETE /app/products/{id}` | `products.delete` | 409 `product_in_use` |
| `GET /app/products/{id}/purchases?page=` | `purchases.view` | shu mahsulot qatorlari, ruxsatli lokatsiyalar, yangi birinchi |
| `GET /app/suppliers?status=&search=&page=` | `suppliers.view` | qidiruv nomda va telefon raqamlarida; `balance` `purchases.view` bilan |
| `POST /app/suppliers` · `GET/PUT/DELETE /app/suppliers/{id}` · `PATCH /app/suppliers/{id} {is_active}` | `suppliers.*` | 409 `name_taken` «Bu nomli ta'minotchi allaqachon bor»; 404 «Ta'minotchi topilmadi»; 409 `supplier_in_use` |
| `GET /app/suppliers/{id}/payments?page=` | `purchases.view` | yangi birinchi; bog'langanlarda `purchase_id`, `purchase_number` |
| `POST /app/suppliers/{id}/payments` · `PUT/DELETE …/payments/{paymentId}` | `purchases.create/edit/delete` | summa > 0 («Summani kiriting», «Summa noto'g'ri»), sana («Sanani kiriting», «Sana noto'g'ri»), izoh; bog'langan to'lov 409 `payment_linked` «Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang»; 404 «To'lov topilmadi» |
| `GET /app/purchases?location_id=&supplier_id=&page=` | `purchases.view` | `location_id` berilsa shu lokatsiya (ruxsatsiz 403), berilmasa ruxsatli hammasi; `supplier_id` ta'minotchi sahifasi uchun |
| `POST /app/purchases` | `purchases.create` | `location_id` yo'q / 0 → 400 «Lokatsiyani tanlang», ruxsatsiz → 403 (handler'da); keyin ta'minotchi («Ta'minotchini tanlang»; nofaol «Ta'minotchi nofaol»), sana, izoh, qatorlar («Kamida bitta mahsulot qo'shing»; har qatorda mahsulot «Mahsulotni tanlang», xizmat «Xizmat xaridga kiritilmaydi», nofaol «Mahsulot nofaol», takror ««X» ikki marta kiritilgan», miqdor ««X» miqdori noto'g'ri», narx ««X» narxi noto'g'ri»), to'langan («To'langan summa noto'g'ri»). Tranzaksiya: raqam → xarid → qatorlar → `total` → qoldiq `+` → bog'langan to'lov |
| `GET /app/purchases/{id}` | `purchases.view` | qatorlari bilan; ruxsatsiz lokatsiyadagi 404 «Xarid topilmadi» |
| `PUT /app/purchases/{id}` | `purchases.edit` | lokatsiya va raqam o'zgarmaydi; o'zgarmagan ta'minotchi va mahsulot qayta tekshirilmaydi (nofaol bo'lsa ham qoladi); qatorlar qaytadan yoziladi, qoldiq farq bilan (`stock_insufficient` 409), `total` qayta, bog'langan to'lov yangilanadi |
| `DELETE /app/purchases/{id}` | `purchases.delete` | yashiradi, qoldiq `−` (409 `stock_insufficient`), bog'langan to'lov yashirinadi |

Kontrakt testi (`internal/httpx/openapi_test.go`) yangi route'larni o'zi talab qiladi.

## Backend

Qatlam: handler → service → sqlc. Ikki yangi paket va bitta kengaytma:

- **`internal/catalog`** (`catalog.go`: `Service`, `write()`, `Product{ID, Kind, Name, Unit, SKU, Price, Note, Active, Quantity, LastPrice, CreatedByName, CreatedAt, UpdatedAt}` (ixtiyoriylari `*string`), `Input`, `Scope{CompanyID, LocationIDs}` (`task.Scope` nusxasi), xatolar; `units.go`: `Units` `{Code, Name}` va `UnitKnown`; `numbers.go`: `Money(raw)`, `Quantity(raw)` (regex + `pgtype.Numeric.Scan`), `Text(n) *string` (admin `amountText` kabi); `products.go`: `List(ctx, scope, ListInput{Kind, Status, Search, LocationID, Page})`, `Get` (+ `stock`), `Create`, `Update`, `SetActive`, `Delete`; `purchases.go`: `Purchases(ctx, scope, id, page)` (mahsulot sahifasi uchun)).
- **`internal/warehouse`** (`warehouse.go`: `Service`, `write()`, `Scope`; `suppliers.go`: `Supplier{…, Active, Balance *string}`, `List` (balans subquery; `withBalance bool`), `Get` (+ jami xarid, jami to'lov), `Create`, `Update`, `SetActive`, `Delete`; `payments.go`: `Payment`, `ListPayments`, `AddPayment`, `UpdatePayment`, `DeletePayment` (bog'langan → 409); `purchases.go`: `Purchase{…, Number}`, `Item`, `Input`, `List(ctx, scope, ListInput{LocationID, SupplierID, Page})`, `Get`, `Create(ctx, scope, by, locationID, in)` (`NextPurchaseNumber` qulf ostida), `Update`, `Delete`; `stock.go`: `applyStock(q, companyID, locationID, productID, delta)` → 23514 `stock_quantity_check` → `errStockInsufficient`).
- **`internal/user`**: `Profiles.SetNavOrder(ctx, phone, companyID, sections *[]string)`; `Access` / `Profile` + `NavOrder []string` (`GetCompanyAccess` yoki `GetCompanyMember`).
- **So'rovlar** (`products.sql`, `suppliers.sql`, `purchases.sql`, `supplier_payments.sql`, `users.sql`): `CreateProduct`, `GetProduct`, `ListProducts` (`LEFT JOIN stock` lokatsiya bo'yicha yoki `SUM` scope ichida; `last_price` subquery; `ILIKE` qidiruv `likeEscaper` bilan; `status`), `CountProducts`, `UpdateProduct`, `SetProductActive`, `DeleteProduct`, `CountProductPurchases`, `ListProductStock(product_id, location_ids)`, `ListProductPurchases`, `CountProductPurchases`; `CreateSupplier`, `GetSupplier` (balans: `COALESCE(SUM(p.total),0) − COALESCE(SUM(sp.amount),0)` jonlilar bo'yicha, jami xarid va to'lov), `ListSuppliers`, `CountSuppliers`, `UpdateSupplier`, `SetSupplierActive`, `DeleteSupplier`, `CountSupplierPurchases`, `CountSupplierPayments`; `NextPurchaseNumber` (`MAX(number) + 1`, o'chirilganlar bilan), `CreatePurchase`, `GetPurchase` (`items_count`, `paid` subquery), `ListPurchases` (`location_id = ANY(location_ids)`), `CountPurchases`, `UpdatePurchase`, `SetPurchaseTotal` (`SUM(quantity * price)`), `DeletePurchase`, `AddPurchaseItem`, `ListPurchaseItems` (nom, birlik, `quantity * price AS amount`), `DeletePurchaseItems`, `AddStock` (upsert `+ delta`), `CountLocationPurchases`; `CreatePayment`, `GetPayment`, `ListPayments` (`purchase_number` bilan), `CountPayments`, `UpdatePayment`, `DeletePayment`, `GetPurchasePayment`, `DeletePurchasePayment`; `SetNavOrder`. Har so'rovga `internal/db/*_test.go` da test.
- **`internal/company/locations.go`** `DeleteLocation`: vazifadan keyin `CountLocationPurchases` > 0 → 409 `location_in_use` «Bu lokatsiyada N ta xarid bor».
- **`internal/app`**: `catalog.go`, `warehouse.go` (handlerlar; `?location_id=` 400 / 403 `listTasks` kabi; `createPurchase` ruxsatsiz lokatsiya → `forbidden`; `balance` faqat `purchases.view` bilan), `nav.go` (`setNavOrder`), `session.go` `inventoryScope(r)`, `handler.go` `Services.Catalog`, `Services.Warehouse`, `me` ga `nav_order`, route'lar. `cmd/api/main.go` ikki servisni ulaydi.
- **Testlar (TDD, table-driven, `pgtest`):** migratsiyalar; so'rovlar; `catalog/*_test.go` (tekshiruv tartibi, takror nom / artikul, xizmatga birlik, nofaol, `product_in_use`, qoldiq ustuni scope bo'yicha, `last_price`, mahsulot xaridlari); `warehouse/*_test.go` (raqam ketma-ket va bo'shamaydi; atomiklik `FailInserts` bilan: qator yozilmasa qoldiq ham o'zgarmaydi; tahrirda farq; o'chirishda qaytish; `stock_insufficient`; bog'langan to'lov hayoti; balans va avans; nofaol ta'minotchi / mahsulot qoidasi; cheklangan xodim boshqa lokatsiya xaridini ko'rmaydi); `user/profiles_test.go` (`nav_order`); `app/*_test.go` (403 / 400 / 404 tartibi, `/app/me.permissions` va `nav_order`, `PUT /app/me/nav`); `access_test.go`; `company/locations_test.go`; navbat testi yangi yozuvlar bilan.

Qayta ishlatiladi: `customer.Service.write` naqshi va `LockCompanyCustomers`, `fields.Invalid` / `Taken` (indeks nomi bilan `name_taken` va `sku_taken` ajratiladi), `apperr`, `httpx.DecodeJSON` / `WriteError` / `JSON`, `pathID`, `sessionCompany`, `allowedLocation`, `user.NormalizePhone`, `customer.SearchOf` / `likeEscaper` naqshi, `billing.amountPattern` va `admin.amountText` naqshi, `pgtest.New` / `FailInserts` / `WaitForLockWait`, `newTestAPI` / `signIn` / `bearer`.

## User app (`apps/web`)

| Fayl | O'zgarish |
|---|---|
| `lib/permissions.ts`, `lib/types.ts` | yangi bo'limlar; `Product`, `ProductDetail`, `ProductPurchase`, `Supplier`, `SupplierDetail`, `Payment`, `Purchase`, `PurchaseDetail`, `PurchaseItem`, `Unit`, `StockLine`, page tiplari |
| `lib/nav.ts` | `NavItem.key` (`home` … `settings`), `tabs?: {label, href, permission}[]`; «Mahsulotlar» (`PackageIcon`, tablar Mahsulotlar / Xizmatlar, `products.view`), «Ombor» (`WarehouseIcon`, tablar Xaridlar `purchases.view` / Ta'minotchilar `suppliers.view`); `navFor(permissions, navOrder)` ruxsatli bo'limlarni saqlangan tartibda (yo'qlari standart tartibda oxirida), bo'limni ruxsatli birinchi tabiga ochadi; `isCurrent` tablarni biladi; `barItems(items)` (≤ 5 hammasi, aks holda 4 + qolganlari) |
| `components/shell/tab-bar.tsx`, `more-sheet.tsx` (yangi), `nav-order-dialog.tsx` (yangi), `sidebar.tsx`, `topbar.tsx` | «Yana» (`EllipsisIcon`, pastdan `Sheet`, `pb-safe`, qolgan bo'limlar, pastida «Menyuni sozlash»); joriy sahifa yashirin bo'limda bo'lsa «Yana» `aria-current`; `NavOrderDialog` (`SortableList`, «Standart holat», «Saqlash» → `PUT /app/me/nav`, `meKey` invalidatsiya, toast); profil menyusida «Menyuni sozlash»; sidebar `navFor` tartibida |
| `components/section-tabs.tsx` (yangi) | bo'lim tablari tasmasi: havolalar, sozlamalar tablari ko'rinishi, `aria-current="page"`, faqat ruxsatli tablar; `/products`, `/services`, `/purchases`, `/suppliers` sahifalarida `PageHeader` dan oldin |
| `lib/format.ts` | `formatAmount` (admin'dan), `formatQuantity(quantity, unit)`, `unitLabel`, `parseDecimal` (vergul → nuqta) |
| `lib/catalog.ts` (yangi) | `units`, `productSchema` / `serviceSchema` (zod; xabarlar API'niki), `kindLabels`, `statusTabs` |
| `lib/warehouse.ts` (yangi) | `supplierSchema`, `paymentSchema`, `purchaseSchema` (qatorlar massivi, takror mahsulot, to'langan), `lineTotal`, `purchaseTotal` (ko'rsatish uchun), `balanceText` («Qarz» / «Avans» / «Qarz yo'q») |
| `lib/queries.ts` | `productsKey`, `useProducts(companyId, {kind, status, search, locationId, page})`, `useProduct`, `useProductPurchases`, `useProductSuggestions`; `suppliersKey`, `useSuppliers`, `useSupplier`, `useSupplierSuggestions`; `paymentsKey`, `usePayments`; `purchasesKey`, `usePurchases(companyId, {locationId, supplierId, page})`, `usePurchase`; `useSetNavOrder`; invalidatsiyalar (xarid yozuvi → purchases, products (qoldiq, oxirgi narx), suppliers (balans), payments) |
| `components/picker.tsx` (yangi) | nom bo'yicha combobox (18-qaror); testlari |
| `components/catalog/*` | `catalog-page.tsx` (`kind` bilan: «Faol» / «Nofaol» tablari, qidiruv, pager, `?status=&search=&page=`; ustunlar «Mahsulot» (`Identity`, nom, ostida artikul yoki birlik; havola mahsulot sahifasiga), «Birlik», «Narx» (`align: "end"`, `card: "aside"`), «Qoldiq» (faqat mahsulotda, joriy lokatsiya), «Qo'shgan», «Qo'shilgan»; xizmatda qator amallari tahrirlash / nofaol / o'chirish), `product-dialog.tsx` (qo'shish va tahrirlash: nom, birlik `SelectBox`, narx, artikul, izoh), `service-dialog.tsx`, `active-button.tsx` (nofaol / faollashtirish, toast), `delete-product-button.tsx`, `product-page.tsx` (`/products/[id]`: «Nofaol» belgisi; facts: birlik, narx, oxirgi xarid narxi, artikul, izoh, qo'shgan, qo'shilgan; «Qoldiq» bo'limi lokatsiyalar bo'yicha; «Xaridlar» bo'limi (`purchases.view`; № , sana, ta'minotchi, miqdor, narx, 2+ da lokatsiya; pager); «Tahrirlash», «Nofaol qilish», «O'chirish» → 409 toast), `use-catalog-filter.ts` |
| `components/warehouse/*` | `suppliers-page.tsx` («Faol» / «Nofaol» tablari, qidiruv, pager; ustunlar «Ta'minotchi» (nom, telefon), «Qarz» (`align: "end"`, `card: "aside"`, qarz qizil, avans yashil, 0 «—»; `purchases.view` bilan), «Qo'shgan», «Qo'shilgan»), `supplier-dialog.tsx` (nom, `PhoneField` ixtiyoriy, izoh), `supplier-page.tsx` (`/suppliers/[id]`: balans kartasi «Qarz / Avans / Qarz yo'q», «Jami xaridlar», «Jami to'lovlar»; «Xaridlar» ro'yxati (№, sana, jami, to'langan, 2+ da lokatsiya; pager); «To'lovlar» ro'yxati (sana, summa, izoh, bog'langanida «Xarid № N» havolasi; o'z to'lovida tahrirlash / o'chirish); «To'lov qo'shish» dialogi; «Tahrirlash», «Nofaol qilish», «O'chirish»), `payment-dialog.tsx` (summa, sana (bugun), izoh; qo'shish va tahrirlash), `purchases-page.tsx` (joriy lokatsiya; ustunlar «Xarid» (`№ 12 · Ta'minotchi`, ostida sana · N ta mahsulot; havola), «Jami» (`aside`), «To'langan», «Qo'shgan»; pager; lokatsiyasiz karta; «Xarid qo'shish» → `/purchases/new`), `purchase-form.tsx` (ta'minotchi `Picker`, sana (`type="date"`, bugun), qatorlar `useFieldArray`: mahsulot `Picker` (tanlanganda `last_price` narxga), miqdor, narx, summa; «Qator qo'shish», qatorni olib tashlash; jami; «To'langan summa» + «To'liq»; izoh; `Refusal`), `purchase-page.tsx` (`/purchases/[id]`: «Xarid № 12»; facts: ta'minotchi (havola), sana, lokatsiya (2+), jami, to'langan, izoh, qo'shgan, qo'shilgan; qatorlar jadvali (Mahsulot, Miqdor, Narx, Summa, footer Jami); «Tahrirlash» → `/purchases/[id]/edit`, «O'chirish»), `new-purchase-page.tsx`, `edit-purchase-page.tsx`, `use-purchase-filter.ts` |
| `app/(app)/products/page.tsx`, `products/[id]/page.tsx`, `services/page.tsx`, `suppliers/page.tsx`, `suppliers/[id]/page.tsx`, `purchases/page.tsx`, `purchases/new/page.tsx`, `purchases/[id]/page.tsx`, `purchases/[id]/edit/page.tsx` | route'lar (`Suspense` qidiruvli sahifalarda, `metadata.title`) |
| `proxy.test.ts` | yangi manzillar himoyalangan (xarakteristika) |
| `mocks/catalog.ts`, `mocks/warehouse.ts` (yangi), `mocks/data.ts`, `mocks/handlers.ts` | Go qoidalari: tekshiruv tartibi va xabarlar, takror, qidiruv, nofaol, raqam, qoldiq (`db.stock`), balans, bog'langan to'lov, oxirgi narx, 403 / 404 lokatsiya; `Membership.navOrder`, `PUT /app/me/nav`; boshlang'ich holatda mahsulot / ta'minotchi yo'q, testlar `seedCatalog()`, `seedSuppliers()` ni chaqiradi; `handlers.test.ts` mahkamlaydi |
| `e2e/catalog.spec.ts`, `e2e/warehouse.spec.ts` (yangi), `e2e/shell.spec.ts` | 375px va desktop: «Yana» menyusi (egasi), menyu tartibini sudrab saqlash (reload'dan keyin, sidebar'da ham), bo'lim tablari; mahsulot va xizmat qo'shish / tahrirlash / nofaol / o'chirish, takror nom; ta'minotchi qo'shish; xarid (ikki qator, oxirgi narx taklifi) → № 1, qoldiq ro'yxat va mahsulot sahifasida, mahsulot sahifasida xarid, ta'minotchi qarzi; to'lov → qarz kamayadi, avans; xarid tahriri → qoldiq farqi; xarid o'chirish → qoldiq qaytadi, raqam bo'shamaydi (keyingisi № 3); xaridi bor mahsulot o'chmaydi (toast), nofaol qilinadi va taklifda chiqmaydi; lokatsiya almashganda ro'yxat va qoldiq almashadi (Nok Market); rolsiz xodim hammasini ko'radi, bo'sh rolli ko'rmaydi |
| `README.md` | «Mahsulotlar va xizmatlar», «Ombor» bo'limlari, menyu tartibi |

Vitest: `nav.test.ts` (tablar, tartib, `barItems`), `tab-bar.test.tsx` (5 / 6+, «Yana», joriy), `more-sheet.test.tsx`, `nav-order-dialog.test.tsx`, `topbar.test.tsx`, `sidebar.test.tsx`, `section-tabs.test.tsx`, `permissions.test.ts`, `format.test.ts`, `catalog.test.ts`, `warehouse.test.ts`, `picker.test.tsx`, `catalog-page.test.tsx`, `product-dialog.test.tsx`, `product-page.test.tsx`, `suppliers-page.test.tsx`, `supplier-page.test.tsx`, `payment-dialog.test.tsx`, `purchases-page.test.tsx`, `purchase-form.test.tsx`, `purchase-page.test.tsx`, `handlers.test.ts`, `role-form.test.tsx`. Mavjud testlar faqat talab o'zgarganda (menyu ro'yxati, `/app/me` fixture'lari `permissions` va `nav_order` bilan, `proxy.test.ts`); hech biri o'chirilmaydi.

## Hujjatlar

- `logic/products.md` (yangi): mahsulot va xizmat tushunchalari, maydonlar, birliklar, nofaol, kim nima qila oladi, qidiruv va tartib, qoldiq va oxirgi narx ko'rinishi, o'chirish, chekka holatlar, xato kodlari.
- `logic/warehouse.md` (yangi): ta'minotchi (nofaol), xarid (raqam, lokatsiya, qatorlar, tekshiruv tartibi, tahrir va o'chirish, qoldiqqa ta'siri), qoldiq, to'lov va balans (qarz, avans, bog'langan to'lov), kim nima qila oladi, ro'yxatlar, chekka holatlar, xato kodlari.
- `logic/roles.md`: 4.1 katalog (uch bo'lim), 4.2 standart to'plam va jadval qatorlari, 4.3 xarid formasi uchun uch ruxsat, 8-bo'lim menyu tartibi va «Yana».
- `logic/locations.md`: 1-bo'lim (lokatsiya xaridlarga ham tegadi), 3-bo'lim (xaridi bor lokatsiya o'chirilmaydi), yangi «Xaridlar va lokatsiya» bo'limi, 7–8-bo'limlar.
- `logic/user.md`: 1-bo'lim (a'zolikda `nav_order`).
- `docs/superpowers/specs/2026-10-07-inventory-design.md`: shu hujjat (bosqich qarorlari bilan to'ldiriladi).
- `CLAUDE.md` «Manbalar», `README.md`.

## Bosqichlar (TDD: RED → GREEN → commit; har bosqich oxirida `make lint`, `make test`, `make e2e`, `git push origin main`)

0. **Hujjatlar.** `logic/products.md`, `logic/warehouse.md`, `logic/roles.md`, `logic/locations.md`, `logic/user.md`, spec, `CLAUDE.md`.
1. **Katalog API.** Ruxsat katalogi (Go, openapi enum, `permissions.ts`; `/app/me.permissions`); migratsiya 00011 (testlari bilan); `products.sql`; `internal/catalog` (`units`, `numbers`, `products`: `List` / `Get` / `Create` / `Update` / `SetActive` / `Delete`; hozircha `Quantity`, `LastPrice`, `Stock` bo'sh); handlerlar va 6 route; openapi + TS client; web mock `mocks/catalog.ts` va `handlers.test.ts`.
2. **Qobiq: menyu.** Migratsiya 00012, `SetNavOrder`, `Profiles.SetNavOrder`, `/app/me.nav_order`, `PUT /app/me/nav`; openapi + TS client; `nav.ts` (kalitlar, tablar, tartib, `barItems`), `TabBar` «Yana» + `MoreSheet`, `NavOrderDialog`, profil menyusi, sidebar tartibi, `SectionTabs`; web mock; Vitest; e2e (`shell.spec.ts`).
3. **Katalog UI.** `format.ts`, `lib/catalog.ts`, `queries.ts`, `/products`, `/services`, dialoglar, nofaol, `/products/[id]` (qoldiq va xaridlar bo'limlari API'dan, hozircha bo'sh), Vitest, e2e (`catalog.spec.ts`), `proxy.test.ts`.
4. **Ombor API.** Migratsiya 00013; `suppliers.sql`, `purchases.sql`, `supplier_payments.sql`; `internal/warehouse` (ta'minotchilar, to'lovlar, xaridlar, raqam, qoldiq); `catalog` ga `Quantity`, `LastPrice`, `Stock`, `Purchases`; `company.DeleteLocation` xarid qoidasi; handlerlar va 16 route; openapi + TS client; web mock `mocks/warehouse.ts`.
5. **Ombor UI.** `Picker`, `lib/warehouse.ts`, `queries.ts`, `/suppliers`, `/suppliers/[id]` (balans, xaridlar, to'lovlar, to'lov dialogi), `/purchases` (joriy lokatsiya), `/purchases/new`, `/purchases/[id]`, `/purchases/[id]/edit`, mahsulotlar «Qoldiq» ustuni, mahsulot sahifasida qoldiq, oxirgi narx va xaridlar, Vitest, e2e (`warehouse.spec.ts`), README.
6. **Yakuniy ko'rik.** Kod ko'rigi, mutatsiya tekshiruvi (fayl nusxadan tiklanadi, `-timeout` bilan), lokal haqiqiy stack'da tekshiruv (pastda), hisobot (har funksiya RED → GREEN). Deploy alohida so'raladi.

Har bosqich boshida batafsil reja `docs/superpowers/plans/2026-10-07-inventory-stage<N>-*.md`. Commit'lar faqat o'z fayllari bilan.

## Tekshiruv

- Har bosqichda `make lint` 0 issues, `make test` (Go, web, admin, api-client), `make e2e` toza; hech bir test o'chirilmaydi yoki o'tkazib yuborilmaydi.
- 1, 2 va 4-bosqich: lokal haqiqiy stack'da curl bilan (vaqtinchalik `hisob24_*` DB `TEMPLATE hisob24` dan, 8090 kabi bo'sh portlar, SMS kodi API log'idan, 12 xonali telefonlar, sinov nomlari ishga xos): egasi mahsulot / xizmat / ta'minotchi qo'shadi (takror nom va artikul 409), nofaol qiladi (takliflarda yo'q), menyu tartibini saqlaydi (`/app/me` qaytaradi, noto'g'ri kalit 400); xarid (ikki qator, to'langan 0) → № 1, qoldiq, balans = jami, `last_price`; to'lov → balans kamayadi; qarzdan ortiq to'lov → avans; xarid tahriri (miqdor kamayadi, ta'minotchi almashadi) → qoldiq farqi, to'lov ergashadi; xarid o'chirish → qoldiq 0, bog'langan to'lov yo'qoladi, keyingi raqam bo'shamaydi; xaridi bor mahsulot va ta'minotchi 409; cheklangan xodim boshqa lokatsiya xaridini ko'rmaydi (404 / 403), balansni ko'radi; bo'sh rolli xodim 403; admin xaridi bor lokatsiyani o'chira olmaydi (409). Sinov ma'lumoti o'chiriladi, satrlar soni boshlang'ich holatga qaytadi.
- 3 va 5-bosqich: Playwright e2e (MSW) va vaqtinchalik skrinshot spec'i (375px va desktop, light va dark, Mini App soxta skript bilan): «Yana» menyusi va sozlash dialogi, bo'lim tablari, mahsulot ro'yxati va sahifasi, xarid formasi telefonda (qatorlar), ta'minotchi sahifasi; 320px da yon scroll yo'q; haqiqiy Go API bilan brauzerda bitta to'liq oqim (egasi menyuni sozlaydi, mahsulot va ta'minotchi qo'shadi, xarid kiritadi, qoldiq va qarzni ko'radi, to'lov qo'shadi).
- Yangi kompaniya (admin panel orqali) o'zgarmaydi (tayyor mahsulot / ta'minotchi yo'q, menyu standart).

## Chegara (bu ishga kirmaydi)

- Sotuv, mijozga savdo, chek; qoldiqni qo'lda tuzatish (inventarizatsiya); lokatsiyalar orasida ko'chirish; minimal qoldiq ogohlantirishi.
- Mahsulot kategoriyalari, rasm, shtrix-kod skaneri, narx tarixi, o'rtacha tannarx; mahsulotda alohida «xarid narxi» maydoni (oxirgi xarid narxi hisoblanadi).
- Xarid va to'lov tarixi (o'zgarishlar), ta'minotchi tarixi; kassa, valyuta (faqat so'm).
- Xaridlarda qidiruv, ta'minotchi va sana oralig'i filtri; Excel import / eksport; hisobotlar (davr bo'yicha xaridlar); bosh sahifada ombor xulosasi.
- Xizmatlarni vazifa yoki sotuvga biriktirish.
- Admin panelda mahsulot, ta'minotchi, xarid ko'rsatish (faqat lokatsiya o'chirish qoidasi).
- Menyu tartibini user bo'yicha hamma kompaniyada bir xil saqlash; sidebar'da bo'limlarni guruhlash.

## 1-bosqich qarorlari (2026-10-07)

Bajarildi: ruxsat katalogi 30 ta (`internal/access`: `products.*`, `suppliers.*`, `purchases.*`; `Default` ularni ham oladi; openapi `Permission` enum; `lib/permissions.ts`), migratsiya `00011_catalog.sql` (testlari bilan), `products.sql` (7 so'rov), `internal/catalog` (`catalog.go`: `Service`, `write()`, `Product`, `Input`, `check`; `numbers.go`: `Money`, `Text`; `units.go`: `Units`; `products.go`: `List`, `Get`, `Create`, `Update`, `SetActive`, `Delete`), `internal/app/catalog.go` va 6 route, `cmd/api` ulashi, openapi (`ProductKind`, `Unit`, `Product`, `ProductInput`, `ProductUpdate`, `ActiveInput`, `ProductPage`, `ProductNotFound`, `ProductConflict`, ikki path) + TS client, web mock (`mocks/catalog.ts`, `ProductRow`, `db.products`). Reja: `docs/superpowers/plans/2026-10-07-inventory-stage1-catalog-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Pul `pgtype.Numeric` bilan, matn sifatida qaytadi** (`catalog.Text`, admin `amountText` kabi): `"12000.5"` kiritilsa baza `"12000.50"` qaytaradi, `"50000"` → `"50000.00"`. Tekshiruv regex `^\d{1,12}(\.\d{1,2})?$` (billing bilan bir xil); vergul 400.
- **`check(kind, in)` sof funksiya**, tartibi: tur → nom → birlik → artikul → narx → izoh; tahrirda tur bazadagi yozuvniki (`in.Kind` e'tiborga olinmaydi) va eng avval yozuvning o'zi (404). Takror indeksni `pgconn.PgError.ConstraintName` ajratadi: `products_sku` → `sku_taken`, aks holda `name_taken` (xabar turga qarab).
- **Yozuvdan keyin `GetProduct` bilan qayta o'qiladi** (tranzaksiya ichida): `created_by_name` a'zoning hozirgi ismi bilan; `gen.ListProductsRow` → `gen.GetProductRow` o'tkazmasi (bir xil ustunlar) bitta `toProduct`.
- **Qidiruv `customer.SearchOf` bilan** (ILIKE escape; raqamlar qismi ishlatilmaydi): nom va artikulda, so'z ichidan.
- **`PATCH` holat tekshiruvi yozuvdan oldin** (`is_active` yo'q → 400 «Holat noto'g'ri», keyin 404); mock ham shu tartibda.
- **Xizmat 404 xabari «Mahsulot topilmadi»** (bitta yo'l, tur noma'lum); xizmatning alohida sahifasi yo'q.
- **Mavjud testlar o'zgardi (talab o'zgargani uchun):** `access_test` (18 → 30, standart to'plam), `permissions.test.ts`, `role-form.test.tsx` (yetti bo'lim), `permissions_test.go` (rol `products` ni ham cheklaydi, standart to'plam mahsulot qo'shadi). Hech biri o'chirilmadi.
- **Testdagi xatolar (kod emas):** `db` ro'yxat testida `"NO"` qidiruvi `aNOr` va `NOk` ikkalasini topardi (so'z ichidan qidiruv to'g'ri) — kutilma `"ANO"` ga; mock testida bir foydalanuvchi bir testda ikki marta kirsa mock SMS cooldown 429 — kirish tartibi o'zgartirildi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 20 paket, api-client 1, admin 235, web 612; `make e2e`: admin 42, web 104. Lokal haqiqiy stack (`hisob24_smoke_cat` nusxasi `TEMPLATE hisob24` dan, goose 11, API :8090, botlar o'chiq): 27 / 27 — egasi 30 ruxsat, mahsulot va xizmat qo'shadi (trim, ikki kasr), takror nom (ikki xabar) va artikul 409, birliksiz / xizmatga birlik / vergulli narx 400, rolsiz xodim 201, bo'sh rolli 403 `forbidden`, kompaniyasiz token 403 `company_required`, ro'yxat nom bo'yicha, `kind=service`, artikul qidiruvi, nofaol (faol ro'yxatdan ketadi, `status=inactive` da), tahrir (tur qoladi, yuborilmagani bo'shaydi), xizmatga birlik tahrirda 400, o'chirish 204 → 404 → nom bo'shaydi, `page=abc` 400. API log'ida xato 0; vaqtinchalik DB o'chirildi, `hisob24` ga tegilmadi. macOS'da `setsid` yo'q: API `nohup … & disown` bilan.

## 2-bosqich qarorlari (2026-10-07)

Bajarildi: migratsiya `00012_nav_order.sql` (`user_companies.nav_order TEXT[]`), `GetCompanyAccess` + `nav_order`, `SetNavOrder`; `internal/user/nav.go` (`NavSections`, `ParseNavOrder`), `Access.NavOrder`, `Profiles.SetNavOrder`; `/app/me.nav_order`, `PUT /app/me/nav` (`internal/app/nav.go`, `meBody`), openapi (`NavSection`, `NavOrderInput`, `Me.nav_order`, path) + TS client; web `lib/nav.ts` (`NavKey`, `NavTab`, `NavItem.key/tabs`, `navFor(permissions, navOrder)`, `barItems`, `isCurrentItem`, «Mahsulotlar» va «Ombor» bo'limlari), `TabBar` («Yana» tugmasi), `MoreSheet`, `NavOrderDialog`, `useSetNavOrder`, `Sidebar` va `Topbar` (profil menyusida «Menyuni sozlash»), mock (`Membership.navOrder`, `meOf`, `PUT /app/me/nav`), e2e (`shell.spec.ts`: «Yana», tartibni sudrab saqlash va reload). Reja: `docs/superpowers/plans/2026-10-07-inventory-stage2-shell-menu.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`PUT /app/me/nav` javobi `/app/me` ning o'zi**, yangi tartib bilan: handler `SetNavOrder` dan keyin `Profiles.Access` ni qayta o'qiydi (kontekstdagi standing eski), `meBody(ctx, claims, standing)` ikkala handler'ga umumiy. Client `setQueryData(meKey, me)` qiladi, qayta so'ramaydi.
- **Bo'sh ro'yxat ham tartib** (`[]` → `'{}'`, `nav_order: []`): client yo'q bo'limlarni standart tartibda to'ldiradi; `null` esa NULL (standart). Noma'lum kalit 400 «Bo'lim noto'g'ri», hech narsa yozilmaydi.
- **`navFor` barqaror sort bilan:** tartibda nomlangan bo'limlar o'z o'rnida, qolganlari `navOrder.length` darajasi bilan standart tartibda; ruxsatsiz (yoki tablari ruxsatsiz) bo'lim chiqmaydi; tabli bo'lim ruxsatli birinchi tabiga (`href`) ochiladi.
- **«Yana» tugmasi** (`button`, `aria-haspopup="dialog"`, `aria-current="page"` yashirin bo'limlardan biri joriy bo'lsa) bar'da oxirgi o'rinda; `MoreSheet` pastdan (`Sheet side="bottom"`, `pb-safe`), sarlavhasi «Yana», `nav aria-label="Qolgan bo'limlar"`, pastida «Menyuni sozlash».
- **`NavOrderDialog` formasi `me.data` kelgach mount bo'ladi** (`OrderForm({me})`): holat ochilgan paytdagi tartibdan boshlanadi (avval `useMe` yuklanmasdan mount bo'lib bo'sh holatni olardi — Vitest tutdi). «Standart holat» tugmasi standart holatda o'chiq.
- **e2e `openSection` «Yana»ni biladi:** bar'da yo'q bo'lim «Yana» dialogidan bosiladi; egasi telefonda «Xodimlar» va «Sozlamalar»ni shu yo'l bilan ochadi. Mavjud spec'lar (`employees`, `miniapp`) bevosita bosishdan `openSection`ga o'tdi; `miniapp` egasi bar'ida «Mijozlar» va «Yana»ni tekshiradi. Birinchi to'liq e2e'da 14 ta mobile test shu sababdan yiqilgan edi; tuzatilgach 34 / 34.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 20 paket, api-client 1, admin 235, web 633; e2e: admin 42, web 106 (92 + qayta ishga tushirilgan 14). Lokal haqiqiy stack (1-bosqich smoke skriptlari, `smoke_nav.py`): 8 / 8 — `nav_order` null, saqlash (takror bir marta, javob `/app/me`), noma'lum kalit 400 va o'zgarmaslik, `[]`, `null`, kompaniyasiz 403. API log'ida xato 0.

## 3-bosqich qarorlari (2026-10-07)

Bajarildi: `SectionTabs` (`components/section-tabs.tsx`); `lib/format.ts` (`formatAmount`, `unitLabel`), `lib/catalog.ts` (`units`, `productSchema`, `serviceSchema`, `productDefaults`, `serviceDefaults`), `lib/queries.ts` (`productsKey`, `useProducts`, `productKey`, `useProduct`); `components/catalog/*` (`use-catalog-filter.ts`, `catalog-page.tsx`, `product-dialog.tsx`, `service-dialog.tsx`, `active-button.tsx`, `delete-product-button.tsx`, `product-page.tsx`, `icon-action.ts`); route'lar `/products`, `/services`, `/products/[id]`; mock `seedCatalog()`; `proxy.test.ts`; e2e `catalog.spec.ts`. Reja: `docs/superpowers/plans/2026-10-07-inventory-stage3-catalog-ui.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Artikul alohida ustun, nom ostida emas.** `DataList.href` butun sarlavha katagini `Link` qiladi va faqat oddiy matnli sarlavha uchun mo'ljallangan (ichida o'z havolasi bo'lgan katak bilan qo'shilmaydi). Shuning uchun «Mahsulot» ustuni nomning o'zi (havola `/products/<id>`), «Artikul» (`card: "inline"`, bo'shi «—») va «Birlik» (`Badge`, `card: "tag"`) alohida ustunlar. Xizmatlar ro'yxatida havola yo'q: xizmat o'z qatorida boshqariladi (tahrirlash, nofaol, o'chirish ikonkalari, `iconAction`).
- **Jami soni filtrsiz ro'yxatdan.** «Kompaniyangiz mahsulotlari · N ta» faqat «Faol» tabida va qidiruvsiz ko'rsatiladi (API `total` filtrlangan sonni qaytaradi); «Nofaol» tabida yoki qidiruvda izoh sonsiz.
- **Filtr manzilda** (`?status=inactive`, `?search=`, `?page=`), standart holat manzilsiz; har o'zgarish 1-sahifadan (`useCustomerFilter` naqshi, `asked` ref bilan ketma-ket o'zgarishlar). Route'lar `Suspense` ichida (`useSearchParams`).
- **Dialoglar har ochilishda yangidan:** ochilish paytida `form.reset(defaults(record))` va `save.reset()`, shunda tahrir dialogi yozuvning hozirgi holatidan boshlanadi va oldingi `Refusal` qolmaydi. Tur (`kind`) faqat yaratishda yuboriladi, `PUT` da yo'q.
- **`ActiveButton` toast'i javobdan:** «Mahsulot nofaol qilindi» / «Xizmat faollashtirildi» `saved.is_active` va `kind` bo'yicha; ro'yxat invalidatsiya, sahifa `setQueryData(productKey)`.
- **O'chirish 409 toast'da,** dialog yopiladi, yozuv qoladi (`product_in_use` 4-bosqichda paydo bo'ladi); mahsulot sahifasida `afterDelete` → `router.replace` orqaga havola manziliga (mahsulot `/products`, xizmat `/services`); `afterDelete` bo'lsa tugma navigatsiyagacha pending turadi.
- **Mahsulot sahifasi xizmatni ham ochadi** (`/products/<id>` xizmat ID'si bilan): izoh «Xizmat», orqaga «Xizmatlar», faktlarda birlik va artikul yo'q. 404 → «Mahsulot topilmadi» va orqaga havola; boshqa xato → `Failed` va qayta urinish.
- **Testlar.** Testing Library `getByText` matcher'ida NBSP emas, oddiy bo'sh joy (normalizer DOM matnini yig'adi, matcher'ni emas); `textContent` solishtirishda haqiqiy ` `. Mock `ProductRow` komponentga `toProduct(row)` bilan beriladi. Playwright: `getByRole("tab", { name: "Faol" })` «Nofaol»ga ham tushadi → `exact: true`; telefonda dialog tugmasidan keyin kursor toast'lar ustida qoladi va ular ketmaydi → `page.mouse.move` va `[data-sonner-toast]` soni 0 kutiladi; `openSection` sessiya kelguncha bar'da bo'lim yoki «Yana» chiqishini kutadi (to'liq e2e'da desktop `roles.spec` bir marta shu sababdan yiqilgan edi).
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 20 paket, api-client 1, admin 235, web 667; e2e: admin 42, web 110. Vaqtinchalik skrinshot spec'i (375px va desktop, light va dark: ikkala ro'yxat, dialog, mahsulot sahifasi, «Yana», sozlash dialogi) ko'rildi va o'chirildi; yon scroll yo'q.

## 4-bosqich qarorlari (2026-10-07)

Bajarildi: migratsiya `00013_warehouse.sql` (`suppliers`, `purchases`, `purchase_items`, `stock`, `supplier_payments`); so'rovlar `suppliers.sql` (10), `purchases.sql` (14), `supplier_payments.sql` (9), `products.sql` ga `location_ids` / `quantity` / `last_price`, `ProductStanding`, `ListProductStock`, `CountProductPurchases`, `ListProductPurchases`, `CountProductPurchaseLines`, `locations.sql` ga `CountLocationPurchases`; `internal/catalog` ga `Scope`, `Quantity`, `Zero`, `Amount`, `QuantityText`, `Detail`, `Purchases`, `product_in_use`; `internal/warehouse` (ta'minotchilar, to'lovlar, xaridlar, qoldiq); `company.DeleteLocation` xarid qoidasi; 16 route (`internal/app/warehouse.go`, `catalog.go`), openapi + TS client, web tiplari, mock (`mocks/warehouse.ts`, `catalog.ts`, `data.ts`). Reja: `docs/superpowers/plans/2026-10-07-inventory-stage4-warehouse-api.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **Qoldiq ikki so'rov bilan yuriladi: `EnsureStock` + `MoveStock`.** Rejadagi bitta `INSERT … ON CONFLICT DO UPDATE` ishlamadi: Postgres CHECK'ni conflict'dan oldin taklif qilingan qatorga qo'llaydi, manfiy farq (`0 − 15.5`) har doim 23514 beradi. Endi qator avval 0 bilan ta'minlanadi (`DO NOTHING`), keyin `UPDATE … quantity + added − removed` (CHECK natijaga). DB testi buni tutdi.
- **Nol summa pgx'da shkalasiz** («0»): pgx nol `numeric`ni `Exp 0` bilan dekodlaydi. Servislar chiqishda to'ldiradi: `catalog.Amount` (2 kasr), `catalog.QuantityText` (3 kasr), `padded` faqat to'ldiradi, yaxlitlamaydi. DB testlarida nol kutilmasi «0» (izoh bilan); API hamma joyda «0.00» / «0.000».
- **Scope tashqarisidagi lokatsiya:** 403 ni faqat handler beradi (`locationParam`, `allowedLocation`); servis uni vazifalar servisi kabi ko'radi — ro'yxatda hech qaysi lokatsiya (qoldiq 0 / xarid yo'q), xarid kiritishda 400 «Lokatsiyani tanlang». `apperr` da `Forbidden` kind yo'q va qo'shilmadi.
- **Ta'minotchi qidiruvi mijozlardagidek:** `SearchOf` raqamli qidiruvda `search` va `digits` ni birga beradi; SQL'da OR: nom ILIKE search yoki telefon LIKE digits (birinchi yozilgan AND varianti servis testida tutildi).
- **Ta'minotchi telefoni faqat O'zbekiston:** `user.NormalizePhone` (9–15 raqam) dan keyin `^998\d{9}$` tekshiriladi (jadval CHECK'i bilan bir xil), aks holda «Telefon raqami noto'g'ri».
- **`logic/warehouse.md` 4.3 aniqlashtirildi:** «Hech narsa o'zgarmagan saqlash qoldiq va balansni o'zgartirmaydi (qatorlar qaytadan yoziladi, farq 0)» — `updated_at` yangilanadi.
- **Bog'langan to'lov:** tahrirda paydo bo'lsa uni saqlagan a'zo kiritgan hisoblanadi (`UpdatePurchase` `by` oladi); mavjud bo'lsa ta'minotchi, summa va sana ergashadi (kim kiritgani o'zgarmaydi); 0 bo'lsa yashirinadi.
- **Balans ko'rinishi handlerda:** servis har doim hisoblaydi (`Supplier.Balance/PurchasesTotal/PaymentsTotal string`), `purchases.view` bo'lmaganga JSON'da `null`.
- **Ro'yxatda qatorlar yo'q:** `Purchase.items` faqat sahifada (`omitempty`), `items_count` ro'yxatda ham.
- **Mahsulot sahifasi** `GET /app/products/{id}` endi `ProductDetail` (`stock` bilan); `Product` ga `quantity`, `last_price` majburiy maydonlar. Mavjud Go va mock testlari (`TestProductByID`, «a product is read …») kutilmasini `stock` bilan yangiladi.
- **Testlardagi tuzatishlar:** migratsiya testida fixture ikkala kompaniyaga «Bozor» kiritgani uchun takror nom «Do'kon» bilan tekshirildi; `TestDeleteLocation` ro'yxat kutilmasi yangi «Qo'yliq (1)» lokatsiyasini oldi; katalog `buy` fixture'i `$2::text` ga int bergani tuzatildi; `TestAmountAndQuantityTextPadAZero` «12000.5» → «12000.50» (to'ldirish qoidasi); mock testida xizmat miqdori `kind=service` ro'yxatidan o'qiladi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 21 paket (yangi `internal/warehouse`), api-client 1, admin 235, web 670; e2e: admin 42, web 110 (UI o'zgarmadi). Lokal haqiqiy stack smoke (`smoke_warehouse.py`, vaqtinchalik `hisob24_smoke_cat` DB, :8090): 37 / 37 — ta'minotchi (takror 409), mahsulot, xarid № 1 (jami, qoldiq, `stock`, `last_price`, balans), to'lov va avans, xarid tahriri (farq, ta'minotchi almashishi, bog'langan to'lov ergashishi, `payment_linked`), `product_in_use` / `supplier_in_use` (xarid va to'lov), cheklangan xodim (ro'yxat bo'sh, 404, 403, o'z lokatsiyasiga № 2, balans to'liq), bo'sh rolli 403, o'chirish (qoldiq qaytdi, bog'langan to'lov yo'q, keyingi № 3). API log'ida xato 0; DB tashlandi. Admin lokatsiya o'chirish qoidasi faqat Go testida (admin OTP smoke'ga kirmadi).

## 5-bosqich qarorlari (2026-10-08)

Bajarildi: `lib/warehouse.ts` (sxemalar, `lineAmount`, `purchaseTotal`, `balanceText`, defaults, `today`), `lib/format.ts` (`formatQuantity`), `lib/queries.ts` (ta'minotchi, to'lov, xarid, mahsulot xaridlari hook'lari; `ProductFilter.locationId`), `mocks/data.ts` (`seedWarehouse`); `components/picker.tsx` va `components/warehouse/pickers.tsx` (`SupplierPicker`, `ProductPicker`); `components/warehouse/*` (ta'minotchilar ro'yxati, dialogi, nofaol, o'chirish; ta'minotchi sahifasi: balans, xaridlar, to'lovlar, to'lov dialogi; xaridlar ro'yxati; xarid formasi (yangi va tahrir); xarid sahifasi va o'chirish); `components/catalog` (ro'yxatda «Qoldiq», sahifada «Oxirgi xarid narxi», «Qoldiq», «Xaridlar»); route'lar `/suppliers`, `/suppliers/[id]`, `/purchases`, `/purchases/new`, `/purchases/[id]`, `/purchases/[id]/edit`; e2e `warehouse.spec.ts`; README. Reja: `docs/superpowers/plans/2026-10-07-inventory-stage5-warehouse-ui.md`.

Amalga oshirishda belgilangan tafsilotlar:

- **`Picker` presentational:** taklif ro'yxatini ota komponent beradi (`items`), kechikish (300 ms) o'rashlarda (`useDebounced`); tanlov maydonni bo'shatadi (`onTyped("")`), tanlangani `role="group"` chip, «×» `aria-label="<label>: bekor qilish"`. Xarid formasida mahsulot chip'i birliksiz (birlik miqdor maydonida), taklifda «birlik · oxirgi narx».
- **Xarid formasi sxemasi forma shaklida:** `supplier_name`, `product_name`, `unit` ko'rsatish uchun formada turadi, zod `transform` ularni tashlab yuboradi (RHF `Resolver` da `TFieldValues` invariant: sxema kirishi forma tipiga aynan mos bo'lishi kerak). Oxirgi narx faqat narx maydoni bo'sh bo'lsa tushadi; o'chirilgan xaridning narxi oxirgi narx emas (faqat jonli xaridlar).
- **Tahrir / nofaol sahifa keshini birlashtiradi:** `ProductDialog` va `ActiveButton` `setQueryData(productKey, (old) => ({ ...old, ...saved }))` — javobda `stock` yo'q, sahifa esa `ProductDetail` kutadi (e2e'da «reading 'map'» tutildi; Vitest testi qo'shildi).
- **Ta'minotchilar filtri** `useCatalogFilter` ni qayta ishlatadi (status / search / page bir xil); `/purchases` faqat `page` (`usePurchaseFilter`), lokatsiya `useLocation` dan, almashganda 1-sahifa (vazifalar kabi).
- **Balans ko'rinishi:** ro'yxatda qarz qizil, avans «Avans N» yashil, 0 «—»; sahifada «Balans» region (`balanceText`), «Jami xaridlar», «Jami to'lovlar». `purchases.view` bo'lmaganga ustun va bo'limlar chizilmaydi.
- **To'lovlar bo'limida bog'langan to'lov** faqat «Xarid № N» havolasi bilan, amallarsiz; o'z to'lovida tahrirlash / o'chirish ikonlari (`aria-label` summa bilan: «Tahrirlash: 1 200,50»).
- **Xarid sahifasi** «Ta'minotchi» faktida havola (`suppliers.view` bilan), «Lokatsiya» fakti 2+ lokatsiyada, qatorlar `DataList` (mahsulotga havola, footer «Jami»); «Tahrirlash» havola `/purchases/[id]/edit`; yangi va tahrir sahifalari `suppliers.view` + `products.view` bo'lmasa qaytaradi (`/purchases` / xarid sahifasiga).
- **`forgetWarehouse`** (new-purchase-page.tsx): xarid yozuvi `purchases`, `purchase`, `products`, `product`, `product-purchases`, `suppliers`, `supplier`, `payments` kalitlarini (kompaniya prefiksi bilan) invalidatsiya qiladi.
- **Testlar:** `getByRole({ name })` NBSP'ni normallashtirmaydi (`getByText` normallashtiradi) → aria-label kutilmalarida ` `; `facts()` yordamchisi «Ma'lumot» region'ga toraytirildi (DataList kartalari ham `dt/dd` beradi); yuklanish holati sarlavhasi bir xil bo'lgan sahifada tavsif `findByText` bilan kutiladi; mock xizmat miqdori `kind=service` ro'yxatidan; `formatAmount` nol kasrlarni tashlaydi — «5 000», «1 000 so'm».
- **Tekshiruv:** `make lint` 0 issues (bitta React Compiler ogohlantirishi: `purchase-form.tsx` `formState` o'qiydi, xato emas); `make test`: Go 21 paket, api-client 1, admin 235, web 735; e2e: admin 42, web 114. Vaqtinchalik skrinshot spec'i (375px va desktop, light va dark: ta'minotchilar, ta'minotchi sahifasi, xaridlar, xarid formasi ikki qator bilan, xarid sahifasi, mahsulotlar «Qoldiq» bilan, mahsulot sahifasi) ko'rildi va o'chirildi; yon scroll yo'q. Haqiqiy Go API bilan brauzerda to'liq oqim (vaqtinchalik Playwright config, `:3103` → `:8090`, `hisob24_smoke_cat` DB): egasi kiradi (kod API log'idan), ta'minotchi va mahsulot qo'shadi, xarid kiritadi (№ 1, 10 kg × 1 000, 4 000 to'langan), ro'yxatda «10 kg», mahsulot sahifasida oxirgi narx va qoldiq, ta'minotchida «Qarz: 6 000 so'm», to'lov → «Qarz yo'q»: 1 / 1, API log'ida xato 0; config, spec va `.next-real` o'chirildi, DB tashlandi.
