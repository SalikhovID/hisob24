"use client"

import { ClipboardCheckIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { DayGroups } from "@/components/kit/day-groups"
import { Foot, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { useInventories } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

// InventoriesPage is the counts of the current location (logic/warehouse.md,
// 5.2), for whoever may see the stock documents (adding takes stock.create
// and a way to the products), as the prototype's list: the newest first,
// grouped by their day, each a row by its number, how many products were
// counted and who counted them.
export function InventoriesPage() {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePageFilter()
  const inventories = useInventories(locationId !== null ? companyId : null, { locationId, page: filter.page })

  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = inventories.isPlaceholderData && inventories.data?.total === 0
  const loading = !noLocation && (inventories.isPending || settling)
  const total = inventories.isPlaceholderData ? undefined : inventories.data?.total

  if (!gate) return null
  const page = inventories.data
  return (
    <>
      <PageTitle
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Inventarizatsiya"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya inventarizatsiyalari"}
        action={canAdd && <PlusButton label="Inventarizatsiya qo'shish" href="/inventories/new" />}
      />
      {noLocation && <NoLocation />}
      {loading && <ListLoading rows={6} />}
      {inventories.isError && <Failed error={inventories.error} onRetry={() => inventories.refetch()} />}
      {!loading && !inventories.isError && page?.total === 0 && (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="Hali inventarizatsiya yo'q"
          description={canAdd ? "Birinchi inventarizatsiyani «Inventarizatsiya qo'shish» tugmasi orqali kiriting." : undefined}
        />
      )}
      {!loading && !inventories.isError && page && page.total > 0 && (
        <>
          <DayGroups label="Inventarizatsiya" items={page.items} at={(inventory) => inventory.at} className={cn(inventories.isPlaceholderData && "opacity-60")}>
            {(inventory) => (
              <Row
                key={inventory.id}
                href={`/inventories/${inventory.id}`}
                media={<SoftIcon icon={ClipboardCheckIcon} />}
                title={`№ ${inventory.number}`}
                sub={[`${inventory.items_count} ta mahsulot`, inventory.created_by_name && shortName(inventory.created_by_name)].filter(Boolean).join(" · ")}
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
