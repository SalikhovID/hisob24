"use client"

import { PackageOpenIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useOpeningStockList } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

// OpeningStockPage is the opening stock documents of the current location
// (logic/warehouse.md, 5.3), for whoever may see the stock documents
// (adding takes stock.create and a way to the products), as the prototype's
// list: the newest first, grouped by their day, each a row by its number,
// how many products and who entered it, what it came to in its currency.
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

  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = openings.isPlaceholderData && openings.data?.total === 0
  const loading = !noLocation && (openings.isPending || settling)
  const total = openings.isPlaceholderData ? undefined : openings.data?.total

  if (!gate) return null
  const page = openings.data
  return (
    <>
      <PageTitle
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Boshlang'ich qoldiq"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya boshlang'ich qoldiqlari"}
        action={canAdd && <PlusButton label="Boshlang'ich qoldiq qo'shish" href="/opening-stock/new" />}
      />
      {noLocation && <NoLocation />}
      {loading && <ListLoading rows={6} />}
      {openings.isError && <Failed error={openings.error} onRetry={() => openings.refetch()} />}
      {!loading && !openings.isError && page?.total === 0 && (
        <EmptyState
          icon={PackageOpenIcon}
          title="Hali boshlang'ich qoldiq yo'q"
          description={canAdd ? "Birinchisini «Boshlang'ich qoldiq qo'shish» tugmasi orqali kiriting." : undefined}
        />
      )}
      {!loading && !openings.isError && page && page.total > 0 && (
        <>
          <DayGroups label="Boshlang'ich qoldiq" items={page.items} at={(opening) => opening.at} className={cn(openings.isPlaceholderData && "opacity-60")}>
            {(opening) => (
              <Row
                key={opening.id}
                href={`/opening-stock/${opening.id}`}
                media={<SoftIcon icon={PackageOpenIcon} />}
                title={`№ ${opening.number}`}
                sub={[`${opening.items_count} ta mahsulot`, opening.created_by_name && shortName(opening.created_by_name)].filter(Boolean).join(" · ")}
                end={formatMoney(opening.total, currencyOf(currencies, opening.currency_id))}
                chevron={false}
              />
            )}
          </DayGroups>
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
