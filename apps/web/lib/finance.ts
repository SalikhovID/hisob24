// The finance dialogs (logic/finance.md, section 5): what they check and
// send, and how they open; what the statements call each document.
import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { UZS } from "./currencies"
import { formatRate } from "./format"
import { accountsKey, accountStatementsKey, expensesKey, moneyTransfersKey } from "./queries"
import type { CashOpening, CompanyCurrency, Expense, FinanceKind, MoneyTransfer } from "./types"
import { atSchema, digits, fromISO, idSchema, moneyPattern, noteSchema } from "./warehouse"

// amountSchema is an amount as typed ("1 000 000,5"): the spaces out and
// the comma a dot; one is needed, above zero, two decimals at most.
function amountSchema(empty: string, wrong: string) {
  return z.string().transform((value, context) => {
    const text = digits(value)
    if (text === "") {
      context.addIssue({ code: "custom", message: empty })
      return z.NEVER
    }
    if (!moneyPattern.test(text) || Number(text) === 0) {
      context.addIssue({ code: "custom", message: wrong })
      return z.NEVER
    }
    return text
  })
}

const amount = amountSchema("Summani kiriting", "Summa noto'g'ri")

// cashOpeningSchema checks the cash opening dialog in the API's words and
// turns it into what the API takes.
export const cashOpeningSchema = z.object({
  bank_account_id: idSchema("Akkauntni tanlang"),
  amount,
  at: atSchema,
  note: noteSchema,
})

// expenseSchema checks the expense dialog: the kind, the account, a
// category of the kind, the amount, the moment, the note.
export const expenseSchema = z.object({
  kind: z.string().min(1, "Turni tanlang").pipe(z.enum(["expense", "income"])),
  bank_account_id: idSchema("Akkauntni tanlang"),
  category_id: idSchema("Kategoriyani tanlang"),
  amount,
  at: atSchema,
  note: noteSchema,
})

// anotherAccount refuses the same account on both sides before the API is
// asked (it would say the same).
const anotherAccount = (value: { from_account_id: number; to_account_id: number }, context: z.RefinementCtx) => {
  if (value.from_account_id === value.to_account_id) {
    context.addIssue({ code: "custom", path: ["to_account_id"], message: "Maqsad akkaunt boshqa bo'lsin" })
  }
}

// moneyTransferSchema checks the transfer dialog: the account it leaves,
// another it arrives in, the amount, the moment, the note.
export const moneyTransferSchema = z
  .object({
    from_account_id: idSchema("Akkauntni tanlang"),
    to_account_id: idSchema("Maqsad akkauntni tanlang"),
    amount,
    at: atSchema,
    note: noteSchema,
  })
  .superRefine(anotherAccount)

// conversionSchema checks the conversion dialog: the account it leaves and
// the amount that leaves, another account and the amount that arrives,
// the moment, the note.
export const conversionSchema = z
  .object({
    from_account_id: idSchema("Akkauntni tanlang"),
    amount,
    to_account_id: idSchema("Maqsad akkauntni tanlang"),
    to_amount: amountSchema("Maqsad summani kiriting", "Maqsad summa noto'g'ri"),
    at: atSchema,
    note: noteSchema,
  })
  .superRefine(anotherAccount)

export type CashOpeningForm = { bank_account_id: string; amount: string; at: string; note: string }
export type CashOpeningOutput = z.output<typeof cashOpeningSchema>
export type ExpenseForm = { kind: string; bank_account_id: string; category_id: string; amount: string; at: string; note: string }
export type ExpenseOutput = z.output<typeof expenseSchema>
export type MoneyTransferForm = { from_account_id: string; to_account_id: string; amount: string; at: string; note: string }
export type MoneyTransferOutput = z.output<typeof moneyTransferSchema>
export type ConversionForm = { from_account_id: string; amount: string; to_account_id: string; to_amount: string; at: string; note: string }
export type ConversionOutput = z.output<typeof conversionSchema>

const accountText = (id: number | null) => (id === null ? "" : String(id))

// cashOpeningDefaults is the cash opening dialog as it opens: now, into
// the first account; or the document being edited.
export function cashOpeningDefaults(opening: CashOpening | undefined, local: string, firstAccount: number | null): CashOpeningForm {
  if (!opening) return { bank_account_id: accountText(firstAccount), amount: "", at: local, note: "" }
  return { bank_account_id: String(opening.bank_account_id), amount: opening.amount, at: fromISO(opening.at), note: opening.note ?? "" }
}

// expenseDefaults is the expense dialog as it opens: now, of the kind
// asked, out of or into the first account, under no category yet; or the
// document being edited (its kind stays).
export function expenseDefaults(expense: Expense | undefined, local: string, firstAccount: number | null, kind: FinanceKind): ExpenseForm {
  if (!expense) return { kind, bank_account_id: accountText(firstAccount), category_id: "", amount: "", at: local, note: "" }
  return { kind: expense.kind, bank_account_id: String(expense.bank_account_id), category_id: String(expense.category_id), amount: expense.amount, at: fromISO(expense.at), note: expense.note ?? "" }
}

// moneyTransferDefaults is the transfer dialog as it opens: now, out of the
// first account, into none yet; or the document being edited.
export function moneyTransferDefaults(transfer: MoneyTransfer | undefined, local: string, firstAccount: number | null): MoneyTransferForm {
  if (!transfer) return { from_account_id: accountText(firstAccount), to_account_id: "", amount: "", at: local, note: "" }
  return { from_account_id: String(transfer.from_account_id), to_account_id: String(transfer.to_account_id), amount: transfer.amount, at: fromISO(transfer.at), note: transfer.note ?? "" }
}

// conversionDefaults is the conversion dialog as it opens: now, out of the
// first account, into none yet; or the document being edited.
export function conversionDefaults(conversion: MoneyTransfer | undefined, local: string, firstAccount: number | null): ConversionForm {
  if (!conversion) return { from_account_id: accountText(firstAccount), amount: "", to_account_id: "", to_amount: "", at: local, note: "" }
  return {
    from_account_id: String(conversion.from_account_id),
    amount: conversion.amount,
    to_account_id: String(conversion.to_account_id),
    to_amount: conversion.to_amount ?? "",
    at: fromISO(conversion.at),
    note: conversion.note ?? "",
  }
}

// conversionRateText is the rate a conversion comes to, as the amounts are
// typed (the API's rule): so'm per unit of the other currency when the
// so'm is on either side; what a unit of what leaves buys otherwise. None
// while either amount is not above zero.
export function conversionRateText(amount: string, toAmount: string, from: CompanyCurrency, to: CompanyCurrency): string | null {
  const leaving = Number(digits(amount))
  const arriving = Number(digits(toAmount))
  if (!(leaving > 0) || !(arriving > 0)) return null
  if (from.id === UZS) return `1 ${to.symbol} = ${formatRate((leaving / arriving).toFixed(4))} so'm`
  if (to.id === UZS) return `1 ${from.symbol} = ${formatRate((arriving / leaving).toFixed(4))} so'm`
  return `1 ${from.symbol} = ${formatRate((arriving / leaving).toFixed(4))} ${to.symbol}`
}

// FinanceDocumentKind is a kind of document an account's statement may hold.
export type FinanceDocumentKind = "cash_opening" | "expense" | "income" | "money_transfer" | "conversion" | "supplier_payment" | "customer_payment"

// financeKindTitle is what each is called («Xarajat № 7»); a payment is a
// payment, whose it was the row's other side tells.
export const financeKindTitle: Record<FinanceDocumentKind, string> = {
  cash_opening: "Kassa boshlang'ich qoldig'i",
  expense: "Xarajat",
  income: "Kirim",
  money_transfer: "O'tkazma",
  conversion: "Konvertatsiya",
  supplier_payment: "To'lov",
  customer_payment: "To'lov",
}

// forgetFinance drops what a cash document, or a payment, changes: what
// the accounts hold, their statements, the lists of the cash documents.
export function forgetFinance(queryClient: QueryClient, companyId: number) {
  queryClient.invalidateQueries({ queryKey: accountsKey(companyId) })
  queryClient.invalidateQueries({ queryKey: accountStatementsKey(companyId) })
  queryClient.invalidateQueries({ queryKey: expensesKey(companyId) })
  queryClient.invalidateQueries({ queryKey: moneyTransfersKey(companyId) })
}
