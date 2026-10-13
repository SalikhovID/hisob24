"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"
import { tabIcons } from "@/components/kit/tab-icons"
import { barItems, isCurrentItem, isRootPath, navFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"

// The tab bar's tabs are 72px wide; the lens under the current one moves by
// a tab.
// A tab is 72px wide, narrower on a phone too narrow for five (a 360px or
// a 320px screen keeps 12px either side).
const TAB = "min(72px, calc((100vw - 24px) / 5))"

// TabBar is the prototype's floating «liquid glass» bar along the bottom of
// a narrow screen (a phone, the Telegram Mini App), where the sidebar is
// hidden: the home and the first four of the member's sections, in their
// own order (logic/roles.md, section 8), each a filled icon over its name.
// The rest are the profile page's. A lens of glass stands under the page's
// section and slides to the next. The bar shows on a section's own pages;
// inside one (a record, a form, the profile) it steps down out of the way,
// and the page leads back. It keeps clear of the phone's home indicator and
// of Telegram's own bottom edge.
export function TabBar() {
  const me = useMe()
  const pathname = usePathname()
  const { shown } = barItems(navFor(me.data?.permissions, me.data?.nav_order))
  const current = shown.findIndex((item) => isCurrentItem(item, pathname))
  const hidden = !isRootPath(pathname)

  return (
    <nav
      aria-label="Bo'limlar"
      aria-hidden={hidden || undefined}
      inert={hidden}
      data-slot="tab-bar"
      data-hidden={hidden || undefined}
      style={{ "--i": String(Math.max(current, 0)), "--tab": TAB } as CSSProperties}
      className={cn(
        "fixed bottom-[calc(22px+max(env(safe-area-inset-bottom),var(--tg-safe-area-inset-bottom,0px)))] left-1/2 z-20 flex h-16 -translate-x-1/2 rounded-[32px] bg-glass p-1 shadow-bar ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[14px] backdrop-brightness-[1.04] backdrop-saturate-[1.9] transition-[translate,opacity] duration-[380ms] ease-drawer select-none md:hidden",
        hidden && "pointer-events-none translate-y-[140%] opacity-0",
      )}
    >
      <span
        aria-hidden="true"
        data-slot="tab-lens"
        className={cn(
          "absolute top-1 left-1 z-[1] h-14 rounded-[28px] bg-muted transition-[translate,opacity] duration-[450ms] ease-spring",
          current < 0 && "opacity-0",
        )}
        style={{ width: "var(--tab)", translate: "calc(var(--i) * var(--tab)) 0" }}
      />
      {shown.map((item) => {
        const on = isCurrentItem(item, pathname)
        const Icon = tabIcons[item.key]
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative z-[2] flex h-14 w-(--tab) flex-col items-center justify-center gap-[3px] rounded-[28px] text-[10.5px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "text-primary" : "text-foreground",
            )}
          >
            <Icon className="size-[26px]" />
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
