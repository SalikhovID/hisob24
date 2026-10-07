import { expect, test } from "vitest"
import { actionLabels, actionsOf, allPermissions, can, defaultPermissions, permissionOf, sectionLabels, summaryOf, toggled } from "./permissions"

test("the catalog is the thirty permissions in their order", () => {
  expect(allPermissions).toHaveLength(30)
  expect(allPermissions[0]).toBe("customers.view")
  expect(allPermissions[10]).toBe("products.view")
  expect(allPermissions[21]).toBe("purchases.delete")
  expect(allPermissions[29]).toBe("settings.delete")
  expect(new Set(allPermissions).size).toBe(30)
})

test("an employee without a role has the customers, the tasks and the warehouse, without the history", () => {
  expect(defaultPermissions).toEqual([
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
    "tasks.view",
    "tasks.create",
    "tasks.edit",
    "tasks.delete",
    "products.view",
    "products.create",
    "products.edit",
    "products.delete",
    "suppliers.view",
    "suppliers.create",
    "suppliers.edit",
    "suppliers.delete",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "purchases.delete",
  ])
})

test("the sections have their names in the app", () => {
  expect(sectionLabels).toEqual({
    customers: "Mijozlar",
    tasks: "Vazifalar",
    products: "Mahsulotlar",
    suppliers: "Ta'minotchilar",
    purchases: "Xaridlar",
    employees: "Xodimlar",
    settings: "Sozlamalar",
  })
})

test("can says whether the permissions hold one; none hold nothing", () => {
  expect(can(["customers.view", "tasks.view"], "tasks.view")).toBe(true)
  expect(can(["customers.view"], "tasks.view")).toBe(false)
  expect(can([], "customers.view")).toBe(false)
  expect(can(undefined, "customers.view")).toBe(false)
})

test("summaryOf names the sections a set of permissions reaches into, in order", () => {
  expect(summaryOf(["tasks.view", "customers.view", "customers.create"])).toBe("Mijozlar, Vazifalar")
  expect(summaryOf(allPermissions)).toBe("Mijozlar, Vazifalar, Mahsulotlar, Ta'minotchilar, Xaridlar, Xodimlar, Sozlamalar")
  expect(summaryOf(["purchases.view", "products.view"])).toBe("Mahsulotlar, Xaridlar")
  expect(summaryOf([])).toBe("Ruxsat yo'q")
})

test("the actions of a section, named: the history is the customers' and the tasks' alone", () => {
  expect(actionsOf("customers")).toEqual(["view", "create", "edit", "delete", "history"])
  expect(actionsOf("tasks")).toEqual(["view", "create", "edit", "delete", "history"])
  expect(actionsOf("products")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("suppliers")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("purchases")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("employees")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("settings")).toEqual(["view", "create", "edit", "delete"])
  expect(permissionOf("tasks", "edit")).toBe("tasks.edit")
  expect(actionLabels).toEqual({ view: "Ko'rish", create: "Qo'shish", edit: "Tahrirlash", delete: "O'chirish", history: "Tarix" })
})

test("toggled: an action brings its section's view, the view taken away takes the section with it; the order is the catalog's", () => {
  expect(toggled([], "customers.create", true)).toEqual(["customers.view", "customers.create"])
  expect(toggled(["tasks.view", "customers.view", "customers.create"], "customers.view", false)).toEqual(["tasks.view"])
  expect(toggled(["customers.view", "customers.create"], "customers.create", false)).toEqual(["customers.view"])
  expect(toggled(["customers.view"], "tasks.view", true)).toEqual(["customers.view", "tasks.view"])
  expect(toggled(["customers.view"], "customers.view", true)).toEqual(["customers.view"])
})
