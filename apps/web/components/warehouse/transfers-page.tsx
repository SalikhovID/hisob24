"use client"

import { ArrowLeftRightIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useTransfers } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

// TransfersPage is the transfers out of or into the current location
// (logic/warehouse.md, 5.1), for whoever may see the stock documents
// (stock.view; adding takes stock.create, a way to the products and
// another location to move to), as the prototype's list: the newest first,
// grouped by their day, each a row by its number and its two ends, how
// many products and who entered it, and whether it leaves the current
// location (red) or arrives in it (green).
export function TransfersPage() {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePageFilter()
  const transfers = useTransfers(locationId !== null ? companyId : null, { locationId, page: filter.page })

  // Another location is another list: it starts from its first page.
  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  // A transfer names products and another location: adding one takes a
  // way to the products and a second location.
  const twoLocations = location.locations.length >= 2
  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null && twoLocations
  const noLocation = location.ready && locationId === null
  const settling = transfers.isPlaceholderData && transfers.data?.total === 0
  const loading = !noLocation && (transfers.isPending || settling)
  const total = transfers.isPlaceholderData ? undefined : transfers.data?.total

  if (!gate) return null
  const page = transfers.data
  return (
    <>
      <PageTitle
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Ko'chirishlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya ko'chirishlari"}
        action={canAdd && <PlusButton label="Ko'chirish qo'shish" href="/transfers/new" />}
      />
      {noLocation && <NoLocation />}
      {loading && <ListLoading rows={6} />}
      {transfers.isError && <Failed error={transfers.error} onRetry={() => transfers.refetch()} />}
      {!loading && !transfers.isError && page?.total === 0 && (
        <EmptyState
          icon={ArrowLeftRightIcon}
          title="Hali ko'chirish yo'q"
          description={!twoLocations ? "Ko'chirish uchun kamida ikkita lokatsiya kerak." : canAdd ? "Birinchi ko'chirishni «Ko'chirish qo'shish» tugmasi orqali kiriting." : undefined}
        />
      )}
      {!loading && !transfers.isError && page && page.total > 0 && (
        <>
          <DayGroups label="Ko'chirishlar" items={page.items} at={(transfer) => transfer.at} className={cn(transfers.isPlaceholderData && "opacity-60")}>
            {(transfer) => {
              const out = transfer.location_id === locationId
              return (
                <Row
                  key={transfer.id}
                  href={`/transfers/${transfer.id}`}
                  media={<SoftIcon icon={ArrowLeftRightIcon} />}
                  title={`№ ${transfer.number} · ${transfer.location_name} → ${transfer.to_location_name}`}
                  sub={[`${transfer.items_count} ta mahsulot`, transfer.created_by_name && shortName(transfer.created_by_name)].filter(Boolean).join(" · ")}
                  end={<span className={cn("text-md", out ? "text-destructive" : "text-positive")}>{out ? "Chiqim" : "Kirim"}</span>}
                  chevron={false}
                />
              )
            }}
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
