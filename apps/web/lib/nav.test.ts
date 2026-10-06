import { expect, test } from "vitest"
import { isCurrent, navFor } from "./nav"
import { allPermissions, defaultPermissions } from "./permissions"
import type { Permission } from "./types"

const labels = (permissions?: Permission[]) => navFor(permissions).map((item) => item.label)

test("the owner may open every section", () => {
  expect(labels(allPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Xodimlar", "Sozlamalar"])
})

test("an employee without a role sees the customers and the tasks", () => {
  expect(labels(defaultPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar"])
})

test("an employee with a role sees the sections the role lets them view; before the session is known, the home alone", () => {
  expect(labels(["tasks.view", "tasks.create", "settings.view"])).toEqual(["Bosh sahifa", "Vazifalar", "Sozlamalar"])
  expect(labels(["employees.view"])).toEqual(["Bosh sahifa", "Xodimlar"])
  expect(labels([])).toEqual(["Bosh sahifa"])
  expect(labels(undefined)).toEqual(["Bosh sahifa"])
})

test("the customers open at /customers, the tasks at /tasks", () => {
  expect(navFor(defaultPermissions).find((item) => item.label === "Mijozlar")?.href).toBe("/customers")
  expect(navFor(defaultPermissions).find((item) => item.label === "Vazifalar")?.href).toBe("/tasks")
})

test.each([
  ["/", "/", true],
  ["/", "/employees", false],
  ["/employees", "/employees", true],
  ["/employees", "/employees/998901234567", true],
  ["/employees", "/employees-archive", false],
  ["/employees", "/", false],
  ["/settings", "/settings/customer-types/7", true],
  ["/customers", "/customers/7", true],
  ["/tasks", "/tasks/7", true],
])("the section at %s holds the page %s: %s", (href, pathname, current) => {
  expect(isCurrent(href, pathname)).toBe(current)
})
