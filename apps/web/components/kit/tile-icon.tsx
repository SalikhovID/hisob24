import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// TileIcon is the icon that opens a row of a list of places (the sections,
// the settings, the tab bar's pages): the prototype's row icon, a 30px
// accent square with the icon white on a phone, a 28px grey square with the
// icon grey on the web. It is decoration: the row's text names the row.
export function TileIcon({ icon: Icon, className, children }: { icon?: LucideIcon; className?: string; children?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      data-slot="tile-icon"
      className={cn("grid size-[30px] shrink-0 place-items-center rounded-md bg-primary text-primary-foreground md:size-7 md:bg-ink-2 md:text-icon [&_svg]:size-4", className)}
    >
      {children ?? (Icon && <Icon strokeWidth={1.8} />)}
    </span>
  )
}

// SoftIcon is the mark that opens a document's row (an order, a purchase, a
// payment) or an account's card: its icon in its color (the accent's by
// default) on a 32px grey square, 28px on the web. It is decoration: the
// row's text names the row.
export function SoftIcon({ icon: Icon, color = "var(--primary)", className }: { icon: LucideIcon; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="soft-icon"
      style={{ color }}
      className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-ink-2 md:size-7 [&_svg]:size-4", className)}
    >
      <Icon strokeWidth={1.9} />
    </span>
  )
}
