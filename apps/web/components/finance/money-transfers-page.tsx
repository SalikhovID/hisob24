"use client"

import { ArrowLeftRightIcon, RepeatIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Chip, Chips } from "@/components/kit/chips"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { accountOptions, currencyOf, useAccounts, useCurrencies } from "@/lib/currencies"
import { conversionRateText, financeKindTitle } from "@/lib/finance"
import { formatMoney, formatTime } from "@/lib/format"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useMoneyTransfers } from "@/lib/queries"
import type { MoneyTransfer, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useMoneyTransferFilter } from "@/lib/use-money-transfer-filter"
import { cn } from "@/lib/utils"
import { financeSection } from "./accounts-page"
import { ConversionDialog } from "./conversion-dialog"
import { DeleteCashDocumentDialog } from "./delete-cash-document-button"
import { MoneyTransferDialog } from "./money-transfer-dialog"

// Entering is the sheet open to enter or edit a document: a new transfer or
// conversion (no document), or the document given.
type Entering = { kind: "money_transfer" | "conversion"; document?: MoneyTransfer }

// MoneyTransfersPage is the transfers between the company's accounts and
// the conversions between its currencies, in one list (logic/finance.md,
// section 5), for whoever may see the finance, as the prototype's list:
// an account as a chip opening its sheet; the documents by their day, the
// newest first, each by its kind and number, its time, the accounts it went
// between and who entered it under it, what left at its end (and under it
// what arrived, for a conversion). A row opens a sheet of its actions (editing,
// deleting; with the permissions; a conversion's rate said in its title);
// the plus offers a transfer or a conversion.
export function MoneyTransfersPage() {
  const gate = usePermission("finance.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useMoneyTransferFilter()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const transfers = useMoneyTransfers(companyId, filter)
  const [choosing, setChoosing] = useState(false)
  const [offering, setOffering] = useState(false)
  const [acting, setActing] = useState<MoneyTransfer | null>(null)
  const [entering, setEntering] = useState<Entering | null>(null)
  const [removing, setRemoving] = useState<MoneyTransfer | null>(null)

  const unfiltered = filter.accountId === null
  const settling = transfers.isPlaceholderData && transfers.data?.total === 0
  const loading = transfers.isPending || settling
  const account = accounts.find((a) => a.id === filter.accountId)
  const acts = allowed("finance.edit") || allowed("finance.delete")
  // moved says what left, and for a conversion what arrived.
  const moved = (t: MoneyTransfer) => {
    const out = formatMoney(t.amount, currencyOf(currencies, t.currency_id))
    return t.kind === "conversion" && t.to_amount !== null ? `${out} → ${formatMoney(t.to_amount, currencyOf(currencies, t.to_currency_id))}` : out
  }
  const titleOf = (t: MoneyTransfer) => `${financeKindTitle[t.kind]} № ${t.number}`
  const rateOf = (t: MoneyTransfer) =>
    t.kind === "conversion" && t.to_amount !== null ? conversionRateText(t.amount, t.to_amount, currencyOf(currencies, t.currency_id), currencyOf(currencies, t.to_currency_id)) : null

  if (!gate) return null
  const page = transfers.data
  return (
    <>
      <PageTitle
        title="O'tkazmalar"
        description="Akkauntlar aro o'tkazmalar va konvertatsiyalar"
        action={companyId !== null && allowed("finance.create") && <PlusButton label="O'tkazma qo'shish" onClick={() => setOffering(true)} />}
      />
      <SectionTabs item={financeSection} permissions={gate.permissions} />
      <Chips>
        <Chip pressed={filter.accountId !== null} chevron onClick={() => setChoosing(true)}>
          {account?.name ?? "Akkaunt"}
        </Chip>
      </Chips>
      <PickerSheet
        open={choosing}
        onOpenChange={setChoosing}
        title="Akkaunt"
        options={accountOptions(accounts, currencies, filter.accountId ?? undefined)}
        value={filter.accountId === null ? "" : String(filter.accountId)}
        onChange={(value) => update({ accountId: value ? Number(value) : null })}
        none="Hamma akkauntlar"
      />
      {loading && <ListLoading rows={6} />}
      {transfers.isError && <Failed error={transfers.error} onRetry={() => transfers.refetch()} />}
      {!loading && !transfers.isError && page?.total === 0 && (
        <EmptyState
          icon={ArrowLeftRightIcon}
          title={unfiltered ? "Hali o'tkazma yo'q" : "Hech narsa topilmadi"}
          description={unfiltered ? (allowed("finance.create") ? "Birinchi o'tkazmani «O'tkazma qo'shish» tugmasi orqali kiriting." : undefined) : "Filtrni o'zgartirib ko'ring."}
        />
      )}
      {!loading && !transfers.isError && page && page.total > 0 && (
        <>
          <DayGroups label="O'tkazmalar" items={page.items} at={(t) => t.at} className={cn(transfers.isPlaceholderData && "opacity-60")}>
            {(t) => (
              <Row
                key={t.id}
                onClick={acts ? () => setActing(t) : undefined}
                media={<SoftIcon icon={t.kind === "conversion" ? RepeatIcon : ArrowLeftRightIcon} />}
                title={titleOf(t)}
                sub={[formatTime(t.at), `${t.from_account_name} → ${t.to_account_name}`, t.created_by_name && shortName(t.created_by_name)].filter(Boolean).join(" · ")}
                end={formatMoney(t.amount, currencyOf(currencies, t.currency_id))}
                endSub={t.kind === "conversion" && t.to_amount !== null ? `→ ${formatMoney(t.to_amount, currencyOf(currencies, t.to_currency_id))}` : undefined}
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
        open={offering}
        onOpenChange={setOffering}
        items={[
          { label: "O'tkazma", onSelect: () => setEntering({ kind: "money_transfer" }) },
          { label: "Konvertatsiya", onSelect: () => setEntering({ kind: "conversion" }) },
        ]}
      />
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? [titleOf(acting), moved(acting), rateOf(acting)].filter(Boolean).join(" · ") : undefined}
        items={[
          ...(allowed("finance.edit") ? [{ label: "Tahrirlash", onSelect: () => acting && setEntering({ kind: acting.kind, document: acting }) }] : []),
          ...(allowed("finance.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setRemoving(acting) }] : []),
        ]}
      />
      {companyId !== null && entering?.kind === "money_transfer" && (
        <MoneyTransferDialog companyId={companyId} transfer={entering.document} open onOpenChange={(open) => !open && setEntering(null)} />
      )}
      {companyId !== null && entering?.kind === "conversion" && (
        <ConversionDialog companyId={companyId} conversion={entering.document} open onOpenChange={(open) => !open && setEntering(null)} />
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
