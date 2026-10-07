import {
  ContactIcon,
  HouseIcon,
  ListTodoIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"
import { can } from "./permissions"
import type { Permission } from "./types"

// NavKey names a section, as the API keeps a member's own order of the menu
// (logic/roles.md, section 8).
export type NavKey = "home" | "customers" | "tasks" | "products" | "warehouse" | "employees" | "settings"

// NavTab is a page of a section that holds several: its own address and the
// permission that opens it.
export interface NavTab {
  label: string
  href: string
  permission: Permission
}

// NavItem is a section of the app in the sidebar and the tab bar.
export interface NavItem {
  key: NavKey
  label: string
  // href is where the section opens; a section with tabs opens at the first
  // tab the member may see (navFor resolves it).
  href: string
  icon: LucideIcon
  // permission is what opens the section (logic/roles.md, section 8); a
  // section without one and without tabs is everyone's.
  permission?: Permission
  tabs?: NavTab[]
}

// navItems are the sections in the default order of the menu.
export const navItems: NavItem[] = [
  { key: "home", label: "Bosh sahifa", href: "/", icon: HouseIcon },
  { key: "customers", label: "Mijozlar", href: "/customers", icon: ContactIcon, permission: "customers.view" },
  { key: "tasks", label: "Vazifalar", href: "/tasks", icon: ListTodoIcon, permission: "tasks.view" },
  {
    key: "products",
    label: "Mahsulotlar",
    href: "/products",
    icon: PackageIcon,
    tabs: [
      { label: "Mahsulotlar", href: "/products", permission: "products.view" },
      { label: "Xizmatlar", href: "/services", permission: "products.view" },
    ],
  },
  {
    key: "warehouse",
    label: "Ombor",
    href: "/purchases",
    icon: WarehouseIcon,
    tabs: [
      { label: "Xaridlar", href: "/purchases", permission: "purchases.view" },
      { label: "Ta'minotchilar", href: "/suppliers", permission: "suppliers.view" },
    ],
  },
  { key: "employees", label: "Xodimlar", href: "/employees", icon: UsersIcon, permission: "employees.view" },
  { key: "settings", label: "Sozlamalar", href: "/settings", icon: SettingsIcon, permission: "settings.view" },
]

// navKeys are the section keys in the default order: what an order of the
// menu is made of.
export const navKeys: NavKey[] = navItems.map((item) => item.key)

// BAR_LIMIT is how many sections the tab bar shows at most; past it, the
// bar shows BAR_LIMIT - 1 and the rest under "Yana".
export const BAR_LIMIT = 5

// navFor is the sections someone with permissions may open (what /app/me
// told; undefined is a session not known yet, which may open the home
// alone), in the member's own order (navOrder, what /app/me told) with what
// it does not name after it in the default order. A section with tabs opens
// at the first tab the member may see.
export function navFor(permissions: readonly Permission[] | undefined, navOrder?: readonly string[] | null): NavItem[] {
  const visible = navItems.flatMap((item) => {
    if (item.tabs) {
      const tab = item.tabs.find((candidate) => can(permissions, candidate.permission))
      return tab ? [{ ...item, href: tab.href }] : []
    }
    return !item.permission || can(permissions, item.permission) ? [item] : []
  })
  if (!navOrder) return visible
  // The sort is stable: what the order does not name keeps the default order.
  const rank = new Map(navOrder.map((key, index) => [key, index]))
  return [...visible].sort((a, b) => (rank.get(a.key) ?? navOrder.length) - (rank.get(b.key) ?? navOrder.length))
}

// barItems splits the sections for the tab bar: all of them up to
// BAR_LIMIT; past that, the first BAR_LIMIT - 1 and the rest, which go
// under "Yana".
export function barItems(items: NavItem[]): { shown: NavItem[]; more: NavItem[] } {
  if (items.length <= BAR_LIMIT) return { shown: items, more: [] }
  return { shown: items.slice(0, BAR_LIMIT - 1), more: items.slice(BAR_LIMIT - 1) }
}

// isCurrent says whether the page at pathname belongs to the section at href.
// The home section is the home page alone; any other holds its own pages.
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

// isCurrentItem says whether the page at pathname belongs to the section: to
// its address, or to any of its tabs'.
export function isCurrentItem(item: NavItem, pathname: string): boolean {
  const hrefs = item.tabs ? item.tabs.map((tab) => tab.href) : [item.href]
  return hrefs.some((href) => isCurrent(href, pathname))
}
