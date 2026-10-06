import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { useKept } from "./use-kept"

afterEach(() => vi.restoreAllMocks())

const KEY = "tasks_view:1:998901234567"

test("nothing is kept until something is; what is kept is there for the next visit", () => {
  const { result } = renderHook(() => useKept(KEY))
  expect(result.current[0]).toBeNull()

  act(() => result.current[1]("list"))
  expect(result.current[0]).toBe("list")
  expect(localStorage.getItem(KEY)).toBe("list")

  const again = renderHook(() => useKept(KEY))
  expect(again.result.current[0]).toBe("list")
})

test("keeping nothing forgets what was kept", () => {
  localStorage.setItem(KEY, "board")
  const { result } = renderHook(() => useKept(KEY))
  expect(result.current[0]).toBe("board")

  act(() => result.current[1](null))

  expect(result.current[0]).toBeNull()
  expect(localStorage.getItem(KEY)).toBeNull()
})

test("every reader of a key sees a change at once, from this tab or another", () => {
  const one = renderHook(() => useKept(KEY))
  const other = renderHook(() => useKept(KEY))

  act(() => one.result.current[1]("list"))
  expect(other.result.current[0]).toBe("list")

  act(() => {
    localStorage.setItem(KEY, "board")
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }))
  })
  expect(one.result.current[0]).toBe("board")
  expect(other.result.current[0]).toBe("board")
})

test("a browser that refuses its storage keeps nothing, and nothing breaks", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("locked down")
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("locked down")
  })

  const { result } = renderHook(() => useKept(KEY))

  expect(result.current[0]).toBeNull()
  expect(() => act(() => result.current[1]("list"))).not.toThrow()
  expect(result.current[0]).toBeNull()
})
