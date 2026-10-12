"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useTransfers } from "@/lib/queries"
import type { Permission, Transfer } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { NoLocation } from "./no-location"
import { usePageFilter } from "./use-page-filter"

const warehouseSection = navItems.find((item) => item.key === "warehouse")!

// TransfersPage is the transfers out of or into the current location
// (logic/warehouse.md, 5.1), for whoever may see the stock documents
// (stock.view; adding takes stock.create, a way to the products and
// another location to move to): the newest first, each by its number and
// its two ends, its moment and how many products, and whether it leaves
// the current location or arrives in it.
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

  const columns: Column<Transfer>[] = [
    {
      header: "Ko'chirish",
      primary: true,
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            № {t.number} · {t.location_name} → {t.to_location_name}
          </span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDateTime(t.at)} · {t.items_count} ta mahsulot
          </span>
        </span>
      ),
    },
    { header: "Yo'nalish", card: "tag", cell: (t) => <Badge variant="outline">{t.location_id === locationId ? "Chiqim" : "Kirim"}</Badge> },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (t) => t.created_by_name },
  ]

  // A transfer names products and another location: adding one takes a
  // way to the products and a second location.
  const twoLocations = location.locations.length >= 2
  const canAdd = allowed("stock.create") && allowed("products.view") && locationId !== null && twoLocations
  const noLocation = location.ready && locationId === null
  const settling = transfers.isPlaceholderData && transfers.data?.total === 0
  const loading = !noLocation && (transfers.isPending || settling)
  const total = transfers.isPlaceholderData ? undefined : transfers.data?.total

  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={warehouseSection} permissions={gate.permissions} />
      <PageHeader
        title="Ko'chirishlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya ko'chirishlari"}
        actions={
          canAdd && (
            <Link href="/transfers/new" className={buttonVariants({ size: "lg", className: "px-3.5" })}>
              <PlusIcon />
              Ko&apos;chirish qo&apos;shish
            </Link>
          )
        }
      />
      {noLocation ? (
        <NoLocation />
      ) : (
        <div className="space-y-3">
          {loading && <ListLoading rows={6} mark="none" />}
          {transfers.isError && <Failed error={transfers.error} onRetry={() => transfers.refetch()} />}
          {!loading && !transfers.isError && transfers.data?.total === 0 && (
            <EmptyState
              title="Hali ko'chirish yo'q"
              description={!twoLocations ? "Ko'chirish uchun kamida ikkita lokatsiya kerak." : canAdd ? "Birinchi ko'chirishni «Ko'chirish qo'shish» tugmasi orqali kiriting." : undefined}
            />
          )}
          {!loading && !transfers.isError && transfers.data && transfers.data.total > 0 && (
            <DataList
              label="Ko'chirishlar"
              items={transfers.data.items}
              columns={columns}
              getKey={(t) => t.id}
              href={(t) => `/transfers/${t.id}`}
              footer={<Pager page={transfers.data.page} pageSize={transfers.data.page_size} total={transfers.data.total} onPage={(page) => update({ page })} />}
            />
          )}
        </div>
      )}
    </div>
  )
}
