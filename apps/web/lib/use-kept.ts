import { useCallback, useSyncExternalStore } from "react"

// What a page keeps in the browser for the next visit, under a key of its
// own: the view a user chose, a column they folded, the columns they hid.
// It is the user's own in each company and never reaches the server; the
// server's HTML knows nothing of it.

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // A change made in another tab is a change here too.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

// stored is what the browser keeps under the key, as it is. A browser may
// refuse its storage (a locked-down WebView): then nothing is kept.
export function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// keep writes what the browser keeps under the key, or forgets it (null),
// and tells every reader of it.
export function keep(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Nowhere to keep it.
  }
  listeners.forEach((listener) => listener())
}

// useKept is what the browser keeps under the key, null until something is
// kept, and a way to change it.
export function useKept(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  )
  const set = useCallback((next: string | null) => keep(key, next), [key])
  return [value, set]
}
