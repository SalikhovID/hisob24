import { ClipboardListIcon } from "lucide-react"
import { Row } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { useCurrencies } from "@/lib/currencies"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { colorValues } from "@/lib/stage-colors"
import { deadlineOf, moneyLine } from "@/lib/orders"
import type { Order, OrderStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// OrderRow is an order as the prototype lists it, a row to its page: its icon
// in its stage's color, its title, a line of what is told about it (its
// stage, its customer, its location, its assignee, as asked, its money), and at the
// right the deadline's day over how far it is (red once past) or, done, the
// stage it was done in.
export function OrderRow({
  order,
  stage,
  showStage = false,
  showCustomer = false,
  locationName = null,
}: {
  order: Order
  stage: OrderStage | undefined
  showStage?: boolean
  showCustomer?: boolean
  locationName?: string | null
}) {
  const done = stage?.is_done ?? false
  const deadline = deadlineOf(order.deadline, done)
  const assignee = order.assignee && (order.assignee.full_name ? shortName(order.assignee.full_name) : formatPhone(order.assignee.phone))
  // A priced order says its price and what is left of it (logic/orders.md, section 6).
  const money = moneyLine(order, useCurrencies())
  const sub = [
    showStage ? stage?.name : null,
    showCustomer ? (order.customer.name ?? formatPhone(order.customer.phone)) : null,
    locationName,
    assignee,
    money,
  ]
    .filter(Boolean)
    .join(" · ")
  const late = deadline.overdue
  return (
    <Row
      href={`/orders/${order.id}`}
      media={<SoftIcon icon={ClipboardListIcon} color={stage ? colorValues[stage.color] : "var(--muted-foreground)"} />}
      title={order.title}
      sub={sub || undefined}
      end={<span className={cn(late && "text-destructive")}>{deadline.date.slice(0, 5)}</span>}
      endSub={<span className={cn(late && "text-destructive")}>{done ? stage?.name : deadline.relative}</span>}
      chevron={false}
    />
  )
}
