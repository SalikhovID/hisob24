"use client"

import { ChevronRightIcon } from "lucide-react"
import { Loading } from "@/components/states"
import { useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"

// SelectCompany lets someone in several companies choose the one to work in.
export function SelectCompany() {
  const me = useMe()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 p-4 pt-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Kompaniyani tanlang</h1>
        <p className="text-sm text-muted-foreground">Qaysi kompaniyada ishlaysiz?</p>
      </div>
      {me.isPending ? (
        <Loading />
      ) : (
        me.data && (
          <ul className="grid gap-3">
            {me.data.companies.map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent"
                >
                  <span className="grid gap-0.5">
                    <span className="font-medium">{company.name}</span>
                    <span className="text-sm text-muted-foreground">{roleLabels[company.role]}</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  )
}
