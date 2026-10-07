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
import { formatAmount, formatDate } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { usePurchases } from "@/lib/queries"
import type { Permission, Purchase } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { usePurchaseFilter } from "./use-purchase-filter"

const warehouseSection = navItems.find((item) => item.key === "warehouse")!

// PurchasesPage is the purchases of the current location (logic/warehouse.md,
// 4.5; logic/locations.md, section 7), for whoever may see them
// (purchases.view; adding takes purchases.create and a way to the suppliers
// and the products): the newest first, each by its number and supplier,
// its day and how many products, what it came to and what was paid with it.
export function PurchasesPage() {
  const gate = usePermission("purchases.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePurchaseFilter()
  // The list is of the current location: nothing is asked until there is one.
  const purchases = usePurchases(locationId !== null ? companyId : null, { locationId, supplierId: null, page: filter.page })

  // Another location is another list: it starts from its first page. The
  // first location known is not a change.
  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const columns: Column<Purchase>[] = [
    {
      header: "Xarid",
      primary: true,
      cell: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            № {p.number} · {p.supplier.name}
          </span>
          <span className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground">
            {formatDate(p.purchased_on)} · {p.items_count} ta mahsulot
          </span>
        </span>
      ),
    },
    { header: "Jami, so'm", align: "end", card: "aside", cell: (p) => formatAmount(p.total) },
    { header: "To'langan, so'm", align: "end", card: "inline", cell: (p) => formatAmount(p.paid) },
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (p) => p.created_by_name },
  ]

  // A purchase names a supplier and products: adding one takes a way to
  // both (logic/roles.md, 4.3), and a location to enter it into.
  const canAdd = allowed("purchases.create") && allowed("suppliers.view") && allowed("products.view") && locationId !== null
  // A member with no location to work in sees no purchases: the owner has
  // to give them one (logic/locations.md, section 5).
  const noLocation = location.ready && locationId === null
  const settling = purchases.isPlaceholderData && purchases.data?.total === 0
  const loading = !noLocation && (purchases.isPending || settling)
  const total = purchases.isPlaceholderData ? undefined : purchases.data?.total

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={warehouseSection} permissions={gate.permissions} />
      <PageHeader
        title="Xaridlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya xaridlari"}
        actions={
          canAdd && (
            <Link href="/purchases/new" className={buttonVariants({ size: "lg", className: "px-3.5" })}>
              <PlusIcon />
              Xarid qo&apos;shish
            </Link>
          )
        }
      />
      {noLocation ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
          <p className="font-medium">Sizga lokatsiya biriktirilmagan</p>
          <p className="mt-1 text-pretty text-muted-foreground">Kompaniya egasi lokatsiya biriktirishi kerak.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loading && <ListLoading rows={6} mark="none" />}
          {purchases.isError && <Failed error={purchases.error} onRetry={() => purchases.refetch()} />}
          {!loading && !purchases.isError && purchases.data?.total === 0 && (
            <EmptyState title="Hali xarid yo'q" description={canAdd ? "Birinchi xaridni «Xarid qo'shish» tugmasi orqali kiriting." : undefined} />
          )}
          {!loading && !purchases.isError && purchases.data && purchases.data.total > 0 && (
            <DataList
              label="Xaridlar"
              items={purchases.data.items}
              columns={columns}
              getKey={(p) => p.id}
              href={(p) => `/purchases/${p.id}`}
              footer={
                <Pager page={purchases.data.page} pageSize={purchases.data.page_size} total={purchases.data.total} onPage={(page) => update({ page })} />
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
