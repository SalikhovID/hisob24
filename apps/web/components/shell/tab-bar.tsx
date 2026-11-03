"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"
import { pageIcons, tabIcons } from "@/components/kit/tab-icons"
import { barPages, currentPin } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { moveTo } from "@/lib/moves"

// A button is the page's icon (24px) over its name (10px), sharing the bar
// alike: the ink, the current one the accent's words, its icon drawn bolder.
const tab =
  "relative z-[2] flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-[26px] pt-[7px] pb-1.5 text-[10px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-6 [&_svg]:stroke-[1.6] aria-[current=page]:[&_svg]:stroke-2"

// A button's name is 10px times the names' scale and keeps 4px clear of
// the button's edges either side. On a bar too narrow for the names at 10px
// (a 320px phone, a larger text size) they are all set smaller together,
// down to 8.5px; there a name may take its button's whole width, and one
// longer still ends in an ellipsis.
const tabName = "max-w-full truncate"
const tabNameSize = { fontSize: "calc(10px * var(--name-k))" }
const NAME_CLEAR = 8
const NAME_LEAST = 8.5 / 10

const SettingsMark = tabIcons.settings

// TabBar is the prototype's floating frosted pill (its frost and capsule
// are globals.css's) along the bottom of a narrow screen (a phone, the
// Telegram Mini App), where the sidebar is hidden: 16px off the screen's
// sides (6px on a phone narrower than 360px, where 16px would leave the
// names too little room), 28px off its foot (and the phone's home
// indicator, and Telegram's own bottom edge). Four pages of the member's own choice (logic/roles.md,
// section 8; the default bar without one), each an icon over its name, and
// «Sozlama» last, always: the settings page, which lists the other pages
// and the settings. A grey capsule stands under the page's button (on a
// record or a form, under the page it lies under) and slides to the next;
// on a page the bar does not hold it stands under «Sozlama». The bar is on
// every page, as the prototype's.
export function TabBar() {
  const me = useMe()
  const pathname = usePathname()
  const pins = barPages(me.data?.permissions, me.data?.tab_bar)
  const pinned = currentPin(pins, pathname)
  const current = pinned < 0 ? pins.length : pinned
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
        data-slot="tab-bar"
        style={{ "--i": String(current), "--n": String(pins.length + 1), "--name-k": String(nameScale) } as CSSProperties}
        className="fixed inset-x-4 max-[359px]:inset-x-1.5 bottom-[calc(28px+max(env(safe-area-inset-bottom),var(--tg-safe-area-inset-bottom,0px)))] z-20 flex rounded-4xl p-1 shadow-(--tab-bar-shadow) select-none md:hidden"
      >
        <span
          aria-hidden="true"
          data-slot="tab-lens"
          className="absolute top-1 bottom-1 left-1 z-[1] rounded-[26px] transition-[translate] duration-[400ms] ease-out-expo"
          style={{ width: "calc((100% - 8px) / var(--n))", translate: "calc(var(--i) * 100%) 0" }}
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
              className={cn(tab, on ? "text-accent-text" : "text-foreground")}
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
          className={cn(tab, pinned < 0 ? "text-accent-text" : "text-foreground")}
        >
          <SettingsMark />
          <span data-slot="tab-name" className={tabName} style={tabNameSize}>
            Sozlama
          </span>
        </Link>
    </nav>
  )
}
