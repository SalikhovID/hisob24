import { expect, test } from "vitest"
import { barItems, isCurrent, isCurrentItem, navFor, navItems } from "./nav"
import { allPermissions, defaultPermissions } from "./permissions"
import type { Permission } from "./types"

const labels = (permissions?: Permission[], order?: string[] | null) => navFor(permissions, order).map((item) => item.label)

test("the owner may open every section, in the default order", () => {
  expect(labels(allPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Xodimlar", "Sozlamalar"])
})

test("an employee without a role sees the customers, the tasks, the products, the sales and the warehouse", () => {
  expect(labels(defaultPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor"])
})

test("an employee with a role sees the sections the role lets them view; before the session is known, the home alone", () => {
  expect(labels(["tasks.view", "tasks.create", "settings.view"])).toEqual(["Bosh sahifa", "Vazifalar", "Sozlamalar"])
  expect(labels(["employees.view"])).toEqual(["Bosh sahifa", "Xodimlar"])
  expect(labels(["suppliers.view"])).toEqual(["Bosh sahifa", "Ombor"])
  expect(labels(["sales.view"])).toEqual(["Bosh sahifa", "Sotuv"])
  expect(labels([])).toEqual(["Bosh sahifa"])
  expect(labels(undefined)).toEqual(["Bosh sahifa"])
})

test("a section with tabs opens at the first tab the member may see", () => {
  const href = (permissions: Permission[], label: string) => navFor(permissions).find((item) => item.label === label)?.href
  expect(href(allPermissions, "Mahsulotlar")).toBe("/products")
  expect(href(allPermissions, "Ombor")).toBe("/purchases")
  expect(href(["suppliers.view"], "Ombor")).toBe("/suppliers")
  expect(href(["stock.view"], "Ombor")).toBe("/transfers")
  expect(href(["stock.view", "suppliers.view"], "Ombor")).toBe("/transfers")
  expect(href(allPermissions, "Sotuv")).toBe("/sales")
  expect(href(defaultPermissions, "Mijozlar")).toBe("/customers")
  expect(href(defaultPermissions, "Vazifalar")).toBe("/tasks")
})

test("the warehouse holds the purchases, the stock documents by kind and the suppliers, in that order", () => {
  const warehouse = navItems.find((item) => item.key === "warehouse")!
  expect(warehouse.tabs?.map((tab) => [tab.label, tab.href, tab.permission])).toEqual([
    ["Xaridlar", "/purchases", "purchases.view"],
    ["Ko'chirishlar", "/transfers", "stock.view"],
    ["Inventarizatsiya", "/inventories", "stock.view"],
    ["Boshlang'ich qoldiq", "/opening-stock", "stock.view"],
    ["Ta'minotchilar", "/suppliers", "suppliers.view"],
  ])
})

test("the member's own order comes first; what it does not name follows in the default order, what they may not see is left out", () => {
  expect(labels(allPermissions, ["settings", "tasks"])).toEqual([
    "Sozlamalar",
    "Vazifalar",
    "Bosh sahifa",
    "Mijozlar",
    "Mahsulotlar",
    "Sotuv",
    "Ombor",
    "Xodimlar",
  ])
  expect(labels(defaultPermissions, ["settings", "warehouse", "home"])).toEqual(["Ombor", "Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv"])
  expect(labels(allPermissions, null)).toEqual(labels(allPermissions))
  expect(labels(allPermissions, ["bogus"])).toEqual(labels(allPermissions))
})

test("the bar shows up to five sections; past that, four and the rest apart", () => {
  const eight = navFor(allPermissions)
  expect(barItems(eight).shown.map((item) => item.label)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
  expect(barItems(eight).more.map((item) => item.label)).toEqual(["Sotuv", "Ombor", "Xodimlar", "Sozlamalar"])
  const five = navFor(["customers.view", "tasks.view", "products.view", "sales.view"])
  expect(barItems(five).shown).toHaveLength(5)
  expect(barItems(five).more).toEqual([])
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

test.each([
  ["home", "/", true],
  ["home", "/employees", false],
  ["products", "/products", true],
  ["products", "/services/3", true],
  ["products", "/purchases", false],
  ["warehouse", "/purchases/new", true],
  ["warehouse", "/suppliers/2", true],
  ["warehouse", "/transfers/3/edit", true],
  ["warehouse", "/inventories", true],
  ["warehouse", "/opening-stock/new", true],
  ["sales", "/sales/3/edit", true],
  ["sales", "/customers/3", false],
  ["warehouse", "/products", false],
])("the section %s holds the page %s: %s", (key, pathname, current) => {
  expect(isCurrentItem(navItems.find((item) => item.key === key)!, pathname)).toBe(current)
})
