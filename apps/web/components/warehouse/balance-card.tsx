"use client"

import { StatCard } from "@/components/kit/stat-cards"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatMoney } from "@/lib/format"
import type { BalanceLine, CompanyCurrency } from "@/lib/types"
import { balanceText } from "@/lib/warehouse"

// BalanceStat is a party's balance as a figure card of its page, the
// prototype's «Balans»: the amount in so'm, red when they owe us, green
// when we owe them; under it «Qarz», «Avans» or «Qarz yo'q» and what of it
// is in each currency when any is not in so'm.
export function BalanceStat({ balance, byCurrency }: { balance: string; byCurrency: BalanceLine[] | null }) {
  const currencies = useCurrencies()
  const { kind } = balanceText(balance)
  const lines = breakdown(byCurrency ?? [], currencies)
  const said = kind === "debt" ? "Qarz" : kind === "advance" ? "Avans" : "Qarz yo'q"
  return (
    <StatCard
      label="Balans"
      value={`${formatAmount(balance.replace("-", ""))} so'm`}
      tone={kind === "debt" ? "red" : kind === "advance" ? "green" : undefined}
      sub={lines ? `${said} · ${lines}` : said}
    />
  )
}

// breakdown says what of a balance is in each currency in words, without
// signs: what is owed, then what is paid ahead («qarz 88 000 so'm, avans
// 15 $»); a currency even is left out; null when nothing but the so'm is
// left.
function breakdown(lines: BalanceLine[], currencies: readonly CompanyCurrency[]): string | null {
  const left = lines.filter((l) => Number(l.amount) !== 0)
  if (!left.some((l) => l.currency_id !== UZS)) return null
  const said = (some: BalanceLine[]) => some.map((l) => formatMoney(l.amount.replace("-", ""), currencyOf(currencies, l.currency_id))).join(", ")
  const owed = left.filter((l) => Number(l.amount) > 0)
  const ahead = left.filter((l) => Number(l.amount) < 0)
  return [owed.length > 0 ? `qarz ${said(owed)}` : null, ahead.length > 0 ? `avans ${said(ahead)}` : null].filter(Boolean).join(", ")
}
