"use client"

import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { formatDateTime } from "@/lib/format"
import { useProductMoves } from "@/lib/queries"
import { documentHref, kindTitle, signedQuantity } from "@/lib/stock"
import type { ProductMove } from "@/lib/types"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// ProductMoves is a product's moves in the stock journal, on its page, in
// the member's locations (logic/products.md, section 6): each by the
// document that moved it (the way into it), its moment, its location (with
// two or more to work in), the counterpart (the supplier, or a transfer's
// other location) and how much came in or went out; the newest first,
// twenty at a time.
export function ProductMoves({ companyId, productId, unit }: { companyId: number; productId: number; unit: string | null }) {
  const [page, setPage] = useState(1)
  const moves = useProductMoves(companyId, productId, page)
  const { locations } = useLocation()
  const columns: Column<ProductMove>[] = [
    {
      header: "Hujjat",
      primary: true,
      // The document is the way in, from the table and the card alike.
      cell: (move) => (
        <Link href={documentHref(move.kind, move.transaction_id)} className="font-medium underline-offset-4 hover:underline">
          {kindTitle[move.kind]} № {move.number}
        </Link>
      ),
    },
    { header: "Vaqt", card: "inline", className: "whitespace-nowrap", cell: (move) => formatDateTime(move.at) },
    ...(locations.length >= 2 ? [{ header: "Lokatsiya", card: "tag", cell: (move) => move.location_name } satisfies Column<ProductMove>] : []),
    { header: "Kontragent", card: "row", cell: (move) => move.counterpart },
    {
      header: "Miqdor",
      align: "end",
      card: "aside",
      cell: (move) => (
        <span className={cn("tabular-nums", move.quantity.startsWith("-") ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
          {signedQuantity(move.quantity, unit, true)}
        </span>
      ),
    },
  ]
  return (
    <section aria-labelledby="product-moves" className="space-y-3">
      <h2 id="product-moves" className="text-base font-semibold">
        Harakatlar
      </h2>
      {moves.isPending && <ListLoading rows={2} mark="none" />}
      {moves.isError && <Failed error={moves.error} onRetry={() => moves.refetch()} />}
      {moves.data?.total === 0 && <EmptyState title="Bu mahsulot hali harakat qilmagan" />}
      {moves.data && moves.data.total > 0 && (
        <DataList
          label="Harakatlar"
          items={moves.data.items}
          columns={columns}
          getKey={(move) => move.id}
          footer={<Pager page={moves.data.page} pageSize={moves.data.page_size} total={moves.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
