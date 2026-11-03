"use client"

import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { BrandMark } from "@/components/kit/brand-mark"
import { tabIcons } from "@/components/kit/tab-icons"
import { Logo } from "@/components/logo"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatUntil } from "@/lib/format"
import { isCurrent, isCurrentItem, type NavItem, navFor } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useLogout, useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useMiniApp } from "@/lib/telegram"
import type { Permission } from "@/lib/types"
import { cn } from "@/lib/utils"
import { moveTo } from "@/lib/moves"

export interface SidebarProps {
  // collapsed: folded to icons.
  collapsed: boolean
  onToggleCollapsed: () => void
}

// Sidebar is the app's sections on a wide screen, as the prototype's web
// view: a pane at the screen's left edge in the pale grey, a hairline at its
// right. At its head the brand (the H24 square and Hisob24's logo) and the
// fold button; under it the company with who is signed in and their role,
// the way to the profile; then the sections, each a 32px row of its icon
// and name (the page's one white and ringed, its icon in the accent), the
// current section's own pages under it; at its foot till when the
// subscription runs and the way out, which asks first (in a browser; inside
// Telegram closing the Mini App is the way out). Each member sees the
// sections their permissions open, in the default order. It folds to icons.
// On a narrow screen it is hidden and the sections are the tab bar's.
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const me = useMe()
  const miniApp = useMiniApp()
  const company = me.data?.company
  // The sections the member may open (logic/roles.md, section 8).
  const items = navFor(me.data?.permissions)
  const user = me.data?.user
  const name = user ? (user.full_name ?? formatPhone(user.phone)) : null
  const role = company ? (company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)) : null

  return (
    <div className="hidden shrink-0 md:flex">
      <aside
        aria-label="Menyu"
        className={cn(
          "flex flex-col overflow-y-auto border-r border-border bg-sidebar pt-safe-3.5 pb-3.5 text-foreground transition-[width] duration-300 ease-out-expo scrollbar-hide",
          collapsed ? "w-16 px-2" : "w-[224px] px-2.5",
        )}
      >
        <div className={cn("flex shrink-0 items-center justify-between gap-2 pb-3.5", !collapsed && "pl-2")}>
          {collapsed ? (
            <button
              type="button"
              aria-label="Menyuni yoyish"
              onClick={onToggleCollapsed}
              className="group relative mx-auto grid size-8 place-items-center rounded-md outline-none hover:bg-ink-1 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BrandMark className="transition-opacity group-hover:opacity-0" />
              <ChevronRightIcon strokeWidth={2} className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <BrandMark />
                <Logo className="h-[15px]" />
              </div>
              <button
                type="button"
                aria-label="Menyuni yig'ish"
                onClick={onToggleCollapsed}
                className="grid size-7 shrink-0 place-items-center rounded-md text-icon outline-none hover:bg-ink-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronLeftIcon strokeWidth={2} className="size-4" />
              </button>
            </>
          )}
        </div>
        {company && name && user && (
          <Link
            href="/profile"
            aria-label={collapsed ? `Profil: ${name}` : undefined}
            className={cn(
              "mb-3 flex items-center gap-2.5 rounded-lg p-2 text-left no-underline outline-none hover:bg-ink-1 focus-visible:ring-3 focus-visible:ring-ring/50",
              collapsed && "justify-center px-0",
            )}
          >
            <Avatar name={user.full_name ?? company.name} className="size-7 text-[12px] md:size-7 md:text-[12px]" />
            {!collapsed && (
              <span className="grid min-w-0 gap-px leading-[1.3]">
                <b className="truncate text-[13px] font-semibold">{company.name}</b>{" "}
                <small className="truncate text-[12px] text-muted-foreground">{`${name} · ${role}`}</small>
              </span>
            )}
          </Link>
        )}
        <SidebarNav items={items} permissions={me.data?.permissions} collapsed={collapsed} />
        <SidebarFoot endDate={company?.end_date} collapsed={collapsed} browser={!miniApp} />
      </aside>
    </div>
  )
}

// SidebarNav lists the sections; the current one's own pages stand under it.
function SidebarNav({ items, permissions, collapsed }: { items: NavItem[]; permissions: readonly Permission[] | undefined; collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <TooltipProvider>
      <nav aria-label="Bo'limlar" className="grid content-start gap-px">
        {items.map((item) => {
          const current = isCurrentItem(item, pathname)
          const tabs = (item.tabs ?? []).filter((tab) => can(permissions, tab.permission))
          return (
            <div key={item.key}>
              <SidebarLink item={item} current={current} collapsed={collapsed} />
              {current && !collapsed && tabs.length > 1 && (
                <div className="mt-0.5 mb-1.5 ml-9 grid gap-px">
                  {tabs.map((tab) => {
                    const here = isCurrent(tab.href, pathname)
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => moveTo(undefined)}
                        data-slot="side-subitem"
                        aria-current={here ? "page" : undefined}
                        className={cn(
                          "flex h-7 items-center rounded-md px-2.5 text-[12.5px] no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          here ? "bg-primary-soft font-medium text-accent-text" : "text-muted-foreground hover:bg-ink-1 hover:text-foreground",
                        )}
                      >
                        {tab.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}

// SidebarLink is one section, its icon and name; the one the page belongs
// to stands white and ringed, its icon in the accent. Folded, it is the icon
// alone: the name stays for screen readers and shows beside it on hover.
function SidebarLink({ item, current, collapsed }: { item: NavItem; current: boolean; collapsed: boolean }) {
  const Icon = tabIcons[item.key]
  const link = (
    <Link
      href={item.href}
      // A section is switched to at once (lib/moves.ts).
      onClick={() => moveTo(undefined)}
      data-slot="side-item"
      aria-current={current ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        current ? "bg-card font-medium shadow-[var(--card-shadow),0_0_0_1px_var(--border)] [&_svg]:text-primary" : "hover:bg-ink-1 [&_svg]:text-icon",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" />
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

// SidebarFoot says till when the subscription runs and holds the way out
// (in a browser), which asks first.
function SidebarFoot({ endDate, collapsed, browser }: { endDate: string | undefined; collapsed: boolean; browser: boolean }) {
  const logout = useLogout()
  const [leaving, setLeaving] = useState(false)
  return (
    <div className="mt-auto grid gap-1 pt-3.5">
      {endDate && !collapsed && <span className="px-2.5 text-[12px] text-muted-foreground">{`Obuna ${formatUntil(endDate)} gacha faol`}</span>}
      {browser && (
        <>
          <button
            type="button"
            aria-label={collapsed ? "Chiqish" : undefined}
            onClick={() => setLeaving(true)}
            className={cn(
              "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-foreground outline-none hover:bg-ink-1 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:text-icon",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOutIcon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            {!collapsed && <span>Chiqish</span>}
          </button>
          <AlertDialog open={leaving} onOpenChange={setLeaving}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tizimdan chiqasizmi?</AlertDialogTitle>
                <AlertDialogDescription>Qayta kirish uchun raqamingizga kod keladi.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                <Button variant="destructive" disabled={logout.isPending} onClick={() => logout.mutate()}>
                  Chiqish
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
