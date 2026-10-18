import { expect, test } from "vitest"
import { som } from "./currencies"
import type { CompanyCurrency, Customer, CustomerType, Order, OrderDetail, OrderType } from "./types"
import { bucketLabels, deadlineBucket, deadlineOf, moneyLine, orderDefaults, orderSchema, todayISO } from "./orders"

test("todayISO is the day where the browser stands, as YYYY-MM-DD", () => {
  const now = new Date()
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  expect(todayISO()).toBe(expected)
})

test("a deadline reads as a date with how far off it is; a done order's has no distance and is never late", () => {
  const today = "2026-10-06"
  expect(deadlineOf("2026-10-06", false, today)).toEqual({ date: "06.10.2026", relative: "Bugun", overdue: false })
  expect(deadlineOf("2026-10-07", false, today)).toEqual({ date: "07.10.2026", relative: "1 kun qoldi", overdue: false })
  expect(deadlineOf("2026-10-18", false, today)).toEqual({ date: "18.10.2026", relative: "12 kun qoldi", overdue: false })
  expect(deadlineOf("2026-11-05", false, today)).toEqual({ date: "05.11.2026", relative: "30 kun qoldi", overdue: false })
  expect(deadlineOf("2026-10-05", false, today)).toEqual({ date: "05.10.2026", relative: "1 kun kechikdi", overdue: true })
  expect(deadlineOf("2026-09-26", false, today)).toEqual({ date: "26.09.2026", relative: "10 kun kechikdi", overdue: true })
  // In a done stage the day is all that is said.
  expect(deadlineOf("2026-09-26", true, today)).toEqual({ date: "26.09.2026", relative: null, overdue: false })
  expect(deadlineOf("2026-10-06", true, today)).toEqual({ date: "06.10.2026", relative: null, overdue: false })
})

// Olma Savdo's type Buyurtma, with a required text, a number and a choice,
// and the customer type Jismoniy with a required name.
const buyurtma: OrderType = {
  id: 7,
  name: "Buyurtma",
  fields: [
    { id: 71, label: "Izoh", kind: "string", required: true, dropdown_id: null },
    { id: 72, label: "Summa", kind: "int", required: false, dropdown_id: null },
    { id: 73, label: "Kanal", kind: "checkbox", required: false, dropdown_id: 3 },
  ],
}
const jismoniy: CustomerType = {
  id: 5,
  name: "Jismoniy",
  fields: [
    { id: 51, label: "F.I.Sh.", kind: "string", required: true, is_unique: false, dropdown_id: null },
    { id: 52, label: "Yoshi", kind: "int", required: false, is_unique: false, dropdown_id: null },
  ],
}

// filled is a form filled in whole, for a new customer.
const filled = {
  title: " Qo'ng'iroq qilish ",
  deadline: "2026-10-10",
  stage_id: "12",
  assignee_phone: "998902223344",
  values: { f71: " Ertalab ", f72: "45000", f73: ["31", "32"] },
  customer: { type_id: "5", phone: "90 111 22 33", values: { f51: " Zarina Karimova ", f52: "" } },
  amount: "",
  currency_id: "1",
  rate: "",
  items: [],
  payments: [],
}

// issuesOf is what the schema refuses, by path.
function issuesOf(schema: ReturnType<typeof orderSchema>, form: unknown): Record<string, string> {
  const result = schema.safeParse(form)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]))
}

test("the schema turns a form with a new customer into what the API takes", () => {
  const schema = orderSchema(buyurtma, jismoniy, null)

  expect(schema.parse(filled)).toEqual({
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    stage_id: 12,
    assignee_phone: "998902223344",
    values: { 71: "Ertalab", 72: 45000, 73: [31, 32] },
    customer: { type_id: 5, phone: "998901112233", values: { 51: "Zarina Karimova" } },
    amount: null,
    currency_id: 1,
    rate: null,
    items: [],
    payments: [],
  })
  // Nobody assigned is null, and an answer left empty is left out.
  expect(schema.parse({ ...filled, assignee_phone: "", values: { f71: "X", f72: "", f73: [] } })).toMatchObject({
    assignee_phone: null,
    values: { 71: "X" },
  })
})

test("a customer that is there is sent by its id, and its fields are not checked", () => {
  const schema = orderSchema(buyurtma, jismoniy, 42)

  expect(schema.parse({ ...filled, customer: { type_id: "5", phone: "", values: { f51: "" } } })).toMatchObject({
    customer: { id: 42 },
  })
})

test("what is wrong with the form is said in the API's words, all at once", () => {
  const schema = orderSchema(buyurtma, jismoniy, null)

  expect(
    issuesOf(schema, {
      title: "  ",
      deadline: "",
      stage_id: "",
      assignee_phone: "",
      values: { f71: "", f72: "ko'p", f73: [] },
      customer: { type_id: "5", phone: "90 111", values: { f51: "", f52: "1.5" } },
      amount: "",
      currency_id: "1",
      rate: "",
      items: [],
      payments: [],
    }),
  ).toEqual({
    title: "Buyurtma nomini kiriting",
    deadline: "Muddatni kiriting",
    stage_id: "Bosqichni tanlang",
    "values.f71": "«Izoh» maydonini to'ldiring",
    "values.f72": "«Summa» butun son bo'lishi kerak",
    "customer.phone": "Telefon raqamini to'liq kiriting",
    "customer.values.f51": "«F.I.Sh.» maydonini to'ldiring",
    "customer.values.f52": "«Yoshi» butun son bo'lishi kerak",
  })
  expect(issuesOf(schema, { ...filled, title: "ў".repeat(201) })).toEqual({ title: "Buyurtma nomi 200 belgidan oshmasin" })
  expect(issuesOf(schema, { ...filled, title: "ў".repeat(200) })).toEqual({})
})

test("with no customer type to enter a customer under, only a customer that is there will do", () => {
  expect(issuesOf(orderSchema(buyurtma, null, null), filled)).toEqual({ "customer.phone": "Mijozni tanlang" })
  expect(orderSchema(buyurtma, null, 42).parse(filled)).toMatchObject({ customer: { id: 42 } })
})

test("the form opens empty for a new order, in the stage it was opened for, and filled for one being edited", () => {
  expect(orderDefaults(buyurtma, jismoniy, 12)).toEqual({
    title: "",
    deadline: "",
    stage_id: "12",
    assignee_phone: "",
    values: { f71: "", f72: "", f73: [] },
    customer: { type_id: "5", phone: "", values: { f51: "", f52: "" } },
    amount: "",
    currency_id: "1",
    rate: "",
    items: [],
    payments: [],
  })
  expect(orderDefaults(buyurtma, null, null).customer).toEqual({ type_id: "", phone: "", values: {} })

  const order: Order = {
    id: 1,
    type_id: 7,
    stage_id: 13,
    location_id: 1,
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    customer: { id: 42, phone: "998901112233", name: "Zarina Karimova" },
    assignee: { phone: "998902223344", full_name: "Vali Aliyev" },
    values: { 71: "Ertalab", 73: [32] },
    amount: "0.00",
    currency_id: 1,
    rate: "1.0000",
    amount_uzs: "0.00",
    paid: "0.00",
    created_by_name: null,
    created_at: "2026-10-02T06:01:00.000Z",
    updated_at: "2026-10-02T06:01:00.000Z",
  }
  expect(orderDefaults(buyurtma, jismoniy, 12, order)).toEqual({
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    stage_id: "13",
    assignee_phone: "998902223344",
    values: { f71: "Ertalab", f72: "", f73: ["32"] },
    customer: { type_id: "5", phone: "", values: { f51: "", f52: "" } },
    amount: "",
    currency_id: "1",
    rate: "",
    items: [],
    payments: [],
  })
  // An order with money and goods opens with them; its payments are not the form's.
  const priced: OrderDetail = {
    ...order,
    amount: "5000.00",
    currency_id: 2,
    rate: "12800.0000",
    amount_uzs: "64000000.00",
    paid: "400.00",
    items: [{ product_id: 3, name: "Olma", kind: "product", unit: "kg", quantity: "2.000", cost_uzs: null }],
    payments: [{ id: 9, bank_account_id: 7, account_name: "Naqd", amount: "400.00", currency_id: 1, rate: "1.0000", amount_uzs: "400.00", at: "", note: null, created_by_name: null }],
    cost_uzs: null,
    profit_uzs: null,
  }
  expect(orderDefaults(buyurtma, jismoniy, 12, priced)).toMatchObject({
    amount: "5000.00",
    currency_id: "2",
    rate: "12800",
    items: [{ product_id: 3, product_name: "Olma", unit: "kg", quantity: "2.000", price: "" }],
    payments: [],
  })
  const unassigned: Customer = { id: 42, type_id: 5, phone: "998901112233", values: {}, balance: null, balance_by_currency: null, created_by_name: null, created_at: "", updated_at: "" }
  expect(unassigned.id).toBe(42)
  expect(orderDefaults(buyurtma, jismoniy, 12, { ...order, assignee: null }).assignee_phone).toBe("")
})

test("an order's group by its deadline: the late, today's, this week's, the later; a done one is done whatever its day", () => {
  const today = "2026-10-06"
  expect(deadlineBucket("2026-10-05", false, today)).toBe("late")
  expect(deadlineBucket("2026-10-06", false, today)).toBe("today")
  expect(deadlineBucket("2026-10-07", false, today)).toBe("week")
  expect(deadlineBucket("2026-10-13", false, today)).toBe("week")
  expect(deadlineBucket("2026-10-14", false, today)).toBe("later")
  expect(deadlineBucket("2026-10-01", true, today)).toBe("done")
  expect(bucketLabels).toEqual({ late: "Kechikkan", today: "Bugun", week: "Shu hafta", later: "Keyinroq", done: "Bajarilgan" })
})

test("the schema takes the price, the currency and rate, the lines and the advance, in the API's words", () => {
  const schema = orderSchema(buyurtma, null, 42)
  const money = {
    ...filled,
    amount: "5 000",
    currency_id: "2",
    rate: "12 800,5",
    items: [{ product_id: 3, product_name: "Olma", unit: "kg", quantity: "2", price: "" }],
    payments: [{ bank_account_id: "7", amount: "400" }],
  }
  expect(schema.parse(money)).toMatchObject({ amount: "5000", currency_id: 2, rate: "12800.5", items: [{ product_id: 3, quantity: "2" }], payments: [{ bank_account_id: 7, amount: "400" }] })
  // No price, in so'm.
  expect(schema.parse({ ...money, amount: "", currency_id: "1", rate: "" })).toMatchObject({ amount: null, currency_id: 1, rate: null })
  expect(issuesOf(schema, { ...money, amount: "abc" })).toMatchObject({ amount: "Narx noto'g'ri" })
  expect(issuesOf(schema, { ...money, rate: "x" })).toMatchObject({ rate: "Kurs noto'g'ri" })
  expect(issuesOf(schema, { ...money, items: [{ product_id: 0, product_name: "", unit: null, quantity: "", price: "" }] })).toMatchObject({ "items.0.product_id": "Mahsulotni tanlang", "items.0.quantity": "Miqdor noto'g'ri" })
  expect(issuesOf(schema, { ...money, items: [money.items[0], { ...money.items[0] }] })).toMatchObject({ "items.1.product_id": "Bu mahsulot allaqachon kiritilgan" })
  expect(issuesOf(schema, { ...money, payments: [{ bank_account_id: "", amount: "0" }] })).toMatchObject({ "payments.0.bank_account_id": "Akkauntni tanlang", "payments.0.amount": "Summa noto'g'ri" })
})

test("moneyLine says an order's price and what is left of it, nothing for an order without a price", () => {
  const usd: CompanyCurrency = { id: 2, code: "USD", name: "AQSH dollari", symbol: "$", rate: "12800.0000" }
  const currencies = [som, usd]
  const priced = (amount: string, paid: string, currency_id = 2) => ({ amount, paid, currency_id }) as Order
  // The thousands stand apart by a no-break space, as every amount on screen.
  const plain = (line: string | null) => line?.replace(/\u00a0/g, " ") ?? null
  expect(plain(moneyLine(priced("5000.00", "700.00"), currencies))).toBe("5 000 $ · qolgan 4 300 $")
  expect(plain(moneyLine(priced("5000.00", "0.00"), currencies))).toBe("5 000 $ · qolgan 5 000 $")
  expect(plain(moneyLine(priced("5000.00", "5000.00"), currencies))).toBe("5 000 $ · to'langan")
  expect(plain(moneyLine(priced("5000.00", "5200.00"), currencies))).toBe("5 000 $ · avans 200 $")
  expect(plain(moneyLine(priced("1200000.00", "500000.50", 1), currencies))).toBe("1 200 000 so'm · qolgan 699 999,50 so'm")
  expect(moneyLine(priced("0.00", "0.00"), currencies)).toBeNull()
  expect(moneyLine(priced("0.00", "300.00"), currencies)).toBeNull()
})

