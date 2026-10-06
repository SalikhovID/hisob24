import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { useHiddenColumns } from "./use-hidden-columns"

afterEach(() => vi.restoreAllMocks())

const KEY = "customers_hidden_columns:1:998901234567"

test("every column shows until it is hidden; hiding and showing is kept in the browser", () => {
  const { result } = renderHook(() => useHiddenColumns(1, "998901234567"))
  expect([...result.current.hidden]).toEqual([])

  act(() => result.current.toggle("type"))
  act(() => result.current.toggle("field:manba"))
  expect([...result.current.hidden]).toEqual(["type", "field:manba"])
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["type", "field:manba"])

  act(() => result.current.toggle("type"))
  expect([...result.current.hidden]).toEqual(["field:manba"])
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["field:manba"])
})

test("the list opens with the columns the user left hidden", () => {
  localStorage.setItem(KEY, JSON.stringify(["created_at"]))

  const { result } = renderHook(() => useHiddenColumns(1, "998901234567"))

  expect([...result.current.hidden]).toEqual(["created_at"])
})

test("the choice is each user's own, in each company", () => {
  localStorage.setItem(KEY, JSON.stringify(["type"]))

  expect([...renderHook(() => useHiddenColumns(2, "998901234567")).result.current.hidden]).toEqual([])
  expect([...renderHook(() => useHiddenColumns(1, "998902223344")).result.current.hidden]).toEqual([])
})

test("what the browser keeps is not trusted to be a list of columns", () => {
  for (const kept of ["not json", '{"type":true}', "[1,null]", "null"]) {
    localStorage.setItem(KEY, kept)
    const { result, unmount } = renderHook(() => useHiddenColumns(1, "998901234567"))
    expect([...result.current.hidden], kept).toEqual([])
    unmount()
  }
})

test("a browser that refuses its storage shows every column, and hiding one does no harm", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied")
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied")
  })
  const { result } = renderHook(() => useHiddenColumns(1, "998901234567"))

  act(() => result.current.toggle("type"))

  expect([...result.current.hidden]).toEqual([])
})

test("the tasks list keeps its own columns, apart from the customers'", () => {
  localStorage.setItem(KEY, JSON.stringify(["type"]))

  const { result } = renderHook(() => useHiddenColumns(1, "998901234567", "tasks"))
  expect([...result.current.hidden]).toEqual([])

  act(() => result.current.toggle("stage"))
  expect([...result.current.hidden]).toEqual(["stage"])
  expect(JSON.parse(localStorage.getItem("tasks_hidden_columns:1:998901234567")!)).toEqual(["stage"])
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["type"])
})
