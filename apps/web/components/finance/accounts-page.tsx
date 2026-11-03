"use client"

import { WalletIcon } from "lucide-react"
import { Group, Row } from "@/components/kit/group"
import { Hero } from "@/components/kit/hero"
import { PageTitle } from "@/components/kit/page-title"
import { TileIcon } from "@/components/kit/tile-icon"
import { SectionTabs } from "@/components/section-tabs"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { convert, currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatMoney, formatRate } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { useAccountBalances } from "@/lib/queries"
import type { AccountBalance } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { cn } from "@/lib/utils"

export const financeSection = navItems.find((item) => item.key === "finance")!

// signedMoney is an amount with its currency, the minus sign a real one.
export function signedMoney(amount: string, currency: { symbol: string }): string {
  return amount.startsWith("-") ? `−${formatMoney(amount.slice(1), currency)}` : formatMoney(amount, currency)
}

// AccountsPage is the cash (logic/finance.md, section 4), for whoever may
// see the finance, as the prototype's list: every account a row with its
// wallet tile, its currency under its name and what it holds at its end
// (in its own currency, red below zero), the active first and then in the
// order added, the ones turned off last (said beside the name); each leads
// to its page.
export function AccountsPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const currencies = useCurrencies()
  const accounts = useAccountBalances(companyId)

  if (!gate) return null
  return (
    <>
      <PageTitle title="Kassa" description="Akkauntlar va ulardagi pul" />
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      {accounts.isPending && <ListLoading rows={3} />}
      {accounts.isError && <Failed error={accounts.error} onRetry={() => accounts.refetch()} />}
      {accounts.data && accounts.data.length > 0 && <CashTotal accounts={accounts.data} />}
      {accounts.data && (
        <Group label="Akkauntlar" inset="tile">
          {accounts.data.map((account) => {
            const currency = currencyOf(currencies, account.currency_id)
            return (
              <Row
                key={account.id}
                href={`/accounts/${account.id}`}
                media={<TileIcon icon={WalletIcon} />}
                title={account.name}
                badge={!account.is_active && <Badge>Nofaol</Badge>}
                sub={currency.code}
                end={<span className={cn("tabular-nums", account.balance.startsWith("-") && "text-destructive")}>{signedMoney(account.balance, currency)}</span>}
              />
            )
          })}
        </Group>
      )}
    </>
  )
}

// CashTotal heads the cash with what every account holds in so'm, as the
// prototype's card «Jami, so'mda»: each account turned by the rate in force
// (/app/me), the rates said under it; a currency with no rate stands apart,
// in its own.
function CashTotal({ accounts }: { accounts: AccountBalance[] }) {
  const currencies = useCurrencies()
  let som = 0
  const turned = new Set<number>()
  const apart = new Map<number, number>()
  for (const account of accounts) {
    const value = Number(account.balance)
    const inSom = convert(value, account.currency_id, UZS, currencies)
    if (inSom === null) apart.set(account.currency_id, (apart.get(account.currency_id) ?? 0) + value)
    else {
      som += inSom
      if (account.currency_id !== UZS && value !== 0) turned.add(account.currency_id)
    }
  }
  const sub = [
    ...[...turned].map((id) => {
      const currency = currencyOf(currencies, id)
      return `1 ${currency.symbol} = ${formatRate(currency.rate ?? "0")} so'm`
    }),
    ...[...apart].filter(([, value]) => value !== 0).map(([id, value]) => `+ ${formatMoney(value.toFixed(2), currencyOf(currencies, id))}`),
  ].join(" · ")
  return <Hero label="Jami, so'mda" icon={WalletIcon} value={som.toFixed(2)} unit="so'm" sub={sub || undefined} />
}

