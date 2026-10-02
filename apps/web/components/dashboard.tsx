"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Failed, Loading } from "@/components/states"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { subscriptionExpired } from "@/lib/api"
import { unavailable } from "@/lib/companies"
import { formatPhone } from "@/lib/phone"
import { useLogout, useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { cn } from "@/lib/utils"

// Dashboard is the app's home: for now who is signed in and where.
export function Dashboard() {
  const router = useRouter()
  const me = useMe()
  const logout = useLogout()
  const company = me.data?.company
  // The page is for a session with a company that may be used: an expired
  // one goes to /expired, none yet to the company list.
  const away = subscriptionExpired(me.error) ? "/expired" : company === null ? "/select-company" : null

  useEffect(() => {
    if (away) router.replace(away)
  }, [away, router])

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
        <span className="font-semibold">Hisob24</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOutIcon />
            Chiqish
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl p-4">
        {me.isPending ? (
          <Loading rows={2} />
        ) : me.isError ? (
          !away && <Failed error={me.error} onRetry={() => me.refetch()} />
        ) : (
          company && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">
                Salom, {me.data.user.full_name ?? formatPhone(me.data.user.phone)}
              </h1>
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-sm text-muted-foreground">Kompaniya</span>
                  <span className="truncate font-medium">{company.name}</span>
                </div>
                <Badge variant="secondary">{roleLabels[company.role]}</Badge>
              </div>
              {me.data.companies.filter((c) => unavailable(c) === null).length > 1 && (
                <Link href="/select-company" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                  Kompaniyani almashtirish
                </Link>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
