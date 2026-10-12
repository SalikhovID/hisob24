"use client"

import type { ReactNode } from "react"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { BalanceLine } from "@/lib/types"
import { cn } from "@/lib/utils"
import { balanceText } from "@/lib/warehouse"

// BalanceCard is what a party owes or is owed, on their page: a supplier's
// (logic/warehouse.md, section 6) or a customer's (logic/sales.md, section
// 5) balance in so'm, red when they owe us and green when we owe them, with
// what of it is in each currency when any is not in so'm; children stand
// beside it (the supplier's totals).
export function BalanceCard({ balance, byCurrency, children }: { balance: string; byCurrency: BalanceLine[] | null; children?: ReactNode }) {
  const currencies = useCurrencies()
  const text = balanceText(balance)
  const lines = (byCurrency ?? []).some((l) => l.currency_id !== UZS) ? (byCurrency ?? []).map((l) => formatMoney(l.amount, currencyOf(currencies, l.currency_id))).join(", ") : null
  return (
    <section aria-label="Balans" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
      <div>
        <p className={cn("text-lg font-semibold tabular-nums", text.kind === "debt" && "text-destructive", text.kind === "advance" && "text-emerald-700 dark:text-emerald-400")}>
          {text.text}
        </p>
        {lines && <p className="text-sm text-muted-foreground tabular-nums">shu jumladan {lines}</p>}
      </div>
      {children}
    </section>
  )
}
