import { expect, test } from "vitest"
import { oldTabHref, settingsHref } from "./use-settings-tab"

test.each([
  ["customers", "/settings/customer-types"],
  ["tasks", "/settings/task-types"],
  ["stages", "/settings/stages"],
  ["dropdowns", "/settings/dropdowns"],
  ["currencies", "/settings/currencies"],
  ["finance", "/settings/finance-categories"],
  ["roles", "/settings/roles"],
] as const)("settingsHref(%s) is the part's page", (tab, href) => {
  expect(settingsHref(tab)).toBe(href)
})

test("an old tab's address leads to the part's page; none, or one not there, leads nowhere", () => {
  expect(oldTabHref("tasks")).toBe("/settings/task-types")
  expect(oldTabHref("roles")).toBe("/settings/roles")
  expect(oldTabHref("x")).toBeNull()
  expect(oldTabHref(null)).toBeNull()
})
