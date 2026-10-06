import { act, renderHook } from "@testing-library/react"
import { expect, test } from "vitest"
import { router, setLocation } from "@/test/navigation"
import { settingsHref, useSettingsTab } from "./use-settings-tab"

test("the address names the tab; without one, or with an unknown one, it is the customers", () => {
  setLocation("/settings")
  const { result } = renderHook(() => useSettingsTab())
  expect(result.current[0]).toBe("customers")

  act(() => setLocation("/settings?tab=tasks"))
  expect(result.current[0]).toBe("tasks")

  act(() => setLocation("/settings?tab=dropdowns"))
  expect(result.current[0]).toBe("dropdowns")

  act(() => setLocation("/settings?tab=x"))
  expect(result.current[0]).toBe("customers")
})

test("choosing a tab puts it in the address, the customers tab as the bare page", () => {
  setLocation("/settings?tab=tasks")
  const { result } = renderHook(() => useSettingsTab())

  act(() => result.current[1]("dropdowns"))
  expect(router.replace).toHaveBeenLastCalledWith("/settings?tab=dropdowns")
  expect(result.current[0]).toBe("dropdowns")

  act(() => result.current[1]("customers"))
  expect(router.replace).toHaveBeenLastCalledWith("/settings")
  expect(result.current[0]).toBe("customers")
})

test.each([
  ["customers", "/settings"],
  ["tasks", "/settings?tab=tasks"],
  ["dropdowns", "/settings?tab=dropdowns"],
] as const)("settingsHref(%s) is the tab's address", (tab, href) => {
  expect(settingsHref(tab)).toBe(href)
})
