"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"
import { isCurrent, type NavItem } from "@/lib/nav"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { cn } from "@/lib/utils"

// SectionTabs is the strip at the top of a page of a section that holds
// several (the products and the services; the cash, the expenses and the
// transfers): the prototype's segmented control made of links, a link per
// tab the member may see, the page's one on the thumb, in its ink. With one tab
// to see there is nothing to switch, and no strip. On a wide screen it
// keeps a control's width rather than stretching across the page.
export function SectionTabs({ item, permissions }: { item: NavItem; permissions: readonly Permission[] | undefined }) {
  const pathname = usePathname()
  const tabs = (item.tabs ?? []).filter((tab) => can(permissions, tab.permission))
  if (tabs.length < 2) return null
  return (
    <nav aria-label={`${item.label} bo'limi`} className="mb-3.5 md:max-w-sm">
      <div data-slot="segmented" style={{ "--n": String(tabs.length) } as CSSProperties} className="flex h-10 rounded-full bg-muted p-[3px] shadow-[inset_0_1px_2px_rgba(60,40,120,.06)]">
        {tabs.map((tab) => {
          const current = isCurrent(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              data-active={current ? "" : undefined}
              className={cn(
                "flex min-h-[34px] flex-1 items-center justify-center rounded-full px-2 text-md font-medium whitespace-nowrap text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                current && "bg-(--seg-thumb) font-semibold text-(--seg-on) shadow-(--seg-shadow)",
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
