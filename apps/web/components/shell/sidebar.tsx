"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
// works in: the owner sees them all, an employee those open to everyone. On
// a wide screen it is a column that folds to icons.
export function Sidebar(props: SidebarProps) {
  const { collapsed, onToggleCollapsed } = props
  const me = useMe()
  const company = me.data?.company
  const items = navFor(company?.role)

  return (
    <aside
      aria-label="Menyu"
      className={cn(
        "hidden shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        {collapsed ? (
          <button
            type="button"
            aria-label="Menyuni yoyish"
            onClick={onToggleCollapsed}
            className="group relative mx-auto flex size-8 items-center justify-center rounded"
          >
            <Logo className="transition-opacity group-hover:opacity-0" />
            <ChevronRightIcon
              strokeWidth={2.5}
              className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Logo />
              <span className="truncate font-semibold">{company?.name ?? "Hisob24"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Menyuni yig'ish"
              onClick={onToggleCollapsed}
              className="size-8 shrink-0"
            >
              <ChevronLeftIcon strokeWidth={2.5} />
            </Button>
          </>
        )}
      </div>
      <SidebarNav items={items} collapsed={collapsed} />
    </aside>
  )
}

// Logo is Hisob24's mark.
function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground",
        className,
      )}
    >
      H
    </span>
  )
}

function SidebarNav({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <TooltipProvider>
      <nav aria-label="Bo'limlar" className="scrollbar-hide min-h-0 flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} current={isCurrent(item.href, pathname)} collapsed={collapsed} />
        ))}
      </nav>
    </TooltipProvider>
  )
}

// SidebarLink is one section; the one the page belongs to stands out. Folded,
// it is the icon alone: the name stays for screen readers and shows beside
// it on hover.
function SidebarLink({ item, current, collapsed }: { item: NavItem; current: boolean; collapsed: boolean }) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "mx-2 flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        current && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon strokeWidth={current ? 2.5 : 1.5} className={cn("size-5 shrink-0", collapsed && "mx-auto")} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" className="font-medium">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}
