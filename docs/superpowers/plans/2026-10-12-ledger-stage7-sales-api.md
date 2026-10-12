# Jurnal, 7-bosqich: sotuv API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sotuv hujjati (`sale`: mijozga yoki chakana, qoldiqdan chiqim, xizmat qatori, bog'langan mijoz to'lovlari), mijoz to'lovlari (`customer_payment`), mijozning boshlang'ich qarz / avansi (`customer_debt` / `customer_prepay`), mijoz balansi (so'mda va valyuta bo'yicha) va hisob harakati, `customer_in_use` hujjat bo'yicha — API (`sales.*`), kontrakt, TS client va web mocklari. Sahifalar 8-bosqichda.

**Architecture:**
- **So'rovlar** (`transactions.sql`, `statements.sql`, `customers.sql`): `GetSale` / `ListSales` / `CountSales` (`location_ids`, `customer_id` ixtiyoriy; `customer_name` `tasks.sql`dagi subquery bilan; `paid` bog'langan to'lovlardan), `ListPartyBalanceByCurrency` / `ListPartyStatement` / `CountPartyStatement` (`party` = `supplier` | `customer`, `party_id`; ishora: xarid, sotuv, qarz qo'shadi; to'lov, avans ayiradi — hozirgi ta'minotchi so'rovlari shu umumiy so'rovlarga o'tadi), `GetCustomerPayment` / `ListCustomerPayments` / `CountCustomerPayments` (`sale_number` bog'langanidan), `GetCustomerOpening` / `ListCustomerOpenings` / `CountCustomerOpenings`, `GetCustomer` / `ListCustomers` balansi (LATERAL, `suppliers.sql` kabi), `CountCustomerDocuments`.
- **Servis** (`internal/warehouse`): `sales.go` (`Sale`, `SaleInput`, `checkSale`, `writeSaleLines`: mahsulot qatorlari `−` harakat, xizmat harakatsiz; chakanada to'lovlar jamiga teng; `ledger.WriteLinkedPayments` `customer_payment` turi bilan), `customer_payments.go` (`checkPayment` umumiy; `payment_linked` «Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang»), `customer_openings.go` (`checkOpening` umumiy; `customer_debt` / `customer_prepay`), `customer_statement.go` (`StatementRow` umumiy; `party` so'rovlari). `checkLines` qoidasi `AllowService` oladi, `checkedItem` mahsulot turini saqlaydi. `internal/customer`: `Customer.Balance`, `BalanceByCurrency` (sahifada), ro'yxatda `Balance`; `Delete` vazifadan keyin hujjat tekshiradi (409 «Bu mijozda N ta hujjat bor»).
- **API** (`internal/app/sales.go`): `/app/sales` (`sales.*`), `/app/customers/{id}/payments[/{paymentId}]`, `/app/customers/{id}/openings[/{openingId}]`, `/app/customers/{id}/statement` (`sales.*`); `Customer.balance` (`sales.view` siz `null`), `CustomerDetail.balance_by_currency`; `permissions_test.go` jadvali.
- **Kontrakt**: `Sale`, `SaleDetail`, `SaleInput`, `SaleCreate`, `SalePage`, `CustomerPayment*`, `CustomerOpening*` (yoki `Opening` umumiy sxemasi `supplier_id` → `party_id`? — yo'q: `CustomerOpening{customer_id}` alohida), `CustomerStatementPage` (`StatementRow` umumiy, `kind` enum kengayadi); `Customer.balance`, `CustomerDetail.balance_by_currency`; `make api-client`.
- **Mock** (`mocks/sales.ts`, `mocks/customers.ts`, `mocks/ledger.ts`): `balanceOf` / `statementOf` `party` bilan; `handlers.test.ts`.

Qoidalar: `logic/sales.md` (hammasi), `logic/customers.md` (2, 5-bo'limlar), `logic/products.md`, `logic/warehouse.md` (5, 6). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

## Kelishuvlar

- Sotuv va mijoz pul hujjatlari `internal/warehouse` paketida qoladi (jurnal hujjatlari bitta paketda; yangi `internal/sales` paketi umumiy yordamchilarni eksport qilishni talab qilardi).
- Ta'minotchi va mijoz hisob harakati bitta so'rov (`party`), bitta `StatementRow`; ishora qoidasi ikkalasida bir xil (hujjat va qarz qo'shadi, to'lov va avans ayiradi). API javobi `kind` bilan farqlaydi.
- Mijoz nomi: turning birinchi `string` maydoni (`tasks.sql`dagi `customer_name` subquery), bo'lmasa telefon (`Ref.name` bo'sh qolmasin: servis `name == ""` bo'lsa telefonni qo'yadi).
- Chakana sotuvning to'lovlari `customer_payment` mijozsiz, `linked_id` bilan: akkauntga tushadi, hech kimning balansiga tegmaydi (so'rovlar `customer_id IS NOT NULL` bilan filtrlaydi).
- Sotuv tahririda mijoz almashsa bog'langan to'lovlar qayta yoziladi (yangi mijoz bilan); mijoz olib tashlansa to'liq to'langan bo'lishi shart (400 «Mijozsiz sotuv to'liq to'langan bo'lsin»).
- `Customer.balance` ro'yxatda ham (`ListCustomers` LATERAL); `sales.view` bo'lmaganga `null`.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/db/queries/transactions.sql`, `statements.sql`, `customers.sql` (+`internal/db/sales_test.go`, `statements_test.go`) | sotuv, `party` hisob harakati, mijoz balansi, hujjat soni |
| `backend/internal/warehouse/sales.go`, `customer_payments.go`, `customer_openings.go`, `customer_statement.go`, `documents.go`, `statements.go`, `suppliers.go` (+testlar) | servis |
| `backend/internal/customer/customers.go` (+test) | balans, `customer_in_use` hujjat |
| `backend/internal/app/sales.go`, `customers.go`, `handler.go` (+`sales_test.go`, `customers_test.go`, `permissions_test.go`) | API |
| `backend/openapi.yaml`, `packages/api-client` | kontrakt |
| `apps/web/mocks/sales.ts` (yangi), `customers.ts`, `ledger.ts`, `data.ts`, `handlers.ts` (+`handlers.test.ts`), `lib/types.ts` | mock |
| `docs/superpowers/specs/2026-10-11-ledger-design.md` | «7-bosqich qarorlari» |

---

### Task 1: So'rovlar (+`internal/db` testlari)

`GetSale(id, company_id, location_ids)`: bosh (`l.id`, `l.name`, `customer_id`, `customer_name`, `doc_at`, `currency_id`, `rate`, `total`, `total_uzs`, `paid`, `items_count`, `note`, kim, qachon); `ListSales` / `CountSales(company_id, location_ids, customer_id::bigint)` (`doc_at DESC, id DESC`). `ListPartyBalanceByCurrency(party, party_id)`, `ListPartyStatement` / `CountPartyStatement(party, party_id, company_id, limit, offset)` — `ListSupplier*` o'rniga (`warehouse/statements.go`, `suppliers.go` moslanadi). `GetCustomerPayment` / `ListCustomerPayments` / `CountCustomerPayments(customer_id, company_id)`: `customer_payment`, `customer_id IS NOT NULL`, `sale_number` bog'langanidan. `GetCustomerOpening` / `ListCustomerOpenings` / `CountCustomerOpenings`. `GetCustomer` / `ListCustomers`: `balance` (so'mda, har hujjat o'z kursi bilan). `CountCustomerDocuments(customer_id)` (jonli `sale`, `customer_payment`, `customer_debt`, `customer_prepay`). `make sqlc`; testlar: sotuv `paid`, mijoz nomi va chakana, `party` hisob harakati ikkala tomon uchun, mijoz balansi, hujjat soni.

### Task 2: Sotuv servisi (`sales.go`, testlar)

`Sale{ID, Number, LocationID, LocationName, CustomerID *int64, CustomerName *string, At, CurrencyID, Rate, Note, Total, TotalUZS, Paid, ItemsCount, CreatedByName, CreatedAt, UpdatedAt, Items []Item, Payments []LinkedPayment}`, `SaleInput{CustomerID *int64, At, CurrencyID, Rate, Note, Items []ItemInput, Payments []ledger.PaymentLine}`, `SaleListInput{LocationID, CustomerID, Page}`. `checkSale` tartibi (logic/sales.md, 3.2): mijoz (`GetCustomer`; «Mijozni tanlang»), vaqt, valyuta va kurs, izoh, qatorlar (`checkLines` `AllowService`, narx bilan; «Mahsulotni tanlang», «Mahsulot nofaol», ikki marta, miqdor, narx), to'lovlar (`WriteLinkedPayments` tekshiradi; chakanada yig'indi (hujjat valyutasiga aylantirilgan) jamiga teng — `convert_amount` bilan servisda yoki so'rov: `PaidOf`). Harakatlar faqat mahsulot qatorlariga (`ledger.MovesOf(Sale, …)` mahsulot qatorlari bilan). `ListSales`, `GetSale`, `CreateSale`, `UpdateSale` (mijoz almashsa / olib tashlansa), `DeleteSale` (harakatlar o'chadi, bog'langan to'lovlar yashirinadi). Testlar: qo'shish (mijozli qarz, chakana to'liq, xizmat qatori harakatsiz, USD), rad javoblari tartibi, 409 qoldiq, ro'yxat (lokatsiya / mijoz), tahrir (miqdor oshdi → 409; mijoz olib tashlandi → to'liq to'langan bo'lsin), o'chirish (qoldiq qaytadi, to'lovlar yo'qoladi), raqam bo'shamaydi, atomiklik (`FailInserts("stock_moves")`).

### Task 3: Mijoz to'lovlari, boshlang'ich qarz / avans, hisob harakati (testlar)

`customer_payments.go`: `CustomerPayment{…, CustomerID, SaleID, SaleNumber}`, `ListCustomerPayments`, `AddCustomerPayment`, `UpdateCustomerPayment` (bog'langani 409 `payment_linked` «Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang»), `DeleteCustomerPayment` (404 «To'lov topilmadi»). `customer_openings.go`: `CustomerOpening{…, CustomerID}`, `ListCustomerOpenings`, `AddCustomerOpening`, `UpdateCustomerOpening` («Tur o'zgartirilmaydi»), `DeleteCustomerOpening` (404 «Hujjat topilmadi»). `customer_statement.go`: `CustomerStatement(companyID, customerID, page)` (mijoz 404 «Mijoz topilmadi»). `internal/customer`: `Customer.Balance *string` (so'm), `BalanceByCurrency []BalanceLine` (`Get`), ro'yxat qatorida `Balance`; `Delete` → `CountCustomerDocuments` 409 «Bu mijozda N ta hujjat bor» (vazifa tekshiruvidan keyin). Testlar har biriga.

### Task 4: API, kontrakt, client, mock

`internal/app/sales.go`: `saleJSON{customer: Ref|null, …}`, `saleInputJSON`, `saleCreateJSON`, `customerPaymentJSON{customer_id, sale_id, sale_number, …}`, `customerOpeningJSON`, statement (umumiy `statementRowJSON`); route'lar `allowed(access.Sales*)`: `GET/POST /app/sales`, `GET/PUT/DELETE /app/sales/{id}`, `GET/POST /app/customers/{id}/payments`, `PUT/DELETE …/{paymentId}`, `GET/POST /app/customers/{id}/openings`, `PUT/DELETE …/{openingId}`, `GET /app/customers/{id}/statement`. `customers.go`: `balance` (`sales.view` bilan), `balance_by_currency` detailda. `sales_test.go`, `customers_test.go`, `permissions_test.go`. `openapi.yaml` + `make api-client`. Mock: `mocks/sales.ts` (sotuv Go qoidalarida: chakana to'liq, xizmat harakatsiz; mijoz to'lovlari va boshlang'ich; hisob harakati `party`), `mocks/customers.ts` balans, `mocks/ledger.ts` `balanceOf(party, id)` / `statementOf(party, id)`; `handlers.test.ts`. `make lint`, `make test`, `make e2e`; spec «7-bosqich qarorlari»; push.
