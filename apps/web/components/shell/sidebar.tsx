"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { isCurrent, type NavItem, navFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"

export interface SidebarProps {
  // open and onOpenChange: the sections as a sheet, on a phone.
  open: boolean
  onOpenChange: (open: boolean) => void
  // collapsed: folded to icons, on a wide screen.
  collapsed: boolean
  onToggleCollapsed: () => void
}

// Sidebar is the app's sections under the name of the company the session
// works in: the owner sees them all, an employee those open to everyone.
export function Sidebar(props: SidebarProps) {
  void props
  const me = useMe()
  const company = me.data?.company
  const items = navFor(company?.role)

  return (
    <aside
      aria-label="Menyu"
      className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex"
    >
      <div className="flex h-14 shrink-0 items-center border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Logo />
          <span className="truncate font-semibold">{company?.name ?? "Hisob24"}</span>
        </div>
      </div>
      <SidebarNav items={items} />
    </aside>
  )
}

// Logo is Hisob24's mark.
function Logo() {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
    >
      H
    </span>
  )
}

function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Bo'limlar" className="scrollbar-hide min-h-0 flex-1 overflow-y-auto py-2">
      {items.map((item) => (
        <SidebarLink key={item.href} item={item} current={isCurrent(item.href, pathname)} />
      ))}
    </nav>
  )
}

// SidebarLink is one section; the one the page belongs to stands out.
function SidebarLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "mx-2 flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        current && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon strokeWidth={current ? 2.5 : 1.5} className="size-5 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  )
}
