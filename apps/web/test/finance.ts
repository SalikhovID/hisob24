// The finance as the tests enter it through the mock API: the cash documents.
import { api, call } from "@/lib/api"
import type { CashOpeningInput, ConversionInput, ExpenseInput, MoneyTransferInput } from "@/lib/types"

export const enterCashOpening = (body: CashOpeningInput) => call(api.POST("/app/cash-openings", { body }))
export const enterExpense = (body: ExpenseInput) => call(api.POST("/app/expenses", { body }))
export const enterMoneyTransfer = (body: MoneyTransferInput) => call(api.POST("/app/money-transfers", { body }))
export const enterConversion = (body: ConversionInput) => call(api.POST("/app/conversions", { body }))
