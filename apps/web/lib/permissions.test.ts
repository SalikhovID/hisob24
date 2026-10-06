import { expect, test } from "vitest"
import { allPermissions, defaultPermissions } from "./permissions"

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
