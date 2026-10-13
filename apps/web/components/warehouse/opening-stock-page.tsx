"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useOpeningStockList } from "@/lib/queries"
import type { OpeningStock, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

// OpeningStockPage is the opening stock documents of the current location
// (logic/warehouse.md, 5.3), for whoever may see the stock documents
// (adding takes stock.create and a way to the products): the newest first,
// each by its number, its moment and how many products, and what it came
// to in its currency.
export function OpeningStockPage() {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePageFilter()
  const currencies = useCurrencies()
  const openings = useOpeningStockList(locationId !== null ? companyId : null, { locationId, page: filter.page })

  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const columns: Column<OpeningStock>[] = [
    {
      header: "Hujjat",
      primary: true,
      cell: (o) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">№ {o.number}</span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDateTime(o.at)} · {o.items_count} ta mahsulot
          </span>
        </span>
      ),
    },
    { header: "Jami", align: "end", card: "aside", cell: (o) => formatMoney(o.total, currencyOf(currencies, o.currency_id)) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (o) => o.created_by_name },
  ]

  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = openings.isPlaceholderData && openings.data?.total === 0
  const loading = !noLocation && (openings.isPending || settling)
  const total = openings.isPlaceholderData ? undefined : openings.data?.total

  if (!gate) return null
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Boshlang'ich qoldiq"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya boshlang'ich qoldiqlari"}
        actions={
          canAdd && (
            <Link href="/opening-stock/new" className={buttonVariants({ size: "lg", className: "px-3.5" })}>
              <PlusIcon />
              Boshlang&apos;ich qoldiq qo&apos;shish
            </Link>
          )
        }
      />
      {noLocation ? (
        <NoLocation />
      ) : (
        <div className="space-y-3">
          {loading && <ListLoading rows={6} mark="none" />}
          {openings.isError && <Failed error={openings.error} onRetry={() => openings.refetch()} />}
          {!loading && !openings.isError && openings.data?.total === 0 && (
            <EmptyState title="Hali boshlang'ich qoldiq yo'q" description={canAdd ? "Birinchisini «Boshlang'ich qoldiq qo'shish» tugmasi orqali kiriting." : undefined} />
          )}
          {!loading && !openings.isError && openings.data && openings.data.total > 0 && (
            <DataList
              label="Boshlang'ich qoldiq"
              items={openings.data.items}
              columns={columns}
              getKey={(o) => o.id}
              href={(o) => `/opening-stock/${o.id}`}
              footer={<Pager page={openings.data.page} pageSize={openings.data.page_size} total={openings.data.total} onPage={(page) => update({ page })} />}
            />
          )}
        </div>
      )}
    </div>
  )
}
