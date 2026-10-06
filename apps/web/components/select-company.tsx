"use client"

import { ChevronRightIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Logo } from "@/components/logo"
import { Failed, Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { subscriptionExpired } from "@/lib/api"
import { unavailable } from "@/lib/companies"
import { useLogout, useMe, useSwitchCompany } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useMiniApp } from "@/lib/telegram"

// SelectCompany lets someone in several companies choose the one to work in.
export function SelectCompany() {
  const router = useRouter()
  const me = useMe()
  const choose = useSwitchCompany()
  const logout = useLogout()
  const miniApp = useMiniApp()
  // The session's company has expired since it was chosen: /expired offers
  // the way back to this list.
  const expired = subscriptionExpired(me.error)

  useEffect(() => {
    if (expired) router.replace("/expired")
  }, [expired, router])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 pb-4 pt-safe-10">
      <Logo className="self-start" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Kompaniyani tanlang</h1>
        <p className="text-sm text-muted-foreground">Qaysi kompaniyada ishlaysiz?</p>
      </div>
      {me.isPending ? (
        <Loading />
      ) : me.isError ? (
        !expired && <Failed error={me.error} onRetry={() => me.refetch()} />
      ) : (
        <>
          {choose.isError && (
            <p role="alert" className="text-sm text-destructive">
              {choose.error.message}
            </p>
          )}
          <ul className="grid gap-3">
            {me.data.companies.map((company) => {
              const reason = unavailable(company)
              return (
                <li key={company.id}>
                  <button
                    type="button"
                    disabled={reason !== null || choose.isPending}
                    onClick={() => choose.mutate(company.id, { onSuccess: () => router.replace("/") })}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors not-disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="grid gap-0.5">
                      <span className="font-medium">{company.name}</span>
                      <span className="text-sm text-muted-foreground">{roleLabels[company.role]}</span>
                    </span>
                    {reason ? (
                      <Badge variant={reason.expired ? "destructive" : "secondary"}>{reason.label}</Badge>
                    ) : (
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {me.data.companies.every((company) => unavailable(company) !== null) && (
            <div className="space-y-1 rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">Faol kompaniya yo&apos;q</p>
              <p className="text-sm text-muted-foreground">
                Kompaniyangiz obunasi tugagan yoki bloklangan. Davom etish uchun administrator bilan
                bog&apos;laning.
              </p>
            </div>
          )}
        </>
      )}
      {!miniApp && (
        <Button variant="ghost" className="self-center" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOutIcon />
          Chiqish
        </Button>
      )}
    </main>
  )
}
