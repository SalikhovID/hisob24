import { formatRate } from "./format"
import { useMe } from "./queries"
import type { CompanyCurrency } from "./types"

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
