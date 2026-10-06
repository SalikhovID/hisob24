import { useCallback, useMemo } from "react"
import { stored, useKept } from "./use-kept"

// columns reads a kept choice. What the browser hands back is not trusted:
// anything but a list of column names is no choice at all.
function columns(kept: string | null): string[] {
  try {
    const value: unknown = JSON.parse(kept ?? "[]")
    return Array.isArray(value) && value.every((column) => typeof column === "string") ? value : []
  } catch {
    return []
  }
}

// useHiddenColumns is which columns of a list (the customers', the tasks')
// a user has hidden. The choice is the user's own in each company and is
// kept in the browser, so the next visit shows the list the same way. The
// server's HTML hides nothing.
export function useHiddenColumns(
  companyId: number,
  phone: string,
  list = "customers",
): { hidden: ReadonlySet<string>; toggle: (key: string) => void } {
  const key = `${list}_hidden_columns:${companyId}:${phone}`
  const [kept, set] = useKept(key)
  const hidden = useMemo(() => new Set(columns(kept)), [kept])
  const toggle = useCallback(
    (column: string) => {
      const now = columns(stored(key))
      const next = now.includes(column) ? now.filter((other) => other !== column) : [...now, column]
      set(JSON.stringify(next))
    },
    [key, set],
  )
  return { hidden, toggle }
}
