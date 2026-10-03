"use client"

import { useRouter } from "next/navigation"
import { type ReactNode, useEffect } from "react"
import { Failed, Loading } from "@/components/states"
import { subscriptionExpired } from "@/lib/api"
import { useMe } from "@/lib/queries"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

// AppShell frames every page of the app: the sections beside it, the top bar
// above it. It is also the pages' gate: they are for a session with a company
// that may be used, so an expired one goes to /expired and one with no
// company yet to the company list, and a page is shown only once the session
// is known to have its company.
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const me = useMe()
  const away = subscriptionExpired(me.error) ? "/expired" : me.data?.company === null ? "/select-company" : null

  useEffect(() => {
    if (away) router.replace(away)
  }, [away, router])

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={false} onOpenChange={() => {}} collapsed={false} onToggleCollapsed={() => {}} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => {}} />
        <main className="h-0 flex-1 overflow-auto p-4 md:p-6">
          {me.isPending ? (
            <Loading rows={2} />
          ) : me.isError ? (
            !away && <Failed error={me.error} onRetry={() => me.refetch()} />
          ) : (
            me.data.company && children
          )}
        </main>
      </div>
    </div>
  )
}
