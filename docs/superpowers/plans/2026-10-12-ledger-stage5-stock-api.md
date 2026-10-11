# Jurnal, 5-bosqich: ombor hujjatlari API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ko'chirish, inventarizatsiya va boshlang'ich qoldiq hujjatlari (jurnalda, `stock.*` ruxsati), lahzadagi qoldiq (`GET /app/stock?location_id=&at=`), mahsulot harakatlari (`GET /app/products/{id}/moves`), ta'minotchi boshlang'ich qarz / avansi (`/app/suppliers/{id}/openings`, `purchases.*`) — API, kontrakt, TS client va web mocklari. Sahifalar 6-bosqichda.

**Architecture:**
- **So'rovlar** (`transactions.sql`, `stock_moves.sql`): `GetGoodsDocument` / `ListGoodsDocuments` / `CountGoodsDocuments` (`kind` bo'yicha; lokatsiya filtri manba **yoki** maqsad), `ListStockAt` (lokatsiya, lahza, hujjatning o'zisiz), `ListLocationStock` (lahzada qoldig'i ≠ 0 mahsulotlar), `ListProductMoves` / `CountProductMoves` (hujjat, lokatsiya, kontragent yoki boshqa lokatsiya, ± miqdor), `GetOpening` / `ListOpenings` / `CountOpenings` (supplier_debt / supplier_prepay).
- **Servis** (`internal/warehouse`): `documents.go` (umumiy: hujjat boshi, qatorlar tekshiruvi `checkLines` (mahsulot, xizmat emas, faol yoki avvaldan bor, bir marta; miqdor; narx), `writeGoodsLines`, `moveAndCheck`), `transfers.go`, `inventories.go` (`expected` = `ListStockAt(location, at, self)`, farq), `opening_stock.go` (xarid kabi, ta'minotchisiz va to'lovsiz), `stock.go` (`StockAt`, `ProductMoves`), `openings.go` (qarz / avans). Ko'chirishni ko'rish uchun manba yoki maqsad ruxsatli; tahrir / o'chirish faqat manba ruxsatli (403 `forbidden`).
- **API** (`internal/app/stock.go`): `/app/transfers`, `/app/inventories`, `/app/opening-stock` (`stock.*`), `GET /app/stock`, `GET /app/products/{id}/moves` (`stock.view`), `/app/suppliers/{id}/openings` (`purchases.*`); `permissions_test.go` jadvali.
- **Kontrakt**: `Transfer*`, `Inventory*`, `OpeningStock*`, `StockRow`, `ProductMove*`, `SupplierOpening*` sxemalari va path'lar; `make api-client`.
- **Mock** (`mocks/stock.ts`, `mocks/ledger.ts`): shu endpointlar Go qoidalarida; `handlers.test.ts`.

Qoidalar: `logic/warehouse.md` (5, 5.1–5.3, 6-bo'limlar), `logic/products.md` (6-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

### Task 1: So'rovlar (+`internal/db` testlari)

`GetGoodsDocument(id, company_id, kind, location_ids)`: `transfer` / `inventory` / `opening_stock` boshi (`l.id location_id`, `l.name`, `to_location_id`, `tl.name`, `doc_at`, `currency_id`, `rate`, `total`, `total_uzs`, `items_count`, `note`, kim, qachon), lokatsiya **yoki** maqsad ruxsatli; `ListGoodsDocuments` / `CountGoodsDocuments` (`kind`, `location_ids`, sahifa; `doc_at DESC, id DESC`). `ListStockAt(location_id, at, exclude_id)` → `(product_id, quantity)` (`doc_at <= at`, o'sha hujjatsiz). `ListLocationStock(location_id, at)` → qoldig'i ≠ 0 mahsulotlar (nom, birlik, miqdor), nom bo'yicha. `ListProductMoves(product_id, location_ids, limit, offset)` / `CountProductMoves`: `stock_moves ⋈ transactions` (jonli), `kind`, `number`, `doc_at`, `location`, `quantity`, `counterpart` (ta'minotchi nomi / mijoz nomi / ko'chirishda boshqa lokatsiya nomi). `GetOpening` / `ListOpenings` / `CountOpenings` (ta'minotchi, `kind IN (supplier_debt, supplier_prepay)`, `rate`, `amount_uzs`).

### Task 2: Ko'chirish (`transfers.go`, testlar)

`Transfer{ID, Number, LocationID, LocationName, ToLocationID, ToLocationName, At, Note, ItemsCount, CreatedByName, CreatedAt, UpdatedAt, Items []TransferItem{ProductID, Name, Unit, Quantity}}`, `TransferInput{ToLocationID, At, Note, Items []TransferItemInput{ProductID, Quantity}}`. Tekshiruv: manba (scope, «Lokatsiyani tanlang»), maqsad (kompaniyaning jonli lokatsiyasi «Maqsad lokatsiyani tanlang»; manbadan boshqa «Maqsad lokatsiya boshqa bo'lsin»), vaqt, izoh, qatorlar («Kamida bitta mahsulot qo'shing», «Mahsulotni tanlang», «Xizmat ombor hujjatiga kiritilmaydi», «Mahsulot nofaol», ««X» ikki marta kiritilgan», ««X» miqdori noto'g'ri»). Harakatlar: manbadan `−`, maqsadga `+`; tekshiruv ikkala lokatsiyada. Ro'yxat: manba yoki maqsad scope'da; `?location_id=` ikkala tomon bo'yicha. Tahrir / o'chirish: manba scope'da bo'lmasa 403 `forbidden`; maqsad, vaqt, qatorlar, izoh almashadi.

### Task 3: Inventarizatsiya (`inventories.go`, testlar)

`Inventory{…, Items []InventoryItem{ProductID, Name, Unit, Expected, Counted, Difference}}`, `InventoryInput{At, Note, Items []{ProductID, Counted}}` (sanalgan ≥ 0, 3 kasr). `expected` hujjat lahzasidagi qoldiq (o'zisiz), tahrirda qayta; farq 0 qator saqlanadi, harakat yozilmaydi; joriy qoldiq manfiy bo'lsa 409.

### Task 4: Boshlang'ich qoldiq (`opening_stock.go`, testlar)

`OpeningStock{…, CurrencyID, Rate, Total, TotalUZS, Items []Item}`, `OpeningStockInput{At, CurrencyID, Rate, Note, Items []ItemInput}`; xarid tekshiruvi (ta'minotchisiz, to'lovsiz), `+` harakatlar; `last_price` manbai (so'rov allaqachon).

### Task 5: Qoldiq va harakatlar, boshlang'ich qarz / avans (`stock.go`, `openings.go`, testlar)

`StockAt(scope, locationID, at)` (lokatsiya scope'da, `at` ixtiyoriy, hozir), `ProductMoves(scope, productID, locationID, page)` (mahsulot 404), `Opening{ID, Kind, SupplierID, Amount, CurrencyID, Rate, AmountUZS, At, Note, …}`, `OpeningInput{Kind debt|prepay, Amount, CurrencyID, Rate, At, Note}` («Turni tanlang» / «Tur noto'g'ri», «Summani kiriting» / «Summa noto'g'ri», vaqt, kurs, izoh); `ListOpenings`, `AddOpening`, `UpdateOpening`, `DeleteOpening` (404 «Hujjat topilmadi»).

### Task 6: API, kontrakt, client, mock

`internal/app/stock.go` handler'lari va route'lar; `stock_test.go`; `permissions_test.go`; `openapi.yaml`; `make api-client`; `mocks/stock.ts` + `mocks/ledger.ts` (`stockAt`, `movesOf` ishlatiladi), `handlers.test.ts`; `make lint`, `make test`; spec qarorlari; push.
