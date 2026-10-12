// The sale form (logic/sales.md, section 3): what it checks and sends, and
// how it opens.
import { z } from "zod"
import { trimRate, UZS } from "./currencies"
import { onceEach } from "./stock"
import type { SaleDetail } from "./types"
import { atSchema, emptyLine, fromISO, idSchema, type LineForm, lineSchema, noteSchema, type PaymentLineForm, paymentLineSchema, rateSchema } from "./warehouse"

// saleSchema checks the sale form in the API's words and turns it into what
// the API takes (the location is the page's; the customer's name the form
// holds for the chip is left behind). No customer (0) is a retail sale. The
// rate goes with another currency alone.
export const saleSchema = z
  .object({
    customer_id: z.number().int().min(0),
    customer_name: z.string(),
    at: atSchema,
    currency_id: idSchema("Valyutani tanlang"),
    rate: rateSchema,
    note: noteSchema,
    items: z.array(lineSchema).min(1, "Kamida bitta mahsulot qo'shing").superRefine(onceEach),
    payments: z.array(paymentLineSchema),
  })
  .transform(({ customer_id, at, currency_id, rate, note, items, payments }) => ({
    customer_id: customer_id || null,
    at,
    currency_id,
    rate: currency_id === UZS ? null : rate,
    note,
    items,
    payments,
  }))

export type SaleForm = { customer_id: number; customer_name: string; at: string; currency_id: string; rate: string; note: string; items: LineForm[]; payments: PaymentLineForm[] }
export type SaleOutput = z.output<typeof saleSchema>

// saleDefaults is the sale form as it opens: now, to nobody, in so'm, one
// empty line and nothing paid for a new sale; the sale being edited otherwise.
export function saleDefaults(sale: SaleDetail | null, local: string): SaleForm {
  if (!sale) return { customer_id: 0, customer_name: "", at: local, currency_id: String(UZS), rate: "", note: "", items: [emptyLine()], payments: [] }
  return {
    customer_id: sale.customer?.id ?? 0,
    customer_name: sale.customer?.name ?? "",
    at: fromISO(sale.at),
    currency_id: String(sale.currency_id),
    rate: sale.currency_id === UZS ? "" : trimRate(sale.rate),
    note: sale.note ?? "",
    items: sale.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: item.price })),
    payments: sale.payments.map((p) => ({ bank_account_id: String(p.bank_account_id), amount: p.amount })),
  }
}
