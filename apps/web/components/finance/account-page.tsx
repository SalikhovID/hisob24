"use client"

import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, EllipsisIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { PageAction, PageActions } from "@/components/kit/page-actions"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useAccountBalances } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { AccountStatementList } from "./account-statement-list"
import { CashOpeningDialog } from "./cash-opening-dialog"
import { ConversionDialog } from "./conversion-dialog"
import { ExpenseDialog } from "./expense-dialog"
import { MoneyTransferDialog } from "./money-transfer-dialog"

const back = { href: "/accounts", label: "Kassa" }

// Entering is the cash document whose sheet is open, entered into the account.
type Entering = "expense" | "income" | "transfer" | "conversion" | "opening"

// AccountPage is one account of the company (logic/finance.md, section 4),
// for whoever may see the finance, as the prototype's page: its name over
// what it holds («Qoldiq: N», in its currency, and whether it is turned
// off); the actions at the title's right that enter a cash document into it
// (an expense, an income, a transfer, and under «Yana» a conversion and an
// opening balance) for whoever may add them, while it is active (the forms
// do not offer an inactive one); its statement.
export function AccountPage({ id }: { id: number }) {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const currencies = useCurrencies()
  const accounts = useAccountBalances(companyId)
  const [entering, setEntering] = useState<Entering | null>(null)
  const [more, setMore] = useState(false)

  if (!gate || companyId === null) return null
  const account = accounts.data?.find((a) => a.id === id)
  if (accounts.data && !account) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Akkaunt topilmadi" description="Bu akkaunt o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  if (!account) {
    return (
      <>
        <PageTitle title="Akkaunt" back={back} />
        {accounts.isError ? <Failed error={accounts.error} onRetry={() => accounts.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const currency = currencyOf(currencies, account.currency_id)
  const adding = allowed("finance.create") && account.is_active
  const close = (open: boolean) => !open && setEntering(null)
  const into = { companyId, accountId: account.id, open: true, onOpenChange: close }

  return (
    <>
      <PageTitle
        back={back}
        title={account.name}
        description={
          <>
            <span>Qoldiq: {formatMoney(account.balance, currency)}</span>
            {!account.is_active && <Badge className="ml-2 align-middle">Nofaol</Badge>}
          </>
        }
        action={
          adding && (
            <PageActions>
              <PageAction icon={ArrowUpRightIcon} label="Xarajat" onClick={() => setEntering("expense")} />
              <PageAction icon={ArrowDownLeftIcon} label="Kirim" onClick={() => setEntering("income")} />
              <PageAction icon={ArrowLeftRightIcon} label="O'tkazma" onClick={() => setEntering("transfer")} />
              <PageAction icon={EllipsisIcon} label="Yana" onClick={() => setMore(true)} />
            </PageActions>
          )
        }
      />
      <AccountStatementList companyId={companyId} account={account} currency={currency} canEdit={allowed("finance.edit")} canDelete={allowed("finance.delete")} />
      <ActionSheet
        open={more}
        onOpenChange={setMore}
        items={[
          { label: "Konvertatsiya", onSelect: () => setEntering("conversion") },
          { label: "Boshlang'ich qoldiq", onSelect: () => setEntering("opening") },
        ]}
      />
      {(entering === "expense" || entering === "income") && <ExpenseDialog {...into} kind={entering} settingsAllowed={allowed("settings.view")} />}
      {entering === "transfer" && <MoneyTransferDialog {...into} />}
      {entering === "conversion" && <ConversionDialog {...into} />}
      {entering === "opening" && <CashOpeningDialog {...into} />}
    </>
  )
}
