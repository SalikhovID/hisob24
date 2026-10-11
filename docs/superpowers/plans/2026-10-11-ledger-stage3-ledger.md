# Jurnal, 3-bosqich: jurnal va xaridlar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ombor jurnalga o'tadi: `transactions` + `transaction_items` + `stock_moves` (00016, eski xarid, qator, qoldiq va to'lovlar ko'chiriladi, eski jadvallar o'chadi); `internal/ledger` yadro (turlar, raqam tur bo'yicha, `doc_at`, hujjat valyutasi va kursi, harakatlar va manfiy qoldiq tekshiruvi, bog'langan to'lovlar); xaridlar va ta'minotchi to'lovlari jurnalda (`at`, `currency_id`, `rate`, `payments[]` akkaunt orqali); ta'minotchi balansi so'mda + valyuta bo'yicha, «Hisob harakati»; katalog qoldig'i va oxirgi narxi jurnaldan; `*_in_use` hujjat bo'yicha; web xarid formasi (vaqt, valyuta/kurs, to'lov qatorlari), ta'minotchi sahifasi (balans kartasi, hisob harakati, to'lov dialogi), mocklar jurnalda.

**Architecture:**
- **Baza:** `00016_ledger.sql` (spec «00016» bo'limi) + ko'chirish; so'rovlar `transactions.sql` (hujjat bosh qatori, raqam, qatorlar, to'lovlar, xaridlar ro'yxati), `stock_moves.sql` (harakatlar, qoldiq, manfiy tekshiruv), `statements.sql` (ta'minotchi hisob harakati, balans); o'zgargan `products.sql`, `suppliers.sql`, `locations.sql`, `currencies.sql`; `purchases.sql`, `supplier_payments.sql` o'chadi.
- **Servis:** yangi `internal/ledger` (`kinds.go`, `time.go`, `pricing.go`, `numbers.go`, `moves.go`, `payments.go`); `internal/warehouse` xarid, to'lov, ta'minotchi, hisob harakati jurnalda; `internal/catalog` qoldiq va `LastPrice{Amount, CurrencyID}`; `internal/company` `CountLocationDocuments`.
- **API:** `Purchase{at, currency_id, rate, total, total_uzs, paid, payments[]}`, `PurchaseInput{at, currency_id?, rate?, payments[]}`; `Payment{bank_account_id, account_name, amount, currency_id, rate, amount_uzs, at, …}`, `PaymentInput{bank_account_id, amount, at, rate?, note?}`; `Supplier{balance, purchases_total, payments_total, balance_by_currency[]}`; `GET /app/suppliers/{id}/statement`; `Product.last_price: {amount, currency_id} | null`; `ProductPurchase.at`.
- **Web:** `lib/warehouse.ts` sxemalar (vaqt, valyuta, kurs, to'lov qatorlari), `components/datetime-field.tsx`, `components/currency-field.tsx`, `components/warehouse/payments-field.tsx`, `statement-list.tsx`; `purchase-form`, `purchase-page`, `purchases-page`, `supplier-page`, `payment-dialog`, `product-page`; `mocks/ledger.ts` (jurnal qoidalari), `mocks/warehouse.ts` va `mocks/catalog.ts` jurnalda.

Qoidalar: `logic/warehouse.md` (1, 4, 5, 6-bo'limlar), `logic/currencies.md` (4, 5), `logic/finance.md` (4), `logic/products.md` (5, 6). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

## Kelishuvlar

- 1–2-bosqichlardagi kabi: `GOTEST`, `make sqlc`, har GREEN'dan keyin commit; mavjud testlar yangi qoidaga moslanadi, hech biri o'chirilmaydi.
- **Kurs qatori yo'q kompaniya.** So'mdagi hujjat ham kurs qatoriga havola qiladi. Kompaniyada standart qator bo'lmasa, uning «nol» qatori ishlatiladi: `status = 2`, `uzs = 1`, qolgani 0, `set_by` = hujjatni yozgan a'zo (`GetFallbackRate` topadi, bo'lmasa `CreateRate` yozadi); tarixda ko'rinmaydi. Migratsiya ham shu qatorni yozadi (chetlanish: spec standart qator deydi; standart qator tarixda nol kurs bilan ko'rinib qolardi).
- **Hujjat kursi** (`rate` kiritish): kompaniyada 2+ valyuta bo'lsa forma kursni yuboradi; servis: `rate` berilmagan → `at` dagi standart qator (valyuta ustuni 0 bo'lsa 400 «Kursni kiriting»; UZS'da nol qator yetadi); `rate` berilgan va standartnikiga teng → standart qator; farqli → hujjatning o'z qatori (`status = 2`, boshqa ustunlar standartdan yoki nol); UZS hujjatda `rate` faqat `1` bo'lishi mumkin («Kurs noto'g'ri»). Tahrirda hujjatning joriy qatori ustuni yuborilganiga teng bo'lsa qator qoladi.
- **Bog'langan to'lovlar** tahrirda butunlay almashadi: eskilari yashiriladi, yangilari yoziladi (raqam davom etadi, `created_by` saqlagan a'zo). To'lov qatorining kursi akkaunt valyutasi bo'yicha hujjat sanasidagi standart; akkaunt valyutasi so'm emas va kursi yo'q bo'lsa 400 «Kursni kiriting» (xarid formasida to'lov qatorida kurs maydoni yo'q: avval Sozlamalarda kurs kiritiladi).
- `paid` hujjat valyutasida: har bog'langan to'lov o'z kurs qatori bilan hujjat valyutasiga aylantiriladi (`convert_amount`), yig'indisi.
- Ta'minotchi sahifasida eski «Xaridlar» va «To'lovlar» ro'yxatlari o'rniga bitta «Hisob harakati»; `/app/suppliers/{id}/payments` ro'yxati (GET) qoladi (to'lovlarni tahrirlash uchun kerak emas: hisob harakati qatorida tahrirlash / o'chirish), lekin kontraktdan olib tashlanmaydi.
- Xato kodlari: `stock_insufficient` endi mahsulot nomi bilan ««X» uchun omborda yetarli qoldiq yo'q»; `supplier_in_use` / `product_in_use` / `location_in_use` «… N ta hujjat bor».

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/migrations/00016_ledger.sql` (+`migrations_test.go`) | uch jadval, ko'chirish, DROP; Down eski DDL |
| `backend/internal/db/queries/transactions.sql`, `stock_moves.sql`, `statements.sql` (yangi), `products.sql`, `suppliers.sql`, `locations.sql`, `currencies.sql` (+`internal/db/*_test.go`) | so'rovlar; `purchases.sql`, `supplier_payments.sql` o'chadi |
| `backend/internal/ledger/*.go` (+testlar) | yadro |
| `backend/internal/warehouse/purchases.go`, `payments.go`, `suppliers.go`, `statements.go` (yangi), `warehouse.go`, `numbers.go`, `stock.go` (o'chadi) (+testlar) | jurnalda |
| `backend/internal/catalog/catalog.go`, `products.go`, `purchases.go` (+testlar) | qoldiq, oxirgi narx, `product_in_use` |
| `backend/internal/company/locations.go` (+test) | `location_in_use` hujjat bo'yicha |
| `backend/internal/app/warehouse.go`, `catalog.go`, `handler.go` (+testlar) | JSON, `/statement` |
| `backend/openapi.yaml`, `packages/api-client` | kontrakt |
| `apps/web/lib/warehouse.ts`, `lib/types.ts`, `lib/queries.ts`, `lib/currencies.ts` (+testlar) | sxemalar, hooklar, `convert` |
| `apps/web/components/datetime-field.tsx`, `currency-field.tsx`, `components/warehouse/payments-field.tsx`, `statement-list.tsx` (yangi, +testlar) | umumiy bo'laklar |
| `apps/web/components/warehouse/purchase-form.tsx`, `purchase-page.tsx`, `purchases-page.tsx`, `supplier-page.tsx`, `payment-dialog.tsx`, `supplier-purchases.tsx` va `supplier-payments.tsx` (o'chadi), `components/catalog/product-page.tsx` (+testlar) | sahifalar |
| `apps/web/mocks/ledger.ts` (yangi), `mocks/data.ts`, `mocks/warehouse.ts`, `mocks/catalog.ts` (+`handlers.test.ts`), `e2e/warehouse.spec.ts`, `e2e/catalog.spec.ts` | mocklar, e2e |

---

### Task 1: Migratsiya `00016_ledger.sql`

Testlar (`migrations_test.go`): `TestTheLedgerMigrationMovesThePurchasesAndPaymentsIntoTheJournal` (DownTo 15 → kompaniya, egasi, lokatsiya, ta'minotchi, mahsulot, 2 xarid (biri o'chirilgan) qatorlari bilan, `stock` qatori, 2 to'lov (biri xaridga bog'langan) → UpTo 16 → `transactions`: xaridlar o'z id va raqami bilan, `doc_at` = kuni 00:00 Asia/Tashkent (UTC'da 19:00 oldingi kun), UZS, kurs qatori bor; to'lovlar `supplier_payment`, `linked_id`, «Naqd» akkaunti, raqamlar `paid_on, id` tartibida; qatorlar ko'chgan; `SUM(stock_moves)` eski `stock.quantity` ga teng (o'chirilgan xarid harakatsiz); eski jadvallar yo'q), `TestTransactionsKeepTheirRules` (tur katalogdan (23514); raqam tur ichida takrorlanmas (23505), boshqa turda mumkin; `transfer` da `to_location_id <> location_id`; `supplier_payment` da akkaunt shart; begona lokatsiya (23503)), `TestStockMovesAreAJournal` (miqdor 0 bo'lmaydi; hujjat o'chirilsa harakat o'chadi — `ON DELETE CASCADE`), `TestTheLedgerMigrationDownBringsTheOldTablesBack` (DownTo 15 → `purchases`, `purchase_items`, `stock`, `supplier_payments` bo'sh bor, `transactions` yo'q).

Up: spec «00016» DDL (`transactions`, `transaction_items`, `stock_moves`, indekslar, tur bo'yicha CHECK), so'ng ko'chirish:

```sql
-- Kurs qatori yo'q kompaniyaga (xaridi yoki to'lovi bo'lsa) nol qator (status 2).
INSERT INTO currency_rates (company_id, status, set_by)
SELECT c.id, 2, COALESCE(
    (SELECT user_phone FROM user_companies WHERE company_id = c.id ORDER BY (role = 'owner') DESC, user_phone LIMIT 1),
    (SELECT created_by FROM purchases WHERE company_id = c.id ORDER BY id LIMIT 1),
    (SELECT created_by FROM supplier_payments WHERE company_id = c.id ORDER BY id LIMIT 1))
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM currency_rates r WHERE r.company_id = c.id)
  AND (EXISTS (SELECT 1 FROM purchases p WHERE p.company_id = c.id) OR EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.company_id = c.id));

INSERT INTO transactions (id, company_id, kind, number, doc_at, location_id, supplier_id, currency_id, currency_rate_id, total, note, created_by, created_by_name, created_at, updated_at, deleted_at)
SELECT p.id, p.company_id, 'purchase', p.number, (p.purchased_on::timestamp AT TIME ZONE 'Asia/Tashkent'), p.location_id, p.supplier_id, 1,
       (SELECT r.id FROM currency_rates r WHERE r.company_id = p.company_id ORDER BY (r.status = 1) DESC, r.set_at, r.id LIMIT 1),
       p.total, p.note, p.created_by, p.created_by_name, p.created_at, p.updated_at, p.deleted_at
FROM purchases p;
SELECT setval('transactions_id_seq', COALESCE((SELECT max(id) FROM transactions), 1));

INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position)
SELECT purchase_id, product_id, quantity, price, position FROM purchase_items;

INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity)
SELECT i.purchase_id, p.company_id, p.location_id, i.product_id, i.quantity
FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id WHERE p.deleted_at IS NULL;

INSERT INTO transactions (company_id, kind, number, doc_at, supplier_id, bank_account_id, linked_id, currency_id, currency_rate_id, total, note, created_by, created_by_name, created_at, updated_at, deleted_at)
SELECT sp.company_id, 'supplier_payment', row_number() OVER (PARTITION BY sp.company_id ORDER BY sp.paid_on, sp.id),
       (sp.paid_on::timestamp AT TIME ZONE 'Asia/Tashkent'), sp.supplier_id,
       (SELECT b.id FROM bank_accounts b WHERE b.company_id = sp.company_id AND b.deleted_at IS NULL ORDER BY (lower(b.name) = 'naqd') DESC, b.id LIMIT 1),
       sp.purchase_id, 1,
       (SELECT r.id FROM currency_rates r WHERE r.company_id = sp.company_id ORDER BY (r.status = 1) DESC, r.set_at, r.id LIMIT 1),
       sp.amount, sp.note, sp.created_by, sp.created_by_name, sp.created_at, sp.updated_at, sp.deleted_at
FROM supplier_payments sp ORDER BY sp.id;

DROP TABLE supplier_payments; DROP TABLE stock; DROP TABLE purchase_items; DROP TABLE purchases;
```

Down: `DROP TABLE stock_moves; DROP TABLE transaction_items; DROP TABLE transactions;` keyin 00013 dagi `purchases`, `purchase_items`, `stock`, `supplier_payments` DDL (bo'sh).

Commit: `feat(db): the ledger — transactions, their lines and the stock moves`.

### Task 2: So'rovlar

`transactions.sql`: `NextNumber(company_id, kind)`, `CreateTransaction` (hamma ustun narg bilan), `UpdateTransactionHead` (supplier_id, doc_at, currency_id, currency_rate_id, note, updated_at), `SetTransactionTotal` (qatorlardan, `sum(quantity * price)`), `SetTransactionAmount` (to'lov summasi), `DeleteTransaction` (deleted_at), `AddTransactionItem`, `ListTransactionItems` (nom, birlik, summa), `DeleteTransactionItems`, `GetPurchase` / `ListPurchases` / `CountPurchases` (lokatsiya va ta'minotchi filtri; `paid` = bog'langan jonli to'lovlar hujjat valyutasiga aylantirilgan yig'indisi; `total_uzs`; `rate` ustuni `cr.*` orqali), `ListLinkedPayments(linked_id)`, `HideLinkedPayments(linked_id)`, `GetPayment` / `ListPayments` / `CountPayments` (ta'minotchi bo'yicha; `purchase_number` = `l.number`; `amount_uzs`), `UpdatePayment`, `CountSupplierDocuments`, `CountLocationDocuments` (location_id yoki to_location_id), `CountProductDocuments`, `ListProductPurchases` / `CountProductPurchaseLines` (jurnaldan, `at`).
`stock_moves.sql`: `AddStockMove`, `DeleteStockMoves(transaction_id)`, `NegativeStock(location_ids, product_ids)` (nomi bilan, `HAVING sum < 0`), `StockOf(location_ids, product_id)`, `ListProductStock` (ko'chadi).
`statements.sql`: `GetSupplierBalance(supplier_id)` (purchases_total, payments_total, balance so'mda), `ListSupplierBalanceByCurrency`, `ListSupplierStatement` / `CountSupplierStatement` (CTE + `sum() OVER (ORDER BY doc_at, id)`, yangi birinchi).
`products.sql`: `quantity` `stock_moves` dan, `last_price` + `last_price_currency_id` (LATERAL: `purchase`/`opening_stock` jonli qatori, `doc_at DESC, id DESC`). `suppliers.sql`: `GetSupplier` / `ListSuppliers` balansi `statements` formulasida (LATERAL). `locations.sql`: `CountLocationPurchases` o'rniga `CountLocationDocuments`. `currencies.sql`: `GetFallbackRate`.

Testlar: `internal/db/transactions_test.go`, `stock_moves_test.go`, `statements_test.go` (purchases_test, supplier_payments_test o'chadi: jadval yo'q), `products_test.go`, `suppliers_test.go`, `locations_test.go`, `currencies_test.go` moslanadi. `make sqlc`. Commit: `feat(db): the ledger queries`.

### Task 3: `internal/ledger`

- `kinds.go`: `type Kind string`, 16 konstanta, `Title(k) string` («Xarid», «Sotuv», «Ko'chirish», «Inventarizatsiya», «Boshlang'ich qoldiq», «To'lov», «Boshlang'ich qarz», «Boshlang'ich avans», «Mijoz to'lovi», «Mijoz boshlang'ich qarzi», «Mijoz boshlang'ich avansi», «Kassa boshlang'ich qoldig'i», «Xarajat», «Kirim», «O'tkazma», «Konvertatsiya»), `Numbered(k)` (sarlavhada raqam ko'rsatiladimi).
- `time.go`: `At(raw string) (time.Time, error)` (RFC3339, «Vaqtni kiriting», «Vaqt noto'g'ri»; UTC'ga).
- `pricing.go`: `Pricing{CurrencyID, RateID int64; Rate pgtype.Numeric}`, `PriceIn(ctx, q, companyID int64, currencyID *int64, rawRate *string, at time.Time, by string, current *Pricing) (Pricing, error)` (kelishuvlar), `RateText`.
- `numbers.go`: `NextNumber(ctx, q, companyID, kind)`.
- `moves.go`: `Line{ProductID; Quantity, Expected pgtype.Numeric}`, `Move{LocationID, ProductID int64; Quantity pgtype.Numeric}`, `MovesOf(kind, locationID, toLocationID int64, lines []Line) []Move` (sof; unit test: xarid/boshlang'ich `+`, sotuv `−`, ko'chirish ikki tomon, inventarizatsiya farq, 0 tashlanadi), `WriteMoves(ctx, q, companyID, txID int64, moves)` (o'chirib qayta yozadi) + `CheckStock(ctx, q, locationIDs, productIDs)` → `ErrStockInsufficient(name)`.
- `payments.go`: `PaymentLine{BankAccountID int64; Amount *string}`, `WriteLinkedPayments(ctx, q, companyID, doc (id, kind, supplier_id, doc_at), lines, by, byName) error` (akkaunt: jonli kompaniyaniki «Akkauntni tanlang», nofaol «Akkaunt nofaol» (avvalgi bog'langan to'lovlarda bo'lsa qoladi), summa «To'lov summasi noto'g'ri», valyuta akkauntniki, kurs standart (yo'q → «Kursni kiriting»); eskilari yashiriladi).

Testlar: `ledger_test.go` (At, MovesOf, Title), `pricing_test.go` (pgtest: UZS nol qator, standart, o'z kursi, teng kurs standartni oladi, yoqilmagan 400, kursi yo'q «Kursni kiriting»), `moves_test.go` (yozish, manfiy 409 nom bilan), `payments_test.go`. Commit: `feat(ledger): the core of the journal`.

### Task 4: Xaridlar jurnalda

`warehouse/purchases.go`: `Purchase{…, At time.Time, CurrencyID, Rate, Total, TotalUZS, Paid, Payments []LinkedPayment{ID, BankAccountID, AccountName, Amount, CurrencyID}}`, `PurchaseInput{SupplierID, At string, CurrencyID *int64, Rate *string, Note, Items, Payments []ledger.PaymentLine}`; `checkPurchase` tartibi 4.2; `CreatePurchase`: raqam → bosh qator → qatorlar → jami → harakatlar (+ tekshiruv) → bog'langan to'lovlar; `UpdatePurchase`: bosh (ta'minotchi, vaqt, valyuta, kurs, izoh) → qatorlar → harakatlar qayta → to'lovlar qayta; `DeletePurchase`: yashirish, harakatlar o'chadi (tekshiruv), bog'langan to'lovlar yashiriladi. `stock.go`, `numbers.go` (`day`) o'chadi.

Testlar `purchases_test.go` yangi qoidaga: `stockOf` `stock_moves` yig'indisidan; `PurchasedOn` → `At`; `Paid` → `Payments: [{naqd, "5000"}]`; valyuta holatlari (USD xarid 12 800 kursda `TotalUZS`, o'z kursi, yoqilmagan, kurs yo'q); to'lov qatori holatlari (akkaunt yo'q / nofaol / summa); «sotilgan tovar» holati `stock_moves` ga qo'lda `−` qator bilan; atomiklik `FailInserts("stock_moves")` va `FailInserts("transactions")` (to'lov yozilmasa xarid ham yo'q: ikkinchi INSERT yiqiladi). Commit: `feat(warehouse): the purchases in the journal, paid through accounts`.

### Task 5: To'lovlar, balans, hisob harakati

`payments.go`: `Payment{ID, SupplierID, PurchaseID, PurchaseNumber, BankAccountID, AccountName, Amount, CurrencyID, Rate, AmountUZS, At, Note, …}`, `PaymentInput{BankAccountID int64; Amount *string; At string; Rate *string; Note *string}`; `AddPayment`, `UpdatePayment` (`payment_linked`), `DeletePayment`, `ListPayments`. `suppliers.go`: `Supplier{…, Balance, PurchasesTotal, PaymentsTotal string; BalanceByCurrency []BalanceLine{CurrencyID, Amount}}`, `DeleteSupplier` → `CountSupplierDocuments` «Bu ta'minotchida N ta hujjat bor». `statements.go`: `StatementRow{ID, Kind, Number, At, Amount, CurrencyID, AmountUZS, DeltaUZS, BalanceUZS, LinkedID *int64, LinkedNumber *int32, Note, CreatedByName}`, `Statement(ctx, companyID, supplierID, page)`.

Testlar: `payments_test.go` (akkaunt valyutasi, kurs, `AmountUZS`), `suppliers_test.go` (balans so'mda: USD xarid 12 800 + so'm to'lov; valyuta bo'yicha; kurs farqi 100 USD 12 800 / 13 000 → −20 000 avans), `statements_test.go` (tartib, qator o'zgarishi, qoldiq balans, sahifa). Commit: `feat(warehouse): supplier payments through accounts, the balance in so'm and the statement`.

### Task 6: Katalog, lokatsiya, app API, kontrakt

- `catalog`: `Product.Quantity` jurnaldan (so'rov), `LastPrice *LastPrice{Amount, CurrencyID}`, `DeleteProduct` → `CountProductDocuments` «Bu mahsulot N ta hujjatda bor», `ProductPurchase.At`. `company.DeleteLocation` → `CountLocationDocuments` «Bu lokatsiyada N ta hujjat bor». Testlar moslanadi (`catalog` testlari `stock_moves` ga yozadi, `purchases` jadvalisiz).
- `app/warehouse.go`: `purchaseJSON{at, currency_id, rate, total, total_uzs, paid, payments[]}`, `purchaseInputJSON{at, currency_id?, rate?, payments[]}`, `paymentJSON{bank_account_id, account_name, amount, currency_id, rate, amount_uzs, at, …}`, `paymentInputJSON`, `supplierJSON.balance_by_currency`, `getSupplierStatement` (`purchases.view`), route `GET /app/suppliers/{id}/statement`; `app/catalog.go` `last_price` obyekt, `product purchases` `at`. Testlar: `warehouse_test.go`, `catalog_test.go`, `permissions_test.go`, `handler_test.go` (fixture'lar `bank_accounts`, `currency_rates`).
- `openapi.yaml`: `Purchase`, `PurchaseDetail` (`payments`), `PurchaseInput` (`at` date-time, `currency_id`, `rate`, `payments`), `PaymentLine`, `LinkedPayment`, `Payment`, `PaymentInput`, `Supplier` (`balance_by_currency`), `BalanceLine`, `StatementRow`, `StatementPage`, `/app/suppliers/{id}/statement`, `Product.last_price` (`LastPrice | null`), `ProductPurchase.at`; `make api-client`. Commit: `feat(api): purchases and payments in the journal, the supplier statement`.

### Task 7: Web lib va mocklar

- `lib/types.ts` (+`LinkedPayment`, `PaymentLine`, `BalanceLine`, `StatementRow`, `StatementPage`, `LastPrice`), `lib/queries.ts` (`statementKey`, `useStatement`; xarid yozuvi `suppliersKey`, `statementKey`, `meKey`? (akkaunt qoldig'i keyin) ni bekor qiladi), `lib/currencies.ts` (`useAccounts()` `/app/me` dan faollari, `accountOptions`, `convert(amount, from, to, rates)` 2 kasr, `rateOf`), `lib/warehouse.ts` (`purchaseSchema`: `at` (`datetime-local` → ISO), `currency_id`, `rate` (ko'p valyutada), `payments: [{bank_account_id, amount}]` (summa > 0), `paymentSchema` (`bank_account_id`, `amount`, `at`, `rate?`, `note`), `purchaseDefaults`, `paymentDefaults`, `nowLocal()`, `toISO()`, `fromISO()`, `purchaseTotal`, `remaining(total, payments, rates)`), `lib/format.ts` (`formatDateTime` bor).
- `mocks/ledger.ts`: `TransactionRow`, `ItemRow`, `MoveRow`, `nextNumber(companyId, kind)`, `rateAt(companyId, at)`, `fallbackRate`, `priceIn`, `convert`, `movesOf`, `writeMoves` (manfiy → 409 nom bilan), `stockOf`, `writeLinkedPayments`, `balanceOf`, `statementOf`; `mocks/data.ts`: `db.transactions`, `db.items`, `db.moves` (eski `purchases`, `payments`, `stock` o'chadi; seedlar jurnalga, Nok Market'da USD xarid); `mocks/warehouse.ts` jurnalda; `mocks/catalog.ts` qoldiq va oxirgi narx jurnaldan, `product_in_use`. `handlers.test.ts` yangilanadi. Commit: `feat(web): the mock API keeps the journal`.

### Task 8: Xarid formasi va sahifalari

`components/datetime-field.tsx` (`DateTimeField`: `type="datetime-local"`, standart hozir), `components/currency-field.tsx` (`CurrencyField`: valyuta `SelectField` + kurs `TextField` «1 USD = ? so'm», faqat `isMulti`; UZS'da kurs maydoni yashirin), `components/warehouse/payments-field.tsx` (`PaymentsField`: `useFieldArray`, qator: akkaunt `SelectField` (faol akkauntlar, valyutasi bilan «Naqd (so'm)»), summa, «To'liq» (qolgan qarzni akkaunt valyutasiga aylantiradi), o'chirish; «To'lov qo'shish»; qolgan summa ko'rsatkichi), `purchase-form.tsx` (vaqt, valyuta/kurs, narx taklifi valyutaga qarab `convert`), `purchase-page.tsx` (vaqt `formatDateTime`, valyuta va kurs, jami `formatMoney`, «so'mda», to'lovlar ro'yxati), `purchases-page.tsx` (vaqt, `formatMoney`). Testlar: `datetime-field.test.tsx`, `currency-field.test.tsx`, `payments-field.test.tsx`, `purchase-form.test.tsx`, `purchase-page.test.tsx`, `purchases-page.test.tsx`, `edit-purchase-page.test.tsx`. Commit: `feat(web): purchases with a time, a currency and payment lines`.

### Task 9: Ta'minotchi sahifasi, to'lov dialogi, mahsulot sahifasi

`statement-list.tsx` (`StatementList`: `DataList` «Hujjat» (tur + «№ N», havola xaridga; bog'langan to'lovda «Xarid № N to'lovi»), «Vaqt», «Summa» (valyutasida), «So'mda» (± belgi, rang), «Balans»; o'z to'lovida tahrirlash / o'chirish; `Pager`), `supplier-page.tsx` (balans kartasi: «Qarz: N so'm» / «Avans» / «Qarz yo'q», «shu jumladan …» valyuta bo'yicha, «Jami xaridlar», «Jami to'lovlar»; «Hisob harakati»; «To'lov qo'shish»), `payment-dialog.tsx` (akkaunt, summa, vaqt, kurs (`isMulti` va akkaunt valyutasi so'm emas), izoh), `delete-payment-button.tsx` moslanadi, `supplier-purchases.tsx` va `supplier-payments.tsx` o'chadi, `components/catalog/product-page.tsx` (oxirgi narx valyuta bilan, xaridlar `at`). Testlar yangilanadi. Commit: `feat(web): the supplier's statement and payments through accounts`.

### Task 10: Yakun

`e2e/warehouse.spec.ts` (xarid vaqt bilan, to'lov qatori naqd; Nok Market'da USD xarid va kurs), `e2e/catalog.spec.ts` (oxirgi narx), `make lint`, `make test`, `make e2e` (ketma-ket); spec'ga «3-bosqich qarorlari»; `git push origin dev`.
