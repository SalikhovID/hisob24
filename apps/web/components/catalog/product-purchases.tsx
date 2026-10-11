"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format"
import { useProductPurchases } from "@/lib/queries"
import type { ProductPurchase } from "@/lib/types"
import { useLocation } from "@/lib/use-location"

// ProductPurchases is the live purchases a product is in, on its page, in
// the member's locations: each by its number and supplier (the way into the
// purchase), its moment, its location (with two or more to work in), the
// quantity bought, the price and what the line came to in the purchase's
// currency; the newest first, twenty at a time.
export function ProductPurchases({ companyId, productId, unit }: { companyId: number; productId: number; unit: string | null }) {
  const [page, setPage] = useState(1)
  const purchases = useProductPurchases(companyId, productId, page)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const columns: Column<ProductPurchase>[] = [
    { header: "Xarid", primary: true, cell: (line) => `№ ${line.number} · ${line.supplier.name}` },
    { header: "Vaqt", card: "inline", className: "whitespace-nowrap", cell: (line) => formatDateTime(line.at) },
    ...(locations.length >= 2
      ? [{ header: "Lokatsiya", card: "tag", cell: (line) => <Badge variant="outline">{line.location_name}</Badge> } satisfies Column<ProductPurchase>]
      : []),
    { header: "Miqdor", card: "inline", className: "tabular-nums", cell: (line) => formatQuantity(line.quantity, unit) },
    { header: "Narx", align: "end", card: "inline", cell: (line) => formatMoney(line.price, currencyOf(currencies, line.currency_id)) },
    { header: "Summa", align: "end", card: "aside", cell: (line) => formatMoney(line.amount, currencyOf(currencies, line.currency_id)) },
  ]
  return (
    <section aria-labelledby="product-purchases" className="space-y-3">
      <h2 id="product-purchases" className="text-base font-semibold">
        Xaridlar
      </h2>
      {purchases.isPending && <ListLoading rows={2} mark="none" />}
      {purchases.isError && <Failed error={purchases.error} onRetry={() => purchases.refetch()} />}
      {purchases.data?.total === 0 && <EmptyState title="Bu mahsulot hali xarid qilinmagan" />}
      {purchases.data && purchases.data.total > 0 && (
        <DataList
          label="Xaridlar"
          items={purchases.data.items}
          columns={columns}
          getKey={(line) => line.purchase_id}
          href={(line) => `/purchases/${line.purchase_id}`}
          footer={<Pager page={purchases.data.page} pageSize={purchases.data.page_size} total={purchases.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
