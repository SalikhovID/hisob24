import { type QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, test, vi } from "vitest"
import { ApiError } from "./api"
import { makeQueryClient } from "./query-client"

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const unauthorizedError = () => new ApiError(401, "unauthorized", "Avval tizimga kiring")

test("a 401 from a query leads to /login at once, without retries", async () => {
  const unauthorized = vi.fn()
  const queryFn = vi.fn(() => Promise.reject(unauthorizedError()))

  renderHook(() => useQuery({ queryKey: ["me"], queryFn }), { wrapper: wrapperFor(makeQueryClient(unauthorized)) })

  await waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1))
  expect(queryFn).toHaveBeenCalledTimes(1)
})

test("a 401 from a mutation leads to /login", async () => {
  const unauthorized = vi.fn()
  const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(unauthorizedError()) }), {
    wrapper: wrapperFor(makeQueryClient(unauthorized)),
  })

  act(() => result.current.mutate())

  await waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1))
})

test("other refusals stay with the page and are not retried", async () => {
  const unauthorized = vi.fn()
  const queryFn = vi.fn(() => Promise.reject(new ApiError(404, "not_found", "Kompaniya topilmadi")))

  const { result } = renderHook(() => useQuery({ queryKey: ["company", 9], queryFn }), {
    wrapper: wrapperFor(makeQueryClient(unauthorized)),
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(queryFn).toHaveBeenCalledTimes(1)
  expect(unauthorized).not.toHaveBeenCalled()
})

test("a failed login (401 invalid_code) stays on the login page", async () => {
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
