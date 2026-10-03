"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { unavailable } from "@/lib/companies"
import { formatPhone } from "@/lib/phone"
import { useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { cn } from "@/lib/utils"

// Dashboard is the app's home: for now who is signed in and where. The shell
// around it shows it only to a session with a company, and holds the top bar.
export function Dashboard() {
  const me = useMe()
  const company = me.data?.company
  if (!me.data || !company) return null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Salom, {me.data.user.full_name ?? formatPhone(me.data.user.phone)}</h1>
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
}
