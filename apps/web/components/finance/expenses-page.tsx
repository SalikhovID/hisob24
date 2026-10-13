"use client"

import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Chip, Chips } from "@/components/kit/chips"
import { DateSheet } from "@/components/kit/date-sheet"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { Segmented } from "@/components/kit/segmented"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { accountOptions, currencyOf, useAccounts, useCurrencies } from "@/lib/currencies"
import { formatDate, formatMoney, formatTime } from "@/lib/format"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useExpenses, useFinanceCategories } from "@/lib/queries"
import type { Expense, Permission } from "@/lib/types"
import { useExpenseFilter } from "@/lib/use-expense-filter"
import { usePermission } from "@/lib/use-gate"
import { cn } from "@/lib/utils"
import { financeSection } from "./accounts-page"
import { DeleteCashDocumentDialog } from "./delete-cash-document-button"
import { ExpenseDialog } from "./expense-dialog"

const words = {
  expense: { list: "Xarajatlar", add: "Xarajat qo'shish", none: "Hali xarajat yo'q", first: "Birinchi xarajatni «Xarajat qo'shish» tugmasi orqali kiriting." },
  income: { list: "Kirimlar", add: "Kirim qo'shish", none: "Hali kirim yo'q", first: "Birinchi kirimni «Kirim qo'shish» tugmasi orqali kiriting." },
} as const

// Sheet is the filter's sheet that is open: an account, a category, a bound of the days.
type Sheet = "account" | "category" | "from" | "to"

// ExpensesPage is the expenses, or the other income, of the company
// (logic/finance.md, section 5), for whoever may see the finance, as the
// prototype's list: the kind in a segmented control; the account, the
// category and the days as chips that open their sheets; the documents by
// their day, the newest first, each by its number and category, its time,
// account and who entered it under it, the amount at its end. A row opens
// a sheet of its actions (editing, deleting; with the permissions); the
// plus enters one of the kind chosen.
export function ExpensesPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useExpenseFilter()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const categories = useFinanceCategories(companyId, filter.kind)
  const expenses = useExpenses(companyId, filter)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [acting, setActing] = useState<Expense | null>(null)
  // The sheets the actions open: a new document (null) or one being edited, one being deleted.
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined)
  const [removing, setRemoving] = useState<Expense | null>(null)
  const w = words[filter.kind]

  const unfiltered = filter.accountId === null && filter.categoryId === null && !filter.from && !filter.to
  const settling = expenses.isPlaceholderData && expenses.data?.total === 0
  const loading = expenses.isPending || settling
  const account = accounts.find((a) => a.id === filter.accountId)
  const category = categories.data?.find((c) => c.id === filter.categoryId)
  const sheetOpen = (name: Sheet) => ({ open: sheet === name, onOpenChange: (open: boolean) => setSheet(open ? name : null) })
  const amountOf = (e: Expense) => formatMoney(e.amount, currencyOf(currencies, e.currency_id))
  const actionsOf = () => [
    ...(allowed("finance.edit") ? [{ label: "Tahrirlash", onSelect: () => setEditing(acting) }] : []),
    ...(allowed("finance.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setRemoving(acting) }] : []),
  ]
  const acts = allowed("finance.edit") || allowed("finance.delete")

  if (!gate) return null
  const page = expenses.data
  return (
    <>
      <PageTitle
        title="Xarajatlar"
        description="Xarajatlar va boshqa kirimlar"
        action={companyId !== null && allowed("finance.create") && <PlusButton label={w.add} onClick={() => setEditing(null)} />}
      />
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      <Segmented
        label="Tur"
        value={filter.kind}
        onChange={(kind) => update({ kind: kind === "income" ? "income" : "expense" })}
        options={[
          { value: "expense", label: "Xarajat" },
          { value: "income", label: "Kirim" },
        ]}
      />
      <Chips>
        <Chip pressed={filter.accountId !== null} chevron onClick={() => setSheet("account")}>
          {account?.name ?? "Akkaunt"}
        </Chip>
        <Chip pressed={filter.categoryId !== null} chevron onClick={() => setSheet("category")}>
          {category?.name ?? "Kategoriya"}
        </Chip>
        <Chip pressed={filter.from !== ""} chevron onClick={() => setSheet("from")}>
          {filter.from ? `${formatDate(filter.from)} dan` : "Sanadan"}
        </Chip>
        <Chip pressed={filter.to !== ""} chevron onClick={() => setSheet("to")}>
          {filter.to ? `${formatDate(filter.to)} gacha` : "Sanagacha"}
        </Chip>
      </Chips>
      <PickerSheet
        {...sheetOpen("account")}
        title="Akkaunt"
        options={accountOptions(accounts, currencies, filter.accountId ?? undefined)}
        value={filter.accountId === null ? "" : String(filter.accountId)}
        onChange={(value) => update({ accountId: value ? Number(value) : null })}
        none="Hamma akkauntlar"
      />
      <PickerSheet
        {...sheetOpen("category")}
        title="Kategoriya"
        options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        value={filter.categoryId === null ? "" : String(filter.categoryId)}
        onChange={(value) => update({ categoryId: value ? Number(value) : null })}
        none="Hamma kategoriyalar"
      />
      <DateSheet {...sheetOpen("from")} title="Sanadan" value={filter.from} onChange={(from) => update({ from })} presets="past" none="Hamma kunlar" />
      <DateSheet {...sheetOpen("to")} title="Sanagacha" value={filter.to} onChange={(to) => update({ to })} presets="past" none="Hamma kunlar" />
      {loading && <ListLoading rows={6} />}
      {expenses.isError && <Failed error={expenses.error} onRetry={() => expenses.refetch()} />}
      {!loading && !expenses.isError && page?.total === 0 && (
        <EmptyState
          icon={filter.kind === "income" ? ArrowDownLeftIcon : ArrowUpRightIcon}
          title={unfiltered ? w.none : "Hech narsa topilmadi"}
          description={unfiltered ? (allowed("finance.create") ? w.first : undefined) : "Filtrni o'zgartirib ko'ring."}
        />
      )}
      {!loading && !expenses.isError && page && page.total > 0 && (
        <>
          <DayGroups label={w.list} items={page.items} at={(e) => e.at} className={cn(expenses.isPlaceholderData && "opacity-60")}>
            {(e) => (
              <Row
                key={e.id}
                onClick={acts ? () => setActing(e) : undefined}
                media={e.kind === "income" ? <SoftIcon icon={ArrowDownLeftIcon} color="var(--positive)" /> : <SoftIcon icon={ArrowUpRightIcon} color="var(--destructive)" />}
                title={`№ ${e.number} · ${e.category_name}`}
                sub={[formatTime(e.at), e.account_name, e.created_by_name && shortName(e.created_by_name)].filter(Boolean).join(" · ")}
                end={amountOf(e)}
                chevron={false}
              />
            )}
          </DayGroups>
          {page.total > page.page_size ? (
            <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
          ) : (
            <Foot>Jami: {page.total}</Foot>
          )}
        </>
      )}
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? `№ ${acting.number} · ${acting.category_name} · ${amountOf(acting)}` : undefined}
        items={acting ? actionsOf() : []}
      />
      {companyId !== null && editing !== undefined && (
        <ExpenseDialog
          companyId={companyId}
          kind={editing?.kind ?? filter.kind}
          expense={editing ?? undefined}
          settingsAllowed={allowed("settings.view")}
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
        />
      )}
      {companyId !== null && removing && (
        <DeleteCashDocumentDialog
          companyId={companyId}
          document={{ id: removing.id, kind: removing.kind, amount: removing.amount, currency_id: removing.currency_id, at: removing.at }}
          open
          onOpenChange={(open) => !open && setRemoving(null)}
        />
      )}
    </>
  )
}
