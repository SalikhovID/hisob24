# Ombor, 5-bosqich: ombor UI (ta'minotchilar, xaridlar, to'lovlar, qoldiq) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User app'da «Ombor» bo'limi ishlaydi: `/suppliers` (ro'yxat, qo'shish/tahrirlash dialogi, nofaol, o'chirish), `/suppliers/[id]` (balans kartasi, xaridlar, to'lovlar va to'lov dialogi), `/purchases` (joriy lokatsiya xaridlari), `/purchases/new` va `/purchases/[id]/edit` (forma: ta'minotchi va mahsulot tanlovchilari, qatorlar, to'langan, «To'liq»), `/purchases/[id]` (sahifa, qatorlar, o'chirish); mahsulotlar ro'yxatida «Qoldiq» (joriy lokatsiya), mahsulot sahifasida oxirgi xarid narxi, qoldiq lokatsiyalar bo'yicha va xaridlar. Vitest + e2e, README.

**Architecture:**
- **Formalar va yordamchilar:** `lib/warehouse.ts` (zod: `supplierSchema`, `paymentSchema`, `purchaseSchema`; `lineAmount`, `purchaseTotal`, `balanceText`), `lib/format.ts` (`formatQuantity`), `lib/queries.ts` (ta'minotchi, to'lov, xarid, mahsulot xaridlari hook'lari va invalidatsiyalar; `ProductFilter.locationId`).
- **Tanlovchi:** `components/picker.tsx` — nom bo'yicha qidiradigan combobox (`CustomerPicker` naqshi: 300 ms, 5 taklif, klaviatura, `role="combobox"`/`listbox`), tanlangani chip, «×» bilan bo'shaydi. Ta'minotchi va mahsulot uchun ikki o'rash: `SupplierPicker`, `ProductPicker` (`components/warehouse/pickers.tsx`).
- **Sahifalar:** `components/warehouse/*` (`suppliers-page`, `supplier-dialog`, `supplier-active-button`, `delete-supplier-button`, `supplier-page`, `supplier-purchases`, `supplier-payments`, `payment-dialog`, `delete-payment-button`, `purchases-page`, `use-purchase-filter`, `purchase-form`, `new-purchase-page`, `edit-purchase-page`, `purchase-page`, `delete-purchase-button`), `components/catalog/catalog-page.tsx` («Qoldiq»), `product-page.tsx` (oxirgi narx, qoldiq, xaridlar: `product-stock.tsx`, `product-purchases.tsx`), route'lar `app/(app)/{suppliers,purchases}/…`.
- **Filtr:** `/suppliers` `useCatalogFilter` ni qayta ishlatadi (status/search/page, bir xil shakl); `/purchases` faqat `page` (`usePurchaseFilter`), lokatsiya `useLocation` dan (vazifalar kabi, lokatsiya almashsa 1-sahifa).
- **Mock va testlar:** `mocks/data.ts` ga `seedWarehouse()`; Vitest har komponent uchun; e2e `warehouse.spec.ts` (375px va desktop); vaqtinchalik skrinshot spec'i.

**Tech Stack:** Next.js 16, React, TanStack Query, react-hook-form (`useFieldArray`) + zod, shadcn/Base UI, Vitest + RTL, Playwright, MSW.

Qoidalar: `logic/warehouse.md`, `logic/products.md` (5, 6), `logic/locations.md` (7), `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md` (`DataList`, `PageHeader`, `Fact`), `…/2026-10-06-selects-settings-tabs-pager-design.md` (`SelectBox`, `Pager`). Dizayn: `docs/superpowers/specs/2026-10-07-inventory-design.md`.

---

## Kelishuvlar

- Vitest: `cd apps/web && pnpm exec vitest run <fayl>`; RED = komponent yo'q (`Failed to resolve import`) emas, balki stub bilan mantiqiy yiqilish — bu bosqichda komponent fayli test bilan birga yoziladi, test avval ishga tushiriladi (import xatosi RED hisoblanadi, 3-bosqichdagi kelishuv: yangi fayl uchun import yo'qligi tabiiy RED).
- Har GREEN'dan keyin `pnpm lint`, `pnpm typecheck`, commit (faqat o'z fayllari). Commit xabarlari inglizcha.
- Matnlar: «Ta'minotchi», «Ta'minotchilar», «Xarid», «Xaridlar», «Xarid № 12», «Qoldiq», «To'lov», «To'lovlar», «Qarz», «Avans», «Qarz yo'q», «To'langan», «To'liq», «Jami», «Oxirgi xarid narxi», «Sizga lokatsiya biriktirilmagan», «Hali ta'minotchi yo'q», «Hali xarid yo'q», «Bu ta'minotchida to'lov yo'q», «Bu ta'minotchida xarid yo'q», «Bu mahsulot hali xarid qilinmagan».
- Pul faktlarda «1 200 000 so'm» (`formatAmount` + « so'm»), ustunlarda sarlavha birlikni aytadi («Jami, so'm»). Miqdor `formatQuantity(q, unit)`: «1,5 kg», «12 dona» (ortiqcha nollar tashlanadi, vergul kasr).
- Tanlovchi qidiruvi faqat faollarni oladi (`status=active`), 300 ms kechikish, 5 taklif; mahsulot taklifida birlik va oxirgi narx (bo'lsa).
- Sanalar `type="date"` (jsdom'da `fireEvent.change`/`user.type` bilan — `frontend-test-gotchas`); formada bugun `localToday()` (mock'dagi kabi, `lib/dates.ts` da bo'lsa shu, bo'lmasa `new Date()` dan YYYY-MM-DD).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `apps/web/lib/format.ts` (+test) | `formatQuantity` |
| `apps/web/lib/warehouse.ts` (+test) | sxemalar, `lineAmount`, `purchaseTotal`, `balanceText`, `supplierDefaults`, `paymentDefaults`, `purchaseDefaults` |
| `apps/web/lib/queries.ts` | `suppliersKey`, `useSuppliers`, `supplierKey`, `useSupplier`, `useSupplierSuggestions`, `paymentsKey`, `usePayments`, `purchasesKey`, `usePurchases`, `purchaseKey`, `usePurchase`, `productPurchasesKey`, `useProductPurchases`, `useProductSuggestions`; `ProductFilter.locationId` |
| `apps/web/mocks/data.ts` | `seedWarehouse()` |
| `apps/web/components/picker.tsx` (+test) | umumiy tanlovchi |
| `apps/web/components/warehouse/pickers.tsx` (+test) | `SupplierPicker`, `ProductPicker` |
| `apps/web/components/warehouse/suppliers-page.tsx`, `supplier-dialog.tsx`, `supplier-active-button.tsx`, `delete-supplier-button.tsx` (+testlar) | ta'minotchilar |
| `apps/web/components/warehouse/supplier-page.tsx`, `supplier-purchases.tsx`, `supplier-payments.tsx`, `payment-dialog.tsx`, `delete-payment-button.tsx` (+testlar) | ta'minotchi sahifasi |
| `apps/web/components/warehouse/purchases-page.tsx`, `use-purchase-filter.ts`, `purchase-form.tsx`, `new-purchase-page.tsx`, `edit-purchase-page.tsx`, `purchase-page.tsx`, `delete-purchase-button.tsx` (+testlar) | xaridlar |
| `apps/web/components/catalog/catalog-page.tsx`, `product-page.tsx`, `product-stock.tsx`, `product-purchases.tsx` (+testlar) | qoldiq, oxirgi narx, xaridlar |
| `apps/web/app/(app)/suppliers/page.tsx`, `suppliers/[id]/page.tsx`, `purchases/page.tsx`, `purchases/new/page.tsx`, `purchases/[id]/page.tsx`, `purchases/[id]/edit/page.tsx`, `proxy.test.ts` | route'lar |
| `apps/web/e2e/warehouse.spec.ts`, `catalog.spec.ts` | e2e |
| `README.md` | «Mahsulotlar va xizmatlar», «Ombor», menyu tartibi |

---

### Task 1: `formatQuantity`, `lib/warehouse.ts`, so'rov hook'lari, `seedWarehouse`

**Files:** Modify `apps/web/lib/format.ts`, `format.test.ts`, `lib/queries.ts`, `mocks/data.ts`; Create `lib/warehouse.ts`, `lib/warehouse.test.ts`.

- [ ] **Test** (`format.test.ts` ga):

```ts
test("formatQuantity writes a quantity with its unit, the decimals without the trailing zeros", () => {
  expect(formatQuantity("12.000", "dona")).toBe("12 dona")
  expect(formatQuantity("1.500", "kg")).toBe("1,5 kg")
  expect(formatQuantity("0.125", "l")).toBe("0,125 l")
  expect(formatQuantity("1200.000", "m2")).toBe("1 200 m²")
  expect(formatQuantity("0.000", "kg")).toBe("0 kg")
  expect(formatQuantity("3.000", null)).toBe("3")
})
```

`warehouse.test.ts`:

```ts
import { describe, expect, test } from "vitest"
import { balanceText, lineAmount, paymentSchema, purchaseDefaults, purchaseSchema, purchaseTotal, supplierSchema } from "./warehouse"

test("the supplier form: the name trimmed, the phone as digits or null, the note or null", () => {
  expect(supplierSchema.parse({ name: " Bozor ", phone: "90 123 45 67", note: " " })).toEqual({ name: "Bozor", phone: "998901234567", note: null })
  expect(supplierSchema.parse({ name: "Bozor", phone: "", note: "Chorsu" })).toEqual({ name: "Bozor", phone: null, note: "Chorsu" })
  expect(supplierSchema.safeParse({ name: " ", phone: "", note: "" }).error?.issues[0].message).toBe("Nomni kiriting")
  expect(supplierSchema.safeParse({ name: "a".repeat(121), phone: "", note: "" }).error?.issues[0].message).toBe("Nom 120 belgidan oshmasin")
  expect(supplierSchema.safeParse({ name: "X", phone: "90 12", note: "" }).error?.issues[0].message).toBe("Telefon raqami noto'g'ri")
  expect(supplierSchema.safeParse({ name: "X", phone: "", note: "x".repeat(501) }).error?.issues[0].message).toBe("Izoh 500 belgidan oshmasin")
})

test("the payment form: an amount above zero as typed, a day, a note", () => {
  expect(paymentSchema.parse({ amount: "1 200,5", paid_on: "2026-10-07", note: "" })).toEqual({ amount: "1200.5", paid_on: "2026-10-07", note: null })
  expect(paymentSchema.safeParse({ amount: "", paid_on: "2026-10-07", note: "" }).error?.issues[0].message).toBe("Summani kiriting")
  expect(paymentSchema.safeParse({ amount: "0", paid_on: "2026-10-07", note: "" }).error?.issues[0].message).toBe("Summa noto'g'ri")
  expect(paymentSchema.safeParse({ amount: "1.005", paid_on: "2026-10-07", note: "" }).error?.issues[0].message).toBe("Summa noto'g'ri")
  expect(paymentSchema.safeParse({ amount: "1", paid_on: "", note: "" }).error?.issues[0].message).toBe("Sanani kiriting")
})

describe("the purchase form", () => {
  const line = (product_id: number, quantity: string, price: string) => ({ product_id, quantity, price })
  test("is turned into what the API takes: the lines with their numbers as typed, what was paid, the note", () => {
    expect(purchaseSchema.parse({ supplier_id: 3, purchased_on: "2026-10-07", note: " Ertalab ", paid: "5 000", items: [line(1, "12,5", "1 000"), line(2, "3", "2500,5")] })).toEqual({
      supplier_id: 3,
      purchased_on: "2026-10-07",
      note: "Ertalab",
      paid: "5000",
      items: [line(1, "12.5", "1000"), line(2, "3", "2500.5")],
    })
    expect(purchaseSchema.parse({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [line(1, "1", "1")] })).toMatchObject({ paid: null, note: null })
  })
  test("tells what is wrong where it is wrong", () => {
    const bad = (input: unknown) => purchaseSchema.safeParse(input).error?.issues.map((i) => [i.path.join("."), i.message])
    expect(bad({ supplier_id: 0, purchased_on: "2026-10-07", note: "", paid: "", items: [line(1, "1", "1")] })).toEqual([["supplier_id", "Ta'minotchini tanlang"]])
    expect(bad({ supplier_id: 3, purchased_on: "", note: "", paid: "", items: [line(1, "1", "1")] })).toEqual([["purchased_on", "Sanani kiriting"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [] })).toEqual([["items", "Kamida bitta mahsulot qo'shing"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [line(0, "1", "1")] })).toEqual([["items.0.product_id", "Mahsulotni tanlang"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [line(1, "0", "1")] })).toEqual([["items.0.quantity", "Miqdor noto'g'ri"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [line(1, "1", "x")] })).toEqual([["items.0.price", "Narx noto'g'ri"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "-1", items: [line(1, "1", "1")] })).toEqual([["paid", "To'langan summa noto'g'ri"]])
    expect(bad({ supplier_id: 3, purchased_on: "2026-10-07", note: "", paid: "", items: [line(1, "1", "1"), line(1, "2", "1")] })).toEqual([["items.1.product_id", "Bu mahsulot allaqachon kiritilgan"]])
  })
  test("the amounts on screen: a line, the total", () => {
    expect(lineAmount("12,5", "1 000")).toBe("12500")
    expect(lineAmount("3", "2500,5")).toBe("7501.5")
    expect(lineAmount("x", "1")).toBeNull()
    expect(purchaseTotal([{ quantity: "12,5", price: "1 000" }, { quantity: "3", price: "2500,5" }, { quantity: "x", price: "1" }])).toBe("20001.5")
  })
  test("defaults: today, no lines but one empty, nothing paid; or the purchase being edited", () => {
    expect(purchaseDefaults(null, "2026-10-07")).toEqual({ supplier_id: 0, supplier_name: "", purchased_on: "2026-10-07", note: "", paid: "", items: [{ product_id: 0, product_name: "", unit: null, quantity: "", price: "" }] })
  })
})

test("balanceText says what is owed", () => {
  expect(balanceText("15001.50")).toEqual({ kind: "debt", text: "Qarz: 15 001,50 so'm" })
  expect(balanceText("-4998.50")).toEqual({ kind: "advance", text: "Avans: 4 998,50 so'm" })
  expect(balanceText("0.00")).toEqual({ kind: "none", text: "Qarz yo'q" })
})
```

(`purchaseDefaults` tahrir holati komponent testida.) Qidiruvdagi `supplier_name` / `product_name` / `unit` forma holatida tanlovchining chip'i uchun; sxema ularni tashlab yuboradi (`z.object` strict emas: `.strip()` standart).

- [ ] **RED** → **Kod.** `format.ts`:

```ts
// formatQuantity writes a stored quantity ("1.500") with its unit for
// people to read: thousands apart, the decimals after a comma without the
// trailing zeros ("1,5 kg", "12 dona"); no unit, no suffix.
export function formatQuantity(quantity: string, unit: string | null): string {
  const [whole, decimals = ""] = quantity.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const trimmed = decimals.replace(/0+$/, "")
  const number = trimmed ? `${grouped},${trimmed}` : grouped
  return unit ? `${number} ${unitLabel(unit)}` : number
}
```

`lib/warehouse.ts`: `amount` (katalogdagi `price` kabi: bo'shliqlar tashlanadi, vergul → nuqta, regex 12/2) umumiy; `supplierSchema` (name; phone: `phoneDigits` — `lib/phone.ts` da bor bo'lsa shu: 9 raqam → 998…, bo'sh → null, boshqa → «Telefon raqami noto'g'ri»; note); `paymentSchema` (amount: bo'sh → «Summani kiriting», regex yoki 0 → «Summa noto'g'ri»; paid_on: bo'sh → «Sanani kiriting»; note); `purchaseSchema` (`supplier_id` `z.number().int().positive("Ta'minotchini tanlang")`, `purchased_on` bo'sh → «Sanani kiriting», note, `paid` ixtiyoriy «To'langan summa noto'g'ri», `items` `z.array(lineSchema).min(1, "Kamida bitta mahsulot qo'shing")` + `superRefine` takror mahsulot → `items.<i>.product_id` «Bu mahsulot allaqachon kiritilgan»; `lineSchema`: `product_id` positive «Mahsulotni tanlang», `quantity` (bo'shliqsiz, vergul → nuqta, `^\d{1,9}(\.\d{1,3})?$` va > 0) «Miqdor noto'g'ri», `price` «Narx noto'g'ri»); `lineAmount(quantity, price): string | null` (sonlar matndan, `(q*p)` 2 kasrga yaxlitlanib `String`), `purchaseTotal(lines)`; `balanceText(balance)`; `supplierDefaults(s?)`, `paymentDefaults(p?, today)`, `purchaseDefaults(p: PurchaseDetail | null, today)`; tiplar `SupplierForm/Output`, `PaymentForm/Output`, `PurchaseForm/Output`, `LineForm`.

`queries.ts`:

```ts
export const suppliersKey = (companyId: number | null) => ["suppliers", companyId] as const
export interface SupplierFilter { status: "active" | "inactive"; search: string; page: number }
export function useSuppliers(companyId, filter) // GET /app/suppliers, keepPreviousData
export const supplierKey = (companyId, id) => ["supplier", companyId, id] as const
export function useSupplier(companyId, id)
export function useSupplierSuggestions(companyId, text) // enabled text.trim().length >= 1; GET /app/suppliers?status=active&search=
export const paymentsKey = (companyId, supplierId) => ["payments", companyId, supplierId] as const
export function usePayments(companyId, supplierId, page)
export const purchasesKey = (companyId) => ["purchases", companyId] as const
export interface PurchaseFilter { locationId: number | null; supplierId: number | null; page: number }
export function usePurchases(companyId, filter) // location_id/supplier_id only when set
export const purchaseKey = (companyId, id) => ["purchase", companyId, id] as const
export function usePurchase(companyId, id)
export const productPurchasesKey = (companyId, id) => ["product-purchases", companyId, id] as const
export function useProductPurchases(companyId, id, page)
export function useProductSuggestions(companyId, text) // GET /app/products?kind=product&status=active&search=
```

`ProductFilter` += `locationId: number | null` → `location_id` faqat berilganda. Invalidatsiya qoidasi (komponentlarda): xarid yozuvi → `purchasesKey`, `productsKey`, `productKey`lar, `suppliersKey`, `supplierKey`, `paymentsKey`, `productPurchasesKey`; to'lov yozuvi → `paymentsKey`, `suppliersKey`, `supplierKey`.

`mocks/data.ts`:

```ts
// seedWarehouse enters what the warehouse pages are tested with into Olma
// Savdo: the suppliers Bozor (with a phone) and Dehqon (inactive), and,
// when the catalog is seeded first (olma, nok), purchase № 1 in Asosiy by
// Ali (12.5 kg of Olma at 1000, 3 Nok at 2500.5, 5000 paid with it) and
// its stock.
export function seedWarehouse(products?: { olma: ProductRow; nok: ProductRow }) {
  const at = now()
  const supplier = (fields: Partial<SupplierRow> & { name: string }): SupplierRow => { ...push... }
  const bozor = supplier({ name: "Bozor", phone: "998901234567", note: "Chorsu" })
  const dehqon = supplier({ name: "Dehqon", active: false })
  let purchase: PurchaseRow | undefined
  if (products) {
    const asosiy = db.locations.find((l) => l.companyId === 1 && !l.deleted)!
    purchase = { id: nextId(), companyId: 1, number: 1, locationId: asosiy.id, supplierId: bozor.id, purchasedOn: "2026-10-01", note: "Ertalab",
      items: [{ productId: products.olma.id, quantity: 12.5, price: 1000 }, { productId: products.nok.id, quantity: 3, price: 2500.5 }],
      by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at }
    db.purchases.push(purchase)
    db.stock.push({ companyId: 1, locationId: asosiy.id, productId: products.olma.id, quantity: 12.5 }, { companyId: 1, locationId: asosiy.id, productId: products.nok.id, quantity: 3 })
    db.payments.push({ id: nextId(), companyId: 1, supplierId: bozor.id, purchaseId: purchase.id, amount: 5000, paidOn: "2026-10-01", note: null, by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at })
  }
  return { bozor, dehqon, purchase }
}
```

- [ ] **GREEN**, `pnpm lint`, `pnpm typecheck`, commit `feat(web): the warehouse's forms, amounts and queries`.

### Task 2: `Picker` va `SupplierPicker` / `ProductPicker`

**Files:** Create `components/picker.tsx`, `picker.test.tsx`, `components/warehouse/pickers.tsx`, `pickers.test.tsx`.

- [ ] **Test** (`picker.test.tsx`, presentational):

```tsx
const items = [{ id: 1, name: "Bozor", meta: "+998 90 123 45 67" }, { id: 2, name: "Dehqon" }]

function Harness({ initial = null }: { initial?: { id: number; name: string } | null }) {
  const [typed, setTyped] = useState("")
  const [selected, setSelected] = useState(initial)
  return (
    <Picker
      label="Ta'minotchi"
      placeholder="Nom bo'yicha qidiring"
      listLabel="Ta'minotchi takliflari"
      typed={typed}
      onTyped={setTyped}
      items={typed.length > 0 ? items.filter((i) => i.name.toLowerCase().includes(typed.toLowerCase())) : []}
      selected={selected}
      onSelect={setSelected}
      onClear={() => setSelected(null)}
    />
  )
}

test("typing shows the matches; a click takes one, which stands as a chip the × clears", async () => {
  const { user } = renderWithProviders(<Harness />)
  const box = screen.getByRole("combobox", { name: "Ta'minotchi" })
  await user.type(box, "bo")
  const list = await screen.findByRole("listbox", { name: "Ta'minotchi takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Bozor+998 90 123 45 67"])
  await user.click(within(list).getByRole("option", { name: /Bozor/ }))
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(screen.getByText("Bozor")).toBeInTheDocument()
  expect(screen.queryByRole("combobox", { name: "Ta'minotchi" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Ta'minotchi: bekor qilish" }))
  expect(screen.getByRole("combobox", { name: "Ta'minotchi" })).toHaveValue("")
})

test("the keyboard walks the list: ArrowDown, Enter takes; Escape puts it away; nothing typed, nothing offered", async () => {
  const { user } = renderWithProviders(<Harness />)
  const box = screen.getByRole("combobox", { name: "Ta'minotchi" })
  await user.click(box)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.type(box, "d")
  await user.keyboard("{ArrowDown}{Enter}")
  expect(screen.getByText("Dehqon")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Ta'minotchi: bekor qilish" }))
  await user.type(screen.getByRole("combobox", { name: "Ta'minotchi" }), "o")
  await screen.findByRole("listbox")
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("a selection given at the start stands as a chip", () => {
  renderWithProviders(<Harness initial={{ id: 2, name: "Dehqon" }} />)
  expect(screen.getByText("Dehqon")).toBeInTheDocument()
})
```

`Picker` props: `{ id?, label, placeholder, listLabel, typed, onTyped(text), items: PickerItem[], selected: PickerItem | null, onSelect(item), onClear(), error?: string, disabled?, loading? }`, `PickerItem { id: number; name: string; meta?: string }`. Chip: `<div role="group" aria-label={label}>` ichida nom (`font-medium`), meta, `×` tugmasi `aria-label={`${label}: bekor qilish`}`. Combobox ko'rinmaydi chip turganda. `FieldError` `error` bilan. `pickers.test.tsx`: `SupplierPicker({ companyId, value: {id,name}|null, onChange })` — mock'da `seedWarehouse()` → «bo» yozilsa «Bozor» taklif (nofaol «Dehqon» «de» da yo'q); `ProductPicker` → `seedCatalog()`+`seedWarehouse(…)`: «ol» → «Olma» taklifida «kg · 1 000» (oxirgi narx), `onChange` mahsulot bilan (`{id, name, unit, last_price}`); xizmat «ye» da chiqmaydi; nofaol «Eski» yo'q.

- [ ] **RED** → **Kod** (`picker.tsx` `CustomerPicker` dan: `useId`, `open`/`active`, 300 ms debounce **tashqarida** (o'rashlar `useSupplierSuggestions(companyId, debounced)`), `onMouseDown preventDefault`). `pickers.tsx`: `useDebounced(text, 300)` yordamchisi (`lib/use-debounced.ts` yo'q bo'lsa shu faylda), `SupplierPicker`, `ProductPicker` (`meta`: `[unitLabel(unit), last_price && formatAmount(last_price)].filter(Boolean).join(" · ")`).

- [ ] **GREEN**, commit `feat(web): a picker that searches by name, for the suppliers and the products`.

### Task 3: Ta'minotchilar ro'yxati, dialogi, nofaol, o'chirish

**Files:** Create `components/warehouse/suppliers-page.tsx`, `supplier-dialog.tsx`, `supplier-active-button.tsx`, `delete-supplier-button.tsx` (+4 test), `app/(app)/suppliers/page.tsx`; Modify `proxy.test.ts`.

- [ ] **Test** (`suppliers-page.test.tsx`): egasi: `SectionTabs` «Ombor bo'limi» (Xaridlar, Ta'minotchilar), sarlavha «Ta'minotchilar», «Kompaniyangiz ta'minotchilari · 1 ta» (faol), jadval «Ta'minotchilar» ustunlari ["Ta'minotchi", "Telefon", "Qarz", "Qo'shgan", "Qo'shilgan"], Bozor qatori: havola `/suppliers/<id>`, «+998 90 123 45 67», qarz «—» (0; `seedWarehouse` to'lovsiz chaqirilganda) yoki «15 001,50» (katalog bilan: 20001.5 − 5000); «Nofaol» tabi → `?status=inactive` → Dehqon; qidiruv «bo» → `?search=bo`; `suppliers.view` + `purchases.view`siz rol: «Qarz» ustuni yo'q; «Ta'minotchi qo'shish» tugmasi `suppliers.create`; bo'sh: «Hali ta'minotchi yo'q», «Birinchi ta'minotchini «Ta'minotchi qo'shish» tugmasi orqali qo'shing.»; ruxsatsiz → `router.replace("/")`. `supplier-dialog.test.tsx`: qo'shish («Ta'minotchi qo'shish» → dialog, «Nomi», «Telefon» (PhoneField, +998), «Izoh», «Qo'shish» → toast «Ta'minotchi qo'shildi»); tahrir (`supplier` berilsa «Tahrirlash» / icon «Tahrirlash: Bozor», sarlavha «Ta'minotchini tahrirlash», «Saqlash» → «Ta'minotchi saqlandi»); 409 `Refusal`. `supplier-active-button.test.tsx`: «Nofaol qilish» → toast «Ta'minotchi nofaol qilindi»; «Faollashtirish» → «Ta'minotchi faollashtirildi». `delete-supplier-button.test.tsx`: alertdialog «Ta'minotchini o'chirasizmi?» «Bozor ro'yxatdan olib tashlanadi. Qayta tiklab bo'lmaydi.»; 409 toast «Bu ta'minotchida 1 ta xarid bor»; `afterDelete`.

- [ ] **RED** → **Kod.** `suppliers-page.tsx` `CatalogPage` naqshida (`useCatalogFilter`, `usePermission("suppliers.view")`, `useSuppliers`; «Qarz» ustuni `align: "end"`, `card: "aside"`, qiymat: `balance === null` → ustun chizilmaydi (birinchi yozuv bo'yicha emas, `allowed("purchases.view")` bo'yicha); qarz > 0 `text-destructive`, avans < 0 `text-success`/yashil «Avans N», 0 «—»); ro'yxatda qator amallari yo'q (sahifa bor). Dialog/nofaol/o'chirish `catalog` komponentlari naqshida (`iconAction`, `nounOf` o'rniga «Ta'minotchi»). Route `Suspense` bilan. `proxy.test.ts` ga `/suppliers`, `/suppliers/3`, `/purchases`, `/purchases/new`, `/purchases/3`, `/purchases/3/edit`.

- [ ] **GREEN**, commit `feat(web): the suppliers list, its dialog and actions`.

### Task 4: Ta'minotchi sahifasi: balans, xaridlar, to'lovlar, to'lov dialogi

**Files:** Create `components/warehouse/supplier-page.tsx`, `supplier-purchases.tsx`, `supplier-payments.tsx`, `payment-dialog.tsx`, `delete-payment-button.tsx` (+testlar), `app/(app)/suppliers/[id]/page.tsx`.

- [ ] **Test** (`supplier-page.test.tsx`, `seedCatalog()` + `seedWarehouse(catalog)`): sarlavha «Bozor», izoh «+998 90 123 45 67» (nofaolda «Nofaol» belgisi), orqaga «Ta'minotchilar» → `/suppliers`; amallar («Tahrirlash», «Nofaol qilish», «O'chirish») ruxsat bo'yicha; «Ma'lumot»: Telefon, Izoh («Chorsu»), Qo'shgan, Qo'shilgan; balans kartasi (`purchases.view`): «Qarz: 15 001,50 so'm», «Jami xaridlar» «20 001,50 so'm», «Jami to'lovlar» «5 000,00 so'm»; `suppliers.view` yolg'iz rolda balans, xaridlar va to'lovlar bo'limlari yo'q; «Xaridlar» bo'limi (`SupplierPurchases`): ro'yxat «Xaridlar», qator «№ 1», sana «01.10.2026», jami «20 001,50», to'langan «5 000,00», havola `/purchases/<id>`, 2+ lokatsiyada «Lokatsiya» belgisi, bo'sh «Bu ta'minotchida xarid yo'q»; «To'lovlar» bo'limi (`SupplierPayments`): ro'yxat «To'lovlar», bog'langan to'lov qatori: «01.10.2026», «5 000,00», havola «Xarid № 1» → `/purchases/<id>`, tahrirlash/o'chirish tugmalari yo'q; o'z to'lovi (testda dialog orqali qo'shiladi): «Tahrirlash: 1 200,50» va «O'chirish: 1 200,50» tugmalari; «To'lov qo'shish» tugmasi `purchases.create`; bo'sh «Bu ta'minotchida to'lov yo'q»; 404 → «Ta'minotchi topilmadi»; o'chirish → `router.replace("/suppliers")`. `payment-dialog.test.tsx`: «To'lov qo'shish» → dialog, maydonlar «Summa», «Sana» (bugun bilan to'la), «Izoh»; «Qo'shish» → toast «To'lov qo'shildi», balans yangilanadi (`supplierKey` invalidatsiya); tahrir «To'lovni tahrirlash», «Saqlash» → «To'lov saqlandi»; xatolar formada. `delete-payment-button.test.tsx`: «To'lovni o'chirasizmi?» → «To'lov o'chirildi».

- [ ] **RED** → **Kod.** `supplier-page.tsx` (`CustomerPage` naqshi; `useSupplier`; balans kartasi `rounded-xl border bg-card p-4` ichida `balanceText` (qarz `text-destructive`, avans yashil), ikki `Fact`-sifat qator); `supplier-purchases.tsx` (`usePurchases(companyId, {locationId: null, supplierId, page})`, `CustomerTasks` naqshi, `useLocation().locations` 2+ bo'lsa «Lokatsiya» ustuni); `supplier-payments.tsx` (`usePayments`; ustunlar «Sana», «Summa, so'm» (`align: "end"`), «Izoh», «Xarid» (bog'langan → `Link` «Xarid № N»), «Qo'shgan», «Amallar» (o'z to'lovida `PaymentDialog iconOnly` + `DeletePaymentButton iconOnly`)); `payment-dialog.tsx` (`paymentSchema`, `TextField` «Summa» `inputMode="decimal"`, `TextField type="date"` «Sana», «Izoh»; `useMutation` POST/PUT → invalidate `paymentsKey`, `supplierKey`, `suppliersKey`); `delete-payment-button.tsx`. Route `products/[id]` kabi.

- [ ] **GREEN**, commit `feat(web): the supplier page, with what is owed, the purchases and the payments`.

### Task 5: Xaridlar ro'yxati (joriy lokatsiya)

**Files:** Create `components/warehouse/purchases-page.tsx`, `use-purchase-filter.ts` (+testlar), `app/(app)/purchases/page.tsx`.

- [ ] **Test** (`purchases-page.test.tsx`): egasi: `SectionTabs` «Ombor bo'limi» (Xaridlar joriy), sarlavha «Xaridlar», izoh «Asosiy · 1 ta» (joriy lokatsiya nomi va soni), ro'yxat «Xaridlar» ustunlari ["Xarid", "Jami, so'm", "To'langan, so'm", "Qo'shgan"], qator: «№ 1 · Bozor», ostida «01.10.2026 · 2 ta mahsulot», havola `/purchases/<id>`, «20 001,50», «5 000,00», «Ali Valiyev»; «Xarid qo'shish» havolasi → `/purchases/new` (`purchases.create` + `suppliers.view` + `products.view` + lokatsiya); lokatsiya almashsa (ikkinchi lokatsiya Chilonzor tanlansa — `useLocation` `choose` localStorage orqali: testda `localStorage.setItem("location:1:<ALI>", String(chilonzor.id))`) ro'yxat bo'sh «Hali xarid yo'q»; lokatsiyasiz xodim: «Sizga lokatsiya biriktirilmagan», tugma yo'q; `?page=2` → `page: 2`; ruxsatsiz → `router.replace("/")`.

- [ ] **RED** → **Kod.** `use-purchase-filter.ts` (`page` only, `useCatalogFilter` naqshi); `purchases-page.tsx` (`TasksPage` naqshi: `useLocation`, `locationId`, `noLocation` kartasi, lokatsiya o'zgarsa `page 1`; `usePurchases(locationId !== null ? companyId : null, {locationId, supplierId: null, page})`; sarlavha izohi `${location.current.name} · N ta`; «Xarid qo'shish» `Link` `buttonVariants({ size: "lg" })` + `PlusIcon`). Route `Suspense`.

- [ ] **GREEN**, commit `feat(web): the purchases of the current location`.

### Task 6: Xarid formasi: yangi va tahrir

**Files:** Create `components/warehouse/purchase-form.tsx`, `new-purchase-page.tsx`, `edit-purchase-page.tsx` (+testlar), `app/(app)/purchases/new/page.tsx`, `purchases/[id]/edit/page.tsx`.

- [ ] **Test** (`purchase-form.test.tsx` orqali `NewPurchasePage`): egasi `/purchases/new`: sarlavha «Yangi xarid», izoh «Asosiy» (joriy lokatsiya), orqaga «Xaridlar»; ta'minotchi tanlovchisi «Ta'minotchi» («bo» → «Bozor» → chip); «Sana» bugun; qatorlar: 1 ta bo'sh qator (mahsulot tanlovchisi «Mahsulot», «Miqdor», «Narx», «Summa» «—»); «ol» → «Olma» (taklifda «kg · 1 000») tanlansa narx maydoniga «1000.00» tushadi (oxirgi narx), miqdor «2» → summa «2 000»; «Qator qo'shish» → ikkinchi qator («Nok», miqdor «3», narx «2500,5» → «7 501,5»), «Jami» «9 501,5»; «To'langan» bo'sh, «To'liq» → «9501.5»; «Izoh»; «Saqlash» → `POST /app/purchases` → toast «Xarid qo'shildi» → `router.push("/purchases/<id>")`; qatorsiz saqlash → «Kamida bitta mahsulot qo'shing»; ta'minotchisiz → «Ta'minotchini tanlang»; qatorni «Qatorni olib tashlash» tugmasi olib tashlaydi; API 400 → `Refusal`; lokatsiyasiz → «Sizga lokatsiya biriktirilmagan». `EditPurchasePage` (`edit-purchase-page.test.tsx`): `/purchases/<id>/edit`: sarlavha «Xarid № 1», izoh «Asosiy · 01.10.2026»? — sarlavha «Xaridni tahrirlash», izoh «№ 1 · Asosiy»; maydonlar to'la (Bozor chip, sana, 2 qator, to'langan «5000.00»); nofaol ta'minotchi/mahsulot chip bo'lib turadi; «Saqlash» → `PUT` → «Xarid saqlandi» → `router.push("/purchases/<id>")`; 404 → «Xarid topilmadi».

- [ ] **RED** → **Kod.** `purchase-form.tsx`: `PurchaseForm({ companyId, locationName, defaults, onSubmit: (out: PurchaseOutput) => Promise<void> | void, submitLabel, pending, refusal })`; `useForm<PurchaseForm, unknown, PurchaseOutput>` + `useFieldArray({ name: "items" })`; `SupplierPicker` `Controller` bilan (`supplier_id` + `supplier_name` set), qatorlar `ProductPicker` (tanlanganda `product_id`, `product_name`, `unit`, narx bo'sh bo'lsa `last_price`); qator: `grid grid-cols-[1fr_auto]` telefonda, jadvalsimon desktopda (`md:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_2.5rem]`); «Summa» `lineAmount` → `formatAmount`; «Jami» `purchaseTotal`; «To'liq» `setValue("paid", purchaseTotal(...))`; `watch` bilan jonli; submit `form.handleSubmit(onSubmit)`. `new-purchase-page.tsx`: `usePermission("purchases.create")` + `allowed("suppliers.view") && allowed("products.view")` bo'lmasa `/purchases` ga; `useLocation`; `useMutation` POST (`location_id` = joriy) → invalidate (`purchasesKey`, `productsKey`, `suppliersKey`, `paymentsKey`…) → toast → `router.push`. `edit-purchase-page.tsx`: `usePurchase`, `purchaseDefaults(purchase, today)`, PUT.

- [ ] **GREEN**, commit `feat(web): the purchase form, for a new purchase and an edit`.

### Task 7: Xarid sahifasi va o'chirish

**Files:** Create `components/warehouse/purchase-page.tsx`, `delete-purchase-button.tsx` (+testlar), `app/(app)/purchases/[id]/page.tsx`.

- [ ] **Test:** sarlavha «Xarid № 1», izoh «Bozor · 01.10.2026», orqaga «Xaridlar»; «Ma'lumot»: Ta'minotchi (havola `/suppliers/<id>`), Sana, Lokatsiya (2+ lokatsiyada), Jami «20 001,50 so'm», To'langan «5 000,00 so'm», Izoh, Qo'shgan, Qo'shilgan; qatorlar jadvali «Qatorlar» ustunlari ["Mahsulot", "Miqdor", "Narx, so'm", "Summa, so'm"], «Olma» havola `/products/<id>`, «12,5 kg», «1 000,00», «12 500,00»; footer «Jami» «20 001,50»; amallar: «Tahrirlash» havola `/purchases/<id>/edit` (`purchases.edit`), «O'chirish» (`purchases.delete`) → alertdialog «Xaridni o'chirasizmi?» «№ 1 xaridi o'chiriladi, qoldiq qaytariladi. Qayta tiklab bo'lmaydi.» → toast «Xarid o'chirildi» → `router.replace("/purchases")`; 409 `stock_insufficient` toast; 404 → «Xarid topilmadi»; ruxsatsiz lokatsiya (cheklangan xodim) 404.

- [ ] **RED** → **Kod** (`ProductPage` naqshi; qatorlar `DataList` `href` mahsulotga; `footer` jami).

- [ ] **GREEN**, commit `feat(web): the purchase page`.

### Task 8: Mahsulotlar: «Qoldiq» ustuni, sahifada oxirgi narx, qoldiq va xaridlar

**Files:** Modify `components/catalog/catalog-page.tsx`, `catalog-page.test.tsx`, `product-page.tsx`, `product-page.test.tsx`; Create `components/catalog/product-stock.tsx`, `product-purchases.tsx` (+testlar).

- [ ] **Test:** `catalog-page.test`: mahsulotlar ustunlari ["Mahsulot", "Artikul", "Birlik", "Narx", "Qoldiq", "Qo'shgan", "Qo'shilgan"], Olma qatori «12,5 kg» (joriy lokatsiya Asosiy; `seedWarehouse(catalog)`), Nok «3 dona»; lokatsiya Chilonzor tanlansa «0 kg»; xizmatlarda «Qoldiq» yo'q. `product-page.test`: fakt «Oxirgi xarid narxi» «1 000,00 so'm» (yo'q → «—»); «Qoldiq» bo'limi (`ProductStock`): har lokatsiya nomi va «12,5 kg» / «0 kg», `<dl>`; «Xaridlar» bo'limi (`ProductPurchases`, `purchases.view`): ro'yxat «Xaridlar» qatori «№ 1 · Bozor», «01.10.2026», «12,5 kg», «1 000,00», «12 500,00», 2+ lokatsiyada «Lokatsiya», havola `/purchases/<id>`; bo'sh «Bu mahsulot hali xarid qilinmagan»; xizmat sahifasida ikkala bo'lim yo'q; o'chirish 409 toast «Bu mahsulot 1 ta xaridda bor».

- [ ] **RED** → **Kod.** `catalog-page.tsx`: `useLocation` → `useProducts(companyId, {kind, ...filter, locationId})`; ustun «Qoldiq» (`align: "end"`, `card: "aside"`?? — «Narx» aside; qoldiq `card: "inline"`) `formatQuantity(p.quantity, p.unit)`. `product-page.tsx`: fakt + `<ProductStock stock={d.stock} unit />` + `<ProductPurchases companyId id unit />`.

- [ ] **GREEN**, commit `feat(web): the stock and the purchases on the product pages`.

### Task 9: e2e, skrinshotlar, README, yakun

**Files:** Create `apps/web/e2e/warehouse.spec.ts`; Modify `e2e/catalog.spec.ts` (ustun), `README.md`.

- [ ] **e2e** (`warehouse.spec.ts`, 375px va desktop; `seedCatalog()`): egasi kiradi → «Ombor» bo'limi («Yana» orqali telefonda) → `/purchases` «Hali xarid yo'q» → «Ta'minotchilar» tabi → «Ta'minotchi qo'shish» («Bozor», telefon) → ro'yxatda, qarz «—» → «Xaridlar» tabi → «Xarid qo'shish» → forma: «Bozor» tanlanadi, «Olma» (narx 1000 bo'sh → tushmaydi: oxirgi narx yo'q; «1000» yoziladi), miqdor «10», «Qator qo'shish», «Nok» «3» «2500,5», jami «17 501,5», «To'liq», to'langan «17501.5» → «5000» ga o'zgartiriladi → «Saqlash» → sahifa «Xarid № 1», qatorlar, «To'langan 5 000,00 so'm» → `/products` «Qoldiq» «10 kg» → Olma sahifasi «Oxirgi xarid narxi 1 000,00 so'm», «Qoldiq» Asosiy «10 kg», «Xaridlar» «№ 1 · Bozor» → Bozor sahifasi: «Qarz: 12 501,50 so'm», xaridlar «№ 1», to'lovlar «Xarid № 1» → «To'lov qo'shish» «12501.5» → «Qarz yo'q» → xarid tahriri («Tahrirlash»): Olma miqdori «4» → «Saqlash» → «Jami 11 501,50 so'm», qoldiq «4 kg» → o'chirish («O'chirish») → `/purchases` «Hali xarid yo'q», qoldiq «0 kg» → yangi xarid № 2; Olma o'chirilmoqchi (xaridi bor) → toast «Bu mahsulot 1 ta xaridda bor» → nofaol qilinadi → forma taklifida chiqmaydi; rolsiz xodim (Vali, kompaniya 1) hamma bo'limni ko'radi; «Kuzatuvchi» (`customers.view`) «Ombor» ko'rmaydi, `/purchases` → bosh sahifa. Yon scroll 0.
- [ ] `catalog.spec.ts`: mahsulot sahifasida «Qoldiq» bo'limi mavjudligini tekshirish (0 kg).
- [ ] Vaqtinchalik skrinshot spec'i (375px va desktop, light va dark: ta'minotchilar, ta'minotchi sahifasi, xaridlar, xarid formasi (2 qator), xarid sahifasi, mahsulot sahifasi qoldiq bilan); 320px da yon scroll yo'q; o'chiriladi.
- [ ] `README.md`: «Mahsulotlar va xizmatlar», «Ombor» bo'limlari (lokatsiya = ombor, xarid, qoldiq, balans), menyu tartibi.
- [ ] `make lint`, `make test`, `make e2e`; haqiqiy Go API bilan brauzerda bitta to'liq oqim (vaqtinchalik Playwright config, `smoke` stack: egasi menyuni sozlaydi, ta'minotchi va mahsulot qo'shadi, xarid kiritadi, qoldiq va qarzni ko'radi, to'lov qo'shadi); spec'ga «5-bosqich qarorlari»; `git push origin main`.

## Self-review

- **Qamrov:** `logic/warehouse.md` 3.3 (ro'yxat ustunlari, sahifa: balans kartasi, xaridlar, to'lovlar) → Task 3, 4; 4.5 (xaridlar sahifasi joriy lokatsiya, ustunlar; xarid sahifasi; forma: tanlovchilar, oxirgi narx, qatorlar, «To'liq», nofaol tanlangan turadi) → Task 5, 6, 7; 5 (qoldiq ustuni va sahifada) → Task 8; 6 (to'lov dialogi, o'z/bog'langan) → Task 4; 7 (lokatsiyasiz a'zo, ro'yxat 1-sahifadan) → Task 5; `logic/products.md` 5–6 → Task 8; `logic/roles.md` 4.3 (xarid qo'shish uchun uch ruxsat) → Task 5, 6. Dizayn 17 (forma sahifa), 18 (`Picker`), 22 (pul ko'rinishi) → Task 1, 2, 6.
- **Placeholder:** yo'q (Task 6 testidagi «izoh» ikkilanishi hal: «Xaridni tahrirlash», «№ 1 · Asosiy»; Task 8 «Qoldiq» ustuni `card: "inline"`).
- **Tip izchilligi:** `PickerItem {id, name, meta?}`; `SupplierPicker({companyId, value, onChange})`, `ProductPicker({companyId, value, onChange})` (`onChange(product | null)` to'liq `Product` beradi, forma `last_price` ni oladi); `PurchaseForm` holati `{ supplier_id, supplier_name, purchased_on, note, paid, items: { product_id, product_name, unit, quantity, price }[] }`; `purchaseSchema` chiqishi `PurchaseInput` (`location_id` sahifa qo'shadi); `useSuppliers(companyId, SupplierFilter)`, `usePurchases(companyId, PurchaseFilter{locationId, supplierId, page})`, `usePayments(companyId, supplierId, page)`, `useProductPurchases(companyId, id, page)`.
