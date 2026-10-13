"use client"

import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, BanknoteIcon, type LucideIcon, RepeatIcon, ScaleIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { Failed, ListLoading } from "@/components/states"
import { type FinanceDocumentKind, financeKindTitle } from "@/lib/finance"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"
import { useAccountStatement } from "@/lib/queries"
import type { AccountBalance, AccountStatementRow, CashOpening, CompanyCurrency } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CashOpeningDialog } from "./cash-opening-dialog"
import { type CashDocument, DeleteCashDocumentDialog } from "./delete-cash-document-button"

// signed is a change of what the account holds, with its sign: "+1 000 000", "−128 000".
export function signed(amount: string): string {
  if (amount.startsWith("-")) return `−${formatAmount(amount.slice(1))}`
  return Number(amount) > 0 ? `+${formatAmount(amount)}` : formatAmount(amount)
}

// minus is an amount with a real minus sign when it is below zero: "−5 000".
export function minus(amount: string): string {
  return amount.startsWith("-") ? `−${formatAmount(amount.slice(1))}` : formatAmount(amount)
}

// numbered tells whether a kind is headed with its number on screen: the
// cash documents are, but the opening balance and the payments are not.
const numbered = (kind: FinanceDocumentKind) => kind === "expense" || kind === "income" || kind === "money_transfer" || kind === "conversion"

// isPayment tells a payment (entered with a purchase or a sale, or on its own) from a cash document.
const isPayment = (kind: FinanceDocumentKind) => kind === "supplier_payment" || kind === "customer_payment"

// titleOf says what a row is: a cash document by its kind and number, a
// payment with the document it was entered with.
function titleOf(row: AccountStatementRow): string {
  const kind = row.kind as FinanceDocumentKind
  if (isPayment(kind)) {
    if (row.linked_id === null) return "To'lov"
    return `To'lov · ${kind === "supplier_payment" ? "Xarid" : "Sotuv"} № ${row.linked_number}`
  }
  return numbered(kind) ? `${financeKindTitle[kind]} № ${row.number}` : financeKindTitle[kind]
}

// hrefOf is where a payment entered with a purchase or a sale leads: to
// that document. A cash document is handled in its sheet.
function hrefOf(row: AccountStatementRow): string | undefined {
  if (row.linked_id === null) return undefined
  if (row.kind === "supplier_payment") return `/purchases/${row.linked_id}`
  if (row.kind === "customer_payment") return `/sales/${row.linked_id}`
  return undefined
}

// iconOf is a row's soft icon: an expense in red, an income in green, an
// opening balance in the warning's color, the rest in the accent.
function iconOf(kind: FinanceDocumentKind): { icon: LucideIcon; color?: string } {
  switch (kind) {
    case "cash_opening":
      return { icon: ScaleIcon, color: "var(--warning)" }
    case "expense":
      return { icon: ArrowUpRightIcon, color: "var(--destructive)" }
    case "income":
      return { icon: ArrowDownLeftIcon, color: "var(--positive)" }
    case "money_transfer":
      return { icon: ArrowLeftRightIcon }
    case "conversion":
      return { icon: RepeatIcon }
    default:
      return { icon: BanknoteIcon }
  }
}

// openingOfRow is an opening balance of the cash as its row tells it: into
// this account, with what arrived.
function openingOfRow(row: AccountStatementRow, account: AccountBalance): CashOpening {
  return {
    id: row.id,
    number: row.number,
    bank_account_id: account.id,
    account_name: account.name,
    currency_id: account.currency_id,
    amount: row.delta.replace(/^-/, ""),
    at: row.at,
    note: row.note,
    created_by_name: row.created_by_name,
    created_at: row.at,
    updated_at: row.at,
  }
}

// AccountStatementList is an account's statement (logic/finance.md, section
// 4), as the prototype's rows: every live document that named it, the
// newest first, its moment and other side under its name, how it changed
// what the account holds (green when it grew, red when it shrank) and what
// the account held after it at its end. A cash document opens a sheet of
// its actions: an opening balance of the cash is edited and deleted there,
// the others deleted (they are edited on their lists); a payment leads to
// the document it was entered with.
export function AccountStatementList({
  companyId,
  account,
  currency,
  canEdit,
  canDelete,
}: {
  companyId: number
  account: AccountBalance
  currency: CompanyCurrency
  canEdit: boolean
  canDelete: boolean
}) {
  const [page, setPage] = useState(1)
  const statement = useAccountStatement(companyId, account.id, page)
  const [acting, setActing] = useState<AccountStatementRow | null>(null)
  // The sheets the actions open: an opening balance being edited, a cash document being deleted.
  const [opening, setOpening] = useState<CashOpening | null>(null)
  const [removing, setRemoving] = useState<CashDocument | null>(null)
  const data = statement.data

  const actionsOf = (row: AccountStatementRow) => {
    const kind = row.kind as FinanceDocumentKind
    if (isPayment(kind)) return []
    const document = { id: row.id, kind: kind as CashDocument["kind"], amount: row.delta.replace(/^-/, ""), currency_id: account.currency_id, at: row.at }
    return [
      ...(canEdit && kind === "cash_opening" ? [{ label: "Tahrirlash", onSelect: () => setOpening(openingOfRow(row, account)) }] : []),
      ...(canDelete ? [{ label: "O'chirish", danger: true, onSelect: () => setRemoving(document) }] : []),
    ]
  }

  return (
    <section aria-labelledby="account-statement">
      <SectionHeading>
        <span id="account-statement">Hisob harakati</span>
      </SectionHeading>
      {statement.isPending && <ListLoading rows={4} mark="none" />}
      {statement.isError && <Failed error={statement.error} onRetry={() => statement.refetch()} />}
      {data?.total === 0 && (
        <Group>
          <p className="px-4 py-3.5 text-md text-muted-foreground">Bu akkauntda hujjat yo&apos;q</p>
        </Group>
      )}
      {data && data.total > 0 && (
        <>
          <Group label="Hisob harakati" inset="icon">
            {data.items.map((row) => {
              const kind = row.kind as FinanceDocumentKind
              const { icon, color } = iconOf(kind)
              const negative = row.delta.startsWith("-")
              return (
                <Row
                  key={`${row.kind}-${row.id}`}
                  href={hrefOf(row)}
                  onClick={actionsOf(row).length > 0 ? () => setActing(row) : undefined}
                  media={<SoftIcon icon={icon} color={color} />}
                  title={titleOf(row)}
                  sub={[formatDateTime(row.at), row.party_name].filter(Boolean).join(" · ")}
                  end={<span className={cn("tabular-nums", negative ? "text-destructive" : Number(row.delta) > 0 && "text-positive")}>{signed(row.delta)}</span>}
                  endSub={`qoldiq ${minus(row.balance)}`}
                  chevron={false}
                />
              )
            })}
          </Group>
          {data.total > data.page_size && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? `${titleOf(acting)} · ${formatMoney(acting.delta.replace(/^-/, ""), currency)}` : undefined}
        items={acting ? actionsOf(acting) : []}
      />
      {opening && <CashOpeningDialog companyId={companyId} opening={opening} open onOpenChange={(open) => !open && setOpening(null)} />}
      {removing && <DeleteCashDocumentDialog companyId={companyId} document={removing} open onOpenChange={(open) => !open && setRemoving(null)} />}
    </section>
  )
}
