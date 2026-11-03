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

test("the strip is the prototype's tabs: a faint track as wide as its tabs, the page's one white and ringed in the ink, the others grey", () => {
  setLocation("/products")
  renderWithProviders(<SectionTabs item={products} permissions={["products.view"]} />)

  const nav = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  expect(nav.querySelector("[data-slot=segmented]")).toHaveClass("w-max", "max-w-full", "overflow-x-auto", "bg-muted", "p-0.5", "rounded-[9px]", "md:rounded-lg")
  const current = within(nav).getByRole("link", { name: "Mahsulotlar" })
  expect(current).toHaveClass("bg-(--seg-thumb)", "text-foreground", "shadow-(--seg-shadow)", "h-[30px]", "text-[13px]", "md:h-7", "md:text-[12.5px]")
  expect(within(nav).getByRole("link", { name: "Xizmatlar" })).toHaveClass("text-muted-foreground")
})
