import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { chooseCompany, signIn } from "@/test/session"
import { useLocation } from "./use-location"

// A hook under a query client, as a page has one.
function renderLocation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useLocation(), { wrapper })
}

test("the current location is the first one the member may work in, until one is chosen", async () => {
  const asosiy = asosiyOf(1)
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { result } = renderLocation()

  expect(result.current.current).toBeNull()
  expect(result.current.locations).toEqual([])
  await waitFor(() => expect(result.current.current).not.toBeNull())
  expect(result.current.locations.map((l) => l.name)).toEqual(["Asosiy", "Chilonzor"])
  expect(result.current.current?.id).toBe(asosiy.id)

  act(() => result.current.choose(chilonzor.id))
  expect(result.current.current?.id).toBe(chilonzor.id)
  // Kept for the next visit, by company and member.
  expect(localStorage.getItem(`location:1:${ALI}`)).toBe(String(chilonzor.id))
})

test("a kept choice the member may not work in any more gives way to the first location", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  const gone = addLocation(1, "Yopilgan")
  localStorage.setItem(`location:1:${VALI}`, String(gone.id))
  gone.deleted = true
  await signIn(VALI)
  await chooseCompany(1)
  const { result } = renderLocation()

  await waitFor(() => expect(result.current.current).not.toBeNull())
  expect(result.current.current?.name).toBe("Asosiy")

  restrictTo(VALI, 1, [chilonzor.id])
  const { result: restricted } = renderLocation()
  await waitFor(() => expect(restricted.current.current).not.toBeNull())
  expect(restricted.current.current?.id).toBe(chilonzor.id)
  expect(restricted.current.locations.map((l) => l.name)).toEqual(["Chilonzor"])
})

test("a member with no location to work in has no current one", async () => {
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  restrictTo(VALI, 1, [gone.id])
  await signIn(VALI)
  await chooseCompany(1)
  const { result } = renderLocation()

  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.locations).toEqual([])
  expect(result.current.current).toBeNull()
})
