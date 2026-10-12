"use client"

import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { SelectBox } from "@/components/select-field"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { accountOptions, currencyOf, useAccounts, useCurrencies } from "@/lib/currencies"
import { conversionRateText, financeKindTitle } from "@/lib/finance"
import { formatDateTime, formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useMoneyTransfers } from "@/lib/queries"
import type { MoneyTransfer, Permission } from "@/lib/types"
import { useMoneyTransferFilter } from "@/lib/use-money-transfer-filter"
import { usePermission } from "@/lib/use-gate"
import { financeSection } from "./accounts-page"
import { ConversionDialog } from "./conversion-dialog"
import { DeleteCashDocumentButton } from "./delete-cash-document-button"
import { MoneyTransferDialog } from "./money-transfer-dialog"

// MoneyTransfersPage is the transfers between the company's accounts and
// the conversions between its currencies, in one list (logic/finance.md,
// section 5), for whoever may see the finance: the newest first, each with
// where it came from and went to (a conversion with the rate it came to);
// narrowed to an account; each edited and deleted in its row.
export function MoneyTransfersPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useMoneyTransferFilter()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const transfers = useMoneyTransfers(companyId, filter)

  const columns: Column<MoneyTransfer>[] = [
    {
      header: "Hujjat",
      primary: true,
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {financeKindTitle[t.kind]} № {t.number}
          </span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">{formatDateTime(t.at)}</span>
        </span>
      ),
    },
    {
      header: "Qayerdan",
      card: "inline",
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <span>{t.from_account_name}</span>
          <span className="text-[0.8125rem] leading-5 text-muted-foreground tabular-nums">{formatMoney(t.amount, currencyOf(currencies, t.currency_id))}</span>
        </span>
      ),
    },
    {
      header: "Qayerga",
      card: "inline",
      cell: (t) => {
        const from = currencyOf(currencies, t.currency_id)
        const to = currencyOf(currencies, t.to_currency_id)
        return (
          <span className="flex min-w-0 flex-col">
            <span>{t.to_account_name}</span>
            <span className="text-[0.8125rem] leading-5 text-muted-foreground tabular-nums">{formatMoney(t.to_amount ?? t.amount, to)}</span>
            {t.kind === "conversion" && t.to_amount !== null && <span className="text-[0.8125rem] leading-5 text-muted-foreground tabular-nums">{conversionRateText(t.amount, t.to_amount, from, to)}</span>}
          </span>
        )
      },
    },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (t) => t.created_by_name },
    {
      header: "Amallar",
      actions: true,
      cell: (t) =>
        companyId !== null &&
        (allowed("finance.edit") || allowed("finance.delete")) && (
          <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
            {allowed("finance.edit") && (t.kind === "conversion" ? <ConversionDialog companyId={companyId} conversion={t} iconOnly /> : <MoneyTransferDialog companyId={companyId} transfer={t} iconOnly />)}
            {allowed("finance.delete") && <DeleteCashDocumentButton companyId={companyId} document={{ id: t.id, kind: t.kind, amount: t.amount, currency_id: t.currency_id, at: t.at }} />}
          </span>
        ),
    },
  ]

  const unfiltered = filter.accountId === null
  const settling = transfers.isPlaceholderData && transfers.data?.total === 0
  const loading = transfers.isPending || settling

  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      <PageHeader
        title="O'tkazmalar"
        description="Akkauntlar aro o'tkazmalar va valyuta konvertatsiyalari"
        // Two buttons do not fit beside the title on a phone: they go under it.
        stack
        actions={
          companyId !== null &&
          allowed("finance.create") && (
            <>
              <MoneyTransferDialog companyId={companyId} />
              <ConversionDialog companyId={companyId} />
            </>
          )
        }
      />
      <div className="space-y-3">
        <SelectBox
          aria-label="Akkaunt"
          className="h-9! w-fit"
          value={filter.accountId === null ? "" : String(filter.accountId)}
          onChange={(value) => update({ accountId: value ? Number(value) : null })}
          options={accountOptions(accounts, currencies, filter.accountId ?? undefined)}
          empty="Hamma akkauntlar"
        />
        {loading && <ListLoading rows={6} mark="none" />}
        {transfers.isError && <Failed error={transfers.error} onRetry={() => transfers.refetch()} />}
        {!loading && !transfers.isError && transfers.data?.total === 0 && (
          <EmptyState
            title={unfiltered ? "Hali o'tkazma yo'q" : "Hech narsa topilmadi"}
            description={unfiltered ? (allowed("finance.create") ? "Birinchi o'tkazmani «O'tkazma qo'shish» tugmasi orqali kiriting." : undefined) : "Filtrni o'zgartirib ko'ring."}
          />
        )}
        {!loading && !transfers.isError && transfers.data && transfers.data.total > 0 && (
          <DataList
            label="O'tkazmalar"
            items={transfers.data.items}
            columns={columns}
            getKey={(t) => t.id}
            footer={<Pager page={transfers.data.page} pageSize={transfers.data.page_size} total={transfers.data.total} onPage={(page) => update({ page })} />}
          />
        )}
      </div>
    </div>
  )
}
