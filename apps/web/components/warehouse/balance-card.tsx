"use client"

import type { ReactNode } from "react"
import { Hero } from "@/components/kit/hero"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { BalanceLine } from "@/lib/types"
import { balanceText } from "@/lib/warehouse"

// BalanceCard is what a party owes or is owed, on their page, as the
// prototype's figure: a supplier's (logic/warehouse.md, section 6) or a
// customer's (logic/sales.md, section 5) balance in so'm, «Qarz» in red
// when they owe us, «Avans» in green when we owe them, «Qarz yo'q» when
// even; what of it is in each currency is said under it when any is not in
// so'm; children (the supplier's totals as BalanceChips) stand under it.
export function BalanceCard({ balance, byCurrency, children }: { balance: string; byCurrency: BalanceLine[] | null; children?: ReactNode }) {
  const currencies = useCurrencies()
  const { kind } = balanceText(balance)
  const lines = (byCurrency ?? []).some((l) => l.currency_id !== UZS) ? (byCurrency ?? []).map((l) => formatMoney(l.amount, currencyOf(currencies, l.currency_id))).join(", ") : null
  return (
    <section aria-label="Balans" className="mb-4">
      <Hero
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

// BalanceChip is one of the totals under a balance (the supplier's
// purchases and payments): its name, and the amount in bold under it.
export function BalanceChip({ label, value }: { label: string; value: string }) {
  return (
    <span data-slot="balance-chip" className="flex min-w-[9.5rem] flex-col items-center rounded-[14px] bg-card px-3.5 py-2 text-sm text-muted-foreground">
      {label}{" "}
      <b className="text-base font-semibold text-foreground tabular-nums">{value}</b>
    </span>
  )
}
