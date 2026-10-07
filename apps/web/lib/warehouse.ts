import { z } from "zod"
import { formatAmount } from "./format"
import { phoneDigits } from "./phone"
import type { Payment, PurchaseDetail, Supplier } from "./types"

const trimmed = z.string().trim()

// optional is an optional text: trimmed, counted as the API counts it, and
// null when nothing is left, as the API keeps it.
const optional = (max: number, tooLong: string) =>
  trimmed.refine((value) => [...value].length <= max, tooLong).transform((value) => (value === "" ? null : value))

const name = trimmed.min(1, "Nomni kiriting").refine((value) => [...value].length <= 120, "Nom 120 belgidan oshmasin")
const note = optional(500, "Izoh 500 belgidan oshmasin")

// digits is a number as typed ("12 000,5"): the spaces out and the comma a
// dot, ready to be checked as the API checks it.
const digits = (value: string) => value.replace(/\s/g, "").replace(",", ".")
const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/
const quantityPattern = /^\d{1,9}(\.\d{1,3})?$/

// amount is an optional amount as typed: nothing becomes null, what does
// not match is refused with bad.
const amount = (bad: string) =>
  z.string().transform((value, context) => {
    const text = digits(value)
    if (text === "") return null
    if (!moneyPattern.test(text)) {
      context.addIssue({ code: "custom", message: bad })
      return z.NEVER
    }
    return text
  })

// day is a day as the date field gives it (YYYY-MM-DD); one is needed.
const day = z.string().trim().min(1, "Sanani kiriting")

// supplierSchema checks the supplier dialog in the API's words and turns it
// into what the API takes: the phone as digits (998…) or null.
export const supplierSchema = z.object({
  name,
  phone: z.string().transform((value, context) => {
    if (value.replace(/\D/g, "") === "") return null
    const phone = phoneDigits(value)
    if (phone === null) {
      context.addIssue({ code: "custom", message: "Telefon raqami noto'g'ri" })
      return z.NEVER
    }
    return phone
  }),
  note,
})

// paymentSchema checks the payment dialog: an amount above zero, a day, a
// note.
export const paymentSchema = z.object({
  amount: z.string().transform((value, context) => {
    const text = digits(value)
    if (text === "") {
      context.addIssue({ code: "custom", message: "Summani kiriting" })
      return z.NEVER
    }
    if (!moneyPattern.test(text) || Number(text) === 0) {
      context.addIssue({ code: "custom", message: "Summa noto'g'ri" })
      return z.NEVER
    }
    return text
  }),
  paid_on: day,
  note,
})

// lineSchema checks one line of the purchase form: a product chosen, a
// quantity above zero, a price.
const lineSchema = z.object({
  product_id: z.number().int().positive("Mahsulotni tanlang"),
  quantity: z.string().transform((value, context) => {
    const text = digits(value)
    if (!quantityPattern.test(text) || Number(text) === 0) {
      context.addIssue({ code: "custom", message: "Miqdor noto'g'ri" })
      return z.NEVER
    }
    return text
  }),
  price: z.string().transform((value, context) => {
    const text = digits(value)
    if (!moneyPattern.test(text)) {
      context.addIssue({ code: "custom", message: "Narx noto'g'ri" })
      return z.NEVER
    }
    return text
  }),
})

// purchaseSchema checks the purchase form in the API's words and turns it
// into what the API takes (the location is the page's). A product once per
// purchase: the second line of one is told.
export const purchaseSchema = z.object({
  supplier_id: z.number().int().positive("Ta'minotchini tanlang"),
  purchased_on: day,
  note,
  paid: amount("To'langan summa noto'g'ri"),
  items: z
    .array(lineSchema)
    .min(1, "Kamida bitta mahsulot qo'shing")
    .superRefine((items, context) => {
      const seen = new Set<number>()
      items.forEach((item, index) => {
        if (seen.has(item.product_id)) context.addIssue({ code: "custom", message: "Bu mahsulot allaqachon kiritilgan", path: [index, "product_id"] })
        seen.add(item.product_id)
      })
    }),
})

export type SupplierForm = { name: string; phone: string; note: string }
export type SupplierOutput = z.output<typeof supplierSchema>
export type PaymentForm = { amount: string; paid_on: string; note: string }
export type PaymentOutput = z.output<typeof paymentSchema>
// LineForm is one line as the form holds it: the product chosen (its name
// and unit for the chip and the quantity's unit), the quantity and the
// price as typed.
export type LineForm = { product_id: number; product_name: string; unit: string | null; quantity: string; price: string }
export type PurchaseForm = { supplier_id: number; supplier_name: string; purchased_on: string; note: string; paid: string; items: LineForm[] }
export type PurchaseOutput = z.output<typeof purchaseSchema>

// lineAmount is what a line comes to as typed (quantity × price, two
// decimals), null while either is not a number.
export function lineAmount(quantity: string, price: string): string | null {
  const q = digits(quantity)
  const p = digits(price)
  if (!quantityPattern.test(q) || !moneyPattern.test(p)) return null
  return String(Math.round(Number(q) * Number(p) * 100) / 100)
}

// purchaseTotal is what the lines come to, the lines not yet numbers left
// out.
export function purchaseTotal(lines: { quantity: string; price: string }[]): string {
  const sum = lines.reduce((total, line) => total + Number(lineAmount(line.quantity, line.price) ?? 0), 0)
  return String(Math.round(sum * 100) / 100)
}

// balanceText says what the supplier's balance means: owed (above zero),
// an advance (below), or nothing.
export function balanceText(balance: string): { kind: "debt" | "advance" | "none"; text: string } {
  const value = Number(balance)
  if (value > 0) return { kind: "debt", text: `Qarz: ${formatAmount(balance)} so'm` }
  if (value < 0) return { kind: "advance", text: `Avans: ${formatAmount(balance.replace("-", ""))} so'm` }
  return { kind: "none", text: "Qarz yo'q" }
}

// today is the day as the date field writes it, in the browser's time zone.
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// supplierDefaults is the supplier dialog as it opens: empty, or with the
// fields of the one being edited (its phone as the field shows it).
export function supplierDefaults(supplier?: Supplier): SupplierForm {
  return { name: supplier?.name ?? "", phone: supplier?.phone ? supplier.phone.slice(3) : "", note: supplier?.note ?? "" }
}

// paymentDefaults is the payment dialog as it opens: today and nothing, or
// the payment being edited.
export function paymentDefaults(payment: Payment | undefined, day: string): PaymentForm {
  return { amount: payment?.amount ?? "", paid_on: payment?.paid_on ?? day, note: payment?.note ?? "" }
}

// emptyLine is a line not yet filled.
export const emptyLine = (): LineForm => ({ product_id: 0, product_name: "", unit: null, quantity: "", price: "" })

// purchaseDefaults is the purchase form as it opens: today, one empty line
// and nothing paid for a new purchase; the purchase being edited otherwise.
export function purchaseDefaults(purchase: PurchaseDetail | null, day: string): PurchaseForm {
  if (!purchase) return { supplier_id: 0, supplier_name: "", purchased_on: day, note: "", paid: "", items: [emptyLine()] }
  return {
    supplier_id: purchase.supplier.id,
    supplier_name: purchase.supplier.name,
    purchased_on: purchase.purchased_on,
    note: purchase.note ?? "",
    paid: Number(purchase.paid) === 0 ? "" : purchase.paid,
    items: purchase.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: item.price })),
  }
}
