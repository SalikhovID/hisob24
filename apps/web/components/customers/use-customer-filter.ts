"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { CustomerFilter } from "@/lib/queries"

// useCustomerFilter keeps the customers page's type, search and page in the
// address, so a reload or the back button finds the same list. Any change
// but the page itself starts again from the first page.
export function useCustomerFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filter = useMemo<CustomerFilter>(() => {
    const type = Number(params.get("type"))
    return {
      search: params.get("search") ?? "",
      typeId: Number.isInteger(type) && type > 0 ? type : null,
      page: Math.max(1, Number(params.get("page")) || 1),
    }
  }, [params])

  // A change of the filter is a navigation, and a navigation takes a moment.
  // A second change made in that moment builds on what was asked for, not on
  // what the address still says: otherwise it would undo the first (a tab
  // chosen right after the search was cleared lost one of the two). Once
  // the address moves, it is the truth again.
  const asked = useRef<CustomerFilter | null>(null)
  useEffect(() => {
    asked.current = null
  }, [filter])

  const update = useCallback(
    (change: Partial<CustomerFilter>) => {
      const next = { ...(asked.current ?? filter), page: 1, ...change }
      asked.current = next
      const query = new URLSearchParams()
      if (next.typeId !== null) query.set("type", String(next.typeId))
      if (next.search) query.set("search", next.search)
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )

  return [filter, update] as const
}
