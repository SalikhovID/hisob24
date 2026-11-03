"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"
import { isCurrent, type NavItem } from "@/lib/nav"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { cn } from "@/lib/utils"

// SectionTabs is the strip at the top of a page of a section that holds
// several (the products and the services; the warehouse's pages; the cash,
// the expenses and the transfers): the prototype's tabs made of links, a
// link per tab the member may see, on a faint track as wide as its tabs
// (it scrolls sideways when they do not fit), the page's one white and
// ringed in the ink, the others grey. With one tab to see there is nothing
// to switch, and no strip.
export function SectionTabs({ item, permissions }: { item: NavItem; permissions: readonly Permission[] | undefined }) {
  const pathname = usePathname()
  const tabs = (item.tabs ?? []).filter((tab) => can(permissions, tab.permission))
  if (tabs.length < 2) return null
  return (
    <nav aria-label={`${item.label} bo'limi`} className="mb-4 md:max-w-full">
      <div
        data-slot="segmented"
        style={{ "--n": String(tabs.length) } as CSSProperties}
        className="flex w-max max-w-full gap-0.5 overflow-x-auto rounded-[9px] bg-muted p-0.5 scrollbar-hide md:rounded-lg"
      >
        {tabs.map((tab) => {
          const current = isCurrent(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              data-active={current ? "" : undefined}
              className={cn(
                "flex h-[30px] shrink-0 items-center justify-center rounded-[7px] px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-7 md:rounded-md md:text-[12.5px]",
                current ? "bg-(--seg-thumb) text-foreground shadow-(--seg-shadow)" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
