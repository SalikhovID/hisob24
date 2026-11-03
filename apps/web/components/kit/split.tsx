import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Split is the prototype's list beside its record (the settings' types and
// a type's fields, the dropdowns and a dropdown's options): on the web the
// list in a 280px column at the left and the record beside it, on a phone
// one over the other.
export function Split({ aside, children, className }: { aside: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div data-slot="split" className={cn("grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:items-start", className)}>
      <div data-slot="split-aside" className="min-w-0">
        {aside}
      </div>
      <div data-slot="split-main" className="min-w-0">
        {children}
      </div>
    </div>
  )
}
