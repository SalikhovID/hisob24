"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { isCurrent, type NavItem } from "@/lib/nav"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { cn } from "@/lib/utils"

// SectionTabs is the strip at the top of a page of a section that holds
// several (the products and the services; the purchases and the suppliers):
// a link per tab the member may see, the page's one standing out as a card
// on the muted strip, like the settings' tabs. With one tab to see there is
// nothing to switch, and no strip.
export function SectionTabs({ item, permissions }: { item: NavItem; permissions: readonly Permission[] | undefined }) {
  const pathname = usePathname()
  const tabs = (item.tabs ?? []).filter((tab) => can(permissions, tab.permission))
  if (tabs.length < 2) return null
  return (
    // The strip scrolls sideways on a narrow screen rather than squeezing.
    <nav aria-label={`${item.label} bo'limi`} className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5 scrollbar-hide">
      <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-[3px] max-sm:min-w-full">
        {tabs.map((tab) => {
          const current = isCurrent(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-full flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                current && "bg-card text-foreground shadow-sm",
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
