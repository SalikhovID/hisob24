"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { tabIcons } from "@/components/kit/tab-icons"
import { Logo, LogoMark } from "@/components/logo"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isCurrentItem, type NavItem, navFor } from "@/lib/nav"
import { formatPhone } from "@/lib/phone"
import { useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { LocationSwitcher } from "./location-switcher"
import { moveTo } from "@/lib/moves"

export interface SidebarProps {
  // collapsed: folded to icons.
  collapsed: boolean
  onToggleCollapsed: () => void
}

// Sidebar is the app's sections on a wide screen, in the prototype's look:
// Hisob24's logo over the company's name, the sections each a filled icon
// and its name (the page's one on the accent's soft tint), and at the foot
// the location switch and who is signed in, the way to the profile. Each
// member sees the sections their permissions open (the owner all of them),
// in the default order. It folds to icons, the logo to its
// mark. On a narrow screen it is hidden and the sections are the tab bar's.
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const me = useMe()
  const company = me.data?.company
  // The sections the member may open (logic/roles.md, section 8).
  const items = navFor(me.data?.permissions)
  const user = me.data?.user
  const name = user ? (user.full_name ?? formatPhone(user.phone)) : null
  const role = company ? (company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)) : null

  return (
    <aside
      aria-label="Menyu"
      className={cn(
        "hidden shrink-0 flex-col border-r-[0.5px] border-border bg-background text-foreground transition-[width] duration-300 ease-out-expo md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        {collapsed ? (
          <button
            type="button"
            aria-label="Menyuni yoyish"
            onClick={onToggleCollapsed}
            className="group relative mx-auto flex h-8 w-10 items-center justify-center rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoMark className="h-auto w-9 transition-opacity group-hover:opacity-0" />
            <ChevronRightIcon strokeWidth={2.5} className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <>
            <div className="min-w-0">
              <Logo className="h-4" />
              <p className="h-5 truncate text-[0.8125rem] leading-5 font-medium">{company?.name}</p>
            </div>
            <button
              type="button"
              aria-label="Menyuni yig'ish"
              onClick={onToggleCollapsed}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-press focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeftIcon strokeWidth={2.5} className="size-4" />
            </button>
          </>
        )}
      </div>
      <SidebarNav items={items} collapsed={collapsed} />
      {company && name && user && (
        <div className="flex shrink-0 flex-col gap-2 p-3">
          {!collapsed && <LocationSwitcher className="self-start" />}
          <Link
            href="/profile"
            aria-label={collapsed ? `Profil: ${name}` : undefined}
            className={cn(
              "flex min-h-12 items-center gap-2.5 rounded-[14px] px-2 py-1.5 text-left outline-none hover:bg-press focus-visible:ring-3 focus-visible:ring-ring/50",
              collapsed && "justify-center px-0",
            )}
          >
            <Avatar name={user.full_name} className="size-9 text-[13px]" />
            {!collapsed && (
              <span className="min-w-0">
                <b className="block truncate text-md leading-tight font-semibold">{name}</b>{" "}
                <small className="block truncate text-xs text-muted-foreground">{role}</small>
              </span>
            )}
          </Link>
        </div>
      )}
    </aside>
  )
}

// SidebarNav lists the sections.
function SidebarNav({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <TooltipProvider>
      <nav aria-label="Bo'limlar" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2 scrollbar-hide">
        {items.map((item) => (
          <SidebarLink key={item.key} item={item} current={isCurrentItem(item, pathname)} collapsed={collapsed} />
        ))}
      </nav>
    </TooltipProvider>
  )
}

// SidebarLink is one section; the one the page belongs to stands on the
// accent's soft tint. Folded, it is the icon alone: the name stays for
// screen readers and shows beside it on hover.
function SidebarLink({ item, current, collapsed }: { item: NavItem; current: boolean; collapsed: boolean }) {
  const Icon = tabIcons[item.key]
  const link = (
    <Link
      href={item.href}
      // A section is switched to at once (lib/moves.ts).
      onClick={() => moveTo(undefined)}
      aria-current={current ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-base font-medium outline-none transition-colors hover:bg-press focus-visible:ring-3 focus-visible:ring-ring/50",
        current && "bg-primary-soft text-primary hover:bg-primary-soft",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-[22px] shrink-0" />
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
