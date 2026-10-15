import { screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { expect, test, vi } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { MenuSheet } from "./menu-sheet"

// next/link as far as a click goes: a link that runs its click and stays.
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    />
  ),
}))

const sheet = () => screen.findByRole("dialog", { name: "Sozlama" })
const pages = (list: HTMLElement) => within(list).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])
const props = () => ({ open: true, onOpenChange: vi.fn(), onCustomize: vi.fn() })

test("the owner's «Sozlama» holds every page under its section, the settings' too", async () => {
  await signIn(ALI)
  setLocation("/customers")
  renderWithProviders(<MenuSheet {...props()} />)

  const menu = await sheet()
  expect(await within(menu).findByText("Olma Savdo")).toBeInTheDocument()
  expect(pages(await within(menu).findByRole("list", { name: "Bo'limlar" }))).toEqual([
    ["Bosh sahifa", "/"],
    ["Mijozlar", "/customers"],
    ["Vazifalar", "/tasks"],
    ["Sotuv", "/sales"],
    ["Xodimlar", "/employees"],
  ])
  expect(pages(within(menu).getByRole("list", { name: "Mahsulotlar" }))).toEqual([
    ["Mahsulotlar", "/products"],
    ["Xizmatlar", "/services"],
  ])
  expect(pages(within(menu).getByRole("list", { name: "Ombor" }))).toEqual([
    ["Ombor", "/warehouse"],
    ["Xaridlar", "/purchases"],
    ["Ko'chirishlar", "/transfers"],
    ["Inventarizatsiya", "/inventories"],
    ["Boshlang'ich qoldiq", "/opening-stock"],
    ["Ta'minotchilar", "/suppliers"],
  ])
  expect(pages(within(menu).getByRole("list", { name: "Moliya" }))).toEqual([
    ["Kassa", "/accounts"],
    ["Xarajatlar", "/expenses"],
    ["O'tkazmalar", "/money-transfers"],
  ])
  expect(pages(within(menu).getByRole("list", { name: "Sozlamalar" }))).toEqual([
    ["Mijoz turlari", "/settings/customer-types"],
    ["Vazifa turlari", "/settings/task-types"],
    ["Bosqichlar", "/settings/stages"],
    ["Dropdownlar", "/settings/dropdowns"],
    ["Valyuta kurslari", "/settings/currencies"],
    ["Moliya kategoriyalari", "/settings/finance-categories"],
    ["Rollar", "/settings/roles"],
  ])
})

test("an employee's «Sozlama» holds the pages their role opens, the settings' only with the settings", async () => {
  giveRole(VALI, 1, "Omborchi", ["stock.view", "sales.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<MenuSheet {...props()} />)

  const menu = await sheet()
  expect(pages(await within(menu).findByRole("list", { name: "Ombor" }))).toEqual([
    ["Ombor", "/warehouse"],
    ["Ko'chirishlar", "/transfers"],
    ["Inventarizatsiya", "/inventories"],
    ["Boshlang'ich qoldiq", "/opening-stock"],
  ])
  expect(pages(within(menu).getByRole("list", { name: "Bo'limlar" }))).toEqual([
    ["Bosh sahifa", "/"],
    ["Sotuv", "/sales"],
  ])
  expect(within(menu).queryByRole("list", { name: "Moliya" })).not.toBeInTheDocument()
  expect(within(menu).queryByRole("list", { name: "Sozlamalar" })).not.toBeInTheDocument()
})

test("the page's own tile is marked; the bar's pages are said to stand in it", async () => {
  db.members[ALI][0].tabBar = ["home", "purchases"]
  await signIn(ALI)
  setLocation("/expenses")
  renderWithProviders(<MenuSheet {...props()} />)

  const menu = await sheet()
  const expenses = await within(menu).findByRole("link", { name: "Xarajatlar" })
  expect(expenses).toHaveAttribute("aria-current", "page")
  expect(within(menu).getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toEqual([expenses])
  const inBar = within(menu).getAllByRole("link").filter((link) => link.hasAttribute("aria-describedby"))
  expect(inBar.map((link) => link.textContent)).toEqual(["Bosh sahifa", "Xaridlar"])
  expect(within(menu).getByRole("link", { name: "Xaridlar" })).toHaveAccessibleDescription("Pastki panelda")
})
