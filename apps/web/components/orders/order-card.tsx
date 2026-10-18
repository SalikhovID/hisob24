"use client"

import { useDraggable } from "@dnd-kit/core"
import Link from "next/link"
import { Avatar } from "@/components/kit/avatar"
import { Badge } from "@/components/ui/badge"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { deadlineOf } from "@/lib/orders"
import type { Order, OrderStage, OrderType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StageMenu } from "./stage-menu"

// What a card on the board says of its order.
export interface CardProps {
  order: Order
  // stage is the one the order stands in; stages are all of them, for the
  // menu; type is said only under every type.
  stage: OrderStage
  stages: OrderStage[]
  type?: OrderType
  // onMove is undefined where the member may not move orders: then there is
  // no stage menu and no drag.
  onMove?: (order: Order, stage: OrderStage) => void
}

// CardContent is the card's face, as the prototype's: the title, the
// customer, and a line of the deadline (the day and how far it is, red once
// past; «bajarildi» in a done stage), the assignee with their avatar and,
// under every type, the type. The copy that follows the pointer during a
// drag shows it too, so it is apart from the card.
export function CardContent({ order, stage, type }: Pick<CardProps, "order" | "stage" | "type">) {
  const deadline = deadlineOf(order.deadline, stage.is_done)
  const assignee = order.assignee
  return (
    <>
      <span data-slot="card-title" className="block text-base leading-tight font-semibold [overflow-wrap:anywhere]">
        {order.title}
      </span>{" "}
      <span className="mt-0.5 block text-md text-muted-foreground [overflow-wrap:anywhere]">{order.customer.name ?? formatPhone(order.customer.phone)}</span>{" "}
      <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn(deadline.overdue && "text-destructive")}>
          {deadline.date.slice(0, 5)} · {stage.is_done ? "bajarildi" : deadline.relative}
        </span>{" "}
        {assignee && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={assignee.full_name} className="size-[18px] text-[8.5px]" />
            {assignee.full_name ? shortName(assignee.full_name) : formatPhone(assignee.phone)}
          </span>
        )}{" "}
        {type && <Badge className="h-5 text-xs">{type.name}</Badge>}
      </span>
    </>
  )
}

// A card is frosted glass; the copy that follows a dragging finger is a
// sheet's glass over a blur, lifted high above the board.
export const cardClass = "relative rounded-[20px] surface"
export const ghostClass = "relative rounded-[20px] bg-sheet-cell backdrop-blur-[20px] shadow-[var(--rim),0_22px_46px_rgba(60,40,120,.22)]"

// OrderCard is an order on the board: the way into it, a card that a pointer
// drags to another column (a press that moves a little, or a finger that
// rests a moment), with the ⋯ stage menu for everyone else. While it is
// dragged the card itself fades, and a copy follows the pointer.
export function OrderCard({ order, stage, stages, type, onMove }: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: order.id, data: { order }, disabled: onMove === undefined })
  return (
    <li ref={setNodeRef} {...listeners} data-slot="order-card" className={cn(cardClass, "touch-manipulation select-none", isDragging && "opacity-35")}>
      <Link
        href={`/tasks/${order.id}`}
        draggable={false}
        className={cn("block rounded-[20px] py-3 pl-3.5 outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50", onMove ? "pr-11" : "pr-3.5")}
      >
        <CardContent order={order} stage={stage} type={type} />
      </Link>
      {onMove && <StageMenu order={order} stages={stages} onMove={onMove} />}
    </li>
  )
}
