# Jurnal (transaction uslubi), ombor hujjatlari, sotuv, valyutalar va moliya — dizayn va reja

Sana: 2026-10-11. Holat: foydalanuvchi reja sifatida tasdiqlagan (reja savollari va `/interview` bilan); amalga oshirilmoqda. Qoidalar: `logic/warehouse.md`, `logic/sales.md`, `logic/currencies.md`, `logic/finance.md`, `logic/products.md`, `logic/customers.md`. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-11-ledger-stage<N>-*.md`.

## Kontekst

Foydalanuvchining so'zlari: "shuni transaction uslubida qilish kerak, va qoldiq db da auto hisoblashi kerak yoki sum() sql bilan real time hisoblab berishi kerak, db namunasini ../tw-dobroe proyektidan ol. va inventarizatsiya, peremesheniya skladdan skladga, boshlang'ich qoldiq tovarlar, boshlang'ich qoldiq supplier bilan, boshlang'ich qoldiq client lar bilan shu joylarini qo'shish kerak, va 2 va undan ortiq turda currency bo'ladi u admin paneldan qoshib beriladi, by default hammaga UZS bo'lishi kerak".

Hozir ombor to'rt jadvalda: `purchases` + `purchase_items` (kirim), `stock` (hisoblagich, `MoveStock` bilan ± yangilanadi), `supplier_payments`. Chiqim, ko'chirish, inventarizatsiya, boshlang'ich qoldiqlar, valyuta va kassa yo'q; mijozning balansi yo'q.

Namuna `../tw-dobroe` (Tamweel): har hujjat bitta `transactions` qatori (yo'nalish `in_id` / `out_id`, `category`, `number` kompaniya va kategoriya ichida, `currency_id`, `currency_rate_id` kurs qatoriga havola) + qatorlari (`transaction_detail`); boshlang'ich qoldiqlar (`product-opening-balance`, `supplier-debt` / `supplier-prepay`, `client-debt` / `client-prepay`), ko'chirish (`storage-transfer`), inventarizatsiya (`inventory` + `inventory-correction` IN / OUT), xarajat (`expense`, `is_incoming`), o'tkazma (`money-transfer`), konvertatsiya (`conversion`) ham tranzaksiya; valyuta `currency` (UZS, USD, EUR, RUB) + `company_currency` + `currency_rate` (bitta qatorda hamma valyuta kursi; status 1 standart, 2 hujjatning o'z kursi) + `convert_amount()`; kassa `bank_account` (to'lovlar `in/out_bank_account_id` orqali, qoldiq `SUM(in) − SUM(out)` o'z valyutasida). tw-dobroe qoldiqni `organization_product.count` hisoblagichda yuritadi (Go kodi yangilaydi); hisob24'da jurnal yig'indisi tanlandi (1-qaror).

## Foydalanuvchi qarorlari (2026-10-11)

| # | Savol | Qaror |
|---|---|---|
| 1 | Qoldiq | **SUM() real time**: `stock` jadvali olib tashlanadi, qoldiq = jurnal (`stock_moves`) imzoli miqdorlar yig'indisi; manfiy tekshiruv servisda, kompaniya qulfi ostida |
| 2 | Kurs | **Sozlamalarda joriy kurs (tarix) + hujjatda snapshot**; amalga oshirish **huddi tw-dobroe**: `currency_rates` jadvali, hujjatda `currency_rate_id`, hisoblashda shu jadval JOIN qilinadi; formada o'zgartirilsa hujjatning o'z kurs qatori (status 2) |
| 3 | Ko'p valyutada balans | **So'mga keltirilgan jami** (har hujjat o'z kurs qatori bilan, kurs farqi balansda ko'rinadi, tw-dobroe) **+ valyuta bo'yicha tafsilot** |
| 4 | Ko'chirish | **Darhol**: saqlangan zahoti manbadan chiqadi, maqsadga tushadi; status yo'q |
| 5 | Hajm | **Sotuv va mijoz to'lovi kiradi** |
| 6 | Ombor interfeysi | **Har tur alohida tab**: Xaridlar, Ko'chirishlar, Inventarizatsiya, Boshlang'ich qoldiq, Ta'minotchilar |
| 7 | Ruxsat | **Yangi `stock` bo'limi** («Ombor hujjatlari») |
| 8 | Inventarizatsiya | **Ikkalasi**: mahsulot tanlab qo'shish + «Hammasini qo'shish» |
| 9 | Sotuv joyi | **Yangi «Sotuv» bo'limi** (`sales`) + `sales.*` (sotuv, mijoz to'lovi, mijoz boshlang'ich qarz / avans, mijoz balansi) |
| 10 | Mahsulot narxi | **Narx + valyuta** (`products.currency_id`, standart UZS; tanlov faqat 2+ valyutada) |
| 11 | Sotuvda mijoz | **Ixtiyoriy**: mijozsiz (chakana) sotuv to'liq to'langan bo'lishi shart |
| 12 | Jarayon | **To'xtovsiz ketma-ket**: har GREEN → commit, bosqich oxirida lint / test / e2e + push, yakunda bitta hisobot; deploy alohida |
| 13 | Vaqt | **Sana + vaqt** (`doc_at`), formada standart: hozir; **hamma userga standart timezone +5** (`Asia/Tashkent`); inventarizatsiya tizim qoldig'i hujjat lahzasiga qarab, tahrirda qayta hisoblanadi |
| 14 | To'lov valyutasi | **To'lov valyutasi alohida**: to'lov **bank akkaunt (kassa)** orqali, valyuta akkauntniki; **admin panel akkauntlarni qo'shadi**, standart: har kompaniyada «Naqd» UZS |
| 15 | Kassa hajmi | **Hammasi**: akkaunt qoldig'i user app'da, boshlang'ich kassa qoldig'i, akkauntlar aro o'tkazma va konvertatsiya, xarajat va boshqa kirim (kategoriyalar bilan) |
| 16 | Raqam | **Har tur bo'yicha alohida** (`UNIQUE (company_id, kind, number)`, bo'shamaydi) |
| 17 | Moliya joyi | **Yangi «Moliya» bo'limi** (`finance`): tablar Kassa, Xarajatlar, O'tkazmalar; ruxsat `finance.*`; kategoriyalar Sozlamalarda (`settings.*`) |
| 18 | Kategoriyalar | **Bitta ro'yxat, har kategoriyada turi** xarajat / kirim |
| 19 | Kassa va lokatsiya | **Kompaniya bo'yicha umumiy**, lokatsiyasiz |
| 20 | Ta'minotchi / mijoz sahifasi | **Bitta «Hisob harakati»** ro'yxati (hamma hujjat sana bo'yicha, qarz o'zgarishi, qoldiq balans) + balans kartasi |
| 21 | Chegirma | **Yo'q** (narx qatorda qo'lda) |
| 22 | Standart valyuta | **Doim UZS**; valyuta va kurs maydonlari faqat kompaniyada 2+ valyuta bo'lsa ko'rinadi |
| 23 | Yaxlitlash | **Hamma joyda 2 kasr** (so'mda ham) |
| 24 | Kurs sanasi | **Hujjat sanasidagi kurs**: `doc_at` lahzasida amalda bo'lgan standart qator (`set_at <= doc_at` eng oxirgisi, bo'lmasa eng birinchisi) |
| 25 | QQS, chek | **Yo'q** (hozircha) |
| 26 | Rolsiz xodim | **Hammasi kiradi**: `sales.*`, `stock.*`, `finance.*` standart to'plamda |
| 27 | Hujjatdagi to'lov | **Bir nechta to'lov qatori** (akkaunt + summa), hammasi hujjatga bog'langan to'lovlar |

## Reja bilan tasdiqlangan qarorlar

1. **Branch.** Ish `dev` branch'da (test server `dev`ni oladi), push `origin dev`; `main`ga qo'shish alohida so'raladi.
2. **Atamalar.** Hujjat (`transactions` qatori), qator (`transaction_items`), harakat (`stock_moves`), jurnal (ombor jurnali: harakatlar; hisob harakati: kontragent yoki akkaunt bo'yicha hujjatlar), kurs qatori (`currency_rates`), akkaunt / kassa (`bank_accounts`), kategoriya (`finance_categories`). Hujjat turlari (`kind`): `purchase` Xarid, `sale` Sotuv, `transfer` Ko'chirish, `inventory` Inventarizatsiya, `opening_stock` Boshlang'ich qoldiq, `supplier_payment` / `customer_payment` To'lov, `supplier_debt` / `customer_debt` Boshlang'ich qarz, `supplier_prepay` / `customer_prepay` Boshlang'ich avans, `cash_opening` Kassa boshlang'ich qoldig'i, `expense` Xarajat, `income` Kirim, `money_transfer` O'tkazma, `conversion` Konvertatsiya.
3. **Xizmat** (`kind = service`) sotuvga kiradi (harakat yozmaydi), xaridga kirmaydi.
4. **Faqat joriy qoldiq tekshiriladi** (orqa sana hujjati oraliq tarixiy qoldiqni tekshirmaydi, tw-dobroe kabi).
5. **Raqam** har kompaniyada har tur bo'yicha 1 dan: «Xarid № 12», «Sotuv № 3», «Ko'chirish № 2», «Inventarizatsiya № 1», «Boshlang'ich qoldiq № 1», «Xarajat № 7», «Kirim № 2», «O'tkazma № 1», «Konvertatsiya № 1»; to'lovlar, boshlang'ich qarz / avans va kassa boshlang'ich qoldig'i raqamlanadi, lekin sarlavhada ko'rsatilmaydi.
6. **Kurs** «1 USD = N so'm» (4 kasr). Kurs qatori hamma valyutani saqlaydi (`uzs` = 1, `usd`, `eur`, `rub`); yoqilmagan valyuta ustuni 0. Yoqilmagan valyutali hujjat 400 `currency_not_allowed`; valyuta yoqilgan, lekin kursi 0 bo'lsa forma kursni talab qiladi (400 «Kursni kiriting»); kiritilgani hujjatning o'z kurs qatori (status 2, qolgan ustunlar standartdan; tw-dobroe `createCustomCurrencyRate`).
7. **Pul ko'rinishi**: «1 200 000 so'm», «150 $», «90 €», «1 000 ₽»; 2 kasr, `.00` tashlanadi (`formatAmount`).
8. **Oxirgi xarid narxi** = mahsulotning eng yangi jonli xarid yoki boshlang'ich qoldiq qatori narxi va valyutasi; forma valyutasi mos bo'lsa to'ldiriladi, aks holda hujjat kursi bilan aylantirib taklif qilinadi (2 kasr). Sotuvda mahsulot narxi (`products.price`, o'z valyutasi) shu qoida bilan.
9. **Hujjatdagi to'lovlar** (`payments[]`): har qatorda akkaunt va summa (akkaunt valyutasida), vaqti hujjatniki, kursi akkaunt valyutasi bo'yicha hujjat sanasidagi standart; «To'liq» tugmasi qolgan qarzni akkaunt valyutasiga aylantiradi. `paid` = bog'langan to'lovlar hujjat valyutasiga aylantirilgan yig'indisi.
10. **Mijozsiz sotuv**: `payments` yig'indisi (hujjat valyutasida) = `total` shart (400 «Mijozsiz sotuv to'liq to'langan bo'lsin»); to'lovlar `customer_payment` (mijozsiz, `linked_id` bilan): kassaga tushadi, hech kimning balansiga tegmaydi.
11. **Akkauntlar aro o'tkazma** faqat bir xil valyutada (400 «Valyutalar farq qilsa konvertatsiya kiriting»); **konvertatsiya** ikki summa bilan (chiqim akkaunt valyutasida `total`, kirim boshqa akkaunt valyutasida `to_total`), kurs ma'lumot uchun hisoblanadi.
12. **Akkaunt** (admin): jonli hujjati bo'lsa o'chirilmaydi (409 `account_in_use` «Bu akkauntda N ta hujjat bor»; nofaol qilish mumkin); valyutasi hujjati bo'lmasa o'zgartiriladi; nofaol akkaunt formada taklif qilinmaydi, qoldig'i ko'rinadi; kompaniyada kamida bitta faol akkaunt qoladi (409 `last_account`). Eski `supplier_payments` ko'chirilganda «Naqd» UZS akkauntiga yoziladi.
13. **Chegara** (bu ishga kirmaydi): qaytarishlar (ta'minotchiga / mijozdan), hisobdan chiqarish, hujjat versiyalari tarixi va «kim tahrirlagan», davrni yopish, tannarx (WAC / FIFO), hisobotlar, Telegram bildirishnomalari, foydalanuvchi timezone'ini o'zgartirish (standart hammaga, keyinroq profil), QQS, chek, chegirma, kassani lokatsiyaga bog'lash.

## Ma'lumotlar modeli

Uch migratsiya, har biriga `migrations_test.go` testlari: `00014_currencies.sql`, `00015_finance_setup.sql`, `00016_ledger.sql`.

### 00014 — valyutalar, kurslar, timezone

```sql
CREATE TABLE currencies (id BIGSERIAL PK, code TEXT UNIQUE, name TEXT, symbol TEXT, position INT);
-- seed (tw-dobroe id'lari): (1,'UZS',"O'zbek so'mi","so'm"), (2,'USD','AQSH dollari','$'), (3,'EUR','Yevro','€'), (4,'RUB','Rossiya rubli','₽'); setval
CREATE TABLE company_currencies (company_id FK, currency_id FK, added_by BIGINT REFERENCES admins(telegram_id), added_at, PK (company_id, currency_id));
-- har mavjud kompaniyaga UZS; company.Create ham yozadi (SeedLocation naqshi)
CREATE TABLE currency_rates (                -- tw-dobroe currency_rate: bitta qator = hamma valyuta kursi
  id BIGSERIAL PK, company_id FK,
  uzs NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (uzs = 1), usd NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (usd >= 0), eur …, rub …,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),   -- 1 standart (sozlamalardan), 2 hujjatning o'z kursi
  set_by TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE, set_by_name TEXT, set_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX currency_rates_standard ON currency_rates (company_id, set_at DESC, id DESC) WHERE status = 1;
-- RateAt(company_id, at): status = 1, set_at <= at bo'lgan eng oxirgi id; bo'lmasa eng birinchi standart; bo'lmasa NULL (sqlc so'rovi)
CREATE FUNCTION convert_amount(p_amount NUMERIC, p_from BIGINT, p_to BIGINT, r currency_rates) RETURNS NUMERIC  -- tw-dobroe 000104
  AS $$ SELECT round(p_amount * CASE p_from WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END
                       / NULLIF(CASE p_to WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END, 0), 2) $$ LANGUAGE SQL IMMUTABLE;
ALTER TABLE products ADD currency_id BIGINT NOT NULL DEFAULT 1 REFERENCES currencies(id);
ALTER TABLE users ADD timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent';   -- +5, hozircha o'zgarmaydi
-- customers (company_id, id) kaliti 00008 dan beri bor
```

Joriy kurs = `RateAt(company, now())`. Sozlamalar formasi bitta qator yozadi (hamma yoqilgan valyuta kurslari birga; yoqilmaganlari 0). Valyutani kompaniyadan olib tashlash: jonli hujjat, mahsulot narxi yoki akkaunt shu valyutada bo'lsa 409 `currency_in_use`; UZS olib tashlanmaydi (400).

### 00015 — kassa va kategoriyalar

```sql
CREATE TABLE bank_accounts (id BIGSERIAL PK, company_id FK, name TEXT, currency_id FK currencies, is_active BOOLEAN DEFAULT true,
  created_by BIGINT REFERENCES admins(telegram_id), created_at, updated_at, deleted_at, UNIQUE (company_id, id));
CREATE UNIQUE INDEX bank_accounts_name ON bank_accounts (company_id, lower(name)) WHERE deleted_at IS NULL;
-- har mavjud kompaniyaga ('Naqd', UZS); company.Create ham yozadi
CREATE TABLE finance_categories (id, company_id FK, name TEXT, kind TEXT CHECK (kind IN ('expense','income')), position INT, is_active,
  created_by TEXT (users.phone), created_at, updated_at, deleted_at, UNIQUE (company_id, id));
CREATE UNIQUE INDEX finance_categories_name ON finance_categories (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
```

### 00016 — jurnal (tw-dobroe `transactions` + `transaction_detail`, hisob24'ga moslab)

```sql
CREATE TABLE transactions (
  id BIGSERIAL PK, company_id FK companies,
  kind TEXT CHECK (kind IN (
    'purchase','sale','transfer','inventory','opening_stock',                 -- tovar
    'supplier_payment','supplier_debt','supplier_prepay',                      -- ta'minotchi puli
    'customer_payment','customer_debt','customer_prepay',                      -- mijoz puli
    'cash_opening','expense','income','money_transfer','conversion')),         -- kassa
  number INT NOT NULL,                                   -- (company_id, kind) ichida 1 dan, bo'shamaydi
  doc_at TIMESTAMPTZ NOT NULL,                           -- hujjat sanasi va vaqti (UTC saqlanadi, timezone bilan ko'rsatiladi)
  location_id BIGINT, to_location_id BIGINT,             -- hujjat lokatsiyasi; ko'chirish maqsadi (<> location_id)
  supplier_id BIGINT, customer_id BIGINT,                -- kontragent
  bank_account_id BIGINT, to_bank_account_id BIGINT,     -- to'lov / xarajat / kirim / kassa boshlang'ich akkaunti; o'tkazma va konvertatsiya maqsadi
  category_id BIGINT,                                    -- xarajat / kirim kategoriyasi
  linked_id BIGINT REFERENCES transactions(id),          -- xarid / sotuv bilan kiritilgan to'lov shu hujjatga bog'lanadi (bir nechta bo'lishi mumkin)
  currency_id BIGINT NOT NULL DEFAULT 1 REFERENCES currencies,
  currency_rate_id BIGINT NOT NULL REFERENCES currency_rates,   -- hujjat kursi qatori (standart yoki o'ziniki)
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),   -- hujjat valyutasida (qatorlar yig'indisi yoki summa)
  to_total NUMERIC(14,2) CHECK (to_total > 0),            -- faqat konvertatsiya: maqsad akkaunt valyutasidagi summa
  note TEXT, created_by, created_by_name, created_at, updated_at, deleted_at,
  UNIQUE (company_id, id), UNIQUE (company_id, kind, number),
  FK (company_id, location_id) / (company_id, to_location_id) → locations, FK (company_id, supplier_id) → suppliers,
  FK (company_id, customer_id) → customers, FK (company_id, bank_account_id) / (company_id, to_bank_account_id) → bank_accounts,
  FK (company_id, category_id) → finance_categories,
  CHECK tur bo'yicha: purchase (location, supplier); sale (location; customer ixtiyoriy); transfer (location, to_location);
    inventory / opening_stock (location); supplier_payment (supplier, bank_account, total > 0, linked ixtiyoriy);
    supplier_debt / supplier_prepay (supplier, total > 0); customer_payment (bank_account, total > 0; customer yoki linked_id);
    customer_debt / customer_prepay (customer, total > 0); cash_opening / expense / income (bank_account, total > 0; expense / income da category);
    money_transfer (bank_account, to_bank_account <>, total > 0); conversion (bank_account, to_bank_account <>, total > 0, to_total)
);
-- indekslar: (company_id, kind, doc_at DESC, id DESC) WHERE deleted_at IS NULL; location_id; to_location_id; supplier_id; customer_id;
--            bank_account_id; to_bank_account_id; category_id; linked_id WHERE linked_id IS NOT NULL

CREATE TABLE transaction_items (                -- foydalanuvchi kiritgan qatorlar
  transaction_id FK, product_id FK products, quantity NUMERIC(14,3) CHECK (quantity >= 0),   -- inventarizatsiyada = sanalgan
  expected NUMERIC(14,3),                        -- faqat inventarizatsiya: hujjat lahzasidagi tizim qoldig'i (snapshot)
  price NUMERIC(14,2) CHECK (price >= 0),        -- xarid, sotuv, boshlang'ich qoldiq: majburiy; ko'chirish, inventarizatsiya: NULL
  position INT, PK (transaction_id, product_id));

CREATE TABLE stock_moves (                       -- ombor jurnali: kirim +, chiqim −
  id BIGSERIAL PK, transaction_id FK, company_id, location_id, product_id, quantity NUMERIC(14,3) CHECK (quantity <> 0),
  FK (company_id, location_id) → locations, FK (company_id, product_id) → products);
CREATE INDEX stock_moves_stock ON stock_moves (location_id, product_id) INCLUDE (quantity);
CREATE INDEX stock_moves_product ON stock_moves (product_id, location_id);
CREATE INDEX stock_moves_transaction ON stock_moves (transaction_id);
```

- `stock_moves` servis yozadi (`movesOf(kind, location, toLocation, items)` sof funksiya, unit test): xarid / boshlang'ich qoldiq `+`; sotuv `−` (xizmat qatori yo'q); ko'chirish har qatorga `−manba` va `+maqsad`; inventarizatsiya `counted − expected` (0 yozilmaydi). Tahrirda hujjat harakatlari o'chirilib qayta yoziladi; hujjat yashirilganda (`deleted_at`) harakatlari **o'chiriladi** (qatorlari qoladi). Qoldiq = `SUM(quantity)` join'siz; lahzagacha qoldiq `JOIN transactions ... doc_at <= $at` (teng bo'lsa `id <`).
- **Qoldiq tekshiruvi**: yozuvdan keyin `SELECT product_id FROM stock_moves WHERE location_id = $1 AND product_id = ANY($2) GROUP BY product_id HAVING sum(quantity) < 0` → 409 `stock_insufficient` «"X" uchun omborda yetarli qoldiq yo'q». Hamma yozuv `Write()` (`LockCompanyCustomers`) ostida.
- **Konvertatsiya** hamma joyda `convert_amount(t.total, t.currency_id, $target, cr) ... JOIN currency_rates cr ON cr.id = t.currency_rate_id` (so'm: `$target = 1`).
- **Balans** (so'mda): ta'minotchi = `purchase + supplier_debt − supplier_payment − supplier_prepay`; mijoz = `sale + customer_debt − customer_payment − customer_prepay` (mijozi bor qatorlar). > 0 Qarz, < 0 Avans. Valyuta bo'yicha tafsilot: shu CASE `total` bilan `GROUP BY currency_id`.
- **Akkaunt qoldig'i** (o'z valyutasida, konvertatsiyasiz): `+` cash_opening, income, customer_payment, money_transfer (maqsad), conversion (maqsad, `to_total`); `−` expense, supplier_payment, money_transfer (manba), conversion (manba, `total`).
- **Hisob harakati** (ta'minotchi / mijoz / akkaunt): hamma tegishli jonli hujjat `doc_at, id` tartibida, qator o'zgarishi va `SUM() OVER (ORDER BY doc_at, id)` qoldiq balans; sahifada yangi birinchi (20 ta).
- **Vaqt**: `doc_at` formada `datetime-local` (standart hozir), API `date-time`; ro'yxat tartibi `doc_at DESC, id DESC`; kun bo'yicha filtr chegaralari userning timezone'i bilan UTC'ga (`internal/dateutil`: `StartOfDayUTC`, `EndOfDayUTC`, tw-dobroe `pkg/dateutil`); inventarizatsiya `expected` = `doc_at` lahzasigacha qoldiq (shu hujjatsiz), tahrirda qayta hisoblanadi.
- **Ma'lumot ko'chirish** (00016 ichida): `purchases` → `transactions` (id saqlanadi, `kind = 'purchase'`, `number`, `doc_at = purchased_on` kuni 00:00 Asia/Tashkent, UZS, kurs qatori: kompaniyaning birinchi standart qatori, bo'lmasa migratsiya har kompaniyaga `(1,0,0,0)` standart qator yozadi), `purchase_items` → `transaction_items`, jonli qatorlar → `stock_moves (+)`, `supplier_payments` → `transactions (kind = 'supplier_payment', linked_id = purchase_id, bank_account_id = «Naqd», number `paid_on, id` tartibida)`; `setval`. Keyin `DROP TABLE stock, purchase_items, purchases, supplier_payments`. Test: `DownTo(13)` → eski jadvallarga ma'lumot → `UpTo(16)` → `SUM(stock_moves)` eski `stock.quantity`ga, ta'minotchi balansi eski formulaga teng; raqamlar saqlangan; Down eski DDL bo'sh qaytaradi (`TestInitDownRemovesTheSchema` o'tsin).

## Ruxsatlar va menyu

- `internal/access`: `Sales*`, `Stock*`, `Finance*` (view / create / edit / delete); `All` tartibi: customers, tasks, products, suppliers, purchases, **sales, stock, finance**, employees, settings (42 ta); `Default` += 12 (26-qaror); `sectionNames` += «Sotuv», «Ombor hujjatlari», «Moliya». `openapi.yaml` `Permission` enum, `apps/web/lib/permissions.ts`.
- Kim nima qiladi: `purchases.*` xarid, ta'minotchi to'lovi, ta'minotchi boshlang'ich qarz / avans, ta'minotchi balansi va hisob harakati; `sales.*` sotuv, mijoz to'lovi, mijoz boshlang'ich qarz / avans, mijoz balansi va hisob harakati; `stock.*` ko'chirish, inventarizatsiya, boshlang'ich qoldiq, mahsulot harakatlari, `/app/stock`; `finance.*` akkaunt qoldiqlari va harakati, kassa boshlang'ich qoldig'i, xarajat / kirim, o'tkazma, konvertatsiya; kurslar `settings.edit` (tab `settings.view`); moliya kategoriyalari `settings.*`; valyutalar, kurslar va akkauntlar ro'yxati `/app/me`da hammaga (formalar uchun).
- `lib/nav.ts`: `NavKey` += `sales`, `finance`; standart tartib: Bosh sahifa, Mijozlar, Vazifalar, Mahsulotlar, **Sotuv** (`/sales`, `ShoppingCartIcon`, `sales.view`), Ombor (tablar: Xaridlar `/purchases` `purchases.view`, Ko'chirishlar `/transfers`, Inventarizatsiya `/inventories`, Boshlang'ich qoldiq `/opening-stock` `stock.view`, Ta'minotchilar `/suppliers` `suppliers.view`), **Moliya** (`/accounts`, `WalletIcon`, tablar: Kassa `/accounts`, Xarajatlar `/expenses`, O'tkazmalar `/money-transfers`, `finance.view`), Xodimlar, Sozlamalar. `backend/internal/user/nav.go` `NavSections` += `"sales"`, `"finance"`.

## API (`backend/openapi.yaml` → `make api-client`)

Umumiy: pul va miqdor `string`; har hujjatda `at` (date-time), `currency_id`, `rate` (hujjat kursi, string, UZS'da `"1"`), `total`, `total_uzs`; kirishda `currency_id` berilmasa UZS, `rate` berilmasa sanadagi standart, berilsa hujjatning o'z kurs qatori. Ro'yxatlar 20 tadan; `?location_id=` qoidasi xaridlardagidek (ruxsatsiz 403, son emas 400); `?from=&to=` kun filtri userning timezone'i bilan.

| Endpoint | Ruxsat | Izoh |
|---|---|---|
| `GET /admin/currencies` | admin | katalog |
| `GET /admin/companies/{id}` | admin | + `currencies`, `accounts` |
| `PUT /admin/companies/{id}/currencies {currency_ids}` | admin | UZS doim; 409 `currency_in_use` |
| `POST /admin/companies/{id}/accounts {name, currency_id}` · `PATCH …/accounts/{accountId} {name?, currency_id?, is_active?}` · `DELETE …/accounts/{accountId}` | admin | 409 `name_taken`, `account_in_use`, `last_account`; valyuta hujjati bo'lmasa o'zgaradi |
| `GET /app/me` | a'zo | `AppCompany.currencies: [{id, code, name, symbol, rate}]` (joriy standart; UZS 1; kursi 0 → `null`), `AppCompany.accounts: [{id, name, currency_id, is_active}]` |
| `GET /app/currency-rates?page=` · `POST /app/currency-rates {usd?, eur?, rub?}` | `settings.view` · `settings.edit` | tarix (kim, qachon); faqat yoqilgan valyutalar; bitta qator |
| `GET/POST/PUT/PATCH/DELETE /app/finance-categories…`, `PUT …/order` | `settings.*` | vazifa turlari naqshi; `kind`; 409 `name_taken`, `category_in_use` |
| `GET/POST /app/products`, `GET/PUT /app/products/{id}` | mavjud | `currency_id`; `last_price: {amount, currency_id} \| null`; `quantity` jurnaldan |
| `GET /app/products/{id}/moves?location_id=&page=` | `stock.view` | harakatlar: vaqt, hujjat (tur, №, havola), lokatsiya, kontragent, ± miqdor |
| `GET /app/stock?location_id=&at=` | `stock.view` | lokatsiyada `at` lahzasidagi qoldig'i ≠ 0 mahsulotlar (sahifasiz) |
| `/app/purchases*` | mavjud | `PurchaseInput.at`, `currency_id?`, `rate?`, `payments: [{bank_account_id, amount}]` (`paid` o'rniga); `Purchase.paid` (hujjat valyutasida), `payments[]` |
| `GET/POST /app/suppliers/{id}/payments` · `PUT/DELETE …/{paymentId}` | `purchases.*` | `{bank_account_id, amount, at, rate?, note?}`; valyuta akkauntniki; bog'langan 409 `payment_linked` |
| `GET/POST /app/suppliers/{id}/openings` · `PUT/DELETE …/{openingId}` | `purchases.*` | `{kind: debt\|prepay, amount, currency_id?, rate?, at, note?}` |
| `GET /app/suppliers/{id}` · `GET /app/suppliers/{id}/statement?page=` | `suppliers.view` / `purchases.view` | `balance` (so'm), `balance_by_currency`; hisob harakati qatorlari `{id, kind, number, at, amount, currency_id, amount_uzs, delta_uzs, balance_uzs, linked_id?, note}` |
| `GET /app/sales?location_id=&customer_id=&page=` · `POST /app/sales` · `GET/PUT/DELETE /app/sales/{id}` | `sales.*` | `SaleCreate {location_id, customer_id?, at, currency_id?, rate?, items[{product_id, quantity, price}], payments[], note?}`; mijozsiz to'liq to'langan; 409 `stock_insufficient`; `customer: {id, name, phone} \| null` (nom `tasks.sql`dagi `customer_name` subquery'si bilan) |
| `GET /app/customers`, `GET /app/customers/{id}` · `GET /app/customers/{id}/statement` · `…/payments…` · `…/openings…` | `sales.*` (balans `sales.view` bilan, aks holda `null`) | ta'minotchidagi qoidalar |
| `GET /app/transfers?location_id=&page=` · `POST /app/transfers` · `GET/PUT/DELETE /app/transfers/{id}` | `stock.*` | `{location_id, to_location_id, at, items[{product_id, quantity}], note?}`; manba ruxsatli, maqsad kompaniyaning jonli lokatsiyasi (`<>`: 400 «Maqsad lokatsiya boshqa bo'lsin»); ro'yxatda manba **yoki** maqsad = lokatsiya (yo'nalish belgisi); tahrir / o'chirish manba ruxsatli bo'lsa |
| `GET /app/inventories?location_id=&page=` · `POST /app/inventories` · `GET/PUT/DELETE /app/inventories/{id}` | `stock.*` | `{location_id, at, items[{product_id, counted}], note?}`; server `expected` (lahza bo'yicha), `difference`; farq 0 qator saqlanadi |
| `GET /app/opening-stock?location_id=&page=` · `POST /app/opening-stock` · `GET/PUT/DELETE /app/opening-stock/{id}` | `stock.*` | `{location_id, at, currency_id?, rate?, items[{product_id, quantity, price}], note?}` |
| `GET /app/accounts` · `GET /app/accounts/{id}/statement?page=` | `finance.view` | akkauntlar qoldig'i (o'z valyutasida); harakat: hujjat, ± summa, qoldiq |
| `GET/POST /app/cash-openings` · `GET/PUT/DELETE /app/cash-openings/{id}` | `finance.*` | `{bank_account_id, amount, at, note?}` |
| `GET /app/expenses?kind=&account_id=&category_id=&from=&to=&page=` · `POST /app/expenses` · `GET/PUT/DELETE /app/expenses/{id}` | `finance.*` | `{kind: expense\|income, bank_account_id, category_id, amount, at, note?}`; kategoriya turi mos bo'lsin (400) |
| `GET /app/money-transfers?page=` · `POST /app/money-transfers` · `GET/PUT/DELETE …/{id}` | `finance.*` | `{from_account_id, to_account_id, amount, at, note?}`; bir xil valyuta (400) |
| `GET /app/conversions?page=` · `POST /app/conversions` · `GET/PUT/DELETE …/{id}` | `finance.*` | `{from_account_id, amount, to_account_id, to_amount, at, note?}`; valyutalar farq qilsin (400); `rate` = hisoblangan ma'lumot |

Xato kodlari (yangi): 400 `currency_not_allowed` «Bu valyuta kompaniyada yoqilmagan», «Kursni kiriting», «Kurs noto'g'ri», «Vaqtni kiriting», «Akkauntni tanlang», «Akkaunt nofaol», «Kategoriyani tanlang»; 409 `currency_in_use`, `account_in_use`, `last_account`, `category_in_use`; 409 `stock_insufficient` mahsulot nomi bilan; 409 `location_in_use` / `product_in_use` / `supplier_in_use` / `customer_in_use` «… N ta hujjat bor». Kontrakt testi `internal/httpx/openapi_test.go` yangi route'larni talab qiladi.

## Backend

Qatlam handler → service → sqlc; hamma yozuv tranzaksiyada, kompaniya qulfi (`LockCompanyCustomers`) ostida.

- **`internal/currency`** (yangi): katalog, `CompanyCurrencies`, `SetCompanyCurrencies` (409), `RateAt(q, companyID, at)`, `CurrentRates`, `SetRates` (bitta standart qator), `CustomRate(q, companyID, by, base, currencyID, rate)` (status 2, qolgani standartdan), `Rate(raw)` tekshiruvi (4 kasr), konvertatsiya SQL'da (`convert_amount`).
- **`internal/ledger`** (yangi, yadro): `Kind` konstantalari va nomlari, `Write(pool, companyID, fn)` (hozirgi `warehouse.write`), `NextNumber(q, companyID, kind)` (`MAX(number) + 1`), `Money{CurrencyID, RateID}` (`currencyFor`: yoqilgan, sanadagi kurs yoki o'ziniki), `At(raw)` (date-time, timezone), `movesOf`, `WriteMoves` / `DeleteMoves`, `CheckStock` → `ErrStockInsufficient(name)`, `Payments` (hujjatga bog'langan to'lov qatorlarini yozish / qayta yozish: akkaunt faol, valyutasi akkauntniki, kurs), umumiy `Document` ro'yxat qatori.
- **`internal/warehouse`**: `purchases.go` (jurnalga, `payments[]`), `sales.go`, `transfers.go`, `inventories.go` (`expectedAt`), `opening_stock.go`, `payments.go` (ta'minotchi / mijoz, `party`), `openings.go` (qarz / avans), `statements.go` (ta'minotchi / mijoz hisob harakati), `stock.go` (`StockAt`, `Moves`), `suppliers.go` (balans jurnaldan, `supplier_in_use`).
- **`internal/finance`** (yangi): akkauntlar (admin CRUD, app ro'yxat va qoldiq, hisob harakati), kategoriyalar (sozlamalar), `cash_openings.go`, `expenses.go` (xarajat / kirim), `money_transfers.go`, `conversions.go`.
- **`internal/catalog`**: `Product.CurrencyID`, `LastPrice{Amount, CurrencyID}`, `quantity` jurnaldan, `product_in_use` hujjatlar, `Stock(scope, locationID, at)`.
- **`internal/customer`**: `Balance`, `BalanceByCurrency` (`withBalance`), `customer_in_use`; mijoz nomi subquery'si sotuvlar uchun.
- **`internal/company`**: `Create` UZS va «Naqd» yozadi; `DeleteLocation` → `CountLocationDocuments` → 409 «Bu lokatsiyada N ta hujjat bor». **`internal/admin`**: valyutalar, akkauntlar. **`internal/app`**: `sales.go`, `stock.go`, `finance.go`, `currencies.go`, `me` (+ currencies, accounts), route'lar. **`internal/user`**: `NavSections`, `timezone` `Access`da.
- **So'rovlar**: `currencies.sql`, `bank_accounts.sql`, `finance_categories.sql`, `transactions.sql`, `stock_moves.sql`, `statements.sql`; o'zgargan `products.sql`, `suppliers.sql`, `customers.sql`, `locations.sql`, `users.sql`; `purchases.sql`, `supplier_payments.sql` o'chadi. Har so'rovga `internal/db/*_test.go`.
- **Testlar** (TDD, table-driven, `pgtest`): migratsiyalar (ko'chirish tengligi, UZS va «Naqd» seed, `convert_amount`); `movesOf`; raqam tur bo'yicha; atomiklik `FailInserts("stock_moves")`, `FailInserts("transactions")` (to'lov yozilmasa hujjat ham yo'q); `stock_insufficient` sotuv / ko'chirish / inventarizatsiya / xarid tahririda; ko'chirish ikki lokatsiya ro'yxatida; inventarizatsiya `expected` lahza bo'yicha va tahrirda qayta; boshlang'ich qoldiqlar; valyuta: yoqilmagan 400, sanadagi kurs, o'z kursi (status 2), `total_uzs`, balans so'mda va valyuta bo'yicha, kurs farqi; akkaunt: valyuta akkauntdan, qoldiq, o'tkazma bir xil valyuta, konvertatsiya ikki tomon, `account_in_use`, `last_account`; mijozsiz sotuv to'liq to'langan; hisob harakati qoldiq balansi; timezone kun chegaralari; ruxsatlar 403 tartibi; `DeleteLocation`; `*_in_use`.

## User app (`apps/web`)

- `lib`: `types.ts`, `permissions.ts`, `nav.ts`, `format.ts` (`formatMoney(amount, currency)`, `formatDateTime` timezone bilan), `currencies.ts` (`useCurrencies`, `useAccounts` `/app/me`dan, `convert(amount, from, to, rates)`, `multi`), `ledger.ts` (zod sxemalar: sale, transfer, inventory, openingStock, openingBalance, payment, cashOpening, expense, moneyTransfer, conversion, rates, financeCategory; xabarlar API'niki), `queries.ts` (hooklar + invalidatsiya: hujjat yozuvi → products, suppliers / customers (balans, statement), accounts, `meKey` kurs saqlanganda), `use-document-filter.ts`.
- Umumiy: `currency-field.tsx` (valyuta `SelectField` + kurs; faqat `multi`), `datetime-field.tsx` (`datetime-local`, standart hozir), `document-lines.tsx` (qatorlar `useFieldArray`: mahsulot `Picker`, miqdor, narx ixtiyoriy, summa), `payments-field.tsx` (to'lov qatorlari: akkaunt `SelectField` + summa akkaunt valyutasida, «To'liq», qolgan qarz ko'rsatkichi), `kind-badge.tsx`, `statement-list.tsx` (hisob harakati: hujjat havolasi, ± summa, qoldiq; o'z to'lovida tahrirlash / o'chirish), `account-badge`.
- `components/warehouse/*`: `purchase-form` (valyuta / kurs, vaqt, `PaymentsField`), `supplier-page` (balans kartasi so'm + valyuta bo'yicha, «Hisob harakati», «To'lov qo'shish», «Boshlang'ich qarz / avans»), `payment-dialog` (akkaunt, summa, vaqt, kurs), `opening-balance-dialog` (`party` prop), `transfers-page`, `transfer-form` (manba joriy lokatsiya, maqsad `SelectField`), `transfer-page`, `inventories-page`, `inventory-form` (qatorda tizim qoldig'i `/app/stock?at=`, sanalgan, farq; «Hammasini qo'shish»), `inventory-page`, `opening-stock-*`.
- `components/sales/*`: `sales-page` («Sotuv» `№ 3 · Mijoz` yoki «Chakana», ostida vaqt · N ta; «Jami», «To'langan», «Qo'shgan»), `sale-form` (mijoz `CustomerPicker` ixtiyoriy, vaqt, valyuta / kurs, qatorlar (mahsulot **va xizmat**; narx taklifi valyutaga qarab), `PaymentsField`; mijozsiz to'liq), `sale-page`, `new-/edit-sale-page`.
- `components/customers/customer-page`: balans kartasi, «Hisob harakati», «To'lov qo'shish», «Boshlang'ich qarz / avans» (`sales.*`); `customers-page` «Qarz» ustuni (`columns-menu`).
- `components/catalog`: `product-dialog` narx valyutasi (`multi`), `product-page` narx va oxirgi narx valyuta bilan, «Harakatlar» (`stock.view`).
- `components/finance/*` (yangi): `accounts-page` (akkauntlar: nom, valyuta, qoldiq; nofaol belgisi), `account-page` (`/accounts/[id]`: qoldiq, hisob harakati, «Boshlang'ich qoldiq», «Xarajat», «Kirim», «O'tkazma», «Konvertatsiya» tugmalari), `cash-opening-dialog`, `expenses-page` (Xarajat / Kirim tablari, akkaunt va kategoriya filtri, kun oralig'i), `expense-dialog` (tur, akkaunt, kategoriya, summa, vaqt, izoh), `money-transfers-page` (o'tkazma va konvertatsiya bitta ro'yxatda, tur belgisi), `money-transfer-dialog`, `conversion-dialog` (ikki akkaunt, ikki summa, hisoblangan kurs).
- `components/settings`: `currency-rates-page.tsx` («Valyuta kurslari»: yoqilgan valyutalar joriy kursi, «Kurslarni yangilash» dialogi, tarix; faqat UZS bo'lsa bo'sh holat), `finance-categories-page.tsx` («Moliya kategoriyalari»: Xarajat / Kirim, qo'shish, nom, nofaol, tartib `SortableList`); `use-settings-tab.ts` (`SettingsTab` va `tabs` += `"currencies"`, `"finance"`).
- Route'lar: `/sales(/new, /[id], /[id]/edit)`, `/transfers(…)`, `/inventories(…)`, `/opening-stock(…)`, `/accounts`, `/accounts/[id]`, `/expenses`, `/money-transfers`; `proxy.test.ts`.
- Mocklar: `mocks/currencies.ts`, `mocks/finance.ts`, `mocks/ledger.ts` (Go qoidalari: raqam, qoldiq SUM, kurs sanasi, balans so'mda va valyuta bo'yicha, akkaunt qoldig'i, bog'langan to'lovlar, `stock_insufficient`, 403 / 404), `mocks/warehouse.ts` jurnalga, `mocks/data.ts` (`seedCurrencies`, `seedAccounts`, `seedLedger`), `handlers.test.ts`.
- Vitest har komponent va lib'ga; e2e (375px va desktop, MSW): `warehouse.spec.ts`, `sales.spec.ts`, `finance.spec.ts`, `settings.spec.ts` (kurslar, kategoriyalar), `shell.spec.ts` (Sotuv, Moliya bo'limlari, Ombor tablari), `roles.spec.ts`.

## Admin panel (`apps/admin`)

`company-page.tsx` «Valyutalar» (chiplar, `currencies-dialog`: USD / EUR / RUB `Checkbox`, UZS doim) va «Kassa» (akkauntlar jadvali: nom, valyuta, holat; `account-dialog` qo'shish / tahrirlash, nofaol qilish, o'chirish → 409 `Refusal`); `lib/types.ts`, `lib/queries.ts`, mock, Vitest, e2e `companies.spec.ts`.

## Hujjatlar

- `logic/warehouse.md` (jurnal, hujjat turlari, qoldiq, ko'chirish, inventarizatsiya, boshlang'ich qoldiq, xarid valyutada, to'lovlar akkaunt orqali, hisob harakati), yangi `logic/sales.md`, `logic/currencies.md`, `logic/finance.md`; `logic/products.md`, `logic/customers.md`, `logic/roles.md` (4.1, 4.2, 4.3, 8), `logic/locations.md` (1, 3, 7), `logic/user.md` (timezone). `CLAUDE.md` «Manbalar», `README.md` (UI bosqichlarida).

## Bosqichlar (TDD RED → GREEN → commit; har bosqich oxirida `make lint`, `make test`, `make e2e`, `git push origin dev`)

0. **Hujjatlar.** Spec, `logic/*.md`, `CLAUDE.md`.
1. **Valyutalar va kurslar.** 00014 (+testlar), `internal/currency`, `currencies.sql`, `company.Create` UZS, admin valyutalar API + «Valyutalar» bo'limi, `/app/me.currencies`, kurslar API + «Valyuta kurslari» tabi, `users.timezone` (`Access`), `formatMoney`, `CurrencyField`, mahsulot narxi valyutasi (API, dialog, ro'yxat, sahifa).
2. **Kassa poydevori.** 00015 (+testlar), `internal/finance` akkauntlar va kategoriyalar, `company.Create` «Naqd», admin akkauntlar API + «Kassa» bo'limi, `/app/me.accounts`, moliya kategoriyalari API + sozlamalar tabi.
3. **Jurnal va xaridlar.** 00016 ko'chirish bilan (+testlar), `internal/ledger` yadro (`doc_at`, raqam, kurs, harakatlar, qoldiq, bog'langan to'lovlar), xaridlar va ta'minotchi to'lovlari jurnalga (`payments[]`, akkaunt, valyuta), ta'minotchi balansi va hisob harakati, `catalog` qoldiq va `last_price`, `DeleteLocation` / `*_in_use`; mavjud testlar moslashadi (hech biri o'chirilmaydi); web: xarid formasi (vaqt, valyuta, to'lov qatorlari), ta'minotchi sahifasi (balans, hisob harakati, to'lov dialogi), mocklar jurnalga.
4. **Ruxsatlar va qobiq.** `sales.*`, `stock.*`, `finance.*` (Go, openapi, `permissions.ts`, rol formasi), nav («Sotuv», Ombor tablari, «Moliya», `NavSections`), `SectionTabs`; e2e `shell`, `roles`.
5. **Ombor hujjatlari API.** Ko'chirish, inventarizatsiya (`expected` lahza bo'yicha, `/app/stock?at=`), boshlang'ich qoldiq, mahsulot harakatlari, ta'minotchi boshlang'ich qarz / avans; openapi + TS client; mocklar.
6. **Ombor hujjatlari UI.** `document-lines`, ko'chirish / inventarizatsiya / boshlang'ich qoldiq sahifalari va formalari, boshlang'ich qarz / avans dialogi, mahsulot sahifasida «Harakatlar»; Vitest, e2e `warehouse`.
7. **Sotuv API.** Sotuv, mijoz to'lovlari, mijoz boshlang'ich qarz / avans, mijoz balansi va hisob harakati, `customer_in_use`; openapi + TS client; mocklar.
8. **Sotuv UI.** `/sales*`, mijoz sahifasi, mijozlar ro'yxatida «Qarz», sotuv formasida narx taklifi; Vitest, e2e `sales`.
9. **Moliya API.** Akkaunt qoldiqlari va hisob harakati, kassa boshlang'ich qoldig'i, xarajat / kirim, o'tkazma, konvertatsiya; openapi + TS client; mocklar.
10. **Moliya UI.** Kassa, akkaunt sahifasi, Xarajatlar, O'tkazmalar sahifalari va dialoglari; Vitest, e2e `finance`, README.
11. **Yakuniy ko'rik.** Kod ko'rigi, mutatsiya tekshiruvi (nusxadan tiklash, `-timeout`), lokal haqiqiy stack'da curl / brauzer oqimi (vaqtinchalik `hisob24_*` DB `TEMPLATE hisob24` dan, bo'sh portlar, SMS kodi API log'idan, 12 xonali telefonlar), hisobot (har funksiya RED → GREEN). Deploy (test server, `dev`) alohida so'raladi.

## Tekshiruv

- Har bosqich: `make lint` 0 issues, `make test` (Go, web, admin, api-client), `make e2e` toza; hech bir test o'chirilmaydi yoki `skip` qilinmaydi.
- Migratsiya testlari: eski xarid / to'lov / qoldiq → jurnal; yig'indilar va balanslar teng; raqamlar saqlangan; «Naqd» va UZS har kompaniyada; `DownTo(0)` toza.
- Haqiqiy stack (11-bosqich): admin USD yoqadi va «Karta» USD akkaunt qo'shadi → egasi kurs kiritadi → mahsulot narxi USD → boshlang'ich qoldiq → xarid USD, to'lov qatorlari naqd so'm + karta USD (balans so'mda + «shu jumladan N USD», akkaunt qoldiqlari) → ko'chirish (ikki lokatsiya qoldig'i) → inventarizatsiya orqa vaqt bilan (farq, «Hammasini qo'shish») → sotuv mijozga (qarz), mijoz to'lovi, chakana sotuv (to'liq), xizmat qatori, qoldiq yetmasa 409 → ta'minotchi / mijoz boshlang'ich qarz / avans, hisob harakati qoldiq balansi → kassa boshlang'ich qoldig'i, xarajat kategoriya bilan, o'tkazma (bir xil valyuta), konvertatsiya (ikki summa), akkaunt hisob harakati → admin USD'ni olib tashlash 409, akkauntni o'chirish 409 → xaridi bor lokatsiya o'chmaydi. Sinov ma'lumoti o'chiriladi.
- Brauzerda (Chrome) 375px: Ombor va Moliya tablari, Sotuv bo'limi, formalarda valyuta maydoni faqat 2+ valyutada, vaqt maydoni standart hozir.

## 1-bosqich qarorlari (2026-10-11)

- `Me.currencies`: yoqilgan valyutalar va joriy kurslar `/app/me` da tanlangan kompaniyaniki sifatida (`locations` kabi), `AppCompany` ichida emas: `companies[]` har kompaniya uchun alohida so'rov talab qilardi.
- Narx valyutasi tekshiruvi bazada, izohdan keyin va takrorlardan (nom, artikul) oldin: katalogda yo'q id 400 «Valyuta noto'g'ri», yoqilmagan 400 `currency_not_allowed` (`logic/products.md`, 4-bo'lim).
- `customers (company_id, id)` kaliti 00008 dan beri bor: 00014 uni qo'shmaydi.
- Kurs JSON'da bazadagidek to'rt kasr bilan (`"12800.0000"`); UZS `"1.0000"`; kiritilmagan `null`. Formada `formatRate` kasrsiz ko'rsatadi («12 800»), kurs maydoni vergul va bo'shliqlarni qabul qiladi.
- Sozlamalar tabi `currencies` («Valyuta kurslari») Dropdownlar va Rollar orasida; `Section` komponenti `components/settings/section.tsx` ga ajratildi.
- Admin «Valyutalar» bo'limi chiplar va dialog (`Checkbox`, UZS doim belgilangan va `aria-disabled`); admin ilovasiga `components/ui/checkbox.tsx` qo'shildi.
- Testlarda `addCompany` fixture'lari (app, catalog, currency) kompaniyaga so'mni ham yozadi: haqiqiy kompaniya kabi.
- Mock: Nok Market (2) USD bilan va Vali kiritgan 12 800 kursi bilan boshlanadi (valyuta maydonlari shu yerda sinaladi); Olma Savdo faqat so'mda.

## 2-bosqich qarorlari (2026-10-11)

- `Me.accounts`: tanlangan kompaniyaning jonli akkauntlari `/app/me` da (`currencies` kabi), qo'shilish tartibida, nofaollari ham: to'lov formalari faqat faollarini taklif qiladi, ro'yxat va hujjatlar nofaolining nomini ham ko'rsatadi. Kompaniya tanlanmagan bo'lsa bo'sh.
- Akkaunt nomi kompaniya ichida (jonlilar orasida, harf farqsiz) takrorlanmaydi: 409 `name_taken` «Bu nomli akkaunt allaqachon bor». Kompaniyada kamida bitta faol akkaunt qoladi: oxirgisini nofaol qilish yoki o'chirish 409 `last_account` «Kompaniyada kamida bitta faol akkaunt qolsin».
- Akkaunt valyutasini o'zgartirish hozircha erkin; hujjati bor akkauntning valyutasi va o'chirilishi (`account_in_use`) 3-bosqichda jurnal bilan keladi. Kategoriyaning `category_in_use` tekshiruvi ham xarajatlar (9-bosqich) bilan.
- Valyutani kompaniyadan olib tashlash endi shu valyutadagi akkauntga ham to'xtaydi: 409 `currency_in_use` «Bu valyutada N ta akkaunt bor» (mahsulotlardan keyin tekshiriladi).
- Moliya kategoriyasi: nom 60 belgigacha, tur ichida takrorlanmaydi (harf farqsiz, 409 `name_taken` «Bu nomli kategoriya allaqachon bor»); turi keyin o'zgarmaydi. `?kind=` noto'g'ri bo'lsa 400 «Tur noto'g'ri», yaratishda tur yo'q bo'lsa 400 «Turni tanlang». Tartib har tur ichida alohida (`PUT /app/finance-categories/order {kind, ids}`), vazifa turlaridagi `order_changed` qoidasi bilan.
- Sozlamalar tabi `finance` («Moliya kategoriyalari») Valyuta kurslari va Rollar orasida: ikki bo'lim (Xarajat, Kirim), vazifa turlari bo'laklari bilan (`NameDialog`, `SortableList`, `SettingRow`); kesh kaliti tur bo'yicha (`financeCategoriesKey(companyId, kind)`).
- Admin «Kassa» bo'limi `DataList` (Akkaunt, Valyuta, Holat, Qo'shilgan, Amallar) va dialoglar (qo'shish, tahrirlash), nofaol/faol tugmasi, o'chirish; `SelectField` va `test/select.ts` yordamchisi user app'dan ko'chirildi.
- `company.Create` «Naqd» UZS akkauntini `created_by` = yaratgan admin bilan yozadi; `finance.Service` admin va app handler'lariga ulangan.
- Mock: Nok Market (2) naqddan tashqari «Karta» USD akkaunti bilan boshlanadi; kategoriyalar bo'sh boshlanadi (testlar o'zi qo'shadi).

## 3-bosqich qarorlari (2026-10-12)

- **Nol kurs qatori.** So'mdagi hujjat ham kurs qatoriga havola qiladi. Kompaniyada standart qator bo'lmasa, uning nol qatori (`status = 2`, `uzs = 1`, qolgani 0, `GetFallbackRate`) ishlatiladi va bir marta yoziladi; migratsiya 00016 ham eski xarid va to'lovlarga shu qatorni yozadi (spec'dagi «(1,0,0,0) standart qator» o'rniga: standart qator tarixda nol kurs bilan ko'rinib qolardi). Standart qator bor kompaniyada so'mdagi hujjat ham o'sha standart qatorga havola qiladi.
- **Hujjat kursi** (`ledger.PriceIn`): `rate` berilmasa `at` dagi standart qator (valyuta ustuni 0 bo'lsa 400 «Kursni kiriting»); standartnikiga teng kurs standart qatorni oladi; farqli kurs hujjatning o'z qatori (`status = 2`, qolgan ustunlar standartdan yoki 0); so'mda faqat `1` («Kurs noto'g'ri»). Tahrirda hujjatning joriy qatori kursi qaytarilsa qator qoladi (`current`).
- **Bog'langan to'lovlar** har saqlashda butunlay qayta yoziladi (eskilari yashiriladi, yangilari ketma-ket raqam bilan, muallifi saqlagan a'zo). To'lov qatorida kurs maydoni yo'q: akkaunt valyutasining hujjat sanasidagi standart kursi; yo'q bo'lsa 400 «Kursni kiriting» (avval Sozlamalarda kurs kiritiladi).
- **`paid`** hujjat valyutasida: har bog'langan to'lov o'z kurs qatori bilan aylantirilgan yig'indisi (`convert_amount`).
- **Ta'minotchi balansi**: `purchases_total` va `payments_total` so'mda (har hujjat o'z kursi bilan), `balance` = xaridlar + boshlang'ich qarz − to'lovlar − boshlang'ich avans; `balance_by_currency` faqat ta'minotchi sahifasida (`GET /app/suppliers/{id}`) va `purchases.view` bilan, ro'yxatda va ruxsatsiz `null`.
- **Hisob harakati** (`GET /app/suppliers/{id}/statement`): qatorda `rate`, `bank_account_id`, `account_name` ham bor — o'z to'lovi qatordan tahrirlanadi va o'chiriladi. `GET /app/suppliers/{id}/payments` kontraktda qoladi, UI ishlatmaydi.
- **Qoldiq tekshiruvi** xarid tahririda va o'chirishda xaridning avvalgi va yangi mahsulotlari bo'yicha (`NegativeStock`), xato ««X» uchun omborda yetarli qoldiq yo'q» birinchi mahsulot nomi bilan (nom bo'yicha tartibda).
- **`Product.last_price`** obyekt `{amount, currency_id}` (oxirgi jonli xarid yoki boshlang'ich qoldiq qatori); `ProductPurchase.at` (date-time) va `currency_id`; `product_in_use`, `supplier_in_use`, `location_in_use` xabarlari «… N ta hujjat(da) bor» (ko'chirishning maqsad lokatsiyasi ham sanaladi).
- **Vaqt**: forma `datetime-local` maydonini brauzer offset'i bilan yuboradi («2026-10-07T09:00:00+05:00»), API UTC'da qaytaradi («…Z»), `formatDateTime` brauzer vaqt zonasida ko'rsatadi (profil timezone'i keyingi bosqichlarda). Alohida `DateTimeField` komponenti yozilmadi: `TextField type="datetime-local"` yetarli.
- **Web**: `CurrencyField` (valyuta + kurs, faqat 2+ valyutada), `PaymentsField` (to'lov qatorlari, «To'liq» qolganini joriy kurslar bilan akkaunt valyutasiga aylantiradi, «Qolgan» ko'rsatkichi), `StatementList` ta'minotchi sahifasida «Xaridlar» va «To'lovlar» ro'yxatlari o'rniga (`supplier-purchases.tsx`, `supplier-payments.tsx` o'chirildi); xarid sahifasida «To'lovlar» bo'limi; narx taklifi boshqa valyutada bo'lsa joriy kurs bilan aylantiriladi (`convert`).
- **Mock**: `mocks/ledger.ts` (raqam, kurs qatori, `convert_amount`, harakatlar, manfiy tekshiruv, bog'langan to'lovlar, balans, hisob harakati), `db.transactions` / `db.items` / `db.moves` eski `purchases` / `payments` / `stock` o'rniga, `RateRow.status`, `seedPayment`; Olma Savdo'da xarid № 1 nol qator bilan.
- **sqlc**: nullable ustun bilan solishtirilgan param `*int64` bo'lib chiqadi — `sqlc.arg(...)::bigint` cast bilan `int64`; JOIN qilingan `l.id` / `s.id` / `b.id` ustunlari `int64` (nullable `t.location_id` emas).
- **Commit tarixi**: 3-bosqichning oraliq commit'lari (00016, so'rovlar, ledger) orasida backend to'liq kompilyatsiya bo'lmaydi (eski so'rovlar o'chgan, servislar keyin keldi); bosqich oxirida hammasi yashil.

## 4-bosqich qarorlari (2026-10-12)

- Katalog 42 ta ruxsat: `sales.*`, `stock.*`, `finance.*` xaridlardan keyin, xodimlardan oldin (`internal/access`, `lib/permissions.ts`, `Permission` enum); rolsiz xodimning standart to'plami 32 ta (tarix, xodimlar va sozlamalardan tashqari hammasi). Rol matritsasi (`PermissionMatrix`) yangi bo'limlarni o'zi chizadi: «Sotuv», «Ombor hujjatlari», «Moliya».
- Menyu kalitlari (`NavSections`, `NavKey`, `NavSection` enum): `home, customers, tasks, products, sales, warehouse, finance, employees, settings`. API va mock yangi kalitlarni qabul qiladi; **menyuda «Sotuv» va «Moliya» bo'limlari va Ombor'ning yangi tablari sahifalari bilan birga keladi** (6, 8, 10-bosqichlar): sahifasiz bo'limga havola qo'yilmaydi (reja 4-bosqichda nav'ni ham ko'zda tutgan edi; o'lik havolalar o'rniga kechiktirildi). `SectionTabs` o'zgarmaydi: tabni ruxsat bo'yicha chizadi.
