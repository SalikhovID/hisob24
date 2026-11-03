"use client"

import { PackageIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { type Column, DataTable } from "@/components/kit/data-table"
import { Foot } from "@/components/kit/group"
import { SearchBox } from "@/components/kit/search-box"
import { Toolbar } from "@/components/kit/toolbar"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney, formatQuantity } from "@/lib/format"
import { useStockSummary } from "@/lib/queries"
import type { StockSummaryItem } from "@/lib/types"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// StockSummary is the warehouse's «Qoldiq» table (logic/warehouse.md,
// section 5), as the prototype's: a product a row by name (its SKU under
// it, «Nofaol» when turned off), its stock in every location of the
// member's (the current one bold), the sum and its value at the last
// purchase price; a search by name or SKU, twenty to a page. On a phone a
// product is a row: the stock by location under its name (with two or
// more), the current location's at its right.
export function StockSummary({ companyId }: { companyId: number }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const summary = useStockSummary(companyId, { search, page })
  const { locations, current } = useLocation()
  const currencies = useCurrencies()
  const nameOf = (id: number) => locations.find((location) => location.id === id)?.name ?? ""
  const quantityIn = (item: StockSummaryItem, id: number | undefined) => item.locations.find((l) => l.location_id === id)?.quantity ?? item.total

  const columns: Column<StockSummaryItem>[] = [
    {
      key: "product",
      label: "Mahsulot",
      render: (item) => (
        <span className="grid leading-[1.3]">
          <span className="flex items-center gap-1.5 font-medium">
            {item.name}
            {!item.is_active && <Badge>Nofaol</Badge>}
          </span>
          {item.sku && <span className="text-[12px] text-muted-foreground">{item.sku}</span>}
        </span>
      ),
    },
    ...(summary.data?.items[0]?.locations ?? []).map((l) => ({
      key: `location-${l.location_id}`,
      label: nameOf(l.location_id),
      align: "end" as const,
      render: (item: StockSummaryItem) => (
        <span className={cn(l.location_id === current?.id && "font-semibold")}>{formatQuantity(quantityIn(item, l.location_id), item.unit)}</span>
      ),
    })),
    { key: "total", label: "Jami", align: "end", render: (item) => formatQuantity(item.total, item.unit) },
    {
      key: "value",
      label: "Qiymati",
      align: "end",
      render: (item) => (item.value !== null && item.last_price ? formatMoney(item.value, currencyOf(currencies, item.last_price.currency_id)) : "—"),
    },
  ]

  const data = summary.data
  return (
    <section aria-label="Qoldiq">
      <Toolbar>
        <SearchBox
          value={search}
          onSearch={(next) => {
            setSearch(next)
            setPage(1)
          }}
          placeholder="Nomi yoki artikul"
        />
      </Toolbar>
      {summary.isPending && <ListLoading rows={5} />}
      {summary.isError && <Failed error={summary.error} onRetry={() => summary.refetch()} />}
      {data && (
        <div className={cn(summary.isPlaceholderData && "opacity-60")}>
          <DataTable
            label="Qoldiq"
            rows={data.items}
            rowKey={(item) => item.product_id}
            href={(item) => `/products/${item.product_id}`}
            columns={columns}
            mobileRow={(item) => ({
              title: item.name,
              sub:
                item.locations.length > 1
                  ? item.locations.map((l) => `${nameOf(l.location_id)} ${formatQuantity(l.quantity, null)}`).join(" · ")
                  : (item.sku ?? undefined),
              end: formatQuantity(quantityIn(item, current?.id), item.unit),
            })}
            empty={
              <EmptyState
                icon={search ? SearchIcon : PackageIcon}
                title={search ? "Mahsulot topilmadi" : "Hali mahsulot yo'q"}
                description={search ? "Qidiruvni o'zgartirib ko'ring." : undefined}
              />
            }
          />
          {data.total > data.page_size ? (
            <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          ) : (
            data.total > 0 && <Foot>Jami: {data.total}</Foot>
          )}
        </div>
      )}
    </section>
  )
}
