"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { formatAmount, formatDate } from "@/lib/format"
import { usePurchases } from "@/lib/queries"
import type { Purchase } from "@/lib/types"
import { useLocation } from "@/lib/use-location"

// SupplierPurchases is the purchases from a supplier, on its page: each by
// its number (the way into the purchase), its day, its location (with two
// or more to work in: the supplier's purchases are of every one of them),
// what it came to and what was paid with it; the newest first, twenty at a
// time.
export function SupplierPurchases({ companyId, supplierId }: { companyId: number; supplierId: number }) {
  const [page, setPage] = useState(1)
  const purchases = usePurchases(companyId, { locationId: null, supplierId, page })
  const { locations } = useLocation()
  const columns: Column<Purchase>[] = [
    { header: "Xarid", primary: true, cell: (p) => `№ ${p.number}` },
    { header: "Sana", card: "inline", cell: (p) => formatDate(p.purchased_on) },
    ...(locations.length >= 2
      ? [{ header: "Lokatsiya", card: "tag", cell: (p) => <Badge variant="outline">{p.location_name}</Badge> } satisfies Column<Purchase>]
      : []),
    { header: "Jami, so'm", align: "end", card: "aside", cell: (p) => formatAmount(p.total) },
    { header: "To'langan, so'm", align: "end", card: "inline", cell: (p) => formatAmount(p.paid) },
  ]
  return (
    <section aria-labelledby="supplier-purchases" className="space-y-3">
      <h2 id="supplier-purchases" className="text-base font-semibold">
        Xaridlar
      </h2>
      {purchases.isPending && <ListLoading rows={2} mark="none" />}
      {purchases.isError && <Failed error={purchases.error} onRetry={() => purchases.refetch()} />}
      {purchases.data?.total === 0 && <EmptyState title="Bu ta'minotchida xarid yo'q" />}
      {purchases.data && purchases.data.total > 0 && (
        <DataList
          label="Xaridlar"
          items={purchases.data.items}
          columns={columns}
          getKey={(p) => p.id}
          href={(p) => `/purchases/${p.id}`}
          footer={<Pager page={purchases.data.page} pageSize={purchases.data.page_size} total={purchases.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
