import { describe, expect, test } from "vitest"
import { som, UZS } from "./currencies"
import {
  cashOpeningDefaults,
  cashOpeningSchema,
  conversionDefaults,
  conversionRateText,
  conversionSchema,
  expenseDefaults,
  expenseSchema,
  financeKindTitle,
  moneyTransferDefaults,
  moneyTransferSchema,
} from "./finance"
import type { CashOpening, CompanyCurrency, Expense, MoneyTransfer } from "./types"
import { toISO } from "./warehouse"

const at = toISO("2026-10-07T09:00")!
const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) => result.error?.issues.map((i) => [i.path.join("."), i.message])
const usd: CompanyCurrency = { id: 2, code: "USD", name: "AQSH dollari", symbol: "$", rate: "12800.0000" }
const eur: CompanyCurrency = { id: 3, code: "EUR", name: "Yevro", symbol: "€", rate: null }

describe("the cash opening dialog", () => {
  const base = { bank_account_id: "9101", amount: "1 000 000,5", at: "2026-10-07T09:00", note: " Boshlanish " }
  test("is turned into what the API takes: the account, the amount as digits, the moment, the note or none", () => {
    expect(cashOpeningSchema.parse(base)).toEqual({ bank_account_id: 9101, amount: "1000000.5", at, note: "Boshlanish" })
    expect(cashOpeningSchema.parse({ ...base, note: "  " })).toMatchObject({ note: null })
  })
  test("tells what is wrong where it is wrong, in the API's words", () => {
    expect(issues(cashOpeningSchema.safeParse({ ...base, bank_account_id: "" }))).toEqual([["bank_account_id", "Akkauntni tanlang"]])
    expect(issues(cashOpeningSchema.safeParse({ ...base, amount: "" }))).toEqual([["amount", "Summani kiriting"]])
    expect(issues(cashOpeningSchema.safeParse({ ...base, amount: "0" }))).toEqual([["amount", "Summa noto'g'ri"]])
    expect(issues(cashOpeningSchema.safeParse({ ...base, amount: "1.234" }))).toEqual([["amount", "Summa noto'g'ri"]])
    expect(issues(cashOpeningSchema.safeParse({ ...base, at: "" }))).toEqual([["at", "Vaqtni kiriting"]])
    expect(issues(cashOpeningSchema.safeParse({ ...base, note: "a".repeat(501) }))).toEqual([["note", "Izoh 500 belgidan oshmasin"]])
  })
  test("opens now into the first account, or with the document being edited", () => {
    expect(cashOpeningDefaults(undefined, "2026-10-07T09:00", 9101)).toEqual({ bank_account_id: "9101", amount: "", at: "2026-10-07T09:00", note: "" })
    expect(cashOpeningDefaults(undefined, "2026-10-07T09:00", null)).toMatchObject({ bank_account_id: "" })
    const opening: CashOpening = { id: 7, number: 1, bank_account_id: 9112, account_name: "Karta", currency_id: 2, amount: "250.50", at: "2026-10-07T04:00:00Z", note: null, created_by_name: null, created_at: at, updated_at: at }
    expect(cashOpeningDefaults(opening, "2026-10-08T09:00", 9101)).toEqual({ bank_account_id: "9112", amount: "250.50", at: "2026-10-07T09:00", note: "" })
  })
})

describe("the expense dialog", () => {
  const base = { kind: "expense", bank_account_id: "9101", category_id: "3", amount: "150 000", at: "2026-10-07T09:00", note: "" }
  test("is turned into what the API takes: the kind, the account, the category, the amount, the moment, the note", () => {
    expect(expenseSchema.parse(base)).toEqual({ kind: "expense", bank_account_id: 9101, category_id: 3, amount: "150000", at, note: null })
    expect(expenseSchema.parse({ ...base, kind: "income" })).toMatchObject({ kind: "income" })
  })
  test("tells what is wrong, in the API's words", () => {
    expect(issues(expenseSchema.safeParse({ ...base, kind: "" }))).toEqual([["kind", "Turni tanlang"]])
    expect(issues(expenseSchema.safeParse({ ...base, bank_account_id: "" }))).toEqual([["bank_account_id", "Akkauntni tanlang"]])
    expect(issues(expenseSchema.safeParse({ ...base, category_id: "" }))).toEqual([["category_id", "Kategoriyani tanlang"]])
    expect(issues(expenseSchema.safeParse({ ...base, amount: "x" }))).toEqual([["amount", "Summa noto'g'ri"]])
  })
  test("opens now, of the kind asked, into the first account, with no category; or with the document being edited", () => {
    expect(expenseDefaults(undefined, "2026-10-07T09:00", 9101, "income")).toEqual({ kind: "income", bank_account_id: "9101", category_id: "", amount: "", at: "2026-10-07T09:00", note: "" })
    const rent: Expense = { id: 7, kind: "expense", number: 1, bank_account_id: 9101, account_name: "Naqd", currency_id: 1, category_id: 3, category_name: "Ijara", amount: "150000.00", at: "2026-10-07T04:00:00Z", note: "Oktabr", created_by_name: null, created_at: at, updated_at: at }
    expect(expenseDefaults(rent, "2026-10-08T09:00", 9112, "income")).toEqual({ kind: "expense", bank_account_id: "9101", category_id: "3", amount: "150000.00", at: "2026-10-07T09:00", note: "Oktabr" })
  })
})

describe("the transfer and the conversion dialogs", () => {
  const transfer = { from_account_id: "9101", to_account_id: "9103", amount: "100 000", at: "2026-10-07T09:00", note: "" }
  const conversion = { from_account_id: "9101", amount: "128 000", to_account_id: "9112", to_amount: "10", at: "2026-10-07T09:00", note: "" }
  test("are turned into what the API takes", () => {
    expect(moneyTransferSchema.parse(transfer)).toEqual({ from_account_id: 9101, to_account_id: 9103, amount: "100000", at, note: null })
    expect(conversionSchema.parse(conversion)).toEqual({ from_account_id: 9101, amount: "128000", to_account_id: 9112, to_amount: "10", at, note: null })
  })
  test("tell what is wrong, in the API's words; the same account on both sides is told before the API is asked", () => {
    expect(issues(moneyTransferSchema.safeParse({ ...transfer, from_account_id: "" }))).toEqual([["from_account_id", "Akkauntni tanlang"]])
    expect(issues(moneyTransferSchema.safeParse({ ...transfer, to_account_id: "" }))).toEqual([["to_account_id", "Maqsad akkauntni tanlang"]])
    expect(issues(moneyTransferSchema.safeParse({ ...transfer, to_account_id: "9101" }))).toEqual([["to_account_id", "Maqsad akkaunt boshqa bo'lsin"]])
    expect(issues(moneyTransferSchema.safeParse({ ...transfer, amount: "" }))).toEqual([["amount", "Summani kiriting"]])
    expect(issues(conversionSchema.safeParse({ ...conversion, to_amount: "" }))).toEqual([["to_amount", "Maqsad summani kiriting"]])
    expect(issues(conversionSchema.safeParse({ ...conversion, to_amount: "0" }))).toEqual([["to_amount", "Maqsad summa noto'g'ri"]])
    expect(issues(conversionSchema.safeParse({ ...conversion, to_account_id: "9101" }))).toEqual([["to_account_id", "Maqsad akkaunt boshqa bo'lsin"]])
  })
  test("open now out of the first account into nothing yet; or with the document being edited", () => {
    expect(moneyTransferDefaults(undefined, "2026-10-07T09:00", 9101)).toEqual({ from_account_id: "9101", to_account_id: "", amount: "", at: "2026-10-07T09:00", note: "" })
    expect(conversionDefaults(undefined, "2026-10-07T09:00", null)).toEqual({ from_account_id: "", amount: "", to_account_id: "", to_amount: "", at: "2026-10-07T09:00", note: "" })
    const moved: MoneyTransfer = { id: 7, kind: "money_transfer", number: 1, from_account_id: 9101, from_account_name: "Naqd", currency_id: 1, amount: "100000.00", to_account_id: 9103, to_account_name: "Kassa 2", to_currency_id: 1, to_amount: null, rate: null, at: "2026-10-07T04:00:00Z", note: "Kassaga", created_by_name: null, created_at: at, updated_at: at }
    expect(moneyTransferDefaults(moved, "2026-10-08T09:00", 9112)).toEqual({ from_account_id: "9101", to_account_id: "9103", amount: "100000.00", at: "2026-10-07T09:00", note: "Kassaga" })
    const converted: MoneyTransfer = { ...moved, kind: "conversion", to_account_id: 9112, to_account_name: "Karta", to_currency_id: 2, amount: "128000.00", to_amount: "10.00", rate: "12800.0000", note: null }
    expect(conversionDefaults(converted, "2026-10-08T09:00", 9101)).toEqual({ from_account_id: "9101", amount: "128000.00", to_account_id: "9112", to_amount: "10.00", at: "2026-10-07T09:00", note: "" })
  })
  test("the rate a conversion comes to is told as the amounts are typed: so'm per unit of the other currency, or what a unit of what leaves buys", () => {
    // The rate is written like the currencies' own (a no-break space in the thousands).
    expect(conversionRateText("128 000", "10", som, usd)).toBe("1 $ = 12\u00a0800 so'm")
    expect(conversionRateText("10", "127 000,5", usd, som)).toBe("1 $ = 12\u00a0700,05 so'm")
    expect(conversionRateText("100", "90", usd, eur)).toBe("1 $ = 0,9 €")
    expect(conversionRateText("", "10", som, usd)).toBeNull()
    expect(conversionRateText("5", "0", som, usd)).toBeNull()
    expect(UZS).toBe(som.id)
  })
})

test("every document an account's statement may hold has a title", () => {
  expect(financeKindTitle).toEqual({
    cash_opening: "Kassa boshlang'ich qoldig'i",
    expense: "Xarajat",
    income: "Kirim",
    money_transfer: "O'tkazma",
    conversion: "Konvertatsiya",
    supplier_payment: "To'lov",
    customer_payment: "To'lov",
  })
})
