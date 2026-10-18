"use client"

import type { CSSProperties } from "react"
import { colorValues } from "@/lib/stage-colors"
import type { OrderStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// StageTrack is the order's stages in a row on frosted glass, as the prototype's track: each
// with its color, the order's one tinted in it. Whoever may move orders moves
// this one with a press; anyone else sees the stages, not changeable.
export function StageTrack({
  stages,
  value,
  disabled,
  onChange,
}: {
  stages: OrderStage[]
  value: number
  disabled: boolean
  onChange: (stageId: number) => void
}) {
  return (
    <div role="radiogroup" aria-label="Bosqich" data-slot="stage-track" className="mb-3 flex gap-1 overflow-x-auto rounded-[22px] surface p-1 scrollbar-hide">
      {stages.map((stage) => {
        const on = stage.id === value
        return (
          <button
            key={stage.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(stage.id)}
            style={{ "--c": colorValues[stage.color] } as CSSProperties}
            className={cn(
              "flex min-h-11 flex-[1_0_auto] items-center justify-center gap-1.5 rounded-[18px] px-2.5 text-[13.5px] font-semibold text-muted-foreground outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50",
              on && "bg-[color-mix(in_srgb,var(--c)_16%,transparent)] text-[color-mix(in_srgb,var(--c)_58%,var(--foreground))]",
            )}
          >
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--c)" />
            {stage.name}
          </button>
        )
      })}
    </div>
  )
}
