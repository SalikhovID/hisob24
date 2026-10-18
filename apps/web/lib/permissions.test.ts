import { expect, test } from "vitest"
import { actionLabels, actionsOf, allPermissions, can, defaultPermissions, permissionOf, sectionLabels, summaryOf, toggled } from "./permissions"

test("the catalog is the forty-two permissions in their order", () => {
  expect(allPermissions).toHaveLength(42)
  expect(allPermissions[0]).toBe("customers.view")
  expect(allPermissions[10]).toBe("products.view")
  expect(allPermissions[21]).toBe("purchases.delete")
  expect(allPermissions[22]).toBe("sales.view")
  expect(allPermissions[26]).toBe("stock.view")
  expect(allPermissions[33]).toBe("finance.delete")
  expect(allPermissions[34]).toBe("employees.view")
  expect(allPermissions[41]).toBe("settings.delete")
  expect(new Set(allPermissions).size).toBe(42)
})

test("an employee without a role has everything but the history, the employees and the settings", () => {
  expect(defaultPermissions).toEqual([
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.delete",
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
    "sales.view",
    "sales.create",
    "sales.edit",
    "sales.delete",
    "stock.view",
    "stock.create",
    "stock.edit",
    "stock.delete",
    "finance.view",
    "finance.create",
    "finance.edit",
    "finance.delete",
  ])
})

test("the sections have their names in the app", () => {
  expect(sectionLabels).toEqual({
    customers: "Mijozlar",
    orders: "Vazifalar",
    products: "Mahsulotlar",
    suppliers: "Ta'minotchilar",
    purchases: "Xaridlar",
    sales: "Sotuv",
    stock: "Ombor hujjatlari",
    finance: "Moliya",
    employees: "Xodimlar",
    settings: "Sozlamalar",
  })
})

test("can says whether the permissions hold one; none hold nothing", () => {
  expect(can(["customers.view", "orders.view"], "orders.view")).toBe(true)
  expect(can(["customers.view"], "orders.view")).toBe(false)
  expect(can([], "customers.view")).toBe(false)
  expect(can(undefined, "customers.view")).toBe(false)
})

test("summaryOf names the sections a set of permissions reaches into, in order", () => {
  expect(summaryOf(["orders.view", "customers.view", "customers.create"])).toBe("Mijozlar, Vazifalar")
  expect(summaryOf(allPermissions)).toBe("Mijozlar, Vazifalar, Mahsulotlar, Ta'minotchilar, Xaridlar, Sotuv, Ombor hujjatlari, Moliya, Xodimlar, Sozlamalar")
  expect(summaryOf(["finance.view", "stock.view"])).toBe("Ombor hujjatlari, Moliya")
  expect(summaryOf(["purchases.view", "products.view"])).toBe("Mahsulotlar, Xaridlar")
  expect(summaryOf([])).toBe("Ruxsat yo'q")
})

test("the actions of a section, named: the history is the customers' and the orders' alone", () => {
  expect(actionsOf("customers")).toEqual(["view", "create", "edit", "delete", "history"])
  expect(actionsOf("orders")).toEqual(["view", "create", "edit", "delete", "history"])
  expect(actionsOf("products")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("suppliers")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("purchases")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("sales")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("stock")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("finance")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("employees")).toEqual(["view", "create", "edit", "delete"])
  expect(actionsOf("settings")).toEqual(["view", "create", "edit", "delete"])
  expect(permissionOf("orders", "edit")).toBe("orders.edit")
  expect(actionLabels).toEqual({ view: "Ko'rish", create: "Qo'shish", edit: "Tahrirlash", delete: "O'chirish", history: "Tarix" })
})

test("toggled: an action brings its section's view, the view taken away takes the section with it; the order is the catalog's", () => {
  expect(toggled([], "customers.create", true)).toEqual(["customers.view", "customers.create"])
  expect(toggled(["orders.view", "customers.view", "customers.create"], "customers.view", false)).toEqual(["orders.view"])
  expect(toggled(["customers.view", "customers.create"], "customers.create", false)).toEqual(["customers.view"])
  expect(toggled(["customers.view"], "orders.view", true)).toEqual(["customers.view", "orders.view"])
  expect(toggled(["customers.view"], "customers.view", true)).toEqual(["customers.view"])
})
