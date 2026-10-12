"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { ExpenseFilter } from "@/lib/queries"

const dayPattern = /^\d{4}-\d{2}-\d{2}$/

// useExpenseFilter keeps the expenses page's kind, account, category, days
// and page in the address, so a reload or the back button finds the same
// list. Any change but the page itself starts again from the first page.
export function useExpenseFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filter = useMemo<ExpenseFilter>(() => {
    const id = (name: string) => {
      const value = Number(params.get(name))
      return Number.isInteger(value) && value > 0 ? value : null
    }
    const day = (name: string) => {
      const value = params.get(name) ?? ""
      return dayPattern.test(value) ? value : ""
    }
    return {
      kind: params.get("kind") === "income" ? "income" : "expense",
      accountId: id("account_id"),
      categoryId: id("category_id"),
      from: day("from"),
      to: day("to"),
      page: Math.max(1, Number(params.get("page")) || 1),
    }
  }, [params])

  // A change of the filter is a navigation, and a navigation takes a moment:
  // a second change made meanwhile builds on what was asked for, not on
  // what the address still says (the customers' filter does the same).
  const asked = useRef<ExpenseFilter | null>(null)
  useEffect(() => {
    asked.current = null
  }, [filter])

  const update = useCallback(
    (change: Partial<ExpenseFilter>) => {
      const next = { ...(asked.current ?? filter), page: 1, ...change }
      asked.current = next
      const query = new URLSearchParams()
      if (next.kind === "income") query.set("kind", "income")
      if (next.accountId !== null) query.set("account_id", String(next.accountId))
      if (next.categoryId !== null) query.set("category_id", String(next.categoryId))
      if (next.from) query.set("from", next.from)
      if (next.to) query.set("to", next.to)
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )

  return [filter, update] as const
}
