import { z } from "zod"
import { unitLabel } from "./format"
import type { Product, Unit } from "./types"

// unitCodes are the units a product is measured in (logic/products.md,
// 3.2), as the API keeps them; units are the same as a select offers them.
export const unitCodes = ["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"] as const satisfies readonly Unit[]
export const units = unitCodes.map((value) => ({ value, label: unitLabel(value) }))

const trimmed = z.string().trim()

// optional is an optional text: trimmed, counted as the API counts it, and
// null when nothing is left, as the API keeps it.
const optional = (max: number, tooLong: string) =>
  trimmed.refine((value) => [...value].length <= max, tooLong).transform((value) => (value === "" ? null : value))

// name is a name as the API takes it: not empty, 120 characters at most.
const name = trimmed.min(1, "Nomni kiriting").refine((value) => [...value].length <= 120, "Nom 120 belgidan oshmasin")

// price is an amount as typed ("12 000,5"): the spaces out and the comma a
// dot, then checked as the API checks it; nothing becomes null.
const price = z.string().transform((value, context) => {
  const text = value.replace(/\s/g, "").replace(",", ".")
  if (text === "") return null
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "Narx noto'g'ri" })
    return z.NEVER
  }
  return text
})

// productSchema checks the product dialog in the API's words and turns it
// into what the API takes (without the kind, which the dialog knows).
export const productSchema = z.object({
  name,
  unit: z.string().pipe(z.enum(unitCodes, { message: "Birlikni tanlang" })),
  sku: optional(60, "Artikul 60 belgidan oshmasin"),
  price,
  note: optional(500, "Izoh 500 belgidan oshmasin"),
})

// serviceSchema checks the service dialog: a service has no unit and no SKU.
export const serviceSchema = z.object({ name, price, note: optional(500, "Izoh 500 belgidan oshmasin") })

// ProductForm is what the product dialog holds; ProductOutput is the form
// as the API takes it. The same for a service.
export type ProductForm = { name: string; unit: string; sku: string; price: string; note: string }
export type ProductOutput = z.output<typeof productSchema>
export type ServiceForm = { name: string; price: string; note: string }
export type ServiceOutput = z.output<typeof serviceSchema>

// productDefaults is the product dialog as it opens: empty for a new
// product, with the fields of one being edited (its price as the API
// writes it, "12000.50").
export function productDefaults(product?: Product): ProductForm {
  return {
    name: product?.name ?? "",
    unit: product?.unit ?? "",
    sku: product?.sku ?? "",
    price: product?.price ?? "",
    note: product?.note ?? "",
  }
}

// serviceDefaults is the service dialog as it opens.
export function serviceDefaults(service?: Product): ServiceForm {
  return { name: service?.name ?? "", price: service?.price ?? "", note: service?.note ?? "" }
}
