# Jurnal, 6-bosqich: ombor hujjatlari UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ombor bo'limida uchta yangi tab va sahifalari: «Ko'chirishlar» (`/transfers`), «Inventarizatsiya» (`/inventories`), «Boshlang'ich qoldiq» (`/opening-stock`) — ro'yxat, hujjat sahifasi, qo'shish va tahrirlash formalari, o'chirish; ta'minotchi sahifasida boshlang'ich qarz / avans dialogi (hisob harakati qatorida tahrirlash va o'chirish); mahsulot sahifasida «Harakatlar». Hammasi 5-bosqich API'si va mocklari ustida; Vitest va e2e.

**Architecture:**
- **Nav** (`lib/nav.ts`): Ombor tablari `Xaridlar (/purchases, purchases.view) · Ko'chirishlar (/transfers, stock.view) · Inventarizatsiya (/inventories, stock.view) · Boshlang'ich qoldiq (/opening-stock, stock.view) · Ta'minotchilar (/suppliers, suppliers.view)`. `SectionTabs` o'zgarmaydi (5 tab tor ekranda yonga suriladi).
- **Lib**: `lib/stock.ts` (zod sxemalar `transferSchema`, `inventorySchema`, `openingStockSchema`, `openingSchema`; forma turlari va `*Defaults`; `kindTitle(kind)`, `documentHref(kind, id)`), `lib/queries.ts` (hooklar), `forgetWarehouse` kengayadi.
- **Umumiy bo'lak**: `components/warehouse/lines-field.tsx` (`LinesField`: `useFieldArray("items")`, mahsulot `ProductPicker`, miqdor birlik bilan, `withPrice` bo'lsa narx va summa, «Qator qo'shish», qator xatosi); xarid formasi ham shu bo'lakka o'tadi.
- **Sahifalar** (`components/warehouse/`): `transfers-page`, `transfer-form`, `new-transfer-page`, `edit-transfer-page`, `transfer-page`, `delete-transfer-button`; `inventories-page`, `inventory-form` (tizim qoldig'i `useStockAt`, «Hammasini qo'shish», farq), `new-/edit-inventory-page`, `inventory-page`, `delete-inventory-button`; `opening-stock-page`, `opening-stock-form`, `new-/edit-opening-stock-page`, `opening-stock-detail-page`, `delete-opening-stock-button`; `opening-dialog` + `delete-opening-button` (ta'minotchi), `statement-list` qatorida; `components/catalog/product-moves.tsx`.
- **Route'lar** (`app/(app)/`): `transfers/{page,new/page,[id]/page,[id]/edit/page}.tsx`, `inventories/…`, `opening-stock/…`.
- **API qo'shimchasi**: `GET /app/stock?exclude_id=` — tahrir formasida inventarizatsiyaning o'z harakatlarisiz tizim qoldig'i (Go servis `StockAt(scope, locationID, at, excludeID)`, handler, openapi, client, mock).

Qoidalar: `logic/warehouse.md` (5, 5.1–5.3, 6-bo'limlar), `logic/products.md` (6-bo'lim), `logic/locations.md` (7-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`, `2026-10-04-crud-ui-refresh-design.md` (DataList, PageHeader, Fact), `2026-10-06-selects-settings-tabs-pager-design.md` (SelectField, Pager).

---

## Kelishuvlar

- **Ko'chirish maqsadi** formada a'zoning o'z lokatsiyalari (`/app/me.locations`) orasidan, manbadan tashqari, tanlanadi: API kompaniyaning istalgan jonli lokatsiyasiga ruxsat beradi, lekin cheklangan xodimga begona lokatsiyalar ro'yxati API'da yo'q, yangi endpoint qo'shilmaydi. Bitta lokatsiyali a'zoga «Ko'chirish qo'shish» ko'rsatilmaydi; bo'sh holat: «Ko'chirish uchun kamida ikkita lokatsiya kerak».
- **Ko'chirishlar ro'yxati** joriy lokatsiyaniki (`?location_id=` joriy): manba yoki maqsad joriy; qatorda yo'nalish belgisi «Chiqim» (manba joriy) / «Kirim» (maqsad joriy). Hujjat sahifasida «Tahrirlash» va «O'chirish» faqat manba a'zoning lokatsiyalari ichida bo'lsa (aks holda API 403).
- **Inventarizatsiya formasi**: qatorda «Tizim» (`GET /app/stock?location_id=&at=&exclude_id=` dan, hujjat vaqti bo'yicha; vaqt o'zgarsa qayta so'raladi), «Sanalgan» kiritiladi, «Farq» hisoblanadi (ortiqcha yashil, kam qizil). «Hammasini qo'shish» qoldig'i ≠ 0 mahsulotlarni (ro'yxatda yo'qlarini) sanalgan = tizim bilan qo'shadi. Tahrirda `exclude_id` hujjatning o'zi.
- **Boshlang'ich qoldiq** formasi xarid formasi kabi, ta'minotchi va to'lovlarsiz (vaqt, valyuta va kurs 2+ valyutada, qatorlar narx bilan, jami, izoh).
- **Boshlang'ich qarz / avans** ta'minotchi sahifasida dialog (`OpeningDialog`): tur (`SelectField`: «Qarz» — biz ta'minotchiga qarzdormiz / «Avans» — oldindan to'laganmiz), summa (+ valyuta `SelectField` 2+ valyutada), vaqt, kurs (so'mdan boshqa valyutada), izoh; hisob harakati qatorida (`supplier_debt` / `supplier_prepay`) tahrirlash (tur o'zgarmaydi: select `disabled`) va o'chirish, to'lov qatoridagidek (`purchases.edit` / `purchases.delete`).
- **Mahsulot sahifasi «Harakatlar»** (`stock.view`): hujjat (tur nomi va raqami, havola: xarid `/purchases/{id}`, ko'chirish `/transfers/{id}`, inventarizatsiya `/inventories/{id}`, boshlang'ich qoldiq `/opening-stock/{id}`; sotuv sahifasi 8-bosqichda — ungacha oddiy matn), vaqt, lokatsiya (2+ ruxsatli lokatsiyada), kontragent yoki boshqa lokatsiya («—» bo'lsa), miqdor «+4 kg» / «−1 kg» (kirim yashil, chiqim qizil). 20 tadan, `Pager`.
- **Matnlar**: sahifa nomlari «Ko'chirishlar», «Yangi ko'chirish», «Ko'chirishni tahrirlash», «Ko'chirish № N», «Ko'chirish topilmadi» («Bu ko'chirish o'chirilgan yoki siz ishlamaydigan lokatsiyalar orasida.»); «Inventarizatsiya», «Yangi inventarizatsiya», «Inventarizatsiyani tahrirlash», «Inventarizatsiya № N», «Inventarizatsiya topilmadi»; «Boshlang'ich qoldiq», «Yangi boshlang'ich qoldiq», «Boshlang'ich qoldiqni tahrirlash», «Boshlang'ich qoldiq № N», «Hujjat topilmadi». Tugmalar «Ko'chirish qo'shish», «Inventarizatsiya qo'shish», «Boshlang'ich qoldiq qo'shish», «Hammasini qo'shish», «Boshlang'ich qarz / avans». Bo'sh holatlar «Hali ko'chirish yo'q», «Hali inventarizatsiya yo'q», «Hali boshlang'ich qoldiq yo'q». O'chirish dialoglari «Ko'chirishni o'chirasizmi?» («№ N ko'chirishi o'chiriladi, tovar manbaga qaytadi. Qayta tiklab bo'lmaydi.»), «Inventarizatsiyani o'chirasizmi?» («… farqlari qoldiqdan olinadi …»), «Boshlang'ich qoldiqni o'chirasizmi?» («… qoldiq olinadi …»), «Hujjatni o'chirasizmi?» (qarz / avans). Toastlar «… qo'shildi» / «… saqlandi» / «… o'chirildi».
- **Talab o'zgargani uchun o'zgargan testlar**: `purchases-page.test.tsx` va `suppliers-page.test.tsx` Ombor tablari ro'yxati (5 ta); `warehouse.spec.ts` tablar; `nav.test.ts` tablar.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/warehouse/stock.go` (+test), `internal/app/stock.go` (+test), `openapi.yaml`, `packages/api-client` | `StockAt` `excludeID`; `GET /app/stock?exclude_id=` |
| `apps/web/mocks/stock.ts` (+`handlers.test.ts`) | `exclude_id` |
| `apps/web/lib/nav.ts` (+test), `lib/stock.ts` (yangi, +test), `lib/queries.ts`, `lib/types.ts` | tablar, sxemalar, hooklar |
| `apps/web/components/warehouse/lines-field.tsx` (yangi, +test), `purchase-form.tsx` | umumiy qatorlar |
| `apps/web/components/warehouse/transfer*.tsx`, `inventor*.tsx`, `opening-stock*.tsx`, `opening-dialog.tsx`, `delete-*-button.tsx`, `statement-list.tsx`, `new-purchase-page.tsx` (`forgetWarehouse`) (+testlar) | sahifalar va dialoglar |
| `apps/web/components/catalog/product-moves.tsx` (yangi, +test), `product-page.tsx` | «Harakatlar» |
| `apps/web/app/(app)/transfers/**`, `inventories/**`, `opening-stock/**` | route'lar |
| `apps/web/e2e/warehouse.spec.ts` | oqim: ko'chirish, inventarizatsiya, boshlang'ich qoldiq, qarz / avans, harakatlar |
| `docs/superpowers/specs/2026-10-11-ledger-design.md` | «6-bosqich qarorlari» |

---

### Task 1: `GET /app/stock?exclude_id=`

Go: `warehouse.StockAt(ctx, scope, locationID, at *time.Time, excludeID int64)` → `ListLocationStock` so'roviga `exclude_id` (`t.id <> sqlc.arg('exclude_id')`, 0 hech narsani chiqarmaydi; `make sqlc`); test `TestStockAtAMoment`: inventarizatsiyaning o'zisiz. Handler: `?exclude_id=` (son emas: 400 «Hujjat noto'g'ri»); `stock_test.go`. `openapi.yaml` parametri; `make api-client`. Mock `stockAt(locationId, at, excludeId)` allaqachon bor — handler o'qiydi; `handlers.test.ts`. Commit.

### Task 2: Nav tablari, `lib/stock.ts`, hooklar

`nav.ts` tablar (yuqoridagi tartib); `nav.test.ts` (`navFor` stock.view bilan Ombor `/transfers` da ochiladi, purchases.view bilan `/purchases`). `lib/stock.ts`: `transferSchema` (`to_location_id` `id("Maqsad lokatsiyani tanlang")`, `at`, `note`, `items: lineSchema` narxsiz → `{product_id, quantity}`, bir mahsulot bir marta), `inventorySchema` (`at`, `note`, `items: {product_id, product_name, unit, expected, counted}` → `{product_id, counted}` («Sanalganni kiriting» / «Miqdor noto'g'ri», 0 mumkin)), `openingStockSchema` (xarid sxemasi ta'minotchi va to'lovsiz), `openingSchema` (`kind` `debt|prepay` «Turni tanlang», `amount` «Summani kiriting» / «Summa noto'g'ri», `currency_id`, `rate` (UZS'da null), `at`, `note`); `transferDefaults`, `inventoryDefaults`, `openingStockDefaults`, `openingDefaults`, `openingOfRow(row, supplierId)`; `kindTitle` («Xarid», «Sotuv», «Ko'chirish», «Inventarizatsiya», «Boshlang'ich qoldiq»), `documentHref` (sotuvga `null`); `differenceOf(expected, counted)`. `lib/stock.test.ts`. `queries.ts`: `transfersKey/useTransfers(companyId, {locationId, page})`, `transferKey/useTransfer`, `inventoriesKey/useInventories`, `inventoryKey/useInventory`, `openingStockKey/useOpeningStockList`, `openingStockItemKey/useOpeningStock`, `stockAtKey/useStockAt(companyId, locationId, atISO, excludeId)`, `productMovesKey/useProductMoves(companyId, productId, page)`; `forgetWarehouse` += `transfers`, `transfer`, `inventories`, `inventory`, `opening-stock`, `opening-stock-item`, `stock-at`, `product-moves`. Commit.

### Task 3: `LinesField` va xarid formasi

`lines-field.tsx`: props `form` (`UseFormReturn` qatorlari `items: LineForm[]` bo'lgan forma), `companyId`, `withPrice`, `currencyId` (narx taklifi uchun), `pending`, `heading` («Mahsulotlar»); `aria-label` `${n}-qator`, «Qator qo'shish», «N-qatorni olib tashlash», summa va jami (`withPrice`). Test: qator qo'shish / olib tashlash, birlik, narx taklifi, xato. `purchase-form.tsx` `LinesField` ga o'tadi, `purchase-form.test.tsx` o'zgarmaydi. Commit.

### Task 4: Ko'chirishlar

`transfers-page.tsx` (joriy lokatsiya; ustunlar «Ko'chirish» `№ N · Asosiy → Chilonzor` + `vaqt · N ta mahsulot`, «Yo'nalish» tag `Badge` Chiqim / Kirim, «Qo'shgan»; `useTransferFilter` = `usePurchaseFilter` nusxasi yoki umumiy `usePageFilter`), `transfer-form.tsx` («Qayerdan» matn, «Qayerga» `SelectField`, vaqt, `LinesField` narxsiz, izoh), `new-transfer-page.tsx` (`stock.create` + `products.view`, 2+ lokatsiya), `edit-transfer-page.tsx`, `transfer-page.tsx` («Ma'lumot»: Qayerdan, Qayerga, Vaqt, Izoh, Qo'shgan, Qo'shilgan; «Qatorlar»: Mahsulot, Miqdor; amallar manba ruxsatli bo'lsa), `delete-transfer-button.tsx`; route'lar. Testlar har biriga (`transfers-page.test.tsx`: ro'yxat, yo'nalish, bo'sh holat, bitta lokatsiya, ruxsatsiz; `transfer-form.test.tsx`: qo'shish oqimi, xatolar, 409; `transfer-page.test.tsx`: sahifa, 404, maqsad tomonidan ko'rilganda amallar yo'q, o'chirish). Commit.

### Task 5: Inventarizatsiya

`inventories-page.tsx`, `inventory-form.tsx` (vaqt; qatorlar: mahsulot, «Tizim» (`useStockAt` natijasidan, yo'q bo'lsa 0), «Sanalgan», «Farq»; «Qator qo'shish», «Hammasini qo'shish»; izoh), `new-/edit-inventory-page.tsx`, `inventory-page.tsx` («Qatorlar»: Mahsulot, Tizim, Sanalgan, Farq rangli), `delete-inventory-button.tsx`; route'lar; testlar (forma: «Hammasini qo'shish» qoldiqdagi mahsulotlarni to'ldiradi, vaqt o'zgarsa tizim qayta so'raladi, farq; sahifa; 404; o'chirish 409 toast). Commit.

### Task 6: Boshlang'ich qoldiq

`opening-stock-page.tsx`, `opening-stock-form.tsx` (vaqt, `CurrencyField`, `LinesField` narx bilan, izoh), `new-/edit-opening-stock-page.tsx`, `opening-stock-detail-page.tsx` («Ma'lumot»: Vaqt, Lokatsiya, Valyuta, Jami, So'mda, Izoh, Qo'shgan, Qo'shilgan; «Qatorlar» xaridnikidek), `delete-opening-stock-button.tsx`; route'lar; testlar. Commit.

### Task 7: Boshlang'ich qarz / avans, hisob harakati

`opening-dialog.tsx` (`companyId`, `supplierId`, `opening?`, `iconOnly?`), `delete-opening-button.tsx`; `statement-list.tsx`: `supplier_debt` / `supplier_prepay` qatorida tahrirlash va o'chirish; `supplier-page.tsx` «Boshlang'ich qarz / avans» tugmasi (`purchases.create`). Testlar (`opening-dialog.test.tsx`: qo'shish, valyuta va kurs, xatolar; `statement-list.test.tsx`: qator amallari). Commit.

### Task 8: Mahsulot sahifasida «Harakatlar»

`product-moves.tsx` (`useProductMoves`; ustunlar «Hujjat», «Vaqt», «Lokatsiya» (2+), «Kontragent», «Miqdor»), `product-page.tsx` (`stock.view` bo'lganga, «Xaridlar»dan keyin). Test. Commit.

### Task 9: Yakun

`e2e/warehouse.spec.ts`: egasi (Olma Savdo, ikkinchi lokatsiya mock orqali) xarid → ko'chirish Chilonzor'ga (ro'yxatda «Chiqim», lokatsiya almashtirilsa «Kirim») → inventarizatsiya «Hammasini qo'shish», sanalgan kam, farq → mahsulot sahifasida «Harakatlar» → boshlang'ich qoldiq → ta'minotchida boshlang'ich qarz, balans; tablar 5 ta; 375px va desktop. `make lint`, `make test`, `make e2e`; spec «6-bosqich qarorlari»; `git push origin dev`.
