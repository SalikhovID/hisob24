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

// SoftIcon is the prototype's soft square that opens a document's row (a
// purchase, a payment, a task): the icon in its color on a pale wash of the
// same color, the accent's by default, with a faint white rim. It is
// decoration: the row's text names the row.
export function SoftIcon({ icon: Icon, color = "var(--primary)", className }: { icon: LucideIcon; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="soft-icon"
      style={{ color }}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,currentColor_14%,transparent)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.5)] [&_svg]:size-5",
        className,
      )}
    >
      <Icon strokeWidth={2.2} />
    </span>
  )
}
