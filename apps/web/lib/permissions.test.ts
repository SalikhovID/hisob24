import { expect, test } from "vitest"
import { allPermissions, can, defaultPermissions, sectionLabels, summaryOf } from "./permissions"

test("the catalog is the eighteen permissions in their order", () => {
  expect(allPermissions).toHaveLength(18)
  expect(allPermissions[0]).toBe("customers.view")
  expect(allPermissions[17]).toBe("settings.delete")
  expect(new Set(allPermissions).size).toBe(18)
})

test("an employee without a role has the customers and the tasks, without their history", () => {
  expect(defaultPermissions).toEqual([
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
    "tasks.view",
    "tasks.create",
    "tasks.edit",
    "tasks.delete",
  ])
})

test("the sections have their names in the app", () => {
  expect(sectionLabels).toEqual({ customers: "Mijozlar", tasks: "Vazifalar", employees: "Xodimlar", settings: "Sozlamalar" })
})

test("can says whether the permissions hold one; none hold nothing", () => {
  expect(can(["customers.view", "tasks.view"], "tasks.view")).toBe(true)
  expect(can(["customers.view"], "tasks.view")).toBe(false)
  expect(can([], "customers.view")).toBe(false)
  expect(can(undefined, "customers.view")).toBe(false)
})

test("summaryOf names the sections a set of permissions reaches into, in order", () => {
  expect(summaryOf(["tasks.view", "customers.view", "customers.create"])).toBe("Mijozlar, Vazifalar")
  expect(summaryOf(allPermissions)).toBe("Mijozlar, Vazifalar, Xodimlar, Sozlamalar")
  expect(summaryOf([])).toBe("Ruxsat yo'q")
})
