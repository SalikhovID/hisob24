import { describe, expect, test } from "vitest"
import { balanceText, fromISO, lineAmount, paymentSchema, purchaseDefaults, purchaseSchema, purchaseTotal, supplierSchema, toISO } from "./warehouse"

test("the supplier form: the name trimmed, the phone as digits or null, the note or null", () => {
  expect(supplierSchema.parse({ name: " Bozor ", phone: "90 123 45 67", note: " " })).toEqual({ name: "Bozor", phone: "998901234567", note: null })
  expect(supplierSchema.parse({ name: "Bozor", phone: "", note: "Chorsu" })).toEqual({ name: "Bozor", phone: null, note: "Chorsu" })
  expect(supplierSchema.safeParse({ name: " ", phone: "", note: "" }).error?.issues[0].message).toBe("Nomni kiriting")
  expect(supplierSchema.safeParse({ name: "a".repeat(121), phone: "", note: "" }).error?.issues[0].message).toBe("Nom 120 belgidan oshmasin")
  expect(supplierSchema.safeParse({ name: "X", phone: "90 12", note: "" }).error?.issues[0].message).toBe("Telefon raqami noto'g'ri")
  expect(supplierSchema.safeParse({ name: "X", phone: "", note: "x".repeat(501) }).error?.issues[0].message).toBe("Izoh 500 belgidan oshmasin")
})

test("a moment goes to the API with the browser's offset and comes back as the field holds it", () => {
  const iso = toISO("2026-10-07T09:00")
  expect(iso).toMatch(/^2026-10-07T09:00:00[+-]\d{2}:\d{2}$/)
  expect(fromISO(iso!)).toBe("2026-10-07T09:00")
  expect(fromISO(new Date(iso!).toISOString())).toBe("2026-10-07T09:00")
  expect(toISO("")).toBeNull()
  expect(toISO("2026-10-07")).toBeNull()
  expect(toISO("kecha")).toBeNull()
})

test("the payment form: the account, an amount above zero as typed, a moment, a rate or none, a note", () => {
  const at = toISO("2026-10-07T09:00")!
  expect(paymentSchema.parse({ bank_account_id: "9101", amount: "1 200,5", at: "2026-10-07T09:00", rate: "", note: "" })).toEqual({ bank_account_id: 9101, amount: "1200.5", at, rate: null, note: null })
  expect(paymentSchema.parse({ bank_account_id: "9112", amount: "10", at: "2026-10-07T09:00", rate: "12 800,5", note: " Karta " })).toEqual({ bank_account_id: 9112, amount: "10", at, rate: "12800.5", note: "Karta" })
  const bad = (input: unknown) => paymentSchema.safeParse(input).error?.issues.map((i) => [i.path.join("."), i.message])
  expect(bad({ bank_account_id: "", amount: "1", at: "2026-10-07T09:00", rate: "", note: "" })).toEqual([["bank_account_id", "Akkauntni tanlang"]])
  expect(bad({ bank_account_id: "9101", amount: "", at: "2026-10-07T09:00", rate: "", note: "" })).toEqual([["amount", "Summani kiriting"]])
  expect(bad({ bank_account_id: "9101", amount: "0", at: "2026-10-07T09:00", rate: "", note: "" })).toEqual([["amount", "Summa noto'g'ri"]])
  expect(bad({ bank_account_id: "9101", amount: "1.005", at: "2026-10-07T09:00", rate: "", note: "" })).toEqual([["amount", "Summa noto'g'ri"]])
  expect(bad({ bank_account_id: "9101", amount: "1", at: "", rate: "", note: "" })).toEqual([["at", "Vaqtni kiriting"]])
  expect(bad({ bank_account_id: "9101", amount: "1", at: "2026-10-07", rate: "", note: "" })).toEqual([["at", "Vaqt noto'g'ri"]])
  expect(bad({ bank_account_id: "9101", amount: "1", at: "2026-10-07T09:00", rate: "x", note: "" })).toEqual([["rate", "Kurs noto'g'ri"]])
})

describe("the purchase form", () => {
  // line is a line as the form holds it; out is the same as the API takes it.
  const line = (product_id: number, quantity: string, price: string) => ({ product_id, product_name: "", unit: null, quantity, price })
  const out = (product_id: number, quantity: string, price: string) => ({ product_id, quantity, price })
  const at = toISO("2026-10-07T09:00")!
  const base = { supplier_id: 3, supplier_name: "Bozor", at: "2026-10-07T09:00", currency_id: "1", rate: "", note: "", payments: [] }
  test("is turned into what the API takes: the moment, the currency, the lines with their numbers as typed, the payments, the note", () => {
    expect(
      purchaseSchema.parse({ ...base, note: " Ertalab ", payments: [{ bank_account_id: "9101", amount: "5 000" }], items: [line(1, "12,5", "1 000"), line(2, "3", "2500,5")] }),
    ).toEqual({
      supplier_id: 3,
      at,
      currency_id: 1,
      rate: null,
      note: "Ertalab",
      items: [out(1, "12.5", "1000"), out(2, "3", "2500.5")],
      payments: [{ bank_account_id: 9101, amount: "5000" }],
    })
    expect(purchaseSchema.parse({ ...base, items: [line(1, "1", "1")] })).toMatchObject({ note: null, payments: [] })
    expect(purchaseSchema.parse({ ...base, currency_id: "2", rate: "12 800,5", items: [line(1, "1", "1")] })).toMatchObject({ currency_id: 2, rate: "12800.5" })
    expect(purchaseSchema.parse({ ...base, currency_id: "2", rate: "", items: [line(1, "1", "1")] })).toMatchObject({ currency_id: 2, rate: null })
    expect(purchaseSchema.parse({ ...base, currency_id: "1", rate: "12800", items: [line(1, "1", "1")] })).toMatchObject({ currency_id: 1, rate: null })
  })
  test("tells what is wrong where it is wrong", () => {
    const bad = (input: unknown) => purchaseSchema.safeParse(input).error?.issues.map((i) => [i.path.join("."), i.message])
    expect(bad({ ...base, supplier_id: 0, supplier_name: "", items: [line(1, "1", "1")] })).toEqual([["supplier_id", "Ta'minotchini tanlang"]])
    expect(bad({ ...base, at: "", items: [line(1, "1", "1")] })).toEqual([["at", "Vaqtni kiriting"]])
    expect(bad({ ...base, at: "2026-10-07", items: [line(1, "1", "1")] })).toEqual([["at", "Vaqt noto'g'ri"]])
    expect(bad({ ...base, currency_id: "2", rate: "x", items: [line(1, "1", "1")] })).toEqual([["rate", "Kurs noto'g'ri"]])
    expect(bad({ ...base, items: [] })).toEqual([["items", "Kamida bitta mahsulot qo'shing"]])
    expect(bad({ ...base, items: [line(0, "1", "1")] })).toEqual([["items.0.product_id", "Mahsulotni tanlang"]])
    expect(bad({ ...base, items: [line(1, "0", "1")] })).toEqual([["items.0.quantity", "Miqdor noto'g'ri"]])
    expect(bad({ ...base, items: [line(1, "1", "x")] })).toEqual([["items.0.price", "Narx noto'g'ri"]])
    expect(bad({ ...base, items: [line(1, "1", "1")], payments: [{ bank_account_id: "", amount: "1" }] })).toEqual([["payments.0.bank_account_id", "Akkauntni tanlang"]])
    expect(bad({ ...base, items: [line(1, "1", "1")], payments: [{ bank_account_id: "9101", amount: "-1" }] })).toEqual([["payments.0.amount", "Summa noto'g'ri"]])
    expect(bad({ ...base, items: [line(1, "1", "1"), line(1, "2", "1")] })).toEqual([["items.1.product_id", "Bu mahsulot allaqachon kiritilgan"]])
  })
  test("the amounts on screen: a line, the total", () => {
    expect(lineAmount("12,5", "1 000")).toBe("12500")
    expect(lineAmount("3", "2500,5")).toBe("7501.5")
    expect(lineAmount("x", "1")).toBeNull()
    expect(lineAmount("", "")).toBeNull()
    expect(purchaseTotal([{ quantity: "12,5", price: "1 000" }, { quantity: "3", price: "2500,5" }, { quantity: "x", price: "1" }])).toBe("20001.5")
    expect(purchaseTotal([])).toBe("0")
  })
  test("defaults: now, in so'm, one empty line, nothing paid", () => {
    expect(purchaseDefaults(null, "2026-10-07T09:00")).toEqual({
      supplier_id: 0,
      supplier_name: "",
      at: "2026-10-07T09:00",
      currency_id: "1",
      rate: "",
      note: "",
      items: [{ product_id: 0, product_name: "", unit: null, quantity: "", price: "" }],
      payments: [],
    })
  })
})

test("balanceText says what is owed", () => {
  expect(balanceText("15001.50")).toEqual({ kind: "debt", text: "Qarz: 15\u00a0001,50 so'm" })
  expect(balanceText("-4998.50")).toEqual({ kind: "advance", text: "Avans: 4\u00a0998,50 so'm" })
  expect(balanceText("0.00")).toEqual({ kind: "none", text: "Qarz yo'q" })
})
