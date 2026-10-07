"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef } from "react"

// CatalogFilter narrows a catalog list: the active or the inactive records,
// a search and the page. The kind is the page's.
export interface CatalogFilter {
  status: "active" | "inactive"
  search: string
  page: number
}

// useCatalogFilter keeps the list's status, search and page in the address,
// so a reload or the back button finds the same list. Any change but the
// page itself starts again from the first page.
export function useCatalogFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filter = useMemo<CatalogFilter>(
    () => ({
      status: params.get("status") === "inactive" ? "inactive" : "active",
      search: params.get("search") ?? "",
      page: Math.max(1, Number(params.get("page")) || 1),
    }),
    [params],
  )

  // A change of the filter is a navigation, and a navigation takes a moment.
  // A second change made in that moment builds on what was asked for, not on
  // what the address still says (the customers' filter does the same).
  const asked = useRef<CatalogFilter | null>(null)
  useEffect(() => {
    asked.current = null
  }, [filter])

  const update = useCallback(
    (change: Partial<CatalogFilter>) => {
      const next = { ...(asked.current ?? filter), page: 1, ...change }
      asked.current = next
      const query = new URLSearchParams()
      if (next.status === "inactive") query.set("status", "inactive")
      if (next.search) query.set("search", next.search)
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )

  return [filter, update] as const
}
