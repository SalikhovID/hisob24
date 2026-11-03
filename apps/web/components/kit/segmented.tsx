"use client"

import { Tabs } from "@base-ui/react/tabs"
import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

// Segmented is the prototype's segmented control: two or three views of one
// thing (Kanban / Ro'yxat, UZS / USD) on a faint track, 2px round its
// segments, a thumb sliding under the chosen one (white and ringed, its word
// in the ink; the others grey). 32px segments of 13px on a phone, 28px of
// 12.5px on the web. It is a tab list (Base UI Tabs) with no panels of its
// own: the page shows the view. On a wide screen it keeps a control's width
// rather than stretching across the page.
export function Segmented({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; icon?: LucideIcon }[]
  className?: string
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(String(next))} className={cn("mb-3.5 md:max-w-[420px]", className)}>
      <Tabs.List
        aria-label={label}
        data-slot="segmented"
        style={{ "--n": String(options.length) } as CSSProperties}
        className="relative flex gap-0.5 rounded-[9px] bg-muted p-0.5 md:rounded-lg"
      >
        <Tabs.Indicator
          aria-hidden="true"
          data-slot="segmented-thumb"
          className="absolute top-0.5 left-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[7px] bg-(--seg-thumb) shadow-(--seg-shadow) transition-transform duration-300 ease-out-expo md:h-7 md:rounded-md"
        />
        {options.map((option) => (
          <Tabs.Tab
            key={option.value}
            value={option.value}
            data-slot="segmented-tab"
            className="relative z-[1] flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-active:text-foreground md:min-h-7 md:rounded-md md:text-[12.5px] [&_svg]:size-[15px] [&_svg]:text-icon"
          >
            {option.icon && <option.icon aria-hidden="true" />}
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}
