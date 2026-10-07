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
    expect(
      purchaseSchema.parse({ supplier_id: 3, purchased_on: "2026-10-07", note: " Ertalab ", paid: "5 000", items: [line(1, "12,5", "1 000"), line(2, "3", "2500,5")] }),
    ).toEqual({
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
    expect(lineAmount("", "")).toBeNull()
    expect(purchaseTotal([{ quantity: "12,5", price: "1 000" }, { quantity: "3", price: "2500,5" }, { quantity: "x", price: "1" }])).toBe("20001.5")
    expect(purchaseTotal([])).toBe("0")
  })
  test("defaults: today, one empty line, nothing paid", () => {
    expect(purchaseDefaults(null, "2026-10-07")).toEqual({
      supplier_id: 0,
      supplier_name: "",
      purchased_on: "2026-10-07",
      note: "",
      paid: "",
      items: [{ product_id: 0, product_name: "", unit: null, quantity: "", price: "" }],
    })
  })
})

test("balanceText says what is owed", () => {
  expect(balanceText("15001.50")).toEqual({ kind: "debt", text: "Qarz: 15 001,50 so'm" })
  expect(balanceText("-4998.50")).toEqual({ kind: "advance", text: "Avans: 4 998,50 so'm" })
  expect(balanceText("0.00")).toEqual({ kind: "none", text: "Qarz yo'q" })
})
