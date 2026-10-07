# Ombor, 3-bosqich: katalog UI (mahsulotlar va xizmatlar sahifalari) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Mahsulotlar» bo'limi ishlaydi: `/products` (mahsulotlar ro'yxati: «Faol» / «Nofaol» tablari, qidiruv, sahifalar, qo'shish dialogi), `/products/[id]` (mahsulot sahifasi: ma'lumot, tahrirlash, nofaol qilish, o'chirish), `/services` (xizmatlar ro'yxati qator amallari bilan); ikkala sahifa tepasida bo'lim tablari (`SectionTabs`). Qoldiq, oxirgi narx va xaridlar bo'limlari 5-bosqichda.

**Architecture:**
- `components/section-tabs.tsx`: bo'lim tablari tasmasi (havolalar, sozlamalar tablari ko'rinishi), faqat a'zo ko'ra oladigan tablar, 2+ bo'lsa chiziladi; `/products`, `/services` (keyin `/purchases`, `/suppliers`) sahifalarida `PageHeader` dan oldin.
- `lib/format.ts`: `formatAmount` (admin'dagi kabi: minglar NBSP, kasr vergul; `.00` tashlanadi), `unitLabel`.
- `lib/catalog.ts`: `units` (kod → nom), `productSchema` / `serviceSchema` (zod; xabarlar API'niki; narxda vergul nuqtaga), `productDefaults`, `ProductForm`, `ProductOutput`.
- `lib/queries.ts`: `productsKey`, `useProducts(companyId, {kind, status, search, page})`, `productKey`, `useProduct`.
- `components/catalog/*`: `use-catalog-filter.ts`, `catalog-page.tsx` (`kind`), `product-dialog.tsx` (qo'shish va tahrirlash, mahsulot), `service-dialog.tsx` (qo'shish va tahrirlash, xizmat), `active-button.tsx`, `delete-product-button.tsx`, `product-page.tsx`.
- `app/(app)/products/page.tsx`, `products/[id]/page.tsx`, `services/page.tsx`; `proxy.test.ts`.
- Mock: `seedCatalog()` (`mocks/data.ts`) testlar va e2e uchun; handlerlar 1-bosqichda.
- e2e `catalog.spec.ts`; Vitest har komponentga.

**Tech Stack:** Next 16 (App Router), Tailwind v4, shadcn/Base UI (`Dialog`, `AlertDialog`, `Tabs`, `Select`), react-hook-form + zod, TanStack Query, MSW, Vitest + RTL, Playwright.

Qoidalar: `logic/products.md`. Dizayn: `docs/superpowers/specs/2026-10-07-inventory-design.md` (11, 16, 17, 19, 22-qarorlar) va `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md` (DataList, PageHeader, Identity qoidalari). Kelishuvlar 1-bosqich rejasidagidek.

---

### Task 1: `SectionTabs`

**Files:** Create `apps/web/components/section-tabs.tsx`, `apps/web/components/section-tabs.test.tsx`.

- [ ] **Test:**

```tsx
import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { navItems } from "@/lib/nav"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { SectionTabs } from "./section-tabs"

const products = navItems.find((item) => item.key === "products")!
const warehouse = navItems.find((item) => item.key === "warehouse")!

test("the tabs of a section are links, the page's one marked; only the tabs the member may see", () => {
  setLocation("/services")
  renderWithProviders(<SectionTabs item={products} permissions={["products.view"]} />)

  const nav = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Mahsulotlar", "/products"],
    ["Xizmatlar", "/services"],
  ])
  expect(within(nav).getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("aria-current", "page")
  expect(within(nav).getByRole("link", { name: "Mahsulotlar" })).not.toHaveAttribute("aria-current")
})

test("with one tab to see there is no strip", () => {
  setLocation("/suppliers")
  renderWithProviders(<SectionTabs item={warehouse} permissions={["suppliers.view"]} />)
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
})
```

- [ ] **RED** → **Kod:**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { isCurrent, type NavItem } from "@/lib/nav"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { cn } from "@/lib/utils"

// SectionTabs is the strip at the top of a page of a section that holds
// several (the products and the services; the purchases and the
// suppliers): a link per tab the member may see, the page's one standing
// out as a card on the muted strip, like the settings' tabs. With one tab
// to see there is nothing to switch, and no strip.
export function SectionTabs({ item, permissions }: { item: NavItem; permissions: readonly Permission[] | undefined }) {
  const pathname = usePathname()
  const tabs = (item.tabs ?? []).filter((tab) => can(permissions, tab.permission))
  if (tabs.length < 2) return null
  return (
    <nav aria-label={`${item.label} bo'limi`} className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5 scrollbar-hide">
      <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-[3px] max-sm:min-w-full">
        {tabs.map((tab) => {
          const current = isCurrent(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-full flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                current && "bg-card text-foreground shadow-sm",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **GREEN**, commit `feat(web): the tabs of a section that holds several pages`.

### Task 2: `lib/format.ts`, `lib/catalog.ts`, `lib/queries.ts`

**Files:** Modify `apps/web/lib/format.ts` (+`format.test.ts`), `apps/web/lib/queries.ts`; Create `apps/web/lib/catalog.ts`, `apps/web/lib/catalog.test.ts`.

- [ ] **Test** (`format.test.ts` ga):

```ts
test("formatAmount writes an amount for people: thousands apart, the decimals after a comma, none when they are zero", () => {
  expect(formatAmount("1200000.00")).toBe("1 200 000")
  expect(formatAmount("150000.50")).toBe("150 000,50")
  expect(formatAmount("0.5")).toBe("0,5")
  expect(formatAmount("999")).toBe("999")
})

test("unitLabel names a unit on screen: m2 as m²", () => {
  expect(unitLabel("kg")).toBe("kg")
  expect(unitLabel("m2")).toBe("m²")
})
```

`catalog.test.ts`:

```ts
import { expect, test } from "vitest"
import { productDefaults, productSchema, serviceSchema, units } from "./catalog"

test("the units are the ten of the API, in its order", () => {
  expect(units.map((unit) => unit.value)).toEqual(["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"])
  expect(units[6].label).toBe("m²")
})

test("productSchema checks the form in the API's words and turns it into the API's input", () => {
  expect(productSchema.safeParse({ name: " Olma ", unit: "kg", sku: " A-1 ", price: "12 000,5", note: " Qizil " })).toMatchObject({
    success: true,
    data: { name: "Olma", unit: "kg", sku: "A-1", price: "12000.5", note: "Qizil" },
  })
  expect(productSchema.safeParse({ name: "Olma", unit: "dona", sku: "", price: "", note: "" })).toMatchObject({
    success: true,
    data: { name: "Olma", unit: "dona", sku: null, price: null, note: null },
  })
  const messages = (form: object) =>
    Object.fromEntries(
      (productSchema.safeParse(form).error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
    )
  expect(messages({ name: " ", unit: "", sku: "", price: "", note: "" })).toEqual({ name: "Nomni kiriting", unit: "Birlikni tanlang" })
  expect(messages({ name: "a".repeat(121), unit: "kg", sku: "1".repeat(61), price: "abc", note: "x".repeat(501) })).toEqual({
    name: "Nom 120 belgidan oshmasin",
    sku: "Artikul 60 belgidan oshmasin",
    price: "Narx noto'g'ri",
    note: "Izoh 500 belgidan oshmasin",
  })
  expect(messages({ name: "Olma", unit: "kg", sku: "", price: "1.005", note: "" })).toEqual({ price: "Narx noto'g'ri" })
})

test("serviceSchema is the name, the price and the note", () => {
  expect(serviceSchema.safeParse({ name: "Yetkazish", price: "50000", note: "" })).toMatchObject({
    success: true,
    data: { name: "Yetkazish", price: "50000", note: null },
  })
  expect(serviceSchema.safeParse({ name: "", price: "", note: "" }).error?.issues[0].message).toBe("Nomni kiriting")
})

test("productDefaults is an empty form, or the product being edited", () => {
  expect(productDefaults()).toEqual({ name: "", unit: "", sku: "", price: "", note: "" })
  expect(
    productDefaults({ id: 1, kind: "product", name: "Olma", unit: "kg", sku: null, price: "12000.50", note: "Qizil", is_active: true, created_by_name: null, created_at: "", updated_at: "" }),
  ).toEqual({ name: "Olma", unit: "kg", sku: "", price: "12000.50", note: "Qizil" })
})
```

- [ ] **RED** → **Kod.** `format.ts`:

```ts
// formatAmount writes a stored amount ("150000.50") for people to read:
// thousands apart by a no-break space, the decimals after a comma and left
// out when they are zero.
export function formatAmount(amount: string): string {
  const [whole, decimals] = amount.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const rest = (decimals ?? "").replace(/0+$/, "")
  return rest === "" ? grouped : `${grouped},${rest}`
}

// unitLabel is a unit's name on screen: its code, but m2 as m².
export function unitLabel(unit: string): string {
  return unit === "m2" ? "m²" : unit
}
```

`catalog.ts`:

```ts
import { z } from "zod"
import type { Product, ProductInput, Unit } from "./types"
import { unitLabel } from "./format"

// units are the units a product is measured in (logic/products.md, 3.2),
// as a select offers them.
export const unitCodes: Unit[] = ["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"]
export const units = unitCodes.map((value) => ({ value, label: unitLabel(value) }))

const trimmed = z.string().trim()
// optional is an optional text: nothing becomes null, as the API keeps it.
const optional = (max: number, tooLong: string) =>
  trimmed.refine((value) => [...value].length <= max, tooLong).transform((value) => (value === "" ? null : value))
const name = trimmed.min(1, "Nomni kiriting").refine((value) => [...value].length <= 120, "Nom 120 belgidan oshmasin")
// price is an amount as typed ("12 000,5"): spaces out, the comma a dot,
// checked as the API checks it; nothing becomes null.
const price = z.string().transform((value, context) => {
  const text = value.replace(/\s/g, "").replace(",", ".")
  if (text === "") return null
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "Narx noto'g'ri" })
    return z.NEVER
  }
  return text
})

export const productSchema = z.object({
  name,
  unit: z.string().pipe(z.enum(unitCodes, { message: "Birlikni tanlang" })),
  sku: optional(60, "Artikul 60 belgidan oshmasin"),
  price,
  note: optional(500, "Izoh 500 belgidan oshmasin"),
})
export const serviceSchema = z.object({ name, price, note: optional(500, "Izoh 500 belgidan oshmasin") })

export type ProductForm = { name: string; unit: string; sku: string; price: string; note: string }
export type ProductOutput = z.output<typeof productSchema>
export type ServiceForm = { name: string; price: string; note: string }
export type ServiceOutput = z.output<typeof serviceSchema>

export function productDefaults(product?: Product): ProductForm {
  return { name: product?.name ?? "", unit: product?.unit ?? "", sku: product?.sku ?? "", price: product?.price ?? "", note: product?.note ?? "" }
}
export function serviceDefaults(service?: Product): ServiceForm {
  return { name: service?.name ?? "", price: service?.price ?? "", note: service?.note ?? "" }
}
```

(`price` default: `product.price` bazadan `"12000.50"` — formada shunday turadi; foydalanuvchi o'zgartirmasa `"12000.50"` qaytadi.) `queries.ts`:

```ts
export const productsKey = (companyId: number | null) => ["products", companyId] as const
export interface ProductFilter { kind: ProductKind; status: "active" | "inactive"; search: string; page: number }
export function useProducts(companyId: number | null, filter: ProductFilter) {
  return useQuery({
    queryKey: [...productsKey(companyId), filter],
    queryFn: () => call(api.GET("/app/products", { params: { query: { kind: filter.kind, status: filter.status, search: filter.search || undefined, page: filter.page } } })),
    enabled: companyId !== null,
    placeholderData: keepPreviousData,
  })
}
export const productKey = (companyId: number | null, id: number) => ["product", companyId, id] as const
export function useProduct(companyId: number | null, id: number) {
  return useQuery({ queryKey: productKey(companyId, id), queryFn: () => call(api.GET("/app/products/{id}", { params: { path: { id } } })), enabled: companyId !== null })
}
```

- [ ] **GREEN**, commit `feat(web): the catalog's forms, amounts and queries`.

### Task 3: Ro'yxat sahifasi (`CatalogPage`), filtr, dialoglar, amallar

**Files:** Create `apps/web/components/catalog/use-catalog-filter.ts`, `catalog-page.tsx`, `product-dialog.tsx`, `service-dialog.tsx`, `active-button.tsx`, `delete-product-button.tsx`, `catalog-page.test.tsx`, `product-dialog.test.tsx`, `service-dialog.test.tsx`; `apps/web/app/(app)/products/page.tsx`, `apps/web/app/(app)/services/page.tsx`; Modify `apps/web/mocks/data.ts` (`seedCatalog`), `apps/web/proxy.test.ts`.

- [ ] **`seedCatalog()`** (`mocks/data.ts`): Olma Savdo'ga mahsulotlar «Olma» (kg, SKU `OL-1`, narx `12000.00`), «Nok» (dona, narx yo'q), «Eski mahsulot» (nofaol) va xizmat «Yetkazish» (`50000.00`); qaytaradi `{ olma, nok, eski, yetkazish }`.
- [ ] **Test** (`catalog-page.test.tsx`): egasi `/products` da: sarlavha «Mahsulotlar», izoh «Kompaniyangiz mahsulotlari · 2 ta», bo'lim tablari (Mahsulotlar joriy), «Faol» / «Nofaol» tablari, ro'yxat (nom havola `/products/<id>`, ostida artikul yoki birlik; «Birlik», «Narx» `12 000`, bo'shi «—»; «Qo'shgan»; «Qo'shilgan»), «Nofaol» tabida «Eski mahsulot»; qidiruv `OL-1` → faqat Olma (300 ms); «Mahsulot qo'shish» tugmasi `products.create` bilan, bo'sh rolli xodimda bosh sahifaga qaytish (`usePermission`); xizmatlar (`kind="service"`): sarlavha «Xizmatlar», ustunlar «Xizmat», «Narx», «Qo'shgan», «Qo'shilgan», qator amallari (tahrirlash, nofaol, o'chirish) ruxsat bo'yicha; bo'sh holat matnlari («Hali mahsulot yo'q» / «Mahsulotlar topilmadi»; «Hali xizmat yo'q»). `product-dialog.test.tsx`: qo'shish (birlik `SelectBox`, narx vergul bilan → `12000.5`), xatolar formada (API xabarlari bilan bir xil), 409 `Refusal`, toast «Mahsulot qo'shildi»; tahrir (`product` berilsa «Mahsulotni tahrirlash», `PUT`, toast «Mahsulot saqlandi»). `service-dialog.test.tsx` xuddi shunday («Xizmat qo'shildi» / «Xizmat saqlandi»). `active-button.test.tsx`: «Nofaol qilish» → `PATCH {is_active:false}` → toast «Mahsulot nofaol qilindi»; «Faollashtirish» → «Mahsulot faollashtirildi». `delete-product-button.test.tsx`: tasdiq («Mahsulotni o'chirasizmi?» / «Xizmatni o'chirasizmi?»), `DELETE`, toast («Mahsulot o'chirildi» / «Xizmat o'chirildi»), 409 toast'da; `afterDelete` → mahsulot sahifasida `/products` ga.
- [ ] **RED** → **Kod.** `use-catalog-filter.ts` (`useCustomerFilter` naqshi: `status` (`"active"` standart, manzilda faqat `inactive`), `search`, `page`). `catalog-page.tsx`:

```tsx
export function CatalogPage({ kind }: { kind: ProductKind }) {
  const gate = usePermission("products.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useCatalogFilter()
  const products = useProducts(companyId, { kind, ...filter })
  const isProduct = kind === "product"
  const noun = isProduct ? "Mahsulot" : "Xizmat"
  …
  const columns: Column<Product>[] = [
    { header: noun, primary: true, cell: (p, place) => isProduct ? <ProductTitle product={p} place={place} /> : <span className="font-medium">{p.name}</span> },
    ...(isProduct ? [{ header: "Birlik", card: "tag", cell: (p) => p.unit && <Badge variant="secondary">{unitLabel(p.unit)}</Badge> }] : []),
    { header: "Narx", align: "end", card: "aside", className: "tabular-nums", cell: (p) => p.price && formatAmount(p.price) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (p) => p.created_by_name },
    { header: "Qo'shilgan", card: "inline", className: "text-muted-foreground", cell: (p) => formatDate(p.created_at) },
    ...(isProduct ? [] : [{ header: "Amallar", actions: true, cell: (p) => (<span className="inline-flex items-center justify-end gap-1 …">{allowed("products.edit") && <ServiceDialog companyId service={p} />}{allowed("products.edit") && <ActiveButton companyId product={p} />}{allowed("products.delete") && <DeleteProductButton companyId product={p} />}</span>) }]),
  ]
  …
  <SectionTabs item={productsItem} permissions={gate?.permissions} />
  <PageHeader title={isProduct ? "Mahsulotlar" : "Xizmatlar"} description={…} actions={allowed("products.create") && (isProduct ? <ProductDialog companyId /> : <ServiceDialog companyId />)} />
  <Tabs value={filter.status} onValueChange={(v) => update({ status: v as "active" | "inactive" })}>Faol | Nofaol</Tabs> + <SearchInput placeholder={isProduct ? "Nom yoki artikul" : "Nom"} />
  ListLoading / Failed / EmptyState / DataList + Pager
}
```

`ProductTitle`: nom (`place === "table"` da `Link` `/products/<id>`, kartada matn: ro'yxatga `href` beriladi), ostida xira artikul (bo'lmasa birlik). `product-dialog.tsx` (`ProductDialog({ companyId, product? })`: `useForm<ProductForm, unknown, ProductOutput>` + `zodResolver(productSchema)`; maydonlar `TextField` «Nomi», `SelectField` «Birlik» (`units`, placeholder «Tanlang»), `TextField` «Sotuv narxi» (`inputMode="decimal"`), «Artikul», «Izoh»; `POST /app/products {kind:"product", ...}` yoki `PUT /app/products/{id}`; `onSuccess`: `invalidateQueries(productsKey)`, tahrirda `setQueryData(productKey)`, toast, yopish; trigger: qo'shishda `Button size="lg"` «Mahsulot qo'shish» (`PlusIcon`), tahrirda `Button size="lg"` «Tahrirlash» (`PencilIcon`) yoki `iconOnly` (xizmat qatorida `ActionTooltip` + `size="icon"`)). `service-dialog.tsx` shunga o'xshash («Xizmat qo'shish», «Xizmatni tahrirlash», maydonlar «Nomi», «Narx», «Izoh»). `active-button.tsx` (`ActiveButton({ companyId, product, iconOnly? })`: `PATCH`; mahsulot sahifasida `Button variant="outline" size="lg"` «Nofaol qilish» / «Faollashtirish» (`EyeOffIcon` / `EyeIcon`), qatorda ikonka `ActionTooltip`; `onSuccess`: invalidate `productsKey`, `setQueryData(productKey)`, toast). `delete-product-button.tsx` (`DeleteProductButton({ companyId, product, iconOnly?, afterDelete? })`: `AlertDialog` `DeleteCustomerButton` naqshi; matnlar turga qarab; `onError` toast). Route'lar: `products/page.tsx` (`Suspense` + `<CatalogPage kind="product" />`, `metadata.title` «Mahsulotlar — Hisob24»), `services/page.tsx` («Xizmatlar — Hisob24»). `proxy.test.ts`: `/products`, `/products/7`, `/services` qo'shiladi.
- [ ] **GREEN**, commit `feat(web): the products and the services lists, their dialogs and actions`.

### Task 4: Mahsulot sahifasi

**Files:** Create `apps/web/components/catalog/product-page.tsx`, `product-page.test.tsx`, `apps/web/app/(app)/products/[id]/page.tsx`.

- [ ] **Test:** sarlavha nom, izoh «kg · OL-1» (artikulsiz faqat birlik), nofaolda «Nofaol» belgisi (`Badge variant="outline"`); facts «Birlik», «Narx» («12 000» / «—»), «Artikul», «Izoh», «Qo'shgan», «Qo'shilgan»; amallar ruxsat bo'yicha (`products.edit`: «Tahrirlash», «Nofaol qilish»; `products.delete`: «O'chirish» → `/products`); 404 → «Mahsulot topilmadi» va orqaga havola; xizmat ID'si ochilsa ham ko'rsatiladi (bir xil yo'l), orqaga havola «Xizmatlar» ga.
- [ ] **RED** → **Kod** (`CustomerPage` naqshi): `useProduct`; `PageHeader` (`back` turga qarab `/products` «Mahsulotlar» yoki `/services` «Xizmatlar`; `description` = `[unitLabel(unit), sku].filter(Boolean).join(" · ")`; `stack`; actions); `<section aria-labelledby="product-info">` «Ma'lumot» `dl` `Fact`lar; nofaol belgisi sarlavha yonida (`PageHeader` `avatar` o'rniga description ichida «Nofaol» `Badge`? — `description` `ReactNode` qabul qiladi: `<>kg · OL-1 <Badge variant="outline">Nofaol</Badge></>`). Route: `products/[id]/page.tsx` (`PageProps<"/products/[id]">`, `metadata.title` «Mahsulot — Hisob24»).
- [ ] **GREEN**, commit `feat(web): the product page`.

### Task 5: e2e va yakun

**Files:** Create `apps/web/e2e/catalog.spec.ts`.

- [ ] e2e (375px va desktop; `seedCatalog()` fixture'dan; egasi kiradi, «Mahsulotlar» bo'limiga menyudan o'tadi (telefonda bar'da 4-o'rinda)): ro'yxatda Olma va Nok, «Nofaol» tabida Eski mahsulot; «Mahsulot qo'shish» dialogida «Anor» (kg, narx `8 000`) → ro'yxatda «Anor» «8 000»; takror nom «olma» → dialogda «Bu nomli mahsulot allaqachon bor»; Olma sahifasi: facts, «Tahrirlash» (artikul `OL-2`), «Nofaol qilish» → belgisi, ro'yxatda «Nofaol» tabida; «O'chirish» (Nok) → ro'yxatga qaytadi, Nok yo'q; «Xizmatlar» tabi: «Yetkazish» «50 000», «Xizmat qo'shish» «Ta'mirlash», qatorda tahrirlash va o'chirish; yon scroll 0; bo'sh rolli xodim `/products` ni ochsa bosh sahifaga.
- [ ] `make lint`, `make test`, `make e2e`; vaqtinchalik skrinshot spec'i (375px va desktop, light va dark: ro'yxat, dialog, sahifa; o'chiriladi); spec'ga «3-bosqich qarorlari»; `git push origin main`.

## Self-review

- Spec: 11 (nofaol tablari, nofaol qilish), 16 (`SectionTabs`), 17 (dialoglar), 19 (tartib API'da), 22 (pul ko'rinishi) qamrab olindi; qoldiq / oxirgi narx / xaridlar 5-bosqichda (spec shunday).
- Tiplar: `ProductFilter{kind, status, search, page}` ↔ `useCatalogFilter` (`status`, `search`, `page`) + `kind` sahifadan; `productSchema` → `ProductOutput` → `POST` tanasi `{kind: "product", ...output}` (`unit` enum, `sku/price/note` `string | null`), `PUT` tanasi `output` (`ProductUpdate`).
