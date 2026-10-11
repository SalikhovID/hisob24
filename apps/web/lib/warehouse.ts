import { z } from "zod"
import { unitCodes } from "./catalog"
import { trimRate, UZS } from "./currencies"
import { formatAmount } from "./format"
import { formatPhoneInput, phoneDigits } from "./phone"
import type { Payment, PurchaseDetail, StatementRow, Supplier, Unit } from "./types"

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

// at is a moment as the datetime-local field gives it ("2026-10-07T09:00");
// one is needed. It is sent with the browser's offset, as the API takes it.
const at = z
  .string()
  .trim()
  .min(1, "Vaqtni kiriting")
  .transform((value, context) => {
    const iso = toISO(value)
    if (iso === null) {
      context.addIssue({ code: "custom", message: "Vaqt noto'g'ri" })
      return z.NEVER
    }
    return iso
  })

// id is a select's value (the id as text) turned into the id the API takes.
const id = (empty: string) => z.string().min(1, empty).transform(Number)

// rate is a rate as typed ("12 800,5"): the spaces out and the comma a
// dot; nothing becomes null (the API takes the standard rate then).
const rate = z.string().transform((value, context) => {
  const text = digits(value)
  if (text === "") return null
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(text) || Number(text) === 0) {
    context.addIssue({ code: "custom", message: "Kurs noto'g'ri" })
    return z.NEVER
  }
  return text
})

// paymentLineSchema checks one payment entered with a purchase: an account
// chosen, an amount above zero.
const paymentLineSchema = z.object({
  bank_account_id: id("Akkauntni tanlang"),
  amount: z.string().transform((value, context) => {
    const text = digits(value)
    if (!moneyPattern.test(text) || Number(text) === 0) {
      context.addIssue({ code: "custom", message: "Summa noto'g'ri" })
      return z.NEVER
    }
    return text
  }),
})

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

// paymentSchema checks the payment dialog: an account, an amount above
// zero in its currency, a moment, a rate (none: the standard one), a note.
export const paymentSchema = z.object({
  bank_account_id: id("Akkauntni tanlang"),
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
  at,
  rate,
  note,
})

// lineSchema checks one line of the purchase form: a product chosen, a
// quantity above zero, a price. The product's name and unit the form holds
// for the chip and the quantity's suffix are left behind.
const lineSchema = z.object({
  product_id: z.number().int().positive("Mahsulotni tanlang"),
  product_name: z.string(),
  unit: z.enum(unitCodes).nullable(),
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
}).transform(({ product_id, quantity, price }) => ({ product_id, quantity, price }))

// purchaseSchema checks the purchase form in the API's words and turns it
// into what the API takes (the location is the page's; the supplier's name
// the form holds for the chip is left behind). A product once per
// purchase: the second line of one is told. The rate goes with another
// currency alone.
export const purchaseSchema = z
  .object({
    supplier_id: z.number().int().positive("Ta'minotchini tanlang"),
    supplier_name: z.string(),
    at,
    currency_id: id("Valyutani tanlang"),
    rate,
    note,
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
    payments: z.array(paymentLineSchema),
  })
  .transform(({ supplier_id, at, currency_id, rate, note, items, payments }) => ({
    supplier_id,
    at,
    currency_id,
    rate: currency_id === UZS ? null : rate,
    note,
    items,
    payments,
  }))

export type SupplierForm = { name: string; phone: string; note: string }
export type SupplierOutput = z.output<typeof supplierSchema>
export type PaymentForm = { bank_account_id: string; amount: string; at: string; rate: string; note: string }
export type PaymentOutput = z.output<typeof paymentSchema>
// LineForm is one line as the form holds it: the product chosen (its name
// and unit for the chip and the quantity's unit), the quantity and the
// price as typed. PaymentLineForm is one payment entered with the
// purchase: the account chosen (its id as text) and the amount as typed.
export type LineForm = { product_id: number; product_name: string; unit: Unit | null; quantity: string; price: string }
export type PaymentLineForm = { bank_account_id: string; amount: string }
export type PurchaseForm = { supplier_id: number; supplier_name: string; at: string; currency_id: string; rate: string; note: string; items: LineForm[]; payments: PaymentLineForm[] }
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

// amountOf is an amount as typed, as a number; 0 while it is not one.
export function amountOf(text: string): number {
  const t = digits(text)
  return moneyPattern.test(t) ? Number(t) : 0
}

// balanceText says what the supplier's balance means: owed (above zero),
// an advance (below), or nothing.
export function balanceText(balance: string): { kind: "debt" | "advance" | "none"; text: string } {
  const value = Number(balance)
  if (value > 0) return { kind: "debt", text: `Qarz: ${formatAmount(balance)} so'm` }
  if (value < 0) return { kind: "advance", text: `Avans: ${formatAmount(balance.replace("-", ""))} so'm` }
  return { kind: "none", text: "Qarz yo'q" }
}

const pad = (n: number) => String(n).padStart(2, "0")

// toLocal writes a moment as the datetime-local field holds it, in the
// browser's time zone ("2026-10-07T09:00").
export function toLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// nowLocal is now as the datetime-local field holds it.
export function nowLocal(): string {
  return toLocal(new Date())
}

// toISO turns what the datetime-local field holds into the moment the API
// takes (with the browser's offset); null when it is no moment.
export function toISO(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) return null
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) return null
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const hh = pad(Math.floor(Math.abs(offset) / 60))
  const mm = pad(Math.abs(offset) % 60)
  return `${toLocal(date)}:00${sign}${hh}:${mm}`
}

// fromISO turns a moment the API told into what the datetime-local field
// holds, in the browser's time zone.
export function fromISO(iso: string): string {
  return toLocal(new Date(iso))
}

// supplierDefaults is the supplier dialog as it opens: empty, or with the
// fields of the one being edited (its phone as the field shows it).
export function supplierDefaults(supplier?: Supplier): SupplierForm {
  return { name: supplier?.name ?? "", phone: supplier?.phone ? formatPhoneInput(supplier.phone) : "", note: supplier?.note ?? "" }
}

// paymentDefaults is the payment dialog as it opens: the first account, now
// and nothing; or the payment being edited (a statement row of one too).
export function paymentDefaults(payment: Pick<Payment, "bank_account_id" | "amount" | "at" | "rate" | "note"> | undefined, local: string, firstAccount: number | null): PaymentForm {
  if (!payment) return { bank_account_id: firstAccount === null ? "" : String(firstAccount), amount: "", at: local, rate: "", note: "" }
  return { bank_account_id: String(payment.bank_account_id), amount: payment.amount, at: fromISO(payment.at), rate: trimRate(payment.rate), note: payment.note ?? "" }
}

// paymentOfRow is a statement row of a payment entered on its own as the
// payment dialog and the delete button take it.
export function paymentOfRow(row: StatementRow, supplierId: number): Pick<Payment, "id" | "supplier_id" | "bank_account_id" | "amount" | "currency_id" | "at" | "rate" | "note"> {
  return { id: row.id, supplier_id: supplierId, bank_account_id: row.bank_account_id ?? 0, amount: row.amount, currency_id: row.currency_id, at: row.at, rate: row.rate, note: row.note }
}

// emptyLine is a line not yet filled.
export const emptyLine = (): LineForm => ({ product_id: 0, product_name: "", unit: null, quantity: "", price: "" })

// purchaseDefaults is the purchase form as it opens: now, in so'm, one
// empty line and nothing paid for a new purchase; the purchase being edited
// otherwise.
export function purchaseDefaults(purchase: PurchaseDetail | null, local: string): PurchaseForm {
  if (!purchase) return { supplier_id: 0, supplier_name: "", at: local, currency_id: String(UZS), rate: "", note: "", items: [emptyLine()], payments: [] }
  return {
    supplier_id: purchase.supplier.id,
    supplier_name: purchase.supplier.name,
    at: fromISO(purchase.at),
    currency_id: String(purchase.currency_id),
    rate: purchase.currency_id === UZS ? "" : trimRate(purchase.rate),
    note: purchase.note ?? "",
    items: purchase.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: item.price })),
    payments: purchase.payments.map((p) => ({ bank_account_id: String(p.bank_account_id), amount: p.amount })),
  }
}
