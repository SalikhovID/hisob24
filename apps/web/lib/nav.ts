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
import type { Permission, TabBarPage } from "./types"

// NavKey names a section, as the API keeps a member's own order of the menu
// (logic/roles.md, section 8). The finance is a key the API knows already;
// its section comes with its pages.
export type NavKey = "home" | "customers" | "tasks" | "products" | "sales" | "warehouse" | "finance" | "employees" | "settings"

// PageKey names a page of the menu that may stand in the tab bar (the
// API's tab bar page): a section's own page, a tab, the warehouse or one
// of its pages.
export type PageKey = TabBarPage

// NavTab is a page of a section that holds several: its key, its own
// address and the permission that opens it.
export interface NavTab {
  key: PageKey
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
      { key: "products", label: "Mahsulotlar", href: "/products", permission: "products.view" },
      { key: "services", label: "Xizmatlar", href: "/services", permission: "products.view" },
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
      { key: "purchases", label: "Xaridlar", href: "/purchases", permission: "purchases.view" },
      { key: "transfers", label: "Ko'chirishlar", href: "/transfers", permission: "stock.view" },
      { key: "inventories", label: "Inventarizatsiya", href: "/inventories", permission: "stock.view" },
      { key: "opening_stock", label: "Boshlang'ich qoldiq", href: "/opening-stock", permission: "stock.view" },
      { key: "suppliers", label: "Ta'minotchilar", href: "/suppliers", permission: "suppliers.view" },
    ],
  },
  {
    key: "finance",
    label: "Moliya",
    href: "/accounts",
    icon: WalletIcon,
    tabs: [
      { key: "accounts", label: "Kassa", href: "/accounts", permission: "finance.view" },
      { key: "expenses", label: "Xarajatlar", href: "/expenses", permission: "finance.view" },
      { key: "money_transfers", label: "O'tkazmalar", href: "/money-transfers", permission: "finance.view" },
    ],
  },
  { key: "employees", label: "Xodimlar", href: "/employees", icon: UsersIcon, permission: "employees.view" },
  { key: "settings", label: "Sozlamalar", href: "/settings", icon: SettingsIcon, permission: "settings.view" },
]

// navKeys are the section keys in the default order: what an order of the
// menu is made of.
export const navKeys: NavKey[] = navItems.map((item) => item.key)

// NavPage is a page of the menu, of its section: what the tab bar and
// «Sozlama» hold.
export interface NavPage {
  key: PageKey
  label: string
  href: string
  section: NavKey
  // permissions: any of them opens the page (the warehouse, any of its
  // pages'); without them it is everyone's (the home).
  permissions?: Permission[]
}

// navPages are the pages of the menu in its order: a section's own page; a
// section with tabs, its tabs (the warehouse, its own page first). The
// settings are none of them: they stand under «Sozlama» alone.
export const navPages: NavPage[] = navItems.flatMap((item): NavPage[] => {
  if (item.key === "settings") return []
  const tabs = (item.tabs ?? []).map((tab) => ({ key: tab.key, label: tab.label, href: tab.href, section: item.key, permissions: [tab.permission] }))
  if (item.tabs && !item.hub) return tabs
  // A section with a page of its own is a page by its key (the finance,
  // which has none, is its tabs).
  const permissions = item.tabs ? item.tabs.map((tab) => tab.permission) : item.permission && [item.permission]
  return [{ key: item.key as PageKey, label: item.label, href: item.href, section: item.key, permissions }, ...tabs]
})

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


// pagesFor is the pages someone with permissions may open (what /app/me
// told; undefined is a session not known yet, which may open the home
// alone), in the order of the menu.
export function pagesFor(permissions: readonly Permission[] | undefined): NavPage[] {
  return navPages.filter((page) => !page.permissions || page.permissions.some((permission) => can(permissions, permission)))
}

// BAR_LIMIT is how many pages the tab bar holds beside «Sozlama».
export const BAR_LIMIT = 4

// DEFAULT_BAR is the order the default bar takes its pages in: each
// section's first page, in the default order of the menu.
const DEFAULT_BAR: PageKey[] = ["home", "customers", "tasks", "products", "sales", "warehouse", "accounts", "employees"]

// defaultBar is the pages of the default bar: the first BAR_LIMIT of
// DEFAULT_BAR that someone with permissions may open.
export function defaultBar(permissions: readonly Permission[] | undefined): PageKey[] {
  const open = new Set(pagesFor(permissions).map((page) => page.key))
  return DEFAULT_BAR.filter((key) => open.has(key)).slice(0, BAR_LIMIT)
}

// barPages is the member's pages of the tab bar: their own (tabBar, what
// /app/me told; null for the default bar), in their order, those they may
// open, BAR_LIMIT at most.
export function barPages(permissions: readonly Permission[] | undefined, tabBar?: readonly string[] | null): NavPage[] {
  const open = pagesFor(permissions)
  return (tabBar ?? defaultBar(permissions)).flatMap((key) => open.find((page) => page.key === key) ?? []).slice(0, BAR_LIMIT)
}

// currentPin is the index of the bar's page the page at pathname is: the
// page itself; for a page of a hub (the warehouse's), the hub, unless the
// page stands in the bar itself; -1 for none, when «Sozlama» is current.
export function currentPin(pins: readonly NavPage[], pathname: string): number {
  const own = pins.findIndex((pin) => pin.href === pathname)
  if (own >= 0) return own
  const page = navPages.find((candidate) => candidate.href === pathname)
  const hub = page && navItems.find((item) => item.key === page.section && item.hub)
  return hub ? pins.findIndex((pin) => pin.key === hub.key) : -1
}
