"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo, LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isCurrentItem, type NavItem, navFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"

export interface SidebarProps {
  // collapsed: folded to icons.
  collapsed: boolean
  onToggleCollapsed: () => void
}

// Sidebar is the app's sections under Hisob24's logo and the name of the
// company the session works in, on a wide screen: each member sees the
// sections their permissions open (the owner all of them). It is a column
// that folds to icons, the logo to its mark. On a narrow screen it is hidden
// and the sections are the tab bar's (tab-bar.tsx).
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const me = useMe()
  const company = me.data?.company
  // The sections the member may open, in their own order (logic/roles.md, section 8).
  const items = navFor(me.data?.permissions, me.data?.nav_order)

  return <Column company={company?.name} items={items} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
}

// Column is the sidebar of a wide screen. The company's name keeps its line
// while it is not known yet, so the logo stays put when it comes.
function Column({
  company,
  items,
  collapsed,
  onToggleCollapsed,
}: {
  company: string | undefined
  items: NavItem[]
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
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
            className="group relative mx-auto flex h-8 w-10 items-center justify-center rounded"
          >
            <LogoMark className="h-auto w-9 transition-opacity group-hover:opacity-0" />
            <ChevronRightIcon
              strokeWidth={2.5}
              className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ) : (
          <>
            <div className="min-w-0">
              <Logo className="h-4" />
              <p className="h-5 truncate text-[0.8125rem] leading-5 font-medium">{company}</p>
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

// SidebarNav lists the sections.
function SidebarNav({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <TooltipProvider>
      <nav aria-label="Bo'limlar" className="scrollbar-hide min-h-0 flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <SidebarLink key={item.key} item={item} current={isCurrentItem(item, pathname)} collapsed={collapsed} />
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
