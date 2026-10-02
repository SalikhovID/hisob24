"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import type { CompanyFilter } from "@/lib/queries"

const statuses = ["active", "expired"] as const

// useCompanyFilter keeps the companies page's search, status and page in
// the address, so a reload or the back button finds the same list. Any
// change but the page itself starts again from the first page.
export function useCompanyFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filter = useMemo<CompanyFilter>(() => {
    const status = params.get("status") ?? ""
    return {
      search: params.get("search") ?? "",
      status: statuses.includes(status as (typeof statuses)[number]) ? (status as CompanyFilter["status"]) : "",
      page: Math.max(1, Number(params.get("page")) || 1),
    }
  }, [params])

  const update = useCallback(
    (change: Partial<CompanyFilter>) => {
      const next = { ...filter, page: 1, ...change }
      const query = new URLSearchParams()
      if (next.search) query.set("search", next.search)
      if (next.status) query.set("status", next.status)
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )

  return [filter, update] as const
}
