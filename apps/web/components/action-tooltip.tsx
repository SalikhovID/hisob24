"use client"

import type { ReactElement } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ActionTooltip says what an icon button does, in a word, when the pointer
// rests on it or the keyboard reaches it. The button keeps its own name
// (its aria-label says what it does and to whom): the tooltip is for the
// eyes, and adds nothing for assistive technology.
export function ActionTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger delay={200} render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
