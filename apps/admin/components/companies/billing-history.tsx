"use client"

import { type Column, DataList } from "@/components/data-list"
import { EmptyState, Failed, Loading } from "@/components/states"
import { formatAmount, formatDate } from "@/lib/format"
import { useBillings } from "@/lib/queries"
import type { Billing } from "@/lib/types"

// A payment reads as a ledger line: the day it was made, what it bought, what
// was paid, the period it moved, and a note. A payment with no amount or no
// note has none: the table marks the gap with a dash, a card leaves it out.
const columns: Column<Billing>[] = [
  { header: "Sana", primary: true, cell: (b) => formatDate(b.created_at) },
  { header: "Kunlar", card: "tag", cell: (b) => `+${b.days} kun` },
  { header: "Summa", card: "aside", cell: (b) => b.amount !== null && formatAmount(b.amount) },
  { header: "Davr", card: "tag", cell: (b) => `${formatDate(b.prev_end_date)} → ${formatDate(b.new_end_date)}` },
  { header: "Izoh", card: "note", cell: (b) => b.note },
]

// BillingHistory lists a company's payments, newest first.
export function BillingHistory({ companyId }: { companyId: number }) {
  const billings = useBillings(companyId)

  if (billings.isPending) return <Loading rows={2} />
  if (billings.isError) return <Failed error={billings.error} onRetry={() => billings.refetch()} />
  if (billings.data.length === 0) return <EmptyState title="Hali to'lovlar yo'q" />
  return (
    <DataList
      label="Billing tarixi"
      items={billings.data}
      columns={columns}
      getKey={(b) => b.id}
      footer={`Jami: ${billings.data.length}`}
    />
  )
}
