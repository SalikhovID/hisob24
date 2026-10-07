"use client"

import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { formatAmount, formatDate } from "@/lib/format"
import { usePayments } from "@/lib/queries"
import type { Payment } from "@/lib/types"
import { DeletePaymentButton } from "./delete-payment-button"
import { PaymentDialog } from "./payment-dialog"

// SupplierPayments is the payments to a supplier, on its page: each by its
// day, its amount, its note and who entered it; one entered with a purchase
// names the purchase and is changed through it alone, one entered on its
// own is edited and deleted in its row. The newest first, twenty at a time.
export function SupplierPayments({
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
  const payments = usePayments(companyId, supplierId, page)
  const columns: Column<Payment>[] = [
    { header: "Sana", primary: true, cell: (p) => formatDate(p.paid_on) },
    { header: "Summa, so'm", align: "end", card: "aside", cell: (p) => formatAmount(p.amount) },
    { header: "Izoh", card: "inline", className: "max-w-64 whitespace-normal break-words text-muted-foreground", cell: (p) => p.note },
    {
      header: "Xarid",
      card: "inline",
      cell: (p) =>
        p.purchase_id !== null && (
          <Link href={`/purchases/${p.purchase_id}`} className="font-medium underline-offset-4 hover:underline">
            Xarid № {p.purchase_number}
          </Link>
        ),
    },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (p) => p.created_by_name },
    ...(canEdit || canDelete
      ? [
          {
            header: "Amallar",
            actions: true,
            // A payment entered with a purchase goes with the purchase.
            cell: (p) =>
              p.purchase_id === null && (
                <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
                  {canEdit && <PaymentDialog companyId={companyId} supplierId={supplierId} payment={p} iconOnly />}
                  {canDelete && <DeletePaymentButton companyId={companyId} payment={p} />}
                </span>
              ),
          } satisfies Column<Payment>,
        ]
      : []),
  ]
  return (
    <section aria-labelledby="supplier-payments" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="supplier-payments" className="text-base font-semibold">
          To&apos;lovlar
        </h2>
        {canAdd && <PaymentDialog companyId={companyId} supplierId={supplierId} />}
      </div>
      {payments.isPending && <ListLoading rows={2} mark="none" />}
      {payments.isError && <Failed error={payments.error} onRetry={() => payments.refetch()} />}
      {payments.data?.total === 0 && <EmptyState title="Bu ta'minotchida to'lov yo'q" />}
      {payments.data && payments.data.total > 0 && (
        <DataList
          label="To'lovlar"
          items={payments.data.items}
          columns={columns}
          getKey={(p) => p.id}
          footer={<Pager page={payments.data.page} pageSize={payments.data.page_size} total={payments.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
