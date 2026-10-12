import { describe, expect, test } from "vitest"
import { saleDefaults, saleSchema } from "./sales"
import type { SaleDetail } from "./types"
import { toISO } from "./warehouse"

const at = toISO("2026-10-07T09:00")!
const line = (product_id: number, quantity: string, price: string) => ({ product_id, product_name: "", unit: null, quantity, price })
const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) => result.error?.issues.map((i) => [i.path.join("."), i.message])

describe("the sale form", () => {
  const base = { customer_id: 5, customer_name: "Dilshod", at: "2026-10-07T09:00", currency_id: "1", rate: "", note: "", items: [line(1, "4", "3 000")], payments: [] }
  test("is turned into what the API takes: the customer or none, the moment, the currency, the lines, the payments, the note", () => {
    expect(saleSchema.parse({ ...base, note: " Kechqurun ", payments: [{ bank_account_id: "9101", amount: "5 000" }] })).toEqual({
      customer_id: 5,
      at,
      currency_id: 1,
      rate: null,
      note: "Kechqurun",
      items: [{ product_id: 1, quantity: "4", price: "3000" }],
      payments: [{ bank_account_id: 9101, amount: "5000" }],
    })
    expect(saleSchema.parse({ ...base, customer_id: 0, customer_name: "" })).toMatchObject({ customer_id: null, note: null, payments: [] })
    expect(saleSchema.parse({ ...base, currency_id: "2", rate: "12 800,5" })).toMatchObject({ currency_id: 2, rate: "12800.5" })
  })
  test("tells what is wrong where it is wrong", () => {
    expect(issues(saleSchema.safeParse({ ...base, at: "" }))).toEqual([["at", "Vaqtni kiriting"]])
    expect(issues(saleSchema.safeParse({ ...base, items: [] }))).toEqual([["items", "Kamida bitta mahsulot qo'shing"]])
    expect(issues(saleSchema.safeParse({ ...base, items: [line(0, "1", "1")] }))).toEqual([["items.0.product_id", "Mahsulotni tanlang"]])
    expect(issues(saleSchema.safeParse({ ...base, items: [line(1, "1", "x")] }))).toEqual([["items.0.price", "Narx noto'g'ri"]])
    expect(issues(saleSchema.safeParse({ ...base, items: [line(1, "1", "1"), line(1, "2", "1")] }))).toEqual([["items.1.product_id", "Bu mahsulot allaqachon kiritilgan"]])
    expect(issues(saleSchema.safeParse({ ...base, payments: [{ bank_account_id: "", amount: "1" }] }))).toEqual([["payments.0.bank_account_id", "Akkauntni tanlang"]])
    expect(issues(saleSchema.safeParse({ ...base, currency_id: "2", rate: "x" }))).toEqual([["rate", "Kurs noto'g'ri"]])
  })
  test("defaults: now, nobody, in so'm, one empty line, nothing paid; or the sale being edited", () => {
    expect(saleDefaults(null, "2026-10-07T09:00")).toEqual({
      customer_id: 0,
      customer_name: "",
      at: "2026-10-07T09:00",
      currency_id: "1",
      rate: "",
      note: "",
      items: [{ product_id: 0, product_name: "", unit: null, quantity: "", price: "" }],
      payments: [],
    })
    const sale = {
      id: 7,
      number: 1,
      location_id: 1,
      location_name: "Asosiy",
      customer: { id: 5, name: "Dilshod" },
      at: "2026-10-07T04:00:00Z",
      currency_id: 2,
      rate: "12800.0000",
      note: null,
      total: "3.00",
      total_uzs: "38400.00",
      paid: "2.00",
      items_count: 1,
      created_by_name: null,
      created_at: at,
      updated_at: at,
      items: [{ product_id: 1, name: "Olma", unit: "kg", quantity: "2.000", price: "1.50", amount: "3.00" }],
      payments: [{ id: 9, bank_account_id: 9112, account_name: "Karta", amount: "1.00", currency_id: 2 }],
    } satisfies SaleDetail
    expect(saleDefaults(sale, "2026-10-08T09:00")).toEqual({
      customer_id: 5,
      customer_name: "Dilshod",
      at: "2026-10-07T09:00",
      currency_id: "2",
      rate: "12800",
      note: "",
      items: [{ product_id: 1, product_name: "Olma", unit: "kg", quantity: "2.000", price: "1.50" }],
      payments: [{ bank_account_id: "9112", amount: "1.00" }],
    })
    expect(saleDefaults({ ...sale, customer: null }, "2026-10-08T09:00")).toMatchObject({ customer_id: 0, customer_name: "" })
  })
})
