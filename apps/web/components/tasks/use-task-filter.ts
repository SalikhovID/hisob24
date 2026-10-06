"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef } from "react"

// TaskView is how the tasks page shows them: as a list, or as a board of
// the stages.
export type TaskView = "list" | "board"

// TaskPageFilter is what the tasks page reads from the address: the view
// (null when the address names none), one type, one stage, one assignee (a
// phone, "" for every one), the search and the page.
export interface TaskPageFilter {
  view: TaskView | null
  typeId: number | null
  stageId: number | null
  assignee: string
  search: string
  page: number
}

// id reads a record's id from the address; anything else is no id.
function id(raw: string | null): number | null {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

// useTaskFilter keeps the tasks page's view, type, stage, assignee, search
// and page in the address, so a reload or the back button finds the same
// list. Any change but the page itself starts again from the first page.
export function useTaskFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filter = useMemo<TaskPageFilter>(() => {
    const view = params.get("view")
    return {
      view: view === "list" || view === "board" ? view : null,
      typeId: id(params.get("type")),
      stageId: id(params.get("stage")),
      assignee: params.get("assignee") ?? "",
      search: params.get("search") ?? "",
      page: Math.max(1, Number(params.get("page")) || 1),
    }
  }, [params])

  // A change of the filter is a navigation, and a navigation takes a moment.
  // A second change made in that moment builds on what was asked for, not on
  // what the address still says (see useCustomerFilter).
  const asked = useRef<TaskPageFilter | null>(null)
  useEffect(() => {
    asked.current = null
  }, [filter])

  const update = useCallback(
    (change: Partial<TaskPageFilter>) => {
      const next = { ...(asked.current ?? filter), page: 1, ...change }
      asked.current = next
      const query = new URLSearchParams()
      if (next.view !== null) query.set("view", next.view)
      if (next.typeId !== null) query.set("type", String(next.typeId))
      if (next.stageId !== null) query.set("stage", String(next.stageId))
      if (next.assignee) query.set("assignee", next.assignee)
      if (next.search) query.set("search", next.search)
      if (next.page > 1) query.set("page", String(next.page))
      const search = query.toString()
      router.replace(search ? `${pathname}?${search}` : pathname)
    },
    [filter, pathname, router],
  )

  return [filter, update] as const
}
