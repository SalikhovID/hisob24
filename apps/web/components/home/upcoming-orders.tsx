import { CircleCheckIcon, MapPinIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { Avatar } from "@/components/kit/avatar"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { EmptyState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDayMonth, formatMoney } from "@/lib/format"
import { deadlineOf } from "@/lib/orders"
import { formatPhone } from "@/lib/phone"
import { colorValues } from "@/lib/stage-colors"
import type { Dashboard, Order, OrderStage } from "@/lib/types"

// UpcomingOrders is the home's «Yaqin muddatlar», as the prototype's: the
// orders not done that are due soonest, each a row to its page (the
// customer's avatar and name; the number, the deadline, red and said so
// once past, and what is left to pay of a priced one; the stage's badge),
// «Hammasi» the way to them all. With none open it says so (and offers to
// add one); a member with no location is told why there are none.
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
    <SectionHeading
      action={
        hasLocation && (
          <Link href="/orders" className="rounded no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Hammasi
          </Link>
        )
      }
    >
      Yaqin muddatlar
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
          title="Faol buyurtma yo'q"
          action={
            canAdd && (
              <MainButton onClick={onAdd} className="px-5">
                <PlusIcon className="size-5" />
                Buyurtma qo&apos;shish
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
      <Group label="Yaqin muddatlar">
        {orders.upcoming.map((order) => (
          <UpcomingRow key={order.id} order={order} stage={stages.find((s) => s.id === order.stage_id)} />
        ))}
      </Group>
    </>
  )
}

// UpcomingRow is one order of «Yaqin muddatlar».
function UpcomingRow({ order, stage }: { order: Order; stage: OrderStage | undefined }) {
  const currencies = useCurrencies()
  const customer = order.customer.name ?? formatPhone(order.customer.phone)
  const late = deadlineOf(order.deadline, false).overdue
  const day = formatDayMonth(order.deadline)
  const left = Math.round((Number(order.amount) - Number(order.paid)) * 100) / 100
  return (
    <Row
      href={`/orders/${order.id}`}
      media={<Avatar name={customer} />}
      title={customer}
      sub={
        <>
          {`№ ${order.number} · `}
          {late ? <span className="text-destructive">{`Muddati o'tgan · ${day}`}</span> : day}
          {left > 0 && ` · qoldiq ${formatMoney(left.toFixed(2), currencyOf(currencies, order.currency_id))}`}
        </>
      }
      end={
        stage && (
          <Badge dot dotColor={colorValues[stage.color]}>
            {stage.name}
          </Badge>
        )
      }
      chevron={false}
    />
  )
}
