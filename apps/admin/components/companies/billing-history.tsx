"use client"

import { type Column, DataList } from "@/components/data-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { formatAmount, formatDate } from "@/lib/format"
import { useBillings } from "@/lib/queries"
import type { Billing } from "@/lib/types"

// A payment reads as a ledger line: the day it was made, what it bought, what
// was paid, the period it moved, and a note. A payment with no amount or no
// note has none: the table marks the gap with a dash, a card leaves it out.
// The figures are set to the right so the digits line up; the period is
// context (muted, but always there: a column hidden on a narrow table would
// be shown nowhere) and the note takes whatever width is left, wrapping.
const columns: Column<Billing>[] = [
  { header: "Sana", primary: true, className: "font-medium whitespace-nowrap", cell: (b) => formatDate(b.created_at) },
  {
    header: "Kunlar",
    card: "tag",
    align: "end",
    cell: (b) => <span className="text-foreground">{`+${b.days} kun`}</span>,
  },
  { header: "Summa", card: "aside", align: "end", cell: (b) => b.amount !== null && formatAmount(b.amount) },
  {
    header: "Davr",
    card: "tag",
    className: "text-muted-foreground xl:pl-8",
    cell: (b) => `${formatDate(b.prev_end_date)} → ${formatDate(b.new_end_date)}`,
  },
  {
    header: "Izoh",
    card: "note",
    className: "w-full min-w-24 whitespace-normal text-muted-foreground [overflow-wrap:anywhere]",
    cell: (b) => b.note,
  },
]

// BillingHistory lists a company's payments, newest first.
export function BillingHistory({ companyId }: { companyId: number }) {
  const billings = useBillings(companyId)

  if (billings.isPending) return <ListLoading rows={2} mark="none" />
  if (billings.isError) return <Failed error={billings.error} onRetry={() => billings.refetch()} />
  if (billings.data.length === 0) {
    return (
      <EmptyState
        title="Hali to'lovlar yo'q"
        description="Birinchi to'lovni «Billing qo'shish» tugmasi orqali kiriting."
      />
    )
  }
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
