import { type QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, test, vi } from "vitest"
import { ApiError } from "./api"
import { meKey } from "./queries"
import { makeQueryClient } from "./query-client"

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

// The API client answers unauthorized only once the refresh failed too.
const unauthorizedError = () => new ApiError(401, "unauthorized", "Avval tizimga kiring")

test("a lost session from a query leads to /login at once, without retries", async () => {
  const unauthorized = vi.fn()
  const queryFn = vi.fn(() => Promise.reject(unauthorizedError()))

  renderHook(() => useQuery({ queryKey: ["me"], queryFn }), { wrapper: wrapperFor(makeQueryClient(unauthorized)) })

  await waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1))
  expect(queryFn).toHaveBeenCalledTimes(1)
})

test("a lost session from a mutation leads to /login", async () => {
  const unauthorized = vi.fn()
  const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(unauthorizedError()) }), {
    wrapper: wrapperFor(makeQueryClient(unauthorized)),
  })

  act(() => result.current.mutate())

  await waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1))
})

test("other refusals stay with the page and are not retried", async () => {
  const unauthorized = vi.fn()
  const queryFn = vi.fn(() => Promise.reject(new ApiError(402, "subscription_expired", "Kompaniya obunasi tugagan")))

  const { result } = renderHook(() => useQuery({ queryKey: ["me"], queryFn }), {
    wrapper: wrapperFor(makeQueryClient(unauthorized)),
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(queryFn).toHaveBeenCalledTimes(1)
  expect(unauthorized).not.toHaveBeenCalled()
})

test("a wrong login code (401 invalid_code) stays on the login page", async () => {
  const unauthorized = vi.fn()
  const { result } = renderHook(
    () =>
      useMutation({
        mutationFn: () => Promise.reject(new ApiError(401, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")),
      }),
    { wrapper: wrapperFor(makeQueryClient(unauthorized)) },
  )

  act(() => result.current.mutate())

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(unauthorized).not.toHaveBeenCalled()
})

test("a server failure is tried twice more", async () => {
  const queryFn = vi.fn(() => Promise.reject(new ApiError(500, "internal_error", "Ichki xatolik")))

  // No delay between the tries, so the test does not wait out the backoff.
  const { result } = renderHook(() => useQuery({ queryKey: ["me"], queryFn, retryDelay: 0 }), {
    wrapper: wrapperFor(makeQueryClient(vi.fn())),
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(queryFn).toHaveBeenCalledTimes(3)
})

// The API reads the membership, the subscription and the role on every
// request: a refusal for one of them means /app/me, as the app has it, is old.
const expired = () => new ApiError(402, "subscription_expired", "Kompaniya obunasi tugagan")
const ownerOnly = () => new ApiError(403, "owner_only", "Bu bo'lim faqat kompaniya egasi uchun")

test.each([
  ["the subscription ran out", expired],
  ["the user is the owner no more", ownerOnly],
])("an action refused because %s asks /app/me again", async (_, refusal) => {
  const me = vi.fn(() => Promise.resolve({ company: { id: 1 } }))
  const { result } = renderHook(
    () => ({
      me: useQuery({ queryKey: meKey, queryFn: me }),
      action: useMutation({ mutationFn: () => Promise.reject(refusal()) }),
    }),
    { wrapper: wrapperFor(makeQueryClient(vi.fn())) },
  )
  await waitFor(() => expect(result.current.me.isSuccess).toBe(true))
  expect(me).toHaveBeenCalledTimes(1)

  act(() => result.current.action.mutate())

  await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
})

test("a list refused because the user is the owner no more asks /app/me again", async () => {
  const me = vi.fn(() => Promise.resolve({ company: { id: 1 } }))
  const client = makeQueryClient(vi.fn())
  const { result } = renderHook(() => useQuery({ queryKey: meKey, queryFn: me }), { wrapper: wrapperFor(client) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  const { result: list } = renderHook(
    () => useQuery({ queryKey: ["employees", 1], queryFn: () => Promise.reject(ownerOnly()) }),
    { wrapper: wrapperFor(client) },
  )

  await waitFor(() => expect(list.current.isError).toBe(true))
  await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
})

test("/app/me's own refusal is the news itself: it is not asked again", async () => {
  const me = vi.fn(() => Promise.reject(expired()))
  const { result } = renderHook(() => useQuery({ queryKey: meKey, queryFn: me }), {
    wrapper: wrapperFor(makeQueryClient(vi.fn())),
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(me).toHaveBeenCalledTimes(1)
})

test("other refusals leave /app/me as it is", async () => {
  const me = vi.fn(() => Promise.resolve({ company: { id: 1 } }))
  const { result } = renderHook(
    () => ({
      me: useQuery({ queryKey: meKey, queryFn: me }),
      action: useMutation({
        mutationFn: () =>
          Promise.reject(new ApiError(409, "already_member", "Bu raqam kompaniyangizga allaqachon qo'shilgan")),
      }),
    }),
    { wrapper: wrapperFor(makeQueryClient(vi.fn())) },
  )
  await waitFor(() => expect(result.current.me.isSuccess).toBe(true))

  act(() => result.current.action.mutate())

  await waitFor(() => expect(result.current.action.isError).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(me).toHaveBeenCalledTimes(1)
})
