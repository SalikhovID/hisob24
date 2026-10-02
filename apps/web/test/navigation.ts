// An in-memory stand-in for next/navigation: tests set the location with
// setLocation, and router.push / replace move it like the real router.
import { useMemo, useSyncExternalStore } from "react"
import { vi } from "vitest"

const ORIGIN = "http://localhost:3000"
let url = new URL("/", ORIGIN)
let routeParams: Record<string, string> = {}
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function go(href: string) {
  url = new URL(href, url)
  listeners.forEach((listener) => listener())
}

// leave stands in for lib/navigate's full page load: here just a move.
export const leave = vi.fn(go)

export const router = {
  push: vi.fn(go),
  replace: vi.fn(go),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

// setLocation puts a test on a page: its path with the query and the
// dynamic route params.
export function setLocation(href: string, params: Record<string, string> = {}) {
  url = new URL(href, ORIGIN)
  routeParams = params
  Object.values(router).forEach((fn) => fn.mockClear())
  leave.mockClear()
  listeners.forEach((listener) => listener())
}

export function currentUrl() {
  return url.pathname + url.search
}

export function useRouter() {
  return router
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => url.pathname, () => url.pathname)
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => url.search, () => url.search)
  return useMemo(() => new URLSearchParams(search), [search])
}

export function useParams() {
  return routeParams
}

export function redirect(href: string): never {
  throw new Error(`redirect: ${href}`)
}
