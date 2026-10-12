"use client"

import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { SectionTabs } from "@/components/section-tabs"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
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
// see the finance: every account with what it holds in its own currency,
// the active first and then in the order added, the ones turned off last;
// each leads to its page.
export function AccountsPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const currencies = useCurrencies()
  const accounts = useAccountBalances(companyId)

  const columns: Column<AccountBalance>[] = [
    {
      header: "Akkaunt",
      primary: true,
      cell: (a) => (
        <span className="inline-flex items-center gap-2">
          {a.name}
          {!a.is_active && <Badge variant="outline">Nofaol</Badge>}
        </span>
      ),
    },
    { header: "Valyuta", card: "tag", className: "text-muted-foreground", cell: (a) => currencyOf(currencies, a.currency_id).code },
    {
      header: "Qoldiq",
      align: "end",
      card: "aside",
      cell: (a) => <span className={cn("tabular-nums", a.balance.startsWith("-") && "text-destructive")}>{signedMoney(a.balance, currencyOf(currencies, a.currency_id))}</span>,
    },
  ]

  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      <PageHeader title="Kassa" description="Akkauntlar va ulardagi pul" />
      {accounts.isPending && <ListLoading rows={3} mark="none" />}
      {accounts.isError && <Failed error={accounts.error} onRetry={() => accounts.refetch()} />}
      {accounts.data && <DataList label="Akkauntlar" items={accounts.data} columns={columns} getKey={(a) => a.id} href={(a) => `/accounts/${a.id}`} />}
    </div>
  )
}
