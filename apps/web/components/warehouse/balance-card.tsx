"use client"

import type { ReactNode } from "react"
import { Hero } from "@/components/kit/hero"
import { StatCard } from "@/components/kit/stat-cards"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatMoney } from "@/lib/format"
import type { BalanceLine, CompanyCurrency } from "@/lib/types"
import { balanceText } from "@/lib/warehouse"

// BalanceCard is what a party owes or is owed, on their page, as the
// prototype's figure: a supplier's (logic/warehouse.md, section 6) or a
// customer's (logic/sales.md, section 5) balance in so'm, «Qarz» in red
// when they owe us, «Avans» in green when we owe them, «Qarz yo'q» when
// even; what of it is in each currency is said under it when any is not in
// so'm (breakdown); children (the supplier's totals as BalanceChips) stand
// under it.
export function BalanceCard({ balance, byCurrency, children }: { balance: string; byCurrency: BalanceLine[] | null; children?: ReactNode }) {
  const currencies = useCurrencies()
  const { kind } = balanceText(balance)
  const lines = breakdown(byCurrency ?? [], currencies)
  return (
    <section aria-label="Balans" className="mb-4">
      <Hero
        plain
        label={kind === "debt" ? "Qarz" : kind === "advance" ? "Avans" : "Qarz yo'q"}
        tone={kind === "debt" ? "red" : kind === "advance" ? "green" : undefined}
        value={balance.replace("-", "")}
        unit="so'm"
        badges={lines && <span className="text-sm font-medium text-muted-foreground tabular-nums">shu jumladan {lines}</span>}
        className="pt-1 pb-4"
      />
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  )
}

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

// BalanceChip is one of the totals under a balance (the supplier's
// purchases and payments), a small card of frosted glass: its name, and the
// amount in bold under it.
export function BalanceChip({ label, value }: { label: string; value: string }) {
  return (
    <span data-slot="balance-chip" className="flex min-w-[9.5rem] flex-col items-center rounded-[14px] surface px-3.5 py-2 text-sm text-muted-foreground">
      {label}{" "}
      <b className="text-base font-semibold text-foreground tabular-nums">{value}</b>
    </span>
  )
}
