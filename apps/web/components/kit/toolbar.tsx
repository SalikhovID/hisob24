import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Toolbar is the prototype's bar over a list: its search at the left and
// its filters (chips, a switch) at the right on the web, one over the other
// on a phone. The search box and the chips keep no margins of their own
// inside it.
export function Toolbar({ children, end, className }: { children: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <div
      data-slot="toolbar"
      className={cn(
        "mb-4 grid gap-3 md:flex md:flex-wrap md:items-center md:justify-between [&_[data-slot=chips]]:mb-0 [&_[data-slot=search-box]]:mb-0",
        className,
      )}
    >
      {children}
      {end && (
        <div data-slot="toolbar-end" className="flex min-w-0 items-center gap-2">
          {end}
        </div>
      )}
    </div>
  )
}
