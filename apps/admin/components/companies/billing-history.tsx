"use client"

import { type Column, DataList } from "@/components/data-list"
import { Empty, Failed, Loading } from "@/components/states"
import { formatAmount, formatDate } from "@/lib/format"
import { useBillings } from "@/lib/queries"
import type { Billing } from "@/lib/types"

const columns: Column<Billing>[] = [
  { header: "Sana", cell: (b) => formatDate(b.created_at), primary: true },
  { header: "Kunlar", cell: (b) => `+${b.days} kun` },
  { header: "Summa", cell: (b) => formatAmount(b.amount) },
  { header: "Davr", cell: (b) => `${formatDate(b.prev_end_date)} → ${formatDate(b.new_end_date)}` },
  { header: "Izoh", cell: (b) => b.note ?? "—" },
]

// BillingHistory lists a company's payments, newest first.
export function BillingHistory({ companyId }: { companyId: number }) {
  const billings = useBillings(companyId)

  if (billings.isPending) return <Loading rows={2} />
  if (billings.isError) return <Failed error={billings.error} onRetry={() => billings.refetch()} />
  if (billings.data.length === 0) return <Empty>Hali to&apos;lovlar yo&apos;q</Empty>
  return <DataList label="Billing tarixi" items={billings.data} columns={columns} getKey={(b) => b.id} />
}
