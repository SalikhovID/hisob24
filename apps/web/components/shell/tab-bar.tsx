"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { isCurrent, navFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"

// TabBar is the app's sections along the bottom of a narrow screen (a phone,
// the Telegram Mini App), where the sidebar is hidden: each member sees the
// sections their permissions open, the page's one marked by a filled pill
// behind its icon (the sidebar's accent, not the brand color). It keeps clear
// of the phone's home indicator and of Telegram's own bottom edge.
export function TabBar() {
  const me = useMe()
  const pathname = usePathname()
  const items = navFor(me.data?.permissions)

  return (
    <nav aria-label="Bo'limlar" className="flex shrink-0 border-t bg-sidebar text-sidebar-foreground pb-safe md:hidden">
      {items.map((item) => {
        const current = isCurrent(item.href, pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 text-[0.6875rem] leading-4 font-medium transition-colors",
              current ? "text-sidebar-accent-foreground" : "text-muted-foreground hover:text-sidebar-accent-foreground",
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", current && "bg-sidebar-accent")}>
              <Icon strokeWidth={current ? 2.5 : 1.5} className="size-5" aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
