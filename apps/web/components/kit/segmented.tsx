"use client"

import { Tabs } from "@base-ui/react/tabs"
import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"

// Segmented is the prototype's segmented control: two or three views of one
// thing (Kanban / Ro'yxat, Mahsulotlar / Xizmatlar) on a pill, a white
// thumb sliding under the chosen one. It is a tab list (Base UI Tabs) with
// no panels of its own: the page shows the view.
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
    <Tabs.Root value={value} onValueChange={(next) => onChange(String(next))} className={className}>
      <Tabs.List
        aria-label={label}
        data-slot="segmented"
        style={{ "--n": String(options.length) } as CSSProperties}
        className="relative flex h-10 rounded-full bg-muted p-[3px]"
      >
        <Tabs.Indicator
          aria-hidden="true"
          data-slot="segmented-thumb"
          className="absolute top-[3px] left-0 h-[34px] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-card shadow-[0_2px_8px_rgba(0,0,0,.1),0_0_0_.5px_rgba(0,0,0,.04)] transition-transform duration-300 ease-spring dark:bg-[#636366]"
        />
        {options.map((option) => (
          <Tabs.Tab
            key={option.value}
            value={option.value}
            data-slot="segmented-tab"
            className="relative z-[1] flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full text-md font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-active:font-semibold [&_svg]:size-4"
          >
            {option.icon && <option.icon aria-hidden="true" />}
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}
