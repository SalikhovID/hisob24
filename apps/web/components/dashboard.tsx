"use client"

import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { MONTHS } from "@/lib/format"
import { HomeBanner } from "@/components/kit/banner"
import { Foot } from "@/components/kit/group"
import { HomeHero } from "@/components/home/home-hero"
import { Overview } from "@/components/home/overview"
import { QuickTiles } from "@/components/home/quick-tiles"
import { NewOrder } from "@/components/orders/new-order"
import { UpcomingOrders } from "@/components/home/upcoming-orders"
import { LocationSwitcher } from "@/components/shell/location-switcher"
import { Failed, Loading } from "@/components/states"
import { formatDate } from "@/lib/format"
import { useHomeScreenOffer } from "@/lib/home-screen"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { dashboardKey, useDashboard, useMe, useOrderStages } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { todayISO } from "@/lib/orders"
import { useLocation } from "@/lib/use-location"

// Dashboard is the app's home, as the prototype's: who is signed in and
// where (the company, the short name and the role: the way to the profile)
// and the location switch; the one figure that matters most (the hero),
// the quick tiles; inside Telegram, the offer to put the app on the home
// screen; the overview's cards and the nearest deadlines of the current
// location; and the subscription's end. The pages the tab bar does not
// hold are the settings page's (a wide screen has them in the sidebar). The greeting is the page's heading for a screen reader. The shell
// around it shows it only to a session with a company.
export function Dashboard() {
  const me = useMe()
  const offer = useHomeScreenOffer()
  const location = useLocation()
  const data = me.data
  const company = data?.company
  const companyId = company?.id ?? null
  const locationId = location.current?.id ?? null
  const dashboard = useDashboard(companyId, locationId)
  const stages = useOrderStages(dashboard.data?.orders ? companyId : null)
  const [addingOrder, setAddingOrder] = useState(false)
  const queryClient = useQueryClient()
  if (!data || !company) return null
  const user = data.user
  const name = user.full_name ?? formatPhone(user.phone)
  const role = company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)

  return (
    <>
      <h1 className="sr-only">Salom, {name}</h1>
      {/* On a wide screen the head is the location alone, at the right: the
          sidebar holds the way to the profile (the prototype's web view). */}
      <div data-slot="home-head" className="mb-3 flex items-center justify-between gap-2.5 pt-1.5 pb-1 md:justify-end md:pt-0">
        <Link
          href="/profile"
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-[22px] pr-2 text-left outline-none active:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        >
          <Avatar name={user.full_name} />
          <span className="min-w-0">
            <b className="block truncate text-md leading-tight font-semibold">{company.name}</b>{" "}
            <small className="block truncate text-xs text-muted-foreground">
              {user.full_name ? shortName(user.full_name) : name} · {role}
            </small>
          </span>
        </Link>
        <LocationSwitcher />
      </div>

      {dashboard.isPending ? (
        <Loading rows={3} />
      ) : dashboard.isError ? (
        <Failed error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <>
          <HomeHero dashboard={dashboard.data} locationName={location.current?.name ?? null} />
          <QuickTiles companyId={company.id} locationId={locationId} permissions={data.permissions} />
        </>
      )}

      {offer.offered && <HomeBanner onAdd={offer.add} onDismiss={offer.dismiss} />}

      {dashboard.data && (
        <>
          <Overview dashboard={dashboard.data} stages={stages.data ?? []} hasLocation={locationId !== null} month={MONTHS[Number(todayISO().slice(5, 7)) - 1]} />
          {dashboard.data.orders && (
            <UpcomingOrders
              orders={dashboard.data.orders}
              stages={stages.data ?? []}
              hasLocation={locationId !== null}
              canAdd={data.permissions.includes("orders.create") && data.permissions.includes("customers.view")}
              onAdd={() => setAddingOrder(true)}
            />
          )}
          {addingOrder && locationId !== null && (
            <NewOrder
              companyId={company.id}
              locationId={locationId}
              canCreateCustomer={data.permissions.includes("customers.create")}
              onClose={() => {
                setAddingOrder(false)
                queryClient.invalidateQueries({ queryKey: dashboardKey(company.id) })
              }}
            />
          )}
        </>
      )}

      <Foot center>Obuna {formatDate(company.end_date)} gacha faol</Foot>
    </>
  )
}
