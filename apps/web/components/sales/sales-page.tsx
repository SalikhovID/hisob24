"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { NoLocation } from "@/components/warehouse/no-location"
import { usePageFilter } from "@/components/warehouse/use-page-filter"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useSales } from "@/lib/queries"
import type { Permission, Sale } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"

// SalesPage is the sales of the current location (logic/sales.md, 3.4),
// for whoever may see the sales (adding takes sales.create and a way to
// the products): the newest first, each by its number and customer (or
// retail), its moment and how many lines, what it came to and what was
// paid with it, in its currency.
export function SalesPage() {
  const gate = usePermission("sales.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePageFilter()
  const currencies = useCurrencies()
  const sales = useSales(locationId !== null ? companyId : null, { locationId, customerId: null, page: filter.page })

  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const columns: Column<Sale>[] = [
    {
      header: "Sotuv",
      primary: true,
      cell: (s) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            № {s.number} · {s.customer?.name ?? "Chakana"}
          </span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDateTime(s.at)} · {s.items_count} ta mahsulot
          </span>
        </span>
      ),
    },
    { header: "Jami", align: "end", card: "aside", cell: (s) => formatMoney(s.total, currencyOf(currencies, s.currency_id)) },
    { header: "To'langan", align: "end", card: "inline", cell: (s) => formatMoney(s.paid, currencyOf(currencies, s.currency_id)) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (s) => s.created_by_name },
  ]

  const canAdd = allowed("sales.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = sales.isPlaceholderData && sales.data?.total === 0
  const loading = !noLocation && (sales.isPending || settling)
  const total = sales.isPlaceholderData ? undefined : sales.data?.total

  if (!gate) return null
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sotuvlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya sotuvlari"}
        actions={
          canAdd && (
            <Link href="/sales/new" className={buttonVariants({ size: "lg", className: "px-3.5" })}>
              <PlusIcon />
              Sotuv qo&apos;shish
            </Link>
          )
        }
      />
      {noLocation ? (
        <NoLocation />
      ) : (
        <div className="space-y-3">
          {loading && <ListLoading rows={6} mark="none" />}
          {sales.isError && <Failed error={sales.error} onRetry={() => sales.refetch()} />}
          {!loading && !sales.isError && sales.data?.total === 0 && (
            <EmptyState title="Hali sotuv yo'q" description={canAdd ? "Birinchi sotuvni «Sotuv qo'shish» tugmasi orqali kiriting." : undefined} />
          )}
          {!loading && !sales.isError && sales.data && sales.data.total > 0 && (
            <DataList
              label="Sotuvlar"
              items={sales.data.items}
              columns={columns}
              getKey={(s) => s.id}
              href={(s) => `/sales/${s.id}`}
              footer={<Pager page={sales.data.page} pageSize={sales.data.page_size} total={sales.data.total} onPage={(page) => update({ page })} />}
            />
          )}
        </div>
      )}
    </div>
  )
}
