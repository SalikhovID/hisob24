"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

// usePurchaseFilter keeps the purchases page's page number in the address,
// so a reload or the back button finds the same list. The location is the
// current one (the topbar's), not the address's.
export function usePurchaseFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const filter = useMemo(() => ({ page: Math.max(1, Number(params.get("page")) || 1) }), [params])
  const update = useCallback(
    (change: { page: number }) => {
      router.replace(change.page > 1 ? `${pathname}?page=${change.page}` : pathname)
    },
    [pathname, router],
  )
  return [filter, update] as const
}
