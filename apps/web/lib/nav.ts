import { HouseIcon, type LucideIcon, SettingsIcon, UsersIcon } from "lucide-react"
import type { Role } from "./types"

// NavItem is a section of the app in the sidebar.
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  // ownerOnly sections are the company owner's alone (logic/roles.md).
  ownerOnly?: boolean
}

export const navItems: NavItem[] = [
  { label: "Bosh sahifa", href: "/", icon: HouseIcon },
  { label: "Xodimlar", href: "/employees", icon: UsersIcon, ownerOnly: true },
  { label: "Sozlamalar", href: "/settings", icon: SettingsIcon, ownerOnly: true },
]

// navFor is the sections someone with role may open; undefined is a session
// whose role is not known yet.
export function navFor(role: Role | undefined): NavItem[] {
  return navItems.filter((item) => !item.ownerOnly || role === "owner")
}

// isCurrent says whether the page at pathname belongs to the section at href.
// The home section is the home page alone; any other holds its own pages.
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
