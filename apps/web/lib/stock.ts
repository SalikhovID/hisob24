// The stock documents besides the purchases (logic/warehouse.md, section 5)
// and a supplier's opening balances (section 6) as the forms hold them:
// what each form checks and sends, how it opens, and what a document's kind
// is called.
import { z } from "zod"
import { unitCodes } from "./catalog"
import { trimRate, UZS } from "./currencies"
import { formatQuantity } from "./format"
import type { GoodsKind, InventoryDetail, Opening, OpeningStockDetail, StatementRow, TransferDetail, Unit } from "./types"
import { atSchema, digits, emptyLine, fromISO, idSchema, type LineForm, lineSchema, moneyPattern, noteSchema, quantityPattern, rateSchema } from "./warehouse"

// onceEach refuses the second line of a product.
export const onceEach = (items: { product_id: number }[], context: z.RefinementCtx) => {
  const seen = new Set<number>()
  items.forEach((item, index) => {
    if (seen.has(item.product_id)) context.addIssue({ code: "custom", message: "Bu mahsulot allaqachon kiritilgan", path: [index, "product_id"] })
    seen.add(item.product_id)
  })
}

// moveLineSchema checks a line of a document without prices (the shared
// lines field holds a price all the same, unused here): a product chosen,
// a quantity above zero.
const moveLineSchema = z
  .object({
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
    price: z.string(),
  })
  .transform(({ product_id, quantity }) => ({ product_id, quantity }))

// transferSchema checks the transfer form in the API's words and turns it
// into what the API takes (the source is the page's).
export const transferSchema = z.object({
  to_location_id: idSchema("Maqsad lokatsiyani tanlang"),
  at: atSchema,
  note: noteSchema,
  items: z.array(moveLineSchema).min(1, "Kamida bitta mahsulot qo'shing").superRefine(onceEach),
})

// countLineSchema checks a line of the inventory form: a product chosen and
// what was counted (nothing at all is a count too). What the journal
// expected, shown beside it, is the server's to tell anew.
const countLineSchema = z
  .object({
    product_id: z.number().int().positive("Mahsulotni tanlang"),
    product_name: z.string(),
    unit: z.enum(unitCodes).nullable(),
    expected: z.string(),
    counted: z.string().transform((value, context) => {
      const text = digits(value)
      if (text === "") {
        context.addIssue({ code: "custom", message: "Sanalganni kiriting" })
        return z.NEVER
      }
      if (!quantityPattern.test(text)) {
        context.addIssue({ code: "custom", message: "Miqdor noto'g'ri" })
        return z.NEVER
      }
      return text
    }),
  })
  .transform(({ product_id, counted }) => ({ product_id, counted }))

// inventorySchema checks the inventory form and turns it into what the API
// takes (the location is the page's).
export const inventorySchema = z.object({
  at: atSchema,
  note: noteSchema,
  items: z.array(countLineSchema).min(1, "Kamida bitta mahsulot qo'shing").superRefine(onceEach),
})

// openingStockSchema is the purchase form's without the supplier and the
// payments. The rate goes with another currency alone.
export const openingStockSchema = z
  .object({
    at: atSchema,
    currency_id: idSchema("Valyutani tanlang"),
    rate: rateSchema,
    note: noteSchema,
    items: z.array(lineSchema).min(1, "Kamida bitta mahsulot qo'shing").superRefine(onceEach),
  })
  .transform(({ at, currency_id, rate, note, items }) => ({ at, currency_id, rate: currency_id === UZS ? null : rate, note, items }))

// openingSchema checks the opening balance dialog: a kind, an amount above
// zero in the currency chosen, the moment, the rate (with another currency
// than the so'm) and a note.
export const openingSchema = z
  .object({
    kind: z.string().min(1, "Turni tanlang").pipe(z.enum(["debt", "prepay"], { message: "Tur noto'g'ri" })),
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
    currency_id: idSchema("Valyutani tanlang"),
    rate: rateSchema,
    at: atSchema,
    note: noteSchema,
  })
  .transform(({ kind, amount, currency_id, rate, at, note }) => ({ kind, amount, currency_id, rate: currency_id === UZS ? null : rate, at, note }))

export type TransferForm = { to_location_id: string; at: string; note: string; items: LineForm[] }
export type TransferOutput = z.output<typeof transferSchema>
export type CountLineForm = { product_id: number; product_name: string; unit: Unit | null; expected: string; counted: string }
export type InventoryForm = { at: string; note: string; items: CountLineForm[] }
export type InventoryOutput = z.output<typeof inventorySchema>
export type OpeningStockForm = { at: string; currency_id: string; rate: string; note: string; items: LineForm[] }
export type OpeningStockOutput = z.output<typeof openingStockSchema>
export type OpeningForm = { kind: string; amount: string; currency_id: string; rate: string; at: string; note: string }
export type OpeningOutput = z.output<typeof openingSchema>

// OpeningFields is what the dialog needs of an opening balance being edited.
export type OpeningFields = Pick<Opening, "id" | "kind" | "supplier_id" | "amount" | "currency_id" | "rate" | "at" | "note">

export const emptyCount = (): CountLineForm => ({ product_id: 0, product_name: "", unit: null, expected: "", counted: "" })

// transferDefaults is the transfer form as it opens: now, no destination
// yet and one empty line for a new transfer; the transfer being edited
// otherwise.
export function transferDefaults(transfer: TransferDetail | null, local: string): TransferForm {
  if (!transfer) return { to_location_id: "", at: local, note: "", items: [emptyLine()] }
  return {
    to_location_id: String(transfer.to_location_id),
    at: fromISO(transfer.at),
    note: transfer.note ?? "",
    items: transfer.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: "" })),
  }
}

// inventoryDefaults is the inventory form as it opens: now and one empty
// line for a new count; the inventory being edited otherwise.
export function inventoryDefaults(inventory: InventoryDetail | null, local: string): InventoryForm {
  if (!inventory) return { at: local, note: "", items: [emptyCount()] }
  return {
    at: fromISO(inventory.at),
    note: inventory.note ?? "",
    items: inventory.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, expected: item.expected, counted: item.counted })),
  }
}

// openingStockDefaults is the opening stock form as it opens: now, in so'm
// and one empty line; the document being edited otherwise.
export function openingStockDefaults(opening: OpeningStockDetail | null, local: string): OpeningStockForm {
  if (!opening) return { at: local, currency_id: String(UZS), rate: "", note: "", items: [emptyLine()] }
  return {
    at: fromISO(opening.at),
    currency_id: String(opening.currency_id),
    rate: opening.currency_id === UZS ? "" : trimRate(opening.rate),
    note: opening.note ?? "",
    items: opening.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: item.price })),
  }
}

// openingDefaults is the opening balance dialog as it opens: a kind to
// choose, now, in so'm; the balance being edited otherwise.
export function openingDefaults(opening: OpeningFields | undefined, local: string): OpeningForm {
  if (!opening) return { kind: "", amount: "", currency_id: String(UZS), rate: "", at: local, note: "" }
  return {
    kind: opening.kind,
    amount: opening.amount,
    currency_id: String(opening.currency_id),
    rate: opening.currency_id === UZS ? "" : trimRate(opening.rate),
    at: fromISO(opening.at),
    note: opening.note ?? "",
  }
}

// openingOfRow is an opening balance as its row in the supplier's
// statement tells it, for the dialog that edits it.
export function openingOfRow(row: StatementRow, supplierId: number): OpeningFields {
  return {
    id: row.id,
    kind: row.kind === "supplier_prepay" ? "prepay" : "debt",
    supplier_id: supplierId,
    amount: row.amount,
    currency_id: row.currency_id,
    rate: row.rate,
    at: row.at,
    note: row.note,
  }
}

// differenceOf is what a count differs from the stock expected by, on
// screen while the count is typed: null until a count is typed.
export function differenceOf(expected: string, counted: string): string | null {
  const text = digits(counted)
  if (!quantityPattern.test(text)) return null
  return String(Math.round((Number(text) - Number(expected)) * 1000) / 1000)
}

// kindTitle is what a document of each kind is called ("Xarid № 3").
export const kindTitle: Record<GoodsKind, string> = {
  purchase: "Xarid",
  sale: "Sotuv",
  transfer: "Ko'chirish",
  inventory: "Inventarizatsiya",
  opening_stock: "Boshlang'ich qoldiq",
}

// documentHref is the address of a document's own page.
export function documentHref(kind: GoodsKind, id: number): string {
  switch (kind) {
    case "purchase":
      return `/purchases/${id}`
    case "sale":
      return `/sales/${id}`
    case "transfer":
      return `/transfers/${id}`
    case "inventory":
      return `/inventories/${id}`
    case "opening_stock":
      return `/opening-stock/${id}`
  }
}

// signedQuantity writes a signed quantity for people to read: a shortage or
// an outgoing move with a real minus ("−1,5 kg"), the rest as it is; with
// plus, an incoming move leads with "+".
export function signedQuantity(quantity: string, unit: string | null, plus = false): string {
  if (quantity.startsWith("-")) return `−${formatQuantity(quantity.slice(1), unit)}`
  return `${plus && Number(quantity) > 0 ? "+" : ""}${formatQuantity(quantity, unit)}`
}
