import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { NavKey } from "@/lib/nav"
import { cn } from "@/lib/utils"

// sectionColors are the sections' own hues (the prototype's SECCOL): the
// tile icon a section's row wears on the home page, in the settings and in
// the profile. The sales and the finance came after the prototype and take
// hues of their own in the same family.
export const sectionColors: Record<NavKey, string> = {
  home: "#174449",
  customers: "#007AFF",
  tasks: "#FF9500",
  products: "#A2845E",
  sales: "#FF2D55",
  warehouse: "#AF52DE",
  finance: "#5856D6",
  employees: "#34C759",
  settings: "#8E8E93",
}

// TileIcon is the iOS-style square icon that opens a row: a 32px rounded
// square in a color, a white icon on it. It is decoration: the row's text
// names the row.
export function TileIcon({
  icon: Icon,
  color,
  className,
  children,
}: {
  icon?: LucideIcon
  color: string
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="tile-icon"
      style={{ background: color }}
      className={cn("grid size-8 shrink-0 place-items-center rounded-[9px] text-white [&_svg]:size-[19px]", className)}
    >
      {children ?? (Icon && <Icon strokeWidth={2.2} />)}
    </span>
  )
}
