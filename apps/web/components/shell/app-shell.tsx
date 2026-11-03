"use client"

import { usePathname, useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
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

// AppShell frames every page of the app, as the prototype does. On a phone
// there is no top bar (the page heads the screen itself) and the sections
// float under the page (the tab bar: the page keeps room for it). On a wide
// screen the sidebar stands at the left edge and, beside it, the top bar
// (the way back the page tells it of, the location menu, the bell) over the
// page's column (1080px at most, in the middle). It is also the pages'
// gate: they are for a session with a company that may be used, so an
// expired one goes to /expired and one with no company yet to the company
// list, and a page is shown only once the session is known to have its
// company. Inside Telegram the shell is as tall as the Mini App's stable
// viewport (globals.css) and, opened full screen, the page runs under the
// status bar and Telegram's controls: the column starts its content below
// them (pt-safe-*), and what scrolls up passes under them, into a soft fade
// that stands there once the page is scrolled. The page's blocks keep their
// height in the scrolling column.
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
      <div data-slot="app-shell" className="flex h-dvh overflow-hidden">
        <Sidebar collapsed={sidebar.collapsed} onToggleCollapsed={sidebar.toggleCollapsed} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-y-auto bg-background px-4 pt-safe-2 md:px-[max(24px,calc((100%-1080px)/2))] md:pt-5 md:pb-10 [&>*]:shrink-0",
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
