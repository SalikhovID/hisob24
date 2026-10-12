"use client"

import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { SelectBox } from "@/components/select-field"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { accountOptions, currencyOf, useAccounts, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useExpenses, useFinanceCategories } from "@/lib/queries"
import type { Expense, Permission } from "@/lib/types"
import { useExpenseFilter } from "@/lib/use-expense-filter"
import { usePermission } from "@/lib/use-gate"
import { financeSection } from "./accounts-page"
import { DeleteCashDocumentButton } from "./delete-cash-document-button"
import { ExpenseDialog } from "./expense-dialog"

// A tab is quiet until it is the chosen one, like the customers' tabs.
const tab = "px-3 text-muted-foreground data-active:bg-card"

const words = {
  expense: { list: "Xarajatlar", none: "Hali xarajat yo'q", first: "Birinchi xarajatni «Xarajat qo'shish» tugmasi orqali kiriting." },
  income: { list: "Kirimlar", none: "Hali kirim yo'q", first: "Birinchi kirimni «Kirim qo'shish» tugmasi orqali kiriting." },
} as const

// ExpensesPage is the expenses, or the other income, of the company
// (logic/finance.md, section 5), for whoever may see the finance: the
// newest first, each under its category and out of (into) its account;
// narrowed to an account, a category and a span of days; each edited and
// deleted in its row (with the permissions).
export function ExpensesPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useExpenseFilter()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const categories = useFinanceCategories(companyId, filter.kind)
  const expenses = useExpenses(companyId, filter)
  const w = words[filter.kind]

  const columns: Column<Expense>[] = [
    {
      header: "Hujjat",
      primary: true,
      cell: (e) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            № {e.number} · {e.category_name}
          </span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDateTime(e.at)} · {e.account_name}
          </span>
        </span>
      ),
    },
    { header: "Summa", align: "end", card: "aside", cell: (e) => formatMoney(e.amount, currencyOf(currencies, e.currency_id)) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (e) => e.created_by_name },
    {
      header: "Amallar",
      actions: true,
      cell: (e) =>
        companyId !== null &&
        (allowed("finance.edit") || allowed("finance.delete")) && (
          <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
            {allowed("finance.edit") && <ExpenseDialog companyId={companyId} kind={e.kind} expense={e} iconOnly settingsAllowed={allowed("settings.view")} />}
            {allowed("finance.delete") && <DeleteCashDocumentButton companyId={companyId} document={{ id: e.id, kind: e.kind, amount: e.amount, currency_id: e.currency_id, at: e.at }} />}
          </span>
        ),
    },
  ]

  const unfiltered = filter.accountId === null && filter.categoryId === null && !filter.from && !filter.to
  const settling = expenses.isPlaceholderData && expenses.data?.total === 0
  const loading = expenses.isPending || settling

  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      <PageHeader
        title="Xarajatlar"
        description="Xarajatlar va boshqa kirimlar, kategoriyalari bilan"
        actions={companyId !== null && allowed("finance.create") && <ExpenseDialog key={filter.kind} companyId={companyId} kind={filter.kind} settingsAllowed={allowed("settings.view")} />}
      />
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Tabs value={filter.kind} onValueChange={(value) => update({ kind: value === "income" ? "income" : "expense" })}>
            <TabsList className="group-data-horizontal/tabs:h-9 max-sm:min-w-full">
              <TabsTrigger value="expense" className={tab}>
                Xarajat
              </TabsTrigger>
              <TabsTrigger value="income" className={tab}>
                Kirim
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SelectBox
            aria-label="Akkaunt"
            className="h-9! w-fit"
            value={filter.accountId === null ? "" : String(filter.accountId)}
            onChange={(value) => update({ accountId: value ? Number(value) : null })}
            options={accountOptions(accounts, currencies, filter.accountId ?? undefined)}
            empty="Hamma akkauntlar"
          />
          <SelectBox
            aria-label="Kategoriya"
            className="h-9! w-fit"
            value={filter.categoryId === null ? "" : String(filter.categoryId)}
            onChange={(value) => update({ categoryId: value ? Number(value) : null })}
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            empty="Hamma kategoriyalar"
          />
          <Input type="date" aria-label="Sanadan" className="h-9 w-fit bg-card" value={filter.from} onChange={(event) => update({ from: event.target.value })} />
          <Input type="date" aria-label="Sanagacha" className="h-9 w-fit bg-card" value={filter.to} onChange={(event) => update({ to: event.target.value })} />
        </div>
        {loading && <ListLoading rows={6} mark="none" />}
        {expenses.isError && <Failed error={expenses.error} onRetry={() => expenses.refetch()} />}
        {!loading && !expenses.isError && expenses.data?.total === 0 && (
          <EmptyState title={unfiltered ? w.none : "Hech narsa topilmadi"} description={unfiltered ? (allowed("finance.create") ? w.first : undefined) : "Filtrni o'zgartirib ko'ring."} />
        )}
        {!loading && !expenses.isError && expenses.data && expenses.data.total > 0 && (
          <DataList
            label={w.list}
            items={expenses.data.items}
            columns={columns}
            getKey={(e) => e.id}
            footer={<Pager page={expenses.data.page} pageSize={expenses.data.page_size} total={expenses.data.total} onPage={(page) => update({ page })} />}
          />
        )}
      </div>
    </div>
  )
}
