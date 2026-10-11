import { formatRate } from "./format"
import { useMe } from "./queries"
import type { AppAccount, CompanyCurrency } from "./types"

// UZS is the so'm: every company's base currency, always on
// (logic/currencies.md).
export const UZS = 1

// som is the so'm as /app/me lists it: what an amount is in when the
// company has nothing else, and what an unknown currency falls back to.
export const som: CompanyCurrency = { id: UZS, code: "UZS", name: "O'zbek so'mi", symbol: "so'm", rate: "1.0000" }

// useCurrencies is the currencies the company has turned on, with the rate
// in force now, as /app/me told; the so'm alone until it answers.
export function useCurrencies(): CompanyCurrency[] {
  const me = useMe()
  return me.data?.currencies ?? [som]
}

// isMulti says whether the company works in more than the so'm: when the
// forms show a currency and a rate.
export const isMulti = (currencies: readonly CompanyCurrency[]) => currencies.length > 1

// currencyOf is the currency with the id among the company's, the so'm
// when it is not there.
export function currencyOf(currencies: readonly CompanyCurrency[], id: number): CompanyCurrency {
  return currencies.find((c) => c.id === id) ?? som
}

// currencyOptions is the currencies as a select offers them.
export function currencyOptions(currencies: readonly CompanyCurrency[]): { value: string; label: string }[] {
  return currencies.map((c) => ({ value: String(c.id), label: `${c.code} — ${c.name}` }))
}

// rateLine says what a currency is worth now ("1 USD = 12 800 so'm"), or
// that no rate was set.
export function rateLine(c: CompanyCurrency): string {
  return c.rate === null ? "Kurs kiritilmagan" : `1 ${c.code} = ${formatRate(c.rate)} so'm`
}

// rateOf is what a unit of the currency is worth in so'm now, as a number;
// null while no rate was set.
export function rateOf(currencies: readonly CompanyCurrency[], id: number): number | null {
  const rate = currencyOf(currencies, id).rate
  return rate === null ? null : Number(rate)
}

// convert turns an amount from one currency into another by the rates in
// force now, two decimals; null while a rate is missing.
export function convert(amount: number, from: number, to: number, currencies: readonly CompanyCurrency[]): number | null {
  if (from === to) return Math.round(amount * 100) / 100
  const a = rateOf(currencies, from)
  const b = rateOf(currencies, to)
  if (a === null || b === null || b === 0) return null
  return Math.round(((amount * a) / b) * 100) / 100
}

// trimRate writes a stored rate for a field ("12800.0000" → "12800",
// "12800.5000" → "12800.5").
export function trimRate(rate: string): string {
  return rate.includes(".") ? rate.replace(/0+$/, "").replace(/\.$/, "") : rate
}

// useAccounts is the company's live accounts as /app/me told; none until
// it answers.
export function useAccounts(): AppAccount[] {
  const me = useMe()
  return me.data?.accounts ?? []
}

// accountOptions is the accounts as a select offers them, each with its
// currency ("Naqd (so'm)"): the active ones, and the one chosen already
// (keep) even when turned off since.
export function accountOptions(accounts: readonly AppAccount[], currencies: readonly CompanyCurrency[], keep?: number): { value: string; label: string }[] {
  return accounts.filter((a) => a.is_active || a.id === keep).map((a) => ({ value: String(a.id), label: `${a.name} (${currencyOf(currencies, a.currency_id).symbol})` }))
}

// accountCurrency is the currency of the account with the id; the so'm
// when there is none such.
export function accountCurrency(accounts: readonly AppAccount[], currencies: readonly CompanyCurrency[], id: number): CompanyCurrency {
  return currencyOf(currencies, accounts.find((a) => a.id === id)?.currency_id ?? UZS)
}
