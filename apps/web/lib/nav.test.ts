import { expect, test } from "vitest"
import { barItems, isCurrent, isCurrentItem, isRootPath, navFor, navItems, sectionRootOf } from "./nav"
import { allPermissions, defaultPermissions } from "./permissions"
import type { Permission } from "./types"

const labels = (permissions?: Permission[], order?: string[] | null) => navFor(permissions, order).map((item) => item.label)

test("the owner may open every section, in the default order", () => {
  expect(labels(allPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
})

test("an employee without a role sees the customers, the tasks, the products, the sales and the warehouse", () => {
  expect(labels(defaultPermissions)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya"])
})

test("an employee with a role sees the sections the role lets them view; before the session is known, the home alone", () => {
  expect(labels(["tasks.view", "tasks.create", "settings.view"])).toEqual(["Bosh sahifa", "Vazifalar", "Sozlamalar"])
  expect(labels(["employees.view"])).toEqual(["Bosh sahifa", "Xodimlar"])
  expect(labels(["suppliers.view"])).toEqual(["Bosh sahifa", "Ombor"])
  expect(labels(["sales.view"])).toEqual(["Bosh sahifa", "Sotuv"])
  expect(labels(["finance.view"])).toEqual(["Bosh sahifa", "Moliya"])
  expect(labels([])).toEqual(["Bosh sahifa"])
  expect(labels(undefined)).toEqual(["Bosh sahifa"])
})

test("a section with tabs opens at the first tab the member may see", () => {
  const href = (permissions: Permission[], label: string) => navFor(permissions).find((item) => item.label === label)?.href
  expect(href(allPermissions, "Mahsulotlar")).toBe("/products")
  // The warehouse opens at its hub, whichever of its pages the member may see.
  expect(href(allPermissions, "Ombor")).toBe("/warehouse")
  expect(href(["suppliers.view"], "Ombor")).toBe("/warehouse")
  expect(href(["stock.view"], "Ombor")).toBe("/warehouse")
  expect(href(allPermissions, "Sotuv")).toBe("/sales")
  expect(href(allPermissions, "Moliya")).toBe("/accounts")
  expect(href(["finance.view"], "Moliya")).toBe("/accounts")
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

test("the home comes first; the member's own order follows; what it does not name follows in the default order, what they may not see is left out", () => {
  expect(labels(allPermissions, ["settings", "tasks"])).toEqual([
    "Bosh sahifa",
    "Sozlamalar",
    "Vazifalar",
    "Mijozlar",
    "Mahsulotlar",
    "Sotuv",
    "Ombor",
    "Moliya",
    "Xodimlar",
  ])
  expect(labels(defaultPermissions, ["settings", "warehouse", "home"])).toEqual(["Bosh sahifa", "Ombor", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Moliya"])
  expect(labels(allPermissions, null)).toEqual(labels(allPermissions))
  expect(labels(allPermissions, ["bogus"])).toEqual(labels(allPermissions))
})

test("the bar shows the home and the first four sections; the rest go to the profile", () => {
  const nine = navFor(allPermissions)
  expect(barItems(nine).shown.map((item) => item.label)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv"])
  expect(barItems(nine).more.map((item) => item.label)).toEqual(["Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
  const five = navFor(["customers.view", "tasks.view", "products.view", "sales.view"])
  expect(barItems(five).shown).toHaveLength(5)
  expect(barItems(five).more).toEqual([])
})

test("a section's root pages are where the tab bar shows; a record, a form or the profile are inside one", () => {
  for (const path of ["/", "/customers", "/tasks", "/products", "/services", "/sales", "/warehouse", "/accounts", "/expenses", "/money-transfers", "/employees", "/settings"]) {
    expect(isRootPath(path), path).toBe(true)
  }
  for (const path of ["/customers/7", "/tasks/3", "/purchases", "/purchases/new", "/suppliers/2", "/sales/new", "/profile", "/profile/menu", "/settings/roles/new", "/accounts/4"]) {
    expect(isRootPath(path), path).toBe(false)
  }
})

test("a page inside a section leads back to the section's root", () => {
  expect(sectionRootOf("/customers/7")).toBe("/customers")
  expect(sectionRootOf("/purchases/3/edit")).toBe("/warehouse")
  expect(sectionRootOf("/services")).toBe("/products")
  expect(sectionRootOf("/settings/roles/1")).toBe("/settings")
  expect(sectionRootOf("/profile/menu")).toBe("/")
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
  ["warehouse", "/warehouse", true],
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

test("the finance holds the cash, the expenses and the transfers, in that order, each for whoever may see the finance", () => {
  const finance = navItems.find((item) => item.key === "finance")!
  expect(finance.label).toBe("Moliya")
  expect(finance.tabs?.map((tab) => [tab.label, tab.href, tab.permission])).toEqual([
    ["Kassa", "/accounts", "finance.view"],
    ["Xarajatlar", "/expenses", "finance.view"],
    ["O'tkazmalar", "/money-transfers", "finance.view"],
  ])
})
