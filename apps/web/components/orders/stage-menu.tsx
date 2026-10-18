"use client"

import { EllipsisIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { colorValues } from "@/lib/stage-colors"
import type { Order, OrderStage } from "@/lib/types"

// StageMenu moves an order to another stage from a sheet of the stages, as the
// prototype's ⋯ on a card: each stage with its color, the one the order
// stands in marked. It is the way for a keyboard, and for a thumb that does
// not want to drag; it is named by the order, since a board holds many.
export function StageMenu({ order, stages, onMove }: { order: Order; stages: OrderStage[]; onMove: (order: Order, stage: OrderStage) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`Bosqich: ${order.title}`}
        onClick={() => setOpen(true)}
        // The press is the button's own: it does not start a drag of the card.
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute top-1 right-0.5 grid size-10 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <EllipsisIcon aria-hidden="true" strokeWidth={2.6} className="size-5" />
      </button>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={`«${order.title}» bosqichi`}
        items={stages.map((stage) => ({
          label: stage.name,
          dot: colorValues[stage.color],
          checked: stage.id === order.stage_id,
          onSelect: () => onMove(order, stage),
        }))}
      />
    </>
  )
}
