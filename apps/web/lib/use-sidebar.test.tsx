import { act, renderHook } from "@testing-library/react"
import { expect, test } from "vitest"
import { useSidebar } from "./use-sidebar"

test("the sidebar starts unfolded, folds and unfolds, and keeps the choice in the browser", () => {
  const { result } = renderHook(() => useSidebar())
  expect(result.current.collapsed).toBe(false)

  act(() => result.current.toggleCollapsed())
  expect(result.current.collapsed).toBe(true)
  expect(localStorage.getItem("sidebar_collapsed")).toBe("true")

  act(() => result.current.toggleCollapsed())
  expect(result.current.collapsed).toBe(false)
  expect(localStorage.getItem("sidebar_collapsed")).toBe("false")
})

test("the sidebar opens the way it was left", () => {
  localStorage.setItem("sidebar_collapsed", "true")

  const { result } = renderHook(() => useSidebar())

  expect(result.current.collapsed).toBe(true)
})

test("the sections' sheet opens and closes apart from the fold", () => {
  const { result } = renderHook(() => useSidebar())
  expect(result.current.open).toBe(false)

  act(() => result.current.setOpen(true))
  expect(result.current.open).toBe(true)
  expect(result.current.collapsed).toBe(false)

  act(() => result.current.setOpen(false))
  expect(result.current.open).toBe(false)
})
