# Jurnal, 8-bosqich: sotuv UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Sotuv» bo'limi (`/sales`: ro'yxat, sotuv sahifasi, qo'shish va tahrirlash formalari, o'chirish), mijoz sahifasida balans kartasi, «Hisob harakati», to'lov va boshlang'ich qarz / avans dialoglari, mijozlar ro'yxatida «Qarz» ustuni; mahsulot harakatlarida sotuv havolasi. 7-bosqich API'si va mocklari ustida; Vitest va e2e.

**Architecture:**
- **Nav** (`lib/nav.ts`): «Sotuv» bo'limi (`sales`, `/sales`, `ShoppingCartIcon`, `sales.view`) Mahsulotlardan keyin, Ombordan oldin (4-bosqich qarori: bo'lim sahifasi bilan birga keladi). `shell.spec.ts` va `nav.test.ts` bo'limlar ro'yxati sakkizta.
- **Lib**: `lib/sales.ts` (zod `saleSchema` = xarid sxemasi mijoz bilan (`customer_id` ixtiyoriy, `customer_name`), `saleDefaults`, `customerBalanceText`), `lib/stock.ts` `documentHref("sale")` → `/sales/{id}`; `lib/queries.ts` (`salesKey/useSales`, `saleKey/useSale`, `customerStatementKey/useCustomerStatement`, `customerPaymentsKey`), `forgetWarehouse` += `sales`, `sale`, `customers`, `customer`, `customer-statement`, `customer-payments`.
- **Umumiy bo'laklar**: `PaymentsField` (xarid formasiniki) `form` turi bo'yicha umumiylashadi (`PurchaseForm` → qatorlari `payments: PaymentLineForm[]` bo'lgan istalgan forma), `StatementList` `party` oladi (`supplier` | `customer`: so'rov, dialoglar, qator havolalari «Sotuv № N»), `PaymentDialog` va `OpeningDialog` `party` oladi (endpoint va kalitlar).
- **Sahifalar**: `components/sales/sales-page.tsx` («№ 3 · Mijoz» yoki «№ 3 · Chakana», vaqt · N ta mahsulot; Jami, To'langan, Qo'shgan), `sale-form.tsx` (`CustomerPicker` ixtiyoriy + «Chakana sotuv» holati, vaqt, `CurrencyField`, `LinesField` narx bilan va xizmat ham (`ProductPicker` `kind` filtrsiz — takliflar `kind=product` va `kind=service`), narx taklifi `products.price` valyutasiga qarab, `PaymentsField`, mijozsiz «To'liq to'langan bo'lishi shart» eslatmasi, izoh), `new-sale-page.tsx`, `edit-sale-page.tsx`, `sale-page.tsx` (Mijoz havola / «Chakana», Vaqt, Lokatsiya (2+), Valyuta, Jami, So'mda, To'langan, Izoh, Qo'shgan, Qo'shilgan; Qatorlar; To'lovlar), `delete-sale-button.tsx`; `components/customers/customer-page.tsx` (balans kartasi `sales.view` bilan, «Hisob harakati» `StatementList party="customer"`), `customers-page.tsx` «Qarz» ustuni (`balance` `null` bo'lmasa; `columns-menu`).
- **Route'lar**: `app/(app)/sales/{page,new/page,[id]/page,[id]/edit/page}.tsx`.

Qoidalar: `logic/sales.md` (hammasi), `logic/customers.md` (2-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`, CRUD va select dizayn hujjatlari.

---

## Kelishuvlar

- Mijoz tanlovi `CustomerPicker` (mijozlar bo'limidagi telefon takliflari `GET /app/customers?phone=` va nom bo'yicha qidiruv `?search=`): kiritilganiga qarab raqam yoki matn; tanlanmagan holda forma «Chakana sotuv» deb ko'rsatadi va to'lov maydoni «To'liq» bilan jamiga tenglashtiriladi.
- Xizmat qatori: `ProductPicker` sotuvda `kind` bermaydi (ikkala tur), takliflar `kind=product` + `kind=service` ikki so'rov emas — API `kind` berilmasa mahsulotlarni qaytaradi (hozirgi `listProducts`: standart `product`); shuning uchun `useProductSuggestions(companyId, text, kinds)` xizmatlar uchun ikkinchi so'rov yuboradi va natijalar birlashtiriladi (mahsulotlar avval).
- Narx taklifi sotuvda mahsulotning sotuv narxi (`products.price`, `currency_id`), xizmatda xizmat narxi; `last_price` emas.
- Mijozlar ro'yxatida «Qarz» ustuni `balance` bo'lmaganga chizilmaydi; qiymat «Qarz: N so'm» / «Avans: N so'm» / «—».
- Mijoz sahifasidagi dialoglar ta'minotchinikining `party="customer"` varianti; hisob harakati qatorida sotuv havolasi `/sales/{id}`, to'lov va boshlang'ich qatorlarida tahrirlash / o'chirish (`sales.edit` / `sales.delete`).
- Talab o'zgargani uchun o'zgargan testlar: `nav.test.ts`, `shell.spec.ts` (bo'limlar sakkizta: «Sotuv» Mahsulotlardan keyin), `customers-page.test.tsx` ustunlar.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `apps/web/lib/nav.ts` (+test), `lib/sales.ts` (yangi, +test), `lib/stock.ts` (+test), `lib/queries.ts` | bo'lim, sxemalar, hooklar |
| `apps/web/components/warehouse/payments-field.tsx`, `statement-list.tsx`, `payment-dialog.tsx`, `opening-dialog.tsx`, `delete-payment-button.tsx`, `delete-opening-button.tsx`, `pickers.tsx` (+testlar) | `party`, xizmat takliflari |
| `apps/web/components/sales/*.tsx` (yangi, +testlar), `components/customers/customer-page.tsx`, `customers-page.tsx` (+testlar) | sahifalar |
| `apps/web/app/(app)/sales/**` | route'lar |
| `apps/web/e2e/sales.spec.ts` (yangi), `shell.spec.ts`, `roles.spec.ts` | e2e |
| `docs/superpowers/specs/2026-10-11-ledger-design.md` | «8-bosqich qarorlari» |

---

### Task 1: Bo'lim, sxemalar, hooklar

`nav.ts`: `{ key: "sales", label: "Sotuv", href: "/sales", icon: ShoppingCartIcon, permission: "sales.view" }` Mahsulotlardan keyin; `nav.test.ts` (`labels(allPermissions)` sakkizta; `defaultPermissions` bilan ham; `isCurrentItem("sales", "/sales/3/edit")`). `lib/sales.ts`: `saleSchema` (`customer_id: z.number().int().min(0)`, `customer_name`, `at`, `currency_id`, `rate`, `note`, `items: lineSchema`, `payments`) → `{customer_id: null | id, at, currency_id, rate, note, items, payments}`; `SaleForm`, `SaleOutput`, `saleDefaults(sale | null, local)`, `customerBalanceText(balance)` (= `balanceText`), `lib/sales.test.ts`. `documentHref("sale", id)` → `/sales/${id}` (`lib/stock.test.ts` yangilanadi; mahsulot harakatlari sotuvga havola beradi). `queries.ts`: `salesKey/useSales(companyId, {locationId, customerId, page})`, `saleKey/useSale`, `customerStatementKey/useCustomerStatement(companyId, customerId, page)`; `forgetWarehouse` kengayadi. Commit.

### Task 2: Umumiy bo'laklar `party` bilan

`PaymentsField` generik forma turi; `StatementList({ party, companyId, partyId, ... })`: so'rov (`useStatement` / `useCustomerStatement`), `titleOf` sotuv havolasi («Sotuv № N», `/sales/{id}`), `customer_payment` / `customer_debt` / `customer_prepay` nomlari («To'lov», «Boshlang'ich qarz», «Boshlang'ich avans»), qator amallari `PaymentDialog party` / `OpeningDialog party`; `DeletePaymentButton` / `DeleteOpeningButton` `party` (endpoint `/app/customers/{id}/payments/...`). Testlar yangilanadi va mijoz varianti qo'shiladi. `ProductPicker` `kinds` prop (`["product"]` standart; sotuvda `["product", "service"]`), `useProductSuggestions(companyId, text, kinds)`. Commit.

### Task 3: Sotuv sahifalari

`sales-page.tsx` (joriy lokatsiya, `usePageFilter`, `SectionTabs` yo'q — bo'limda bitta sahifa), `sale-form.tsx`, `new-sale-page.tsx` (`sales.create` + `products.view`; `customers.view` bo'lmasa mijoz tanlovi yo'q: faqat chakana), `edit-sale-page.tsx`, `sale-page.tsx`, `delete-sale-button.tsx`; route'lar; testlar (ro'yxat, forma: mijozli va chakana, xizmat qatori, narx taklifi, to'liq to'lov eslatmasi, xatolar, 409; sahifa; tahrir; o'chirish; 404; ruxsatsiz). Commit.

### Task 4: Mijoz sahifasi va ro'yxati

`customer-page.tsx`: balans kartasi (`balanceText`, valyuta bo'yicha «shu jumladan …»), `StatementList party="customer"` (`sales.view`), «To'lov qo'shish», «Boshlang'ich qarz / avans» (`sales.create`); `customers-page.tsx` «Qarz» ustuni; testlar. Commit.

### Task 5: Yakun

`e2e/sales.spec.ts`: egasi mijozga sotuv (xizmat qatori, qisman to'lov) → mijoz sahifasida qarz va hisob harakati → to'lov → chakana sotuv («To'liq») → sotuv sahifasi, tahrir, o'chirish → mahsulot harakatlarida sotuv havolasi; `shell.spec.ts` bo'limlar; `roles.spec.ts` (`sales.*` bo'lmaganga «Sotuv» yo'q). `make lint`, `make test`, `make e2e`; spec «8-bosqich qarorlari»; push.
