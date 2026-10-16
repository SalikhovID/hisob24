"use client"

import { usePathname, useRouter } from "next/navigation"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
import { BackTargetProvider } from "@/components/kit/back-target"
import { Failed, Loading } from "@/components/states"
import { subscriptionExpired } from "@/lib/api"
import { isMenuPath } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import { useSidebar } from "@/lib/use-sidebar"
import { cn } from "@/lib/utils"
import { Sidebar } from "./sidebar"
import { TabBar } from "./tab-bar"
import { TopBar } from "./top-bar"

// AppShell frames every page of the app, as the prototype does: on a phone
// no top bar (the page heads the screen itself; the home holds the way to
// the profile) and the sections floating under the page (the tab bar, on
// the menu's pages: the page keeps room for it there); on a wide screen the
// sections in the floating sidebar and, over the page's column (1120px at
// most, in the middle), the top bar: the way back the page tells it of
// (BackTargetProvider), the theme and the way out. It is also the pages' gate: they are for a
// session with a company that may be used, so an expired one goes to
// /expired and one with no company yet to the company list, and a page is
// shown only once the session is known to have its company. Inside Telegram
// the shell is as tall as the Mini App's stable viewport (globals.css) and,
// opened full screen, the page runs under the status bar and Telegram's
// controls, as the prototype's does: the column starts its content below
// them (pt-safe-*), and what scrolls up passes under them, into a soft fade
// that stands there once the page is scrolled (globals.css: as tall as what
// lies over the top, none where nothing does). The page's
// blocks keep their height in the scrolling column:
// one that clips its overflow (a group's rounded list) would shrink to fit
// the screen otherwise, and lose its last rows. The column holds the ambient
// light still (a scroller's own background does not scroll): the page moves
// over it, as the prototype's screens do over theirs.
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const me = useMe()
  const sidebar = useSidebar()
  const away = subscriptionExpired(me.error) ? "/expired" : me.data?.company === null ? "/select-company" : null
  // scrolled: the page is scrolled past a few pixels, and the top fade shows.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (away) router.replace(away)
  }, [away, router])

  return (
    <BackTargetProvider>
      <div
        data-slot="app-shell"
        // How wide the sidebar stands, with its margins (globals.css: the
        // page that moves lays its light where the column's lies).
        style={{ "--side": sidebar.collapsed ? "96px" : "296px" } as CSSProperties}
        className="flex h-dvh overflow-hidden"
      >
        <Sidebar collapsed={sidebar.collapsed} onToggleCollapsed={sidebar.toggleCollapsed} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-y-auto bg-ambient px-4 pt-safe-2 md:px-[max(32px,calc((100%-1120px)/2))] md:pt-safe-20 md:pb-20 [&>*]:shrink-0",
              isMenuPath(pathname) ? "pb-bar" : "pb-safe-6",
            )}
          >
            {me.isPending ? (
              <Loading rows={2} />
            ) : me.isError ? (
              !away && <Failed error={me.error} onRetry={() => me.refetch()} />
            ) : (
              me.data.company && children
            )}
          </main>
        </div>
        <div aria-hidden="true" data-slot="top-fade" data-on={scrolled || undefined} />
        <TabBar />
      </div>
    </BackTargetProvider>
  )
}
