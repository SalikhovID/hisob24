"use client"

import { ArrowLeftRightIcon, ClipboardCheckIcon, type LucideIcon, PackageOpenIcon, ReceiptIcon, ShoppingBagIcon } from "lucide-react"
import { useState } from "react"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { Failed, ListLoading } from "@/components/states"
import { formatDateTime } from "@/lib/format"
import { useProductMoves } from "@/lib/queries"
import { documentHref, kindTitle, signedQuantity } from "@/lib/stock"
import type { GoodsKind } from "@/lib/types"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// kindIcon is the soft icon of a document of each kind.
const kindIcon: Record<GoodsKind, LucideIcon> = {
  purchase: ReceiptIcon,
  sale: ShoppingBagIcon,
  transfer: ArrowLeftRightIcon,
  inventory: ClipboardCheckIcon,
  opening_stock: PackageOpenIcon,
}

// ProductMoves is a product's moves in the stock journal, on its page, in
// the member's locations (logic/products.md, section 6), as the
// prototype's rows: each by the document that moved it (the way into it),
// the moment, its location (with two or more to work in) and the
// counterpart (the supplier, or a transfer's other location) under it, how
// much came in or went out at its end; the newest first, twenty at a time.
export function ProductMoves({ companyId, productId, unit }: { companyId: number; productId: number; unit: string | null }) {
  const [page, setPage] = useState(1)
  const moves = useProductMoves(companyId, productId, page)
  const { locations } = useLocation()
  const data = moves.data
  return (
    <section aria-labelledby="product-moves">
      <SectionHeading hint={data && data.total > 0 ? data.total : undefined}>
        <span id="product-moves">Harakatlar</span>
      </SectionHeading>
      {moves.isPending && <ListLoading rows={2} mark="none" />}
      {moves.isError && <Failed error={moves.error} onRetry={() => moves.refetch()} />}
      {data?.total === 0 && (
        <Group>
          <p className="px-4 py-3.5 text-md text-muted-foreground">Bu mahsulot hali harakat qilmagan</p>
        </Group>
      )}
      {data && data.total > 0 && (
        <>
          <Group label="Harakatlar" inset="icon">
            {data.items.map((move) => {
              const out = move.quantity.startsWith("-")
              const sub = [formatDateTime(move.at), locations.length >= 2 ? move.location_name : null, move.counterpart]
              return (
                <Row
                  key={move.id}
                  href={documentHref(move.kind, move.transaction_id)}
                  media={<SoftIcon icon={kindIcon[move.kind]} />}
                  title={`${kindTitle[move.kind]} № ${move.number}`}
                  sub={sub.filter(Boolean).join(" · ")}
                  end={<span className={cn("tabular-nums", out ? "text-destructive" : "text-positive")}>{signedQuantity(move.quantity, unit, true)}</span>}
                  chevron={false}
                />
              )
            })}
          </Group>
          {data.total > data.page_size && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
    </section>
  )
}
