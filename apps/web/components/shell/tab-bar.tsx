"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"
import { pageIcons, tabIcons } from "@/components/kit/tab-icons"
import { barPages, currentPin, isMenuPath } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { moveTo } from "@/lib/moves"

// A tab is 72px wide, narrower on a phone too narrow for five (a 360px or
// a 320px screen keeps 12px either side).
const TAB = "min(72px, calc((100vw - 24px) / 5))"

// A button is the page's mark over its name: grey, the current one in the
// text's ink, its mark drawn bolder.
const tab =
  "relative z-[2] flex h-14 w-(--tab) flex-col items-center justify-center gap-1 rounded-[28px] text-[11px] tracking-[-0.01em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-[25px] aria-[current=page]:[&_svg]:stroke-[2.2]"

// A button's name is 11px times the names' scale and keeps 4px clear of
// the button's edges either side. On a bar too narrow for the names at 11px
// (a 360px or a 320px phone, a larger text size) they are all set smaller
// together, down to 8.5px; there a name may take its button's whole width,
// and one longer still ends in an ellipsis.
const tabName = "max-w-full truncate"
const tabNameSize = { fontSize: "calc(11px * var(--name-k))" }
const NAME_CLEAR = 8
const NAME_LEAST = 8.5 / 11

const SettingsMark = tabIcons.settings

// TabBar is the prototype's floating frosted pill (its frost and lens are
// globals.css's) along the bottom of a narrow screen (a phone, the Telegram
// Mini App), where the sidebar is hidden: four pages of the member's own
// choice (logic/roles.md, section 8; the default bar without one), each an
// outline icon over its name, and «Sozlamalar» last, always: the settings
// page, which lists every page and leads to the choice of the bar's pages.
// A lens of glass stands under the page's button and slides to the next;
// on a page the bar does not hold it stands under «Sozlamalar».
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
  const names = pins.map((page) => page.label).join("|")
  const ref = useRef<HTMLElement>(null)
  const [nameScale, setNameScale] = useState(1)

  // The names are measured at full size against their buttons, and the
  // widest one's room sets the size of all. A font's width does not follow
  // its size exactly, so the size is measured again at itself and taken
  // down where a name still runs over. They are fitted again when the bar's
  // width changes, when the current one (set bolder) changes, and once the
  // font has come (the first measure may be the fallback's).
  useLayoutEffect(() => {
    const nav = ref.current
    if (!nav) return
    const fit = () => {
      const names = [...nav.querySelectorAll<HTMLElement>('[data-slot="tab-name"]')]
      const rooms = names.map((name) => (name.parentElement?.getBoundingClientRect().width ?? 0) - NAME_CLEAR)
      let scale = 1
      for (let pass = 0; pass < 3; pass++) {
        nav.style.setProperty("--name-k", String(scale))
        // A name is measured whole, its button's width not holding it in.
        for (const name of names) name.style.maxWidth = "none"
        const widths = names.map((name) => name.getBoundingClientRect().width)
        for (const name of names) name.style.maxWidth = ""
        const over = Math.min(1, ...widths.map((width, at) => (rooms[at] > 0 && width > rooms[at] ? rooms[at] / width : 1)))
        if (over >= 1 || scale === NAME_LEAST) break
        scale = Math.max(NAME_LEAST, scale * over)
      }
      // Set on the node too: React re-applies the style prop only when the
      // state changes, and a measure that keeps the scale would leave it at 1.
      nav.style.setProperty("--name-k", String(scale))
      setNameScale(scale)
    }
    fit()
    let live = true
    document.fonts?.ready.then(() => live && fit())
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => fit())
    observer?.observe(nav)
    return () => {
      live = false
      observer?.disconnect()
    }
  }, [names, current])

  return (
    <nav
        ref={ref}
        aria-label="Bo'limlar"
        aria-hidden={hidden || undefined}
        inert={hidden}
        data-slot="tab-bar"
        data-hidden={hidden || undefined}
        style={{ "--i": String(current), "--tab": TAB, "--name-k": String(nameScale) } as CSSProperties}
        className={cn(
          "fixed bottom-[calc(22px+max(env(safe-area-inset-bottom),var(--tg-safe-area-inset-bottom,0px)))] left-1/2 z-20 flex h-16 -translate-x-1/2 rounded-[32px] p-1 shadow-(--tb-shadow) transition-[translate,opacity] duration-[380ms] ease-drawer select-none md:hidden",
          hidden && "pointer-events-none translate-y-[140%] opacity-0",
        )}
      >
        <span
          aria-hidden="true"
          data-slot="tab-lens"
          className="absolute top-1 left-1 z-[1] h-14 rounded-[28px] transition-[translate,opacity] duration-[450ms] ease-spring"
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
              className={cn(tab, on ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
            >
              <Icon />
              <span data-slot="tab-name" className={tabName} style={tabNameSize}>
                {page.label}
              </span>
            </Link>
          )
        })}
        <Link
          href="/settings"
          // The settings are switched to at once, as a page from the bar.
          onClick={() => moveTo(undefined)}
          aria-current={pinned < 0 ? "page" : undefined}
          className={cn(tab, pinned < 0 ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
        >
          <SettingsMark />
          <span data-slot="tab-name" className={tabName} style={tabNameSize}>
            Sozlamalar
          </span>
        </Link>
    </nav>
  )
}
