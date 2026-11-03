"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { HomeBanner } from "@/components/kit/banner"
import { Foot } from "@/components/kit/group"
import { HomeCards } from "@/components/home/home-cards"
import { HomeHead } from "@/components/home/home-head"
import { HomeHero } from "@/components/home/home-hero"
import { QuickTiles } from "@/components/home/quick-tiles"
import { UpcomingOrders } from "@/components/home/upcoming-orders"
import { NewOrder } from "@/components/orders/new-order"
import { Failed, Loading } from "@/components/states"
import { formatDate, MONTHS } from "@/lib/format"
import { useHomeScreenOffer } from "@/lib/home-screen"
import { todayISO } from "@/lib/orders"
import { formatPhone } from "@/lib/phone"
import { dashboardKey, useDashboard, useMe, useOrderStages } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useLocation } from "@/lib/use-location"

// Dashboard is the app's home, as the prototype's: the greeting and where
// (the head); what the cash holds (the hero) and the quick tiles; inside
// Telegram, the offer to put the app on the home screen; the cards (the
// orders not done, the customers' debt, the month's sales, the low stock)
// and the nearest deadlines of the current location; and the
// subscription's end. Each block is the member's (logic/roles.md,
// section 8). The shell around it shows it only to a session with a
// company.
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
  const name = data.user.full_name ?? formatPhone(data.user.phone)
  const role = company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)

  return (
    <>
      <HomeHead name={name} company={company.name} role={role} />

      {dashboard.isPending ? (
        <Loading rows={3} />
      ) : dashboard.isError ? (
        <Failed error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <>
          {dashboard.data.cash && <HomeHero cash={dashboard.data.cash} />}
          <QuickTiles companyId={company.id} locationId={locationId} permissions={data.permissions} />
        </>
      )}

      {offer.offered && <HomeBanner onAdd={offer.add} onDismiss={offer.dismiss} />}

      {dashboard.data && (
        <>
          <HomeCards dashboard={dashboard.data} stages={stages.data ?? []} hasLocation={locationId !== null} month={MONTHS[Number(todayISO().slice(5, 7)) - 1]} />
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
