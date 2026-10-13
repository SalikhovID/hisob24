import {
  ContactIcon,
  HouseIcon,
  ListTodoIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
} from "lucide-react"
import { can } from "./permissions"
import type { Permission } from "./types"

// NavKey names a section, as the API keeps a member's own order of the menu
// (logic/roles.md, section 8). The finance is a key the API knows already;
// its section comes with its pages.
export type NavKey = "home" | "customers" | "tasks" | "products" | "sales" | "warehouse" | "finance" | "employees" | "settings"

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
  // hub: the section opens at its own page (href), which lists its tabs;
  // without it a section with tabs opens at the first one the member may
  // see, and the tabs are its root pages (a segmented control switches them).
  hub?: boolean
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
  { key: "sales", label: "Sotuv", href: "/sales", icon: ShoppingCartIcon, permission: "sales.view" },
  {
    key: "warehouse",
    label: "Ombor",
    href: "/warehouse",
    icon: WarehouseIcon,
    hub: true,
    tabs: [
      { label: "Xaridlar", href: "/purchases", permission: "purchases.view" },
      { label: "Ko'chirishlar", href: "/transfers", permission: "stock.view" },
      { label: "Inventarizatsiya", href: "/inventories", permission: "stock.view" },
      { label: "Boshlang'ich qoldiq", href: "/opening-stock", permission: "stock.view" },
      { label: "Ta'minotchilar", href: "/suppliers", permission: "suppliers.view" },
    ],
  },
  {
    key: "finance",
    label: "Moliya",
    href: "/accounts",
    icon: WalletIcon,
    tabs: [
      { label: "Kassa", href: "/accounts", permission: "finance.view" },
      { label: "Xarajatlar", href: "/expenses", permission: "finance.view" },
      { label: "O'tkazmalar", href: "/money-transfers", permission: "finance.view" },
    ],
  },
  { key: "employees", label: "Xodimlar", href: "/employees", icon: UsersIcon, permission: "employees.view" },
  { key: "settings", label: "Sozlamalar", href: "/settings", icon: SettingsIcon, permission: "settings.view" },
]

// navKeys are the section keys in the default order: what an order of the
// menu is made of.
export const navKeys: NavKey[] = navItems.map((item) => item.key)

// BAR_SECTIONS is how many sections the tab bar shows after the home; the
// rest are the profile page's.
export const BAR_SECTIONS = 4

// navFor is the sections someone with permissions may open (what /app/me
// told; undefined is a session not known yet, which may open the home
// alone): the home first, as the prototype locks it, then the others in the
// member's own order (navOrder, what /app/me told; where it puts the home
// does not count) with what it does not name after them in the default
// order. A section with tabs opens at the first tab the member may see, a
// hub at its own page.
export function navFor(permissions: readonly Permission[] | undefined, navOrder?: readonly string[] | null): NavItem[] {
  const visible = navItems.flatMap((item) => {
    if (item.tabs) {
      const tab = item.tabs.find((candidate) => can(permissions, candidate.permission))
      return tab ? [{ ...item, href: item.hub ? item.href : tab.href }] : []
    }
    return !item.permission || can(permissions, item.permission) ? [item] : []
  })
  const home = visible.filter((item) => item.key === "home")
  const rest = visible.filter((item) => item.key !== "home")
  if (!navOrder) return [...home, ...rest]
  // The sort is stable: what the order does not name keeps the default order.
  const rank = new Map(navOrder.map((key, index) => [key, index]))
  return [...home, ...rest.sort((a, b) => (rank.get(a.key) ?? navOrder.length) - (rank.get(b.key) ?? navOrder.length))]
}

// barItems splits the sections for the tab bar: the home and the first
// BAR_SECTIONS after it stand in the bar, the rest are the profile page's.
export function barItems(items: NavItem[]): { shown: NavItem[]; more: NavItem[] } {
  return { shown: items.slice(0, BAR_SECTIONS + 1), more: items.slice(BAR_SECTIONS + 1) }
}

// rootsOf are the pages that are a section's own (where the tab bar shows):
// its address, and for a section whose tabs a segmented control switches,
// every tab's.
const rootsOf = (item: NavItem) => (item.tabs && !item.hub ? item.tabs.map((tab) => tab.href) : [item.href])

// rootPaths are every section's own pages.
export const rootPaths: string[] = navItems.flatMap(rootsOf)

// isRootPath says whether the page at pathname is a section's own: there the
// tab bar shows; any other page (a record, a form, the profile) is inside
// one, and leads back.
export function isRootPath(pathname: string): boolean {
  return rootPaths.includes(pathname)
}

// sectionRootOf is the page a page inside a section leads back to: the
// section's own; the home for a page in none.
export function sectionRootOf(pathname: string): string {
  const item = navItems.find((candidate) => candidate.key !== "home" && isCurrentItem(candidate, pathname))
  return item?.href ?? "/"
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
  const hrefs = item.tabs ? [...(item.hub ? [item.href] : []), ...item.tabs.map((tab) => tab.href)] : [item.href]
  return hrefs.some((href) => isCurrent(href, pathname))
}
