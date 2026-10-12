"use client"

import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { can } from "@/lib/permissions"
import { useAccountBalances } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { cn } from "@/lib/utils"
import { signedMoney } from "./accounts-page"
import { AccountStatementList } from "./account-statement-list"
import { CashOpeningDialog } from "./cash-opening-dialog"

const back = { href: "/accounts", label: "Kassa" }

// AccountPage is one account of the company (logic/finance.md, section 4),
// for whoever may see the finance: what it holds, its statement, and the
// cash documents that go into or out of it (for whoever may add them).
export function AccountPage({ id }: { id: number }) {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const currencies = useCurrencies()
  const accounts = useAccountBalances(companyId)

  if (!gate || companyId === null) return null
  const account = accounts.data?.find((a) => a.id === id)
  if (accounts.data && !account) {
    return <PageHeader title="Akkaunt topilmadi" description="Bu akkaunt o'chirilgan yoki sizning kompaniyangizniki emas." back={back} />
  }
  if (!account) {
    return (
      <div className="space-y-5">
        <PageHeader title="Akkaunt" back={back} />
        {accounts.isError ? <Failed error={accounts.error} onRetry={() => accounts.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const currency = currencyOf(currencies, account.currency_id)
  return (
    <div className="space-y-5">
      <PageHeader
        title={account.name}
        description={`${currency.code} · ${account.is_active ? "Faol" : "Nofaol"}`}
        back={back}
        stack
        actions={allowed("finance.create") && <CashOpeningDialog companyId={companyId} accountId={account.id} />}
      />
      <section aria-label="Qoldiq" className="rounded-xl border bg-card p-4">
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">Akkauntdagi pul, o&apos;z valyutasida</p>
        <p className={cn("text-lg font-semibold tabular-nums", account.balance.startsWith("-") && "text-destructive")}>{signedMoney(account.balance, currency)}</p>
      </section>
      <AccountStatementList companyId={companyId} account={account} currency={currency} canEdit={allowed("finance.edit")} canDelete={allowed("finance.delete")} />
    </div>
  )
}
