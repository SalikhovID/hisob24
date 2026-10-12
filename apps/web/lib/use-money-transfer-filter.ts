"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import type { MoneyTransferFilter } from "@/lib/queries"

// useMoneyTransferFilter keeps the transfers page's account and page in the
// address, so a reload or the back button finds the same list. Another
// account starts again from the first page.
export function useMoneyTransferFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const filter = useMemo<MoneyTransferFilter>(() => {
    const account = Number(params.get("account_id"))
    return { accountId: Number.isInteger(account) && account > 0 ? account : null, page: Math.max(1, Number(params.get("page")) || 1) }
  }, [params])
  const update = useCallback(
    (change: Partial<MoneyTransferFilter>) => {
      const next = { ...filter, page: 1, ...change }
      const query = new URLSearchParams()
      if (next.accountId !== null) query.set("account_id", String(next.accountId))
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )
  return [filter, update] as const
}
