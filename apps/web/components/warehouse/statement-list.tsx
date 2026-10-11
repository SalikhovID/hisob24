"use client"

import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"
import { useStatement } from "@/lib/queries"
import type { StatementRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { paymentOfRow } from "@/lib/warehouse"
import { DeletePaymentButton } from "./delete-payment-button"
import { PaymentDialog } from "./payment-dialog"

// titleOf says what a row is: a purchase by its number (the way into it),
// a payment (with the purchase it was entered with), an opening balance.
function titleOf(row: StatementRow) {
  switch (row.kind) {
    case "purchase":
      return (
        <Link href={`/purchases/${row.id}`} className="font-medium underline-offset-4 hover:underline">
          Xarid № {row.number}
        </Link>
      )
    case "supplier_payment":
      return row.linked_id === null ? (
        "To'lov"
      ) : (
        <>
          To&apos;lov ·{" "}
          <Link href={`/purchases/${row.linked_id}`} className="font-medium underline-offset-4 hover:underline">
            Xarid № {row.linked_number}
          </Link>
        </>
      )
    case "supplier_debt":
      return "Boshlang'ich qarz"
    case "supplier_prepay":
      return "Boshlang'ich avans"
  }
}

// StatementList is a supplier's statement, on its page (logic/warehouse.md,
// section 6): every live document in time, the newest first, each with its
// amount in its currency, how it changed what is owed (in so'm) and what
// was owed after it; a payment entered on its own is edited and deleted in
// its row, one entered with a purchase goes with the purchase.
export function StatementList({
  companyId,
  supplierId,
  canAdd,
  canEdit,
  canDelete,
}: {
  companyId: number
  supplierId: number
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [page, setPage] = useState(1)
  const statement = useStatement(companyId, supplierId, page)
  const currencies = useCurrencies()
  const columns: Column<StatementRow>[] = [
    {
      header: "Hujjat",
      primary: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">{titleOf(row)}</span>
          {row.account_name && <span className="text-[0.8125rem] leading-5 font-normal text-muted-foreground">{row.account_name}</span>}
        </span>
      ),
    },
    { header: "Vaqt", card: "inline", className: "whitespace-nowrap", cell: (row) => formatDateTime(row.at) },
    { header: "Summa", align: "end", card: "aside", cell: (row) => formatMoney(row.amount, currencyOf(currencies, row.currency_id)) },
    {
      header: "Qarz, so'm",
      align: "end",
      card: "inline",
      cell: (row) => {
        const delta = Number(row.delta_uzs)
        return (
          <span className={cn("tabular-nums", delta > 0 && "text-destructive", delta < 0 && "text-emerald-700 dark:text-emerald-400")}>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {formatAmount(row.delta_uzs.replace("-", ""))}
          </span>
        )
      },
    },
    { header: "Balans, so'm", align: "end", card: "inline", cell: (row) => formatAmount(row.balance_uzs) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (row) => row.created_by_name },
    ...(canEdit || canDelete
      ? [
          {
            header: "Amallar",
            actions: true,
            // A payment entered with a purchase goes with the purchase.
            cell: (row) =>
              row.kind === "supplier_payment" &&
              row.linked_id === null && (
                <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
                  {canEdit && <PaymentDialog companyId={companyId} supplierId={supplierId} payment={paymentOfRow(row, supplierId)} iconOnly />}
                  {canDelete && <DeletePaymentButton companyId={companyId} payment={paymentOfRow(row, supplierId)} />}
                </span>
              ),
          } satisfies Column<StatementRow>,
        ]
      : []),
  ]
  return (
    <section aria-labelledby="supplier-statement" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="supplier-statement" className="text-base font-semibold">
          Hisob harakati
        </h2>
        {canAdd && <PaymentDialog companyId={companyId} supplierId={supplierId} />}
      </div>
      {statement.isPending && <ListLoading rows={2} mark="none" />}
      {statement.isError && <Failed error={statement.error} onRetry={() => statement.refetch()} />}
      {statement.data?.total === 0 && <EmptyState title="Bu ta'minotchida hujjat yo'q" />}
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
