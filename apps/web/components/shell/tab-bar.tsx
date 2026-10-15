"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type CSSProperties, useState } from "react"
import { pageIcons, tabIcons } from "@/components/kit/tab-icons"
import { barPages, currentPin, isMenuPath } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { moveTo } from "@/lib/moves"
import { MenuSheet } from "./menu-sheet"
import { TabBarSheet } from "./tab-bar-sheet"

// A tab is 72px wide, narrower on a phone too narrow for five (a 360px or
// a 320px screen keeps 12px either side).
const TAB = "min(72px, calc((100vw - 24px) / 5))"

const tab =
  "relative z-[2] flex h-14 w-(--tab) flex-col items-center justify-center gap-[3px] rounded-[28px] text-[10.5px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

const SettingsMark = tabIcons.settings

// TabBar is the prototype's floating «liquid glass» bar along the bottom of
// a narrow screen (a phone, the Telegram Mini App), where the sidebar is
// hidden: up to four pages of the member's own choice (logic/roles.md,
// section 8; the default bar without one), each a filled icon over its
// name, and «Sozlama» last, always, with the rest. A lens of glass stands
// under the page's button and slides to the next; on a page the bar does
// not hold it stands under «Sozlama», which opens the menu of every page
// and, from it, the choice of the bar's pages.
// The bar shows on the menu's pages (a hub's pages too: they may stand in
// it); inside one (a record, a form, the profile) it steps down out of the
// way, and the page leads back. It keeps clear of the phone's home
// indicator and of Telegram's own bottom edge.
export function TabBar() {
  const me = useMe()
  const pathname = usePathname()
  const pins = barPages(me.data?.permissions, me.data?.tab_bar)
  const pinned = currentPin(pins, pathname)
  const current = pinned < 0 ? pins.length : pinned
  const hidden = !isMenuPath(pathname)
  // sheet is the sheet open over the bar: «Sozlama», or the choice of the
  // bar's pages it leads to.
  const [sheet, setSheet] = useState<null | "menu" | "bar">(null)

  return (
    <>
      <nav
        aria-label="Bo'limlar"
        aria-hidden={hidden || undefined}
        inert={hidden}
        data-slot="tab-bar"
        data-hidden={hidden || undefined}
        style={{ "--i": String(current), "--tab": TAB } as CSSProperties}
        className={cn(
          "fixed bottom-[calc(22px+max(env(safe-area-inset-bottom),var(--tg-safe-area-inset-bottom,0px)))] left-1/2 z-20 flex h-16 -translate-x-1/2 rounded-[32px] bg-glass p-1 shadow-bar ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[14px] backdrop-brightness-[1.04] backdrop-saturate-[1.9] transition-[translate,opacity] duration-[380ms] ease-drawer select-none md:hidden",
          hidden && "pointer-events-none translate-y-[140%] opacity-0",
        )}
      >
        <span
          aria-hidden="true"
          data-slot="tab-lens"
          className="absolute top-1 left-1 z-[1] h-14 rounded-[28px] bg-muted transition-[translate,opacity] duration-[450ms] ease-spring"
          style={{ width: "var(--tab)", translate: "calc(var(--i) * var(--tab)) 0" }}
        />
        {pins.map((page, index) => {
          const on = index === pinned
          const Icon = pageIcons[page.key]
          return (
            <Link
              key={page.key}
              href={page.href}
              // A page from the bar is switched to at once (lib/moves.ts).
              onClick={() => moveTo(undefined)}
              aria-current={on ? "page" : undefined}
              className={cn(tab, on ? "text-primary" : "text-foreground")}
            >
              <Icon className="size-[26px]" />
              <span className="max-w-full truncate px-0.5">{page.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={sheet === "menu"}
          aria-current={pinned < 0 ? "page" : undefined}
          onClick={() => setSheet("menu")}
          className={cn(tab, pinned < 0 ? "text-primary" : "text-foreground")}
        >
          <SettingsMark className="size-[26px]" />
          <span className="max-w-full truncate px-0.5">Sozlama</span>
        </button>
      </nav>
      <MenuSheet open={sheet === "menu"} onOpenChange={(open) => setSheet(open ? "menu" : null)} onCustomize={() => setSheet("bar")} />
      <TabBarSheet open={sheet === "bar"} onOpenChange={(open) => setSheet(open ? "bar" : null)} />
    </>
  )
}
