import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

// useHydrated is false while the server's HTML stands in for the page and
// true once React has taken it over. Before that a typed value would be
// wiped by hydration and a form would be sent the browser's way, as a GET.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
