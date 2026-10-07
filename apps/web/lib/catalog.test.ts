import { expect, test } from "vitest"
import { productDefaults, productSchema, serviceDefaults, serviceSchema, units } from "./catalog"
import type { Product } from "./types"

const olma: Product = {
  id: 1,
  kind: "product",
  name: "Olma",
  unit: "kg",
  sku: null,
  price: "12000.50",
  note: "Qizil",
  is_active: true,
  created_by_name: null,
  created_at: "2026-10-02T06:00:00Z",
  updated_at: "2026-10-02T06:00:00Z",
}

// messages are a form's refusals by field, in the API's words.
const messages = (schema: typeof productSchema | typeof serviceSchema, form: object) =>
  Object.fromEntries((schema.safeParse(form).error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]))

test("the units are the ten of the API, in its order, m2 shown as m²", () => {
  expect(units.map((unit) => unit.value)).toEqual(["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"])
  expect(units[6].label).toBe("m²")
})

test("productSchema trims the form, turns the price into the API's amount and empties into null", () => {
  expect(productSchema.safeParse({ name: " Olma ", unit: "kg", sku: " A-1 ", price: "12 000,5", note: " Qizil " })).toMatchObject({
    success: true,
    data: { name: "Olma", unit: "kg", sku: "A-1", price: "12000.5", note: "Qizil" },
  })
  expect(productSchema.safeParse({ name: "Olma", unit: "dona", sku: "", price: "", note: "" })).toMatchObject({
    success: true,
    data: { name: "Olma", unit: "dona", sku: null, price: null, note: null },
  })
})

test("productSchema refuses in the API's words, every field at once", () => {
  expect(messages(productSchema, { name: " ", unit: "", sku: "", price: "", note: "" })).toEqual({
    name: "Nomni kiriting",
    unit: "Birlikni tanlang",
  })
  expect(messages(productSchema, { name: "a".repeat(121), unit: "kg", sku: "1".repeat(61), price: "abc", note: "x".repeat(501) })).toEqual({
    name: "Nom 120 belgidan oshmasin",
    sku: "Artikul 60 belgidan oshmasin",
    price: "Narx noto'g'ri",
    note: "Izoh 500 belgidan oshmasin",
  })
  expect(messages(productSchema, { name: "Olma", unit: "kg", sku: "", price: "1.005", note: "" })).toEqual({ price: "Narx noto'g'ri" })
  expect(messages(productSchema, { name: "Olma", unit: "tonna", sku: "", price: "", note: "" })).toEqual({ unit: "Birlikni tanlang" })
})

test("serviceSchema is the name, the price and the note", () => {
  expect(serviceSchema.safeParse({ name: "Yetkazish", price: "50000", note: "" })).toMatchObject({
    success: true,
    data: { name: "Yetkazish", price: "50000", note: null },
  })
  expect(messages(serviceSchema, { name: "", price: "1,5,5", note: "" })).toEqual({ name: "Nomni kiriting", price: "Narx noto'g'ri" })
})

test("the defaults are an empty form, or the record being edited", () => {
  expect(productDefaults()).toEqual({ name: "", unit: "", sku: "", price: "", note: "" })
  expect(productDefaults(olma)).toEqual({ name: "Olma", unit: "kg", sku: "", price: "12000.50", note: "Qizil" })
  expect(serviceDefaults()).toEqual({ name: "", price: "", note: "" })
  expect(serviceDefaults({ ...olma, kind: "service", unit: null, note: null })).toEqual({ name: "Olma", price: "12000.50", note: "" })
})
