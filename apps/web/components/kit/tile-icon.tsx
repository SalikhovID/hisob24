import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// TileIcon is the icon that opens a row of a list of places (the settings,
// the profile, the warehouse's parts, the menu's pages): the prototype's
// plain outline mark in the heading's ink, no square of color under it. It
// is decoration: the row's text names the row.
export function TileIcon({ icon: Icon, className, children }: { icon?: LucideIcon; className?: string; children?: ReactNode }) {
  return (
    <span aria-hidden="true" data-slot="tile-icon" className={cn("grid h-8 w-7 shrink-0 place-items-center text-heading [&_svg]:size-[22px]", className)}>
      {children ?? (Icon && <Icon strokeWidth={1.8} />)}
    </span>
  )
}

// SoftIcon is the prototype's mark that opens a document's row (an order, a
// purchase, a payment): a 40px circle on the plain fill with the icon alone
// in its color, the accent's by default. It is decoration: the row's text
// names the row.
export function SoftIcon({ icon: Icon, color = "var(--primary)", className }: { icon: LucideIcon; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="soft-icon"
      style={{ color }}
      className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-muted [&_svg]:size-5", className)}
    >
      <Icon strokeWidth={2.3} />
    </span>
  )
}
