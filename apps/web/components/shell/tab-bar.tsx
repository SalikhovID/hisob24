"use client"

import { EllipsisIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { barItems, isCurrentItem, navFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { MoreSheet } from "./more-sheet"
import { NavOrderDialog } from "./nav-order-dialog"

const tab =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 text-[0.6875rem] leading-4 font-medium transition-colors"
const pill = "flex h-7 w-12 items-center justify-center rounded-full"

// TabBar is the app's sections along the bottom of a narrow screen (a phone,
// the Telegram Mini App), where the sidebar is hidden: each member sees the
// sections their permissions open, in their own order (logic/roles.md,
// section 8), the page's one marked by a filled pill behind its icon (the
// sidebar's accent, not the brand color). Up to five sections stand in the
// bar; past that, four and «Yana», which holds the rest and the way to put
// the sections in one's own order. It keeps clear of the phone's home
// indicator and of Telegram's own bottom edge.
export function TabBar() {
  const me = useMe()
  const pathname = usePathname()
  const { shown, more } = barItems(navFor(me.data?.permissions, me.data?.nav_order))
  const [moreOpen, setMoreOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const moreCurrent = more.some((item) => isCurrentItem(item, pathname))

  return (
    <>
      <nav aria-label="Bo'limlar" className="flex shrink-0 border-t bg-sidebar text-sidebar-foreground pb-safe md:hidden">
        {shown.map((item) => {
          const current = isCurrentItem(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(tab, current ? "text-sidebar-accent-foreground" : "text-muted-foreground hover:text-sidebar-accent-foreground")}
            >
              <span className={cn(pill, current && "bg-sidebar-accent")}>
                <Icon strokeWidth={current ? 2.5 : 1.5} className="size-5" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
        {more.length > 0 && (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreCurrent ? "page" : undefined}
            onClick={() => setMoreOpen(true)}
            className={cn(tab, moreCurrent ? "text-sidebar-accent-foreground" : "text-muted-foreground hover:text-sidebar-accent-foreground")}
          >
            <span className={cn(pill, moreCurrent && "bg-sidebar-accent")}>
              <EllipsisIcon strokeWidth={moreCurrent ? 2.5 : 1.5} className="size-5" aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">Yana</span>
          </button>
        )}
      </nav>
      {more.length > 0 && (
        <MoreSheet
          items={more}
          open={moreOpen}
          onOpenChange={setMoreOpen}
          onCustomize={() => {
            setMoreOpen(false)
            setOrderOpen(true)
          }}
        />
      )}
      <NavOrderDialog open={orderOpen} onOpenChange={setOrderOpen} />
    </>
  )
}
