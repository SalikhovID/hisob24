import { useCallback, useMemo, useSyncExternalStore } from "react"

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab hiding a column hides it here too.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

// stored is what the browser keeps under key, as it is. A browser may refuse
// its storage (a locked-down WebView): then nothing is kept, and every
// column shows.
function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

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

// useHiddenColumns is which columns of the customers list a user has hidden.
// The choice is the user's own in each company and is kept in the browser,
// so the next visit shows the list the same way. The server's HTML hides
// nothing.
export function useHiddenColumns(companyId: number, phone: string): { hidden: ReadonlySet<string>; toggle: (key: string) => void } {
  const key = `customers_hidden_columns:${companyId}:${phone}`
  const kept = useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  )
  const hidden = useMemo(() => new Set(columns(kept)), [kept])
  const toggle = useCallback(
    (column: string) => {
      const now = columns(stored(key))
      const next = now.includes(column) ? now.filter((other) => other !== column) : [...now, column]
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Nowhere to keep the choice.
      }
      listeners.forEach((listener) => listener())
    },
    [key],
  )
  return { hidden, toggle }
}
