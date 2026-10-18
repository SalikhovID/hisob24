import { describe, expect, test } from "vitest"
import type { InventoryDetail, OpeningStockDetail, StatementRow, TransferDetail } from "./types"
import { toISO } from "./warehouse"
import {
  differenceOf,
  documentHref,
  inventoryDefaults,
  inventorySchema,
  kindTitle,
  openingDefaults,
  openingOfRow,
  openingSchema,
  openingStockDefaults,
  openingStockSchema,
  signedQuantity,
  transferDefaults,
  transferSchema,
} from "./stock"

const at = toISO("2026-10-07T09:00")!
// line is a line as a form holds it; the price is there for the shared
// lines field, unused by a document without prices.
const line = (product_id: number, quantity: string, price = "") => ({ product_id, product_name: "", unit: null, quantity, price })
const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) => result.error?.issues.map((i) => [i.path.join("."), i.message])

describe("the transfer form", () => {
  const base = { to_location_id: "5", at: "2026-10-07T09:00", note: "", items: [line(1, "4")] }
  test("is turned into what the API takes: the other location, the moment, the lines without prices, the note", () => {
    expect(transferSchema.parse({ ...base, note: " Filialga ", items: [line(1, "4,5", "ignored"), line(2, "1")] })).toEqual({
      to_location_id: 5,
      at,
      note: "Filialga",
      items: [
        { product_id: 1, quantity: "4.5" },
        { product_id: 2, quantity: "1" },
      ],
    })
  })
  test("tells what is wrong where it is wrong", () => {
    expect(issues(transferSchema.safeParse({ ...base, to_location_id: "" }))).toEqual([["to_location_id", "Maqsad lokatsiyani tanlang"]])
    expect(issues(transferSchema.safeParse({ ...base, at: "" }))).toEqual([["at", "Vaqtni kiriting"]])
    expect(issues(transferSchema.safeParse({ ...base, items: [] }))).toEqual([["items", "Kamida bitta mahsulot qo'shing"]])
    expect(issues(transferSchema.safeParse({ ...base, items: [line(0, "1")] }))).toEqual([["items.0.product_id", "Mahsulotni tanlang"]])
    expect(issues(transferSchema.safeParse({ ...base, items: [line(1, "0")] }))).toEqual([["items.0.quantity", "Miqdor noto'g'ri"]])
    expect(issues(transferSchema.safeParse({ ...base, items: [line(1, "1"), line(1, "2")] }))).toEqual([["items.1.product_id", "Bu mahsulot allaqachon kiritilgan"]])
    expect(issues(transferSchema.safeParse({ ...base, note: "x".repeat(501) }))).toEqual([["note", "Izoh 500 belgidan oshmasin"]])
  })
  test("defaults: now, no destination, one empty line; or the transfer being edited", () => {
    expect(transferDefaults(null, "2026-10-07T09:00")).toEqual({ to_location_id: "", at: "2026-10-07T09:00", note: "", items: [line(0, "")] })
    const transfer = {
      id: 7,
      number: 1,
      location_id: 1,
      location_name: "Asosiy",
      to_location_id: 5,
      to_location_name: "Chilonzor",
      at: "2026-10-07T04:00:00Z",
      note: "Filialga",
      items_count: 1,
      created_by_name: null,
      created_at: at,
      updated_at: at,
      items: [{ product_id: 1, name: "Olma", unit: "kg", quantity: "4.000" }],
    } satisfies TransferDetail
    expect(transferDefaults(transfer, "2026-10-08T09:00")).toEqual({
      to_location_id: "5",
      at: "2026-10-07T09:00",
      note: "Filialga",
      items: [{ product_id: 1, product_name: "Olma", unit: "kg", quantity: "4.000", price: "" }],
    })
  })
})

describe("the inventory form", () => {
  const count = (product_id: number, expected: string, counted: string) => ({ product_id, product_name: "", unit: null, expected, counted })
  const base = { at: "2026-10-07T09:00", note: "", items: [count(1, "10.000", "9")] }
  test("is turned into what the API takes: the moment, each product with what was counted, the note", () => {
    expect(inventorySchema.parse({ ...base, items: [count(1, "10.000", "9,5"), count(2, "0.000", "0")] })).toEqual({
      at,
      note: null,
      items: [
        { product_id: 1, counted: "9.5" },
        { product_id: 2, counted: "0" },
      ],
    })
  })
  test("tells what is wrong where it is wrong", () => {
    expect(issues(inventorySchema.safeParse({ ...base, at: "kecha" }))).toEqual([["at", "Vaqt noto'g'ri"]])
    expect(issues(inventorySchema.safeParse({ ...base, items: [] }))).toEqual([["items", "Kamida bitta mahsulot qo'shing"]])
    expect(issues(inventorySchema.safeParse({ ...base, items: [count(1, "1.000", "")] }))).toEqual([["items.0.counted", "Sanalganni kiriting"]])
    expect(issues(inventorySchema.safeParse({ ...base, items: [count(1, "1.000", "-1")] }))).toEqual([["items.0.counted", "Miqdor noto'g'ri"]])
    expect(issues(inventorySchema.safeParse({ ...base, items: [count(1, "1.000", "1"), count(1, "1.000", "2")] }))).toEqual([["items.1.product_id", "Bu mahsulot allaqachon kiritilgan"]])
  })
  test("the difference on screen: counted less expected, three decimals at most; nothing until a count is typed", () => {
    expect(differenceOf("10.000", "9")).toBe("-1")
    expect(differenceOf("0.000", "2,5")).toBe("2.5")
    expect(differenceOf("5.000", "5")).toBe("0")
    expect(differenceOf("1.000", "")).toBeNull()
    expect(differenceOf("1.000", "x")).toBeNull()
  })
  test("defaults: now and one empty line; or the inventory being edited", () => {
    expect(inventoryDefaults(null, "2026-10-07T09:00")).toEqual({ at: "2026-10-07T09:00", note: "", items: [count(0, "", "")] })
    const inventory = {
      id: 7,
      number: 1,
      location_id: 1,
      location_name: "Asosiy",
      at: "2026-10-07T04:00:00Z",
      note: null,
      items_count: 1,
      created_by_name: null,
      created_at: at,
      updated_at: at,
      items: [{ product_id: 1, name: "Olma", unit: "kg", expected: "10.000", counted: "9.000", difference: "-1.000" }],
    } satisfies InventoryDetail
    expect(inventoryDefaults(inventory, "2026-10-08T09:00")).toEqual({
      at: "2026-10-07T09:00",
      note: "",
      items: [{ product_id: 1, product_name: "Olma", unit: "kg", expected: "10.000", counted: "9.000" }],
    })
  })
})

describe("the opening stock form", () => {
  const base = { at: "2026-10-07T09:00", currency_id: "1", rate: "", note: "", items: [line(1, "12,5", "1 000")] }
  test("is a purchase without a supplier or payments", () => {
    expect(openingStockSchema.parse(base)).toEqual({ at, currency_id: 1, rate: null, note: null, items: [{ product_id: 1, quantity: "12.5", price: "1000" }] })
    expect(openingStockSchema.parse({ ...base, currency_id: "2", rate: "12 800" })).toMatchObject({ currency_id: 2, rate: "12800" })
    expect(issues(openingStockSchema.safeParse({ ...base, items: [line(1, "1", "x")] }))).toEqual([["items.0.price", "Narx noto'g'ri"]])
    expect(issues(openingStockSchema.safeParse({ ...base, currency_id: "2", rate: "x" }))).toEqual([["rate", "Kurs noto'g'ri"]])
  })
  test("defaults: now, in so'm, one empty line; or the document being edited", () => {
    expect(openingStockDefaults(null, "2026-10-07T09:00")).toEqual({ at: "2026-10-07T09:00", currency_id: "1", rate: "", note: "", items: [line(0, "")] })
    const opening = {
      id: 7,
      number: 1,
      location_id: 1,
      location_name: "Asosiy",
      at: "2026-10-07T04:00:00Z",
      currency_id: 2,
      rate: "12800.0000",
      note: "Boshi",
      total: "50.00",
      total_uzs: "640000.00",
      items_count: 1,
      created_by_name: null,
      created_at: at,
      updated_at: at,
      items: [{ product_id: 1, name: "Olma", unit: "kg", quantity: "2.000", price: "25.00", amount: "50.00" }],
    } satisfies OpeningStockDetail
    expect(openingStockDefaults(opening, "2026-10-08T09:00")).toEqual({
      at: "2026-10-07T09:00",
      currency_id: "2",
      rate: "12800",
      note: "Boshi",
      items: [{ product_id: 1, product_name: "Olma", unit: "kg", quantity: "2.000", price: "25.00" }],
    })
  })
})

describe("the opening balance dialog", () => {
  const base = { kind: "debt", amount: "1 000 000", currency_id: "1", rate: "", at: "2026-10-07T09:00", note: " Eski qarz " }
  test("is turned into what the API takes", () => {
    expect(openingSchema.parse(base)).toEqual({ kind: "debt", amount: "1000000", currency_id: 1, rate: null, at, note: "Eski qarz" })
    expect(openingSchema.parse({ ...base, kind: "prepay", amount: "10", currency_id: "2", rate: "12 800,5", note: "" })).toEqual({ kind: "prepay", amount: "10", currency_id: 2, rate: "12800.5", at, note: null })
    expect(openingSchema.parse({ ...base, currency_id: "1", rate: "12800" })).toMatchObject({ rate: null })
  })
  test("tells what is wrong where it is wrong", () => {
    expect(issues(openingSchema.safeParse({ ...base, kind: "" }))).toEqual([["kind", "Turni tanlang"]])
    expect(issues(openingSchema.safeParse({ ...base, amount: "" }))).toEqual([["amount", "Summani kiriting"]])
    expect(issues(openingSchema.safeParse({ ...base, amount: "0" }))).toEqual([["amount", "Summa noto'g'ri"]])
    expect(issues(openingSchema.safeParse({ ...base, at: "" }))).toEqual([["at", "Vaqtni kiriting"]])
    expect(issues(openingSchema.safeParse({ ...base, currency_id: "2", rate: "x" }))).toEqual([["rate", "Kurs noto'g'ri"]])
  })
  test("defaults: a kind to choose, now, in so'm; or the balance being edited, as its row in the statement tells it", () => {
    expect(openingDefaults(undefined, "2026-10-07T09:00")).toEqual({ kind: "", amount: "", currency_id: "1", rate: "", at: "2026-10-07T09:00", note: "" })
    const row = {
      id: 9,
      kind: "supplier_prepay",
      number: 1,
      at: "2026-10-07T04:00:00Z",
      amount: "10.00",
      currency_id: 2,
      rate: "12800.0000",
      amount_uzs: "128000.00",
      delta_uzs: "-128000.00",
      balance_uzs: "0.00",
      linked_id: null,
      linked_number: null,
      bank_account_id: null,
      account_name: null,
      order_id: null,
      order_number: null,
      note: null,
      created_by_name: null,
    } satisfies StatementRow
    const opening = openingOfRow(row)
    expect(opening).toEqual({ id: 9, kind: "prepay", amount: "10.00", currency_id: 2, rate: "12800.0000", at: "2026-10-07T04:00:00Z", note: null })
    expect(openingDefaults(opening, "2026-10-08T09:00")).toEqual({ kind: "prepay", amount: "10.00", currency_id: "2", rate: "12800", at: "2026-10-07T09:00", note: "" })
    expect(openingOfRow({ ...row, kind: "supplier_debt" }).kind).toBe("debt")
    expect(openingOfRow({ ...row, kind: "customer_prepay" }).kind).toBe("prepay")
  })
})

test("a document's kind has a name and an address", () => {
  expect(kindTitle).toEqual({ purchase: "Xarid", sale: "Sotuv", order: "Buyurtma", transfer: "Ko'chirish", inventory: "Inventarizatsiya", opening_stock: "Boshlang'ich qoldiq" })
  expect(documentHref("purchase", 3)).toBe("/purchases/3")
  expect(documentHref("order", 3)).toBe("/orders/3")
  expect(documentHref("transfer", 3)).toBe("/transfers/3")
  expect(documentHref("inventory", 3)).toBe("/inventories/3")
  expect(documentHref("opening_stock", 3)).toBe("/opening-stock/3")
  expect(documentHref("sale", 3)).toBe("/sales/3")
})

test("a signed quantity reads with a real minus, and with a plus when asked", () => {
  expect(signedQuantity("-1.500", "kg")).toBe("−1,5\u00a0kg")
  expect(signedQuantity("2.000", "kg")).toBe("2\u00a0kg")
  expect(signedQuantity("2.000", "kg", true)).toBe("+2\u00a0kg")
  expect(signedQuantity("0.000", null, true)).toBe("0")
})
