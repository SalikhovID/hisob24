import { ChevronRightIcon, CircleCheckIcon, MapPinIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { EmptyState } from "@/components/states"
import { OrderRow } from "@/components/orders/order-row"
import type { Dashboard, OrderStage } from "@/lib/types"

// UpcomingOrders is the home's «Yaqin muddatlar», as the prototype's: the
// orders not done that are due soonest, each a row to its page (its icon in
// its stage's color, its customer and assignee, the deadline and how far
// it is, red once past), then the way to them all; the heading leads to the
// list too and says how many are open. With none open it says so (and
// offers to add one); a member with no location is told why there are none.
export function UpcomingOrders({
  orders,
  stages,
  hasLocation,
  canAdd,
  onAdd,
}: {
  orders: NonNullable<Dashboard["orders"]>
  stages: OrderStage[]
  hasLocation: boolean
  canAdd: boolean
  onAdd: () => void
}) {
  const heading = (
    <SectionHeading hint={hasLocation ? `Jami: ${orders.active}` : undefined}>
      <Link
        href="/tasks?view=list"
        className="inline-flex items-center gap-0.5 rounded text-[17px] font-semibold text-heading outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Yaqin muddatlar
        <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="size-[18px] text-muted-foreground" />
      </Link>
    </SectionHeading>
  )
  if (!hasLocation) {
    return (
      <>
        {heading}
        <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
      </>
    )
  }
  if (orders.upcoming.length === 0) {
    return (
      <>
        {heading}
        <EmptyState
          icon={CircleCheckIcon}
          title="Faol vazifa yo'q"
          action={
            canAdd && (
              <MainButton onClick={onAdd} className="px-5">
                <PlusIcon className="size-5" />
                Vazifa qo&apos;shish
              </MainButton>
            )
          }
        />
      </>
    )
  }
  return (
    <>
      {heading}
      <Group label="Yaqin muddatlar" inset="icon">
        {orders.upcoming.map((order) => (
          <OrderRow key={order.id} order={order} stage={stages.find((s) => s.id === order.stage_id)} showCustomer />
        ))}
        <Row variant="link" href="/tasks?view=list" title="Barcha vazifalar" chevron />
      </Group>
    </>
  )
}
