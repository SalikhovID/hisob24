import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { NavKey, PageKey } from "@/lib/nav"
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

// pageColors are the menu's pages' hues (logic/roles.md, section 8): a
// section's own page wears the section's, a page of the warehouse its
// row's on the warehouse's page, the cash the finance's.
export const pageColors: Record<PageKey, string> = {
  home: sectionColors.home,
  customers: sectionColors.customers,
  tasks: sectionColors.tasks,
  products: sectionColors.products,
  services: "#30B0C7",
  sales: sectionColors.sales,
  warehouse: sectionColors.warehouse,
  purchases: "#AF52DE",
  transfers: "#007AFF",
  inventories: "#FF9500",
  opening_stock: "#34C759",
  suppliers: "#5856D6",
  accounts: sectionColors.finance,
  expenses: "#FF3B30",
  money_transfers: "#007AFF",
  employees: sectionColors.employees,
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

// SoftIcon is the prototype's soft square that opens a document's row (a
// purchase, a payment, a task): the icon in its color on a pale wash of the
// same color, the accent's by default. It is decoration: the row's text
// names the row.
export function SoftIcon({ icon: Icon, color = "var(--primary)", className }: { icon: LucideIcon; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="soft-icon"
      style={{ color }}
      className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,currentColor_14%,transparent)] [&_svg]:size-5", className)}
    >
      <Icon strokeWidth={2.2} />
    </span>
  )
}
