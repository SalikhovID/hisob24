import { expect, test } from "vitest"
import { isCurrent, navFor } from "./nav"
import type { Role } from "./types"

const labels = (role?: Role) => navFor(role).map((item) => item.label)

test("the owner may open every section", () => {
  expect(labels("owner")).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Xodimlar", "Sozlamalar"])
})

test("an employee, and a session whose role is not known yet, see no section of the owner's", () => {
  // The customers and the tasks are every member's.
  expect(labels("user")).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar"])
  expect(labels(undefined)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar"])
})

test("the customers open at /customers, the tasks at /tasks", () => {
  expect(navFor("user").find((item) => item.label === "Mijozlar")?.href).toBe("/customers")
  expect(navFor("user").find((item) => item.label === "Vazifalar")?.href).toBe("/tasks")
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
