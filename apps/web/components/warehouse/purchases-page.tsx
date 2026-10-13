"use client"

import { MapPinIcon, ReceiptIcon } from "lucide-react"
import { Fragment, useEffect, useRef } from "react"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { dayOf, dayTitle, formatAmount, formatMoney } from "@/lib/format"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { usePurchases } from "@/lib/queries"
import { todayISO } from "@/lib/tasks"
import type { Permission, Purchase } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { usePageFilter } from "./use-page-filter"

// paidText says what was paid with a purchase, at its row's end: all of it
// (green), none (red), or how much.
function paidText(purchase: Purchase) {
  const paid = Number(purchase.paid)
  if (paid >= Number(purchase.total)) return <span className="text-positive">To&apos;langan</span>
  if (paid === 0) return <span className="text-destructive">To&apos;lanmagan</span>
  return `${formatAmount(purchase.paid)} to'langan`
}

// PurchasesPage is the purchases of the current location (logic/warehouse.md,
// 4.5; logic/locations.md, section 7), for whoever may see them
// (purchases.view; adding takes purchases.create and a way to the suppliers
// and the products), as the prototype's list: the newest first, grouped by
// their day (what the day's purchases came to in so'm beside it), each a row
// by its number and supplier, how many products and who entered it, what it
// came to in its currency and how much of it was paid.
export function PurchasesPage() {
  const gate = usePermission("purchases.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const [filter, update] = usePageFilter()
  const currencies = useCurrencies()
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
  const page = purchases.data
  // The page's purchases by their day, in the order they come (the newest first).
  const days: { day: string; items: Purchase[] }[] = []
  for (const purchase of page?.items ?? []) {
    const day = dayOf(purchase.at)
    const last = days.at(-1)
    if (last?.day === day) last.items.push(purchase)
    else days.push({ day, items: [purchase] })
  }
  const today = todayISO()
  return (
    <>
      <PageTitle
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Xaridlar"
        description={location.current ? (total !== undefined ? `${location.current.name} · ${total} ta` : location.current.name) : "Joriy lokatsiya xaridlari"}
        action={canAdd && <PlusButton label="Xarid qo'shish" href="/purchases/new" />}
      />
      {noLocation && <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />}
      {loading && <ListLoading rows={6} />}
      {purchases.isError && <Failed error={purchases.error} onRetry={() => purchases.refetch()} />}
      {!loading && !purchases.isError && page?.total === 0 && (
        <EmptyState icon={ReceiptIcon} title="Hali xarid yo'q" description={canAdd ? "Birinchi xaridni «Xarid qo'shish» tugmasi orqali kiriting." : undefined} />
      )}
      {!loading && !purchases.isError && page && page.total > 0 && (
        <>
          <section aria-label="Xaridlar" className={cn(purchases.isPlaceholderData && "opacity-60")}>
            {days.map(({ day, items }) => {
              const title = dayTitle(day, today)
              const sum = items.reduce((all, purchase) => all + Number(purchase.total_uzs), 0)
              return (
                <Fragment key={day}>
                  <SectionHeading hint={formatAmount(sum.toFixed(2))}>{title}</SectionHeading>
                  <Group label={title} inset="icon">
                    {items.map((purchase) => (
                      <Row
                        key={purchase.id}
                        href={`/purchases/${purchase.id}`}
                        media={<SoftIcon icon={ReceiptIcon} />}
                        title={`№ ${purchase.number} · ${purchase.supplier.name}`}
                        sub={[`${purchase.items_count} ta mahsulot`, purchase.created_by_name && shortName(purchase.created_by_name)].filter(Boolean).join(" · ")}
                        end={formatMoney(purchase.total, currencyOf(currencies, purchase.currency_id))}
                        endSub={paidText(purchase)}
                        chevron={false}
                      />
                    ))}
                  </Group>
                </Fragment>
              )
            })}
          </section>
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
