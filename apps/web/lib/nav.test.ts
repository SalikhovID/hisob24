import { expect, test } from "vitest"
import { barOrder, barPages, currentPin, defaultBar, isCurrent, isCurrentItem, isMenuPath, isRootPath, navFor, navItems, navPages, pagesFor, sectionRootOf } from "./nav"
import { allPermissions, defaultPermissions } from "./permissions"
import type { Permission } from "./types"

const labels = (permissions?: Permission[]) => navFor(permissions).map((item) => item.label)

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

test("a section's root pages are where the tab bar shows; a record, a form or the profile are inside one", () => {
  for (const path of ["/", "/customers", "/tasks", "/products", "/services", "/sales", "/warehouse", "/accounts", "/expenses", "/money-transfers", "/employees", "/settings"]) {
    expect(isRootPath(path), path).toBe(true)
  }
  for (const path of ["/customers/7", "/tasks/3", "/purchases", "/purchases/new", "/suppliers/2", "/sales/new", "/profile", "/settings/roles/new", "/accounts/4"]) {
    expect(isRootPath(path), path).toBe(false)
  }
})

test("a page inside a section leads back to the section's root", () => {
  expect(sectionRootOf("/customers/7")).toBe("/customers")
  expect(sectionRootOf("/purchases/3/edit")).toBe("/warehouse")
  expect(sectionRootOf("/services")).toBe("/products")
  expect(sectionRootOf("/settings/roles/1")).toBe("/settings")
  expect(sectionRootOf("/profile")).toBe("/")
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

test("the pages of the menu, in its order, each of its section: the sections' own, the tabs, the warehouse and its pages; the settings are none of them", () => {
  expect(navPages.map((page) => [page.key, page.label, page.href, page.section])).toEqual([
    ["home", "Bosh sahifa", "/", "home"],
    ["customers", "Mijozlar", "/customers", "customers"],
    ["tasks", "Vazifalar", "/tasks", "tasks"],
    ["products", "Mahsulotlar", "/products", "products"],
    ["services", "Xizmatlar", "/services", "products"],
    ["sales", "Sotuv", "/sales", "sales"],
    ["warehouse", "Ombor", "/warehouse", "warehouse"],
    ["purchases", "Xaridlar", "/purchases", "warehouse"],
    ["transfers", "Ko'chirishlar", "/transfers", "warehouse"],
    ["inventories", "Inventarizatsiya", "/inventories", "warehouse"],
    ["opening_stock", "Boshlang'ich qoldiq", "/opening-stock", "warehouse"],
    ["suppliers", "Ta'minotchilar", "/suppliers", "warehouse"],
    ["accounts", "Kassa", "/accounts", "finance"],
    ["expenses", "Xarajatlar", "/expenses", "finance"],
    ["money_transfers", "O'tkazmalar", "/money-transfers", "finance"],
    ["employees", "Xodimlar", "/employees", "employees"],
  ])
})

test("someone may open the pages their permissions open, the warehouse with any of its pages; before the session is known, the home alone", () => {
  const keys = (permissions?: Permission[]) => pagesFor(permissions).map((page) => page.key)
  expect(keys(allPermissions)).toEqual(navPages.map((page) => page.key))
  expect(keys(["suppliers.view"])).toEqual(["home", "warehouse", "suppliers"])
  expect(keys(["stock.view"])).toEqual(["home", "warehouse", "transfers", "inventories", "opening_stock"])
  expect(keys(["finance.view", "sales.view"])).toEqual(["home", "sales", "accounts", "expenses", "money_transfers"])
  expect(keys(["products.view"])).toEqual(["home", "products", "services"])
  expect(keys([])).toEqual(["home"])
  expect(keys(undefined)).toEqual(["home"])
})

test("the default bar is the first four of the home, the customers, the tasks, the products, the sales, the warehouse, the cash and the employees the member may open", () => {
  expect(defaultBar(allPermissions)).toEqual(["home", "customers", "tasks", "products"])
  expect(defaultBar(["sales.view", "stock.view", "finance.view"])).toEqual(["home", "sales", "warehouse", "accounts"])
  expect(defaultBar(["employees.view", "purchases.view"])).toEqual(["home", "warehouse", "employees"])
  expect(defaultBar(undefined)).toEqual(["home"])
})

test("the bar's order is the member's own pages they may open, then the rest by the default bar's order and the menu's", () => {
  const order = (permissions: Permission[] | undefined, tabBar?: string[] | null) => barOrder(permissions, tabBar).map((page) => page.key)
  const rest = ["services", "purchases", "transfers", "inventories", "opening_stock", "suppliers", "expenses", "money_transfers"]
  expect(order(allPermissions, null)).toEqual(["home", "customers", "tasks", "products", "sales", "warehouse", "accounts", "employees", ...rest])
  expect(order(allPermissions, ["purchases"])).toEqual([
    "purchases",
    "home",
    "customers",
    "tasks",
    "products",
    "sales",
    "warehouse",
    "accounts",
    "employees",
    ...rest.filter((key) => key !== "purchases"),
  ])
  expect(order(["sales.view"], ["purchases", "sales", "home"]), "a page they may not open is none of it").toEqual(["sales", "home"])
  expect(order(undefined, null)).toEqual(["home"])
})

test("the tab bar is the first four of the bar's order: always full, unless the member may open fewer pages", () => {
  const bar = (permissions: Permission[] | undefined, tabBar?: string[] | null) => barPages(permissions, tabBar).map((page) => page.key)
  expect(bar(allPermissions)).toEqual(["home", "customers", "tasks", "products"])
  expect(bar(allPermissions, null)).toEqual(["home", "customers", "tasks", "products"])
  expect(bar(["employees.view"], null)).toEqual(["home", "employees"])
  expect(bar(allPermissions, ["purchases", "home", "money_transfers"]), "a short bar is filled up").toEqual(["purchases", "home", "money_transfers", "customers"])
  expect(bar(["sales.view"], ["purchases", "sales", "home"]), "a page they may not open drops out").toEqual(["sales", "home"])
  expect(bar(allPermissions, []), "an empty bar of before is filled").toEqual(["home", "customers", "tasks", "products"])
  expect(bar(allPermissions, ["bogus", "tasks"])).toEqual(["tasks", "home", "customers", "products"])
  expect(bar(allPermissions, ["home", "customers", "tasks", "products", "sales"])).toEqual(["home", "customers", "tasks", "products"])
})

test("the bar's current page is the page itself, or the warehouse on one of its pages that is not in the bar; elsewhere none (then «Sozlama» is)", () => {
  const pins = barPages(allPermissions, ["home", "warehouse", "expenses", "purchases"])
  expect(currentPin(pins, "/")).toBe(0)
  expect(currentPin(pins, "/warehouse")).toBe(1)
  expect(currentPin(pins, "/transfers")).toBe(1)
  expect(currentPin(pins, "/suppliers")).toBe(1)
  expect(currentPin(pins, "/purchases")).toBe(3)
  expect(currentPin(pins, "/expenses")).toBe(2)
  expect(currentPin(pins, "/accounts"), "a page beside a tab is not the tab").toBe(-1)
  expect(currentPin(pins, "/customers")).toBe(-1)
  expect(currentPin(pins, "/settings/stages")).toBe(-1)
  expect(currentPin(barPages(allPermissions, ["purchases"]), "/transfers"), "only the warehouse holds its pages").toBe(-1)
  expect(currentPin([], "/")).toBe(-1)
})

test("the tab bar shows on every page of the menu: the sections' own, the tabs, the hubs and their pages; a record, a form or the profile are inside one", () => {
  for (const path of ["/", "/customers", "/tasks", "/products", "/services", "/sales", "/warehouse", "/purchases", "/transfers", "/inventories", "/opening-stock", "/suppliers", "/accounts", "/expenses", "/money-transfers", "/employees", "/settings", "/settings/customer-types", "/settings/roles"]) {
    expect(isMenuPath(path), path).toBe(true)
  }
  for (const path of ["/customers/7", "/purchases/new", "/purchases/3", "/suppliers/2", "/sales/new", "/profile", "/settings/roles/new", "/settings/task-types/4", "/settings/tab-bar", "/accounts/4", "/select-company"]) {
    expect(isMenuPath(path), path).toBe(false)
  }
})
