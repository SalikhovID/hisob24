"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useInventories } from "@/lib/queries"
import type { Inventory, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

const warehouseSection = navItems.find((item) => item.key === "warehouse")!

// InventoriesPage is the counts of the current location (logic/warehouse.md,
// 5.2), for whoever may see the stock documents (adding takes stock.create
// and a way to the products): the newest first, each by its number, its
// moment and how many products were counted.
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

  const columns: Column<Inventory>[] = [
    {
      header: "Inventarizatsiya",
      primary: true,
      cell: (i) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">№ {i.number}</span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDateTime(i.at)} · {i.items_count} ta mahsulot
          </span>
        </span>
      ),
    },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (i) => i.created_by_name },
  ]

  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null
  const noLocation = location.ready && locationId === null
  const settling = inventories.isPlaceholderData && inventories.data?.total === 0
  const loading = !noLocation && (inventories.isPending || settling)
  const total = inventories.isPlaceholderData ? undefined : inventories.data?.total

  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={warehouseSection} permissions={gate.permissions} />
      <PageHeader
        title="Inventarizatsiya"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya inventarizatsiyalari"}
        actions={
          canAdd && (
            <Link href="/inventories/new" className={buttonVariants({ size: "lg", className: "px-3.5" })}>
              <PlusIcon />
              Inventarizatsiya qo&apos;shish
            </Link>
          )
        }
      />
      {noLocation ? (
        <NoLocation />
      ) : (
        <div className="space-y-3">
          {loading && <ListLoading rows={6} mark="none" />}
          {inventories.isError && <Failed error={inventories.error} onRetry={() => inventories.refetch()} />}
          {!loading && !inventories.isError && inventories.data?.total === 0 && (
            <EmptyState title="Hali inventarizatsiya yo'q" description={canAdd ? "Birinchi inventarizatsiyani «Inventarizatsiya qo'shish» tugmasi orqali kiriting." : undefined} />
          )}
          {!loading && !inventories.isError && inventories.data && inventories.data.total > 0 && (
            <DataList
              label="Inventarizatsiya"
              items={inventories.data.items}
              columns={columns}
              getKey={(i) => i.id}
              href={(i) => `/inventories/${i.id}`}
              footer={<Pager page={inventories.data.page} pageSize={inventories.data.page_size} total={inventories.data.total} onPage={(page) => update({ page })} />}
            />
          )}
        </div>
      )}
    </div>
  )
}
