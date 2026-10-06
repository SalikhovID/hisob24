import { ContactIcon, HouseIcon, ListTodoIcon, type LucideIcon, SettingsIcon, UsersIcon } from "lucide-react"
import { can } from "./permissions"
import type { Permission } from "./types"

// NavItem is a section of the app in the sidebar and the tab bar.
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  // permission is what opens the section (logic/roles.md, section 8); a
  // section without one is everyone's.
  permission?: Permission
}

export const navItems: NavItem[] = [
  { label: "Bosh sahifa", href: "/", icon: HouseIcon },
  { label: "Mijozlar", href: "/customers", icon: ContactIcon, permission: "customers.view" },
  { label: "Vazifalar", href: "/tasks", icon: ListTodoIcon, permission: "tasks.view" },
  { label: "Xodimlar", href: "/employees", icon: UsersIcon, permission: "employees.view" },
  { label: "Sozlamalar", href: "/settings", icon: SettingsIcon, permission: "settings.view" },
]

// navFor is the sections someone with permissions may open (what /app/me
// told); undefined is a session not known yet, which may open the home
// alone.
export function navFor(permissions: readonly Permission[] | undefined): NavItem[] {
  return navItems.filter((item) => !item.permission || can(permissions, item.permission))
}

// isCurrent says whether the page at pathname belongs to the section at href.
// The home section is the home page alone; any other holds its own pages.
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
