"use client"

import { WalletIcon } from "lucide-react"
import Link from "next/link"
import { Hero } from "@/components/kit/hero"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { count, formatMoney } from "@/lib/format"
import type { Dashboard } from "@/lib/types"

// HomeHero heads the home with what the cash holds (logic/finance.md,
// section 4), as the prototype's hero: the so'm the accounts hold, big; the
// other currencies they hold and how many accounts there are under it; the
// way to the cash at its right. Nothing is turned into the so'm.
export function HomeHero({ cash }: { cash: NonNullable<Dashboard["cash"]> }) {
  const currencies = useCurrencies()
  const som = cash.totals.find((total) => total.currency_id === UZS)?.amount ?? "0.00"
  const others = cash.totals.filter((total) => total.currency_id !== UZS).map((total) => `+ ${formatMoney(total.amount, currencyOf(currencies, total.currency_id))}`)
  return (
    <Hero
      label="Kassadagi pul"
      icon={WalletIcon}
      action={
        <Link href="/accounts" className="rounded no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Kassa →
        </Link>
      }
      value={som}
      unit="so'm"
      sub={[...others, `${count(cash.accounts)} akkaunt`].join(" · ")}
    />
  )
}
