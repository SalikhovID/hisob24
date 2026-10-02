"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { subscriptionExpired } from "@/lib/api"
import { formatPhoneInput } from "@/lib/phone"
import { useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"

// Dashboard is the app's home: for now who is signed in and where.
export function Dashboard() {
  const router = useRouter()
  const me = useMe()
  const expired = subscriptionExpired(me.error)

  useEffect(() => {
    if (expired) router.replace("/expired")
  }, [expired, router])

  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      {me.isPending ? (
        <Loading rows={2} />
      ) : (
        me.data && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">
              Salom, {me.data.user.full_name ?? formatPhoneInput(me.data.user.phone)}
            </h1>
            {me.data.company && (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="grid gap-0.5">
                  <span className="text-sm text-muted-foreground">Kompaniya</span>
                  <span className="font-medium">{me.data.company.name}</span>
                </div>
                <Badge variant="secondary">{roleLabels[me.data.company.role]}</Badge>
              </div>
            )}
          </div>
        )
      )}
    </main>
  )
}
