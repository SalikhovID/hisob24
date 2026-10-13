"use client"

import { PencilIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Button } from "@/components/ui/button"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"
import type { Party } from "@/lib/party"
import { useCustomerStatement, useStatement } from "@/lib/queries"
import type { StatementRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { type OpeningFields, openingOfRow } from "@/lib/stock"
import { type PaymentFields, paymentOfRow } from "@/lib/warehouse"
import { DeleteOpeningButton } from "./delete-opening-button"
import { DeletePaymentButton } from "./delete-payment-button"
import { OpeningDialog } from "./opening-dialog"
import { PaymentDialog } from "./payment-dialog"

// titleOf says what a row is: a purchase or a sale by its number (the way
// into it), a payment (with the document it was entered with), an opening
// balance.
function titleOf(row: StatementRow) {
  switch (row.kind) {
    case "purchase":
      return (
        <Link href={`/purchases/${row.id}`} className="font-medium underline-offset-4 hover:underline">
          Xarid № {row.number}
        </Link>
      )
    case "sale":
      return (
        <Link href={`/sales/${row.id}`} className="font-medium underline-offset-4 hover:underline">
          Sotuv № {row.number}
        </Link>
      )
    case "supplier_payment":
    case "customer_payment": {
      if (row.linked_id === null) return "To'lov"
      const [href, name] = row.kind === "supplier_payment" ? [`/purchases/${row.linked_id}`, "Xarid"] : [`/sales/${row.linked_id}`, "Sotuv"]
      return (
        <>
          To&apos;lov ·{" "}
          <Link href={href} className="font-medium underline-offset-4 hover:underline">
            {name} № {row.linked_number}
          </Link>
        </>
      )
    }
    case "supplier_debt":
    case "customer_debt":
      return "Boshlang'ich qarz"
    case "supplier_prepay":
    case "customer_prepay":
      return "Boshlang'ich avans"
  }
}

// StatementList is a party's statement, on its page: a supplier's
// (logic/warehouse.md, section 6) or a customer's (logic/sales.md, section
// 5): every live document in time, the newest first, each with its amount
// in its currency, how it changed what is owed (in so'm) and what was owed
// after it; a payment or an opening balance entered on its own is edited
// and deleted in its row, a payment entered with a document goes with the
// document; the header adds a payment or an opening balance.
export function StatementList({
  party,
  companyId,
  partyId,
  canAdd,
  canEdit,
  canDelete,
}: {
  party: Party
  companyId: number
  partyId: number
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [page, setPage] = useState(1)
  // The payment sheet: a new payment (null), or the one being edited.
  const [paying, setPaying] = useState<PaymentFields | null | undefined>(undefined)
  // The opening balance sheet: a new one (null), or the one being edited.
  const [opening, setOpening] = useState<OpeningFields | null | undefined>(undefined)
  const suppliers = useStatement(party === "supplier" ? companyId : null, partyId, page)
  const customers = useCustomerStatement(party === "customer" ? companyId : null, partyId, page)
  const statement = party === "supplier" ? suppliers : customers
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
            // A payment entered with a document goes with the document; an
            // opening balance is its own document.
            cell: (row) => {
              if (row.kind === "supplier_debt" || row.kind === "supplier_prepay" || row.kind === "customer_debt" || row.kind === "customer_prepay") {
                return (
                  <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
                    {canEdit && (
                      <Button variant="ghost" size="icon" aria-label={`Tahrirlash: ${formatAmount(row.amount)}`} onClick={() => setOpening(openingOfRow(row))}>
                        <PencilIcon />
                      </Button>
                    )}
                    {canDelete && <DeleteOpeningButton party={party} companyId={companyId} partyId={partyId} opening={openingOfRow(row)} />}
                  </span>
                )
              }
              return (
                (row.kind === "supplier_payment" || row.kind === "customer_payment") &&
                row.linked_id === null && (
                  <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
                    {canEdit && (
                      <Button variant="ghost" size="icon" aria-label={`Tahrirlash: ${formatAmount(row.amount)}`} onClick={() => setPaying(paymentOfRow(row))}>
                        <PencilIcon />
                      </Button>
                    )}
                    {canDelete && <DeletePaymentButton party={party} companyId={companyId} partyId={partyId} payment={paymentOfRow(row)} />}
                  </span>
                )
              )
            },
          } satisfies Column<StatementRow>,
        ]
      : []),
  ]
  return (
    <section aria-labelledby="party-statement" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="party-statement" className="text-base font-semibold">
          Hisob harakati
        </h2>
        {canAdd && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="lg" variant="outline" className="px-3.5" onClick={() => setOpening(null)}>
              Boshlang&apos;ich qarz / avans
            </Button>
            <Button size="lg" className="px-3.5" onClick={() => setPaying(null)}>
              To&apos;lov qo&apos;shish
            </Button>
          </div>
        )}
      </div>
      {opening !== undefined && (
        <OpeningDialog
          party={party}
          companyId={companyId}
          partyId={partyId}
          opening={opening ?? undefined}
          open
          onOpenChange={(open) => !open && setOpening(undefined)}
        />
      )}
      {paying !== undefined && (
        <PaymentDialog
          party={party}
          companyId={companyId}
          partyId={partyId}
          payment={paying ?? undefined}
          open
          onOpenChange={(open) => !open && setPaying(undefined)}
        />
      )}
      {statement.isPending && <ListLoading rows={2} mark="none" />}
      {statement.isError && <Failed error={statement.error} onRetry={() => statement.refetch()} />}
      {statement.data?.total === 0 && <EmptyState title={party === "supplier" ? "Bu ta'minotchida hujjat yo'q" : "Bu mijozda hujjat yo'q"} />}
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
