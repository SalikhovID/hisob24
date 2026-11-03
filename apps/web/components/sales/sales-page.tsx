"use client"

import { ShoppingBagIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { type Column, DataTable } from "@/components/kit/data-table"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { NoLocation } from "@/components/warehouse/no-location"
import { PaidStatus } from "@/components/warehouse/paid-status"
import { usePageFilter } from "@/components/warehouse/use-page-filter"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { count, formatAmount, formatDayMonthTime, formatMoney } from "@/lib/format"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useSales } from "@/lib/queries"
import type { Permission, Sale } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// SalesPage is the sales of the current location (logic/sales.md, 3.4),
// for whoever may see the sales (adding takes sales.create and a way to
// the products), as the prototype's list: the newest first, grouped by
// their day (what the day's sales came to in so'm beside it), each a row by
// its number and customer (or «Chakana»), how many lines and who entered
// it, what it came to in its currency and how much of it was paid.
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

  const canAdd = allowed("sales.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = sales.isPlaceholderData && sales.data?.total === 0
  const loading = !noLocation && (sales.isPending || settling)
  const total = sales.isPlaceholderData ? undefined : sales.data?.total

  // The web's table: the number (the way in), the moment, the customer (or
  // «Chakana»), who entered it, the total and what of it is paid.
  const columns: Column<Sale>[] = [
    { key: "number", label: "№", render: (sale) => `№ ${sale.number}` },
    { key: "at", label: "Vaqt", render: (sale) => formatDayMonthTime(sale.at) },
    { key: "customer", label: "Mijoz", render: (sale) => sale.customer?.name ?? "Chakana" },
    { key: "by", label: "Kim", render: (sale) => (sale.created_by_name ? shortName(sale.created_by_name) : "—") },
    { key: "total", label: "Jami", align: "end", render: (sale) => formatMoney(sale.total, currencyOf(currencies, sale.currency_id)) },
    { key: "paid", label: "To'lov", align: "end", render: (sale) => <PaidStatus total={sale.total} paid={sale.paid} /> },
  ]

  if (!gate) return null
  const page = sales.data
  return (
    <>
      <PageTitle
        title="Sotuvlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${count(total)}` : location.current.name) : "Joriy lokatsiya sotuvlari"}
        action={canAdd && <PlusButton label="Sotuv qo'shish" href="/sales/new" />}
      />
      {noLocation && <NoLocation />}
      {loading && <ListLoading rows={6} />}
      {sales.isError && <Failed error={sales.error} onRetry={() => sales.refetch()} />}
      {!loading && !sales.isError && page?.total === 0 && (
        <EmptyState icon={ShoppingBagIcon} title="Hali sotuv yo'q" description={canAdd ? "Birinchi sotuvni «Sotuv qo'shish» tugmasi orqali kiriting." : undefined} />
      )}
      {!loading && !sales.isError && page && page.total > 0 && (
        <>
          <div className={cn(sales.isPlaceholderData && "opacity-60")}>
            <DataTable
              label="Sotuvlar"
              rows={page.items}
              rowKey={(sale) => sale.id}
              href={(sale) => `/sales/${sale.id}`}
              columns={columns}
              phone={
                <DayGroups
                  label="Sotuvlar"
                  items={page.items}
                  at={(sale) => sale.at}
                  hint={(day) => formatAmount(day.reduce((sum, sale) => sum + Number(sale.total_uzs), 0).toFixed(2))}
                >
                  {(sale) => (
                    <Row
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      media={<SoftIcon icon={ShoppingBagIcon} />}
                      title={`№ ${sale.number} · ${sale.customer?.name ?? "Chakana"}`}
                      sub={[`${sale.items_count} ta mahsulot`, sale.created_by_name && shortName(sale.created_by_name)].filter(Boolean).join(" · ")}
                      end={formatMoney(sale.total, currencyOf(currencies, sale.currency_id))}
                      endSub={<PaidStatus total={sale.total} paid={sale.paid} />}
                      chevron={false}
                    />
                  )}
                </DayGroups>
              }
            />
          </div>
          {page.total > page.page_size ? (
            <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
          ) : (
            <Foot>Jami: {page.total}</Foot>
          )}
        </>
      )}
    </>
  )
}
