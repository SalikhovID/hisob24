import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { navItems } from "@/lib/nav"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { SectionTabs } from "./section-tabs"

const products = navItems.find((item) => item.key === "products")!
const warehouse = navItems.find((item) => item.key === "warehouse")!

test("the tabs of a section are links, the page's one marked; only the tabs the member may see", () => {
  setLocation("/services")
  renderWithProviders(<SectionTabs item={products} permissions={["products.view"]} />)

  const nav = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Mahsulotlar", "/products"],
    ["Xizmatlar", "/services"],
  ])
  expect(within(nav).getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("aria-current", "page")
  expect(within(nav).getByRole("link", { name: "Mahsulotlar" })).not.toHaveAttribute("aria-current")
})

test("the warehouse's tabs each take their permission", () => {
  setLocation("/purchases/new")
  renderWithProviders(<SectionTabs item={warehouse} permissions={["purchases.view", "suppliers.view"]} />)

  const nav = screen.getByRole("navigation", { name: "Ombor bo'limi" })
  expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Xaridlar", "Ta'minotchilar"])
  expect(within(nav).getByRole("link", { name: "Xaridlar" })).toHaveAttribute("aria-current", "page")
})

test("with one tab to see there is no strip", () => {
  setLocation("/suppliers")
  renderWithProviders(<SectionTabs item={warehouse} permissions={["suppliers.view"]} />)

  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
})

test("the strip is the prototype's segmented control: a pill, the page's link on the thumb", () => {
  setLocation("/products")
  renderWithProviders(<SectionTabs item={products} permissions={["products.view"]} />)

  const nav = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  const pill = nav.querySelector("[data-slot=segmented]")
  expect(pill).not.toBeNull()
  expect(pill).toHaveStyle({ "--n": "2" })
  expect(within(nav).getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("data-active")
  expect(within(nav).getByRole("link", { name: "Xizmatlar" })).not.toHaveAttribute("data-active")
})
