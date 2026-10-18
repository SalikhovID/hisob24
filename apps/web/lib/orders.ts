import { z } from "zod"
import { currencyOf, trimRate, UZS } from "./currencies"
import { answersDefaults, type Entries, readAnswers } from "./fields"
import { formatDate, formatMoney } from "./format"
import { phoneDigits } from "./phone"
import { moveLineSchema, onceEach } from "./stock"
import type { CompanyCurrency, CustomerAnswers, CustomerType, Order, OrderDetail, OrderType } from "./types"
import { digits, idSchema, type LineForm, moneyPattern, type PaymentLineForm, paymentLineSchema, rateSchema } from "./warehouse"

const pad = (n: number) => String(n).padStart(2, "0")

// todayISO is the day it is where the browser stands, as YYYY-MM-DD: what
// a deadline is measured against.
export function todayISO(): string {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const DAY = 24 * 60 * 60 * 1000

// DeadlineInfo is a deadline as people read it: the day (dd.mm.yyyy), how
// far off it is ("Bugun", "3 kun qoldi", "2 kun kechikdi"; null in a done
// stage, where the day is all that is said) and whether the order is late
// (past its day and not done).
export interface DeadlineInfo {
  date: string
  relative: string | null
  overdue: boolean
}

// deadlineOf reads a deadline (YYYY-MM-DD) against today, the browser's day.
export function deadlineOf(deadline: string, done: boolean, today = todayISO()): DeadlineInfo {
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  const relative = done ? null : days === 0 ? "Bugun" : days > 0 ? `${days} kun qoldi` : `${-days} kun kechikdi`
  return { date: formatDate(deadline), relative, overdue: !done && days < 0 }
}

// OrderForm is what the order form holds: the order's own fields (the stage
// and the assignee as a select's value, "" for none), an entry for each
// field of the type, for a new customer its type, phone and entries, and
// the order's money (logic/orders.md, 4.3): the price as typed, the
// currency (a select's value) and the rate, the lines of goods and, on
// entry, the advance's payments.
export type OrderForm = {
  deadline: string
  stage_id: string
  assignee_phone: string
  values: Entries
  customer: { type_id: string; phone: string; values: Entries }
  amount: string
  currency_id: string
  rate: string
  items: LineForm[]
  payments: PaymentLineForm[]
}

// OrderOutput is the form as the API takes it: the customer either one that
// is there, by its id, or a new one to enter with the order; the price
// (null for none), the currency, the rate with another currency than the
// so'm, the lines and the advance.
export type OrderOutput = {
  deadline: string
  stage_id: number
  assignee_phone: string | null
  values: CustomerAnswers
  customer: { id: number } | { type_id: number; phone: string; values: CustomerAnswers }
  amount: string | null
  currency_id: number
  rate: string | null
  items: { product_id: number; quantity: string }[]
  payments: { bank_account_id: number; amount: string }[]
}

// amountSchema is the price as typed ("5 000"): nothing is no price (null),
// else money as the API takes it ("Narx noto'g'ri").
const amountSchema = z.string().transform((value, context) => {
  const text = digits(value)
  if (text === "") return null
  if (!moneyPattern.test(text)) {
    context.addIssue({ code: "custom", message: "Narx noto'g'ri" })
    return z.NEVER
  }
  return text
})

const entries = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

// orderSchema checks the order form in the API's words, all of it at once,
// and turns it into what the API takes. customerType is the type a new
// customer is entered under (null when the company has none: then only a
// customer that is there will do); linked is the id of the customer that
// is there, whose fields are then not checked.
export function orderSchema(type: OrderType, customerType: CustomerType | null, linked: number | null) {
  return z
    .object({
      deadline: z.string(),
      stage_id: z.string(),
      assignee_phone: z.string(),
      values: entries,
      customer: z.object({ type_id: z.string(), phone: z.string(), values: entries }),
      amount: amountSchema,
      currency_id: idSchema("Valyutani tanlang"),
      rate: rateSchema,
      items: z.array(moveLineSchema).superRefine(onceEach),
      payments: z.array(paymentLineSchema),
    })
    .transform((form, context): OrderOutput => {
      const refuse = (path: string[], message: string) => context.addIssue({ code: "custom", message, path })
      if (form.deadline === "") refuse(["deadline"], "Muddatni kiriting")
      if (form.stage_id === "") refuse(["stage_id"], "Bosqichni tanlang")
      const values = readAnswers(type.fields, form.values, (key, message) => refuse(["values", key], message))

      let customer: OrderOutput["customer"]
      if (linked !== null) {
        customer = { id: linked }
      } else if (customerType === null) {
        refuse(["customer", "phone"], "Mijozni tanlang")
        customer = { id: 0 }
      } else {
        const phone = phoneDigits(form.customer.phone)
        if (phone === null) refuse(["customer", "phone"], "Telefon raqamini to'liq kiriting")
        const answers = readAnswers(customerType.fields, form.customer.values, (key, message) =>
          refuse(["customer", "values", key], message),
        )
        customer = { type_id: customerType.id, phone: phone ?? "", values: answers }
      }
      return {
        deadline: form.deadline,
        stage_id: Number(form.stage_id),
        assignee_phone: form.assignee_phone || null,
        values,
        customer,
        amount: form.amount,
        currency_id: form.currency_id,
        rate: form.currency_id === UZS ? null : form.rate,
        items: form.items,
        payments: form.payments,
      }
    })
}

// orderDefaults is the form as it opens: empty for a new order, in the stage
// it was opened for (stageId), in so'm with no price, no line and no
// advance; with the fields, the price and the lines of the order being
// edited (its payments are entered on their own, not in the form). The
// customer part is for a new customer of customerType, always empty.
export function orderDefaults(type: OrderType, customerType: CustomerType | null, stageId: number | null, order?: Order & Partial<Pick<OrderDetail, "items">>): OrderForm {
  const priced = order !== undefined && Number(order.amount) > 0
  return {
    deadline: order?.deadline ?? "",
    stage_id: String(order?.stage_id ?? stageId ?? ""),
    assignee_phone: order?.assignee?.phone ?? "",
    values: answersDefaults(type.fields, order?.values),
    customer: {
      type_id: customerType ? String(customerType.id) : "",
      phone: "",
      values: answersDefaults(customerType?.fields ?? []),
    },
    amount: priced ? order.amount : "",
    currency_id: String(order?.currency_id ?? UZS),
    rate: order && order.currency_id !== UZS ? trimRate(order.rate) : "",
    items: (order?.items ?? []).map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, quantity: item.quantity, price: "" })),
    payments: [],
  }
}

// moneyLine says an order's money on a card or a row (logic/orders.md,
// section 6): its price and what is left of it («5 000 $ · qolgan 4 300
// $»), «to'langan» once it is paid, «avans N» when more was paid; null for
// an order without a price.
export function moneyLine(order: Pick<Order, "amount" | "paid" | "currency_id">, currencies: readonly CompanyCurrency[]): string | null {
  const amount = Number(order.amount)
  if (!(amount > 0)) return null
  const currency = currencyOf(currencies, order.currency_id)
  const left = Math.round((amount - Number(order.paid)) * 100) / 100
  const rest = left > 0 ? `qolgan ${formatMoney(left.toFixed(2), currency)}` : left < 0 ? `avans ${formatMoney((-left).toFixed(2), currency)}` : "to'langan"
  return `${formatMoney(order.amount, currency)} · ${rest}`
}

export type DeadlineBucket = "late" | "today" | "week" | "later" | "done"

// bucketLabels are the orders list's groups, in their order.
export const bucketLabels: Record<DeadlineBucket, string> = {
  late: "Kechikkan",
  today: "Bugun",
  week: "Shu hafta",
  later: "Keyinroq",
  done: "Bajarilgan",
}

// deadlineBucket is the group of the orders list an order falls in by its
// deadline (YYYY-MM-DD) against today: past it, today, within a week, later;
// a done one is done.
export function deadlineBucket(deadline: string, done: boolean, today = todayISO()): DeadlineBucket {
  if (done) return "done"
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  if (days < 0) return "late"
  if (days === 0) return "today"
  return days <= 7 ? "week" : "later"
}

// orderName is what an order is called (logic/orders.md, 3.3): its number
// in the company, «Buyurtma № 12», the way a sale is «Sotuv № 1».
export function orderName(number: number): string {
  return `Buyurtma № ${number}`
}
