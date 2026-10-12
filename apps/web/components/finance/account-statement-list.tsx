"use client"

import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { type FinanceDocumentKind, financeKindTitle } from "@/lib/finance"
import { formatAmount, formatDateTime } from "@/lib/format"
import { useAccountStatement } from "@/lib/queries"
import type { AccountBalance, AccountStatementRow, CashOpening, CompanyCurrency } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CashOpeningDialog } from "./cash-opening-dialog"
import { DeleteCashDocumentButton } from "./delete-cash-document-button"

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

// titleOf says what a row is: a cash document by its kind and number, a
// payment with the document it was entered with (the way into it).
function titleOf(row: AccountStatementRow) {
  const kind = row.kind as FinanceDocumentKind
  if (kind === "supplier_payment" || kind === "customer_payment") {
    if (row.linked_id === null) return "To'lov"
    const [href, name] = kind === "supplier_payment" ? [`/purchases/${row.linked_id}`, "Xarid"] : [`/sales/${row.linked_id}`, "Sotuv"]
    return (
      <>
        To&apos;lov ·{" "}
        <Link href={href} className="font-medium underline-offset-4 hover:underline">
          {name} № {row.linked_number}
        </Link>
      </>
    )
  }
  return numbered(kind) ? `${financeKindTitle[kind]} № ${row.number}` : financeKindTitle[kind]
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
// 4): every live document that named it, the newest first, each with its
// other side, how it changed what the account holds and what the account
// held after it; a cash document is edited and deleted in its row, a
// payment goes with the document it was entered with.
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

  const columns: Column<AccountStatementRow>[] = [
    { header: "Hujjat", primary: true, cell: titleOf },
    { header: "Vaqt", card: "inline", className: "whitespace-nowrap text-muted-foreground", cell: (row) => formatDateTime(row.at) },
    { header: "Qarshi tomon", card: "inline", cell: (row) => row.party_name },
    {
      header: `Summa, ${currency.symbol}`,
      align: "end",
      card: "aside",
      cell: (row) => <span className={cn("tabular-nums", row.delta.startsWith("-") && "text-destructive")}>{signed(row.delta)}</span>,
    },
    { header: `Qoldiq, ${currency.symbol}`, align: "end", card: "inline", className: "tabular-nums", cell: (row) => minus(row.balance) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (row) => row.created_by_name },
    {
      header: "Amallar",
      actions: true,
      // A cash document is deleted here; an opening balance of the cash is
      // edited here too, the others on their own pages. A payment goes with
      // the document it was entered with.
      cell: (row) => {
        const kind = row.kind as FinanceDocumentKind
        if (kind === "supplier_payment" || kind === "customer_payment" || !(canEdit || canDelete)) return null
        return (
          <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
            {canEdit && kind === "cash_opening" && <CashOpeningDialog companyId={companyId} opening={openingOfRow(row, account)} iconOnly />}
            {canDelete && <DeleteCashDocumentButton companyId={companyId} document={{ id: row.id, kind, amount: row.delta.replace(/^-/, ""), currency_id: account.currency_id, at: row.at }} />}
          </span>
        )
      },
    },
  ]

  return (
    <section aria-labelledby="account-statement" className="space-y-3">
      <h2 id="account-statement" className="text-base font-semibold">
        Hisob harakati
      </h2>
      {statement.isPending && <ListLoading rows={4} mark="none" />}
      {statement.isError && <Failed error={statement.error} onRetry={() => statement.refetch()} />}
      {statement.data?.total === 0 && <EmptyState title="Bu akkauntda hujjat yo'q" />}
      {statement.data && statement.data.total > 0 && (
        <DataList
          label="Hisob harakati"
          items={statement.data.items}
          columns={columns}
          getKey={(row) => row.id}
          footer={<Pager page={statement.data.page} pageSize={statement.data.page_size} total={statement.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
