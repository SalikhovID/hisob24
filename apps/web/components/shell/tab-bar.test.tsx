import { screen, waitFor, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { expect, test, vi } from "vitest"
import { moveTo } from "@/lib/moves"
import { ALI, db, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { moved } from "@/test/moves"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { TabBar } from "./tab-bar"

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

const bar = () => screen.getByRole("navigation", { name: "Bo'limlar" })
// settings is «Sozlamalar», the bar's last button: the way to every page.
const settings = () => within(bar()).getByRole("link", { name: "Sozlamalar" })
// tabs is the member's pages in the bar, [name, address], before «Sozlamalar».
const tabs = () =>
  within(bar())
    .getAllByRole("link")
    .filter((link) => link !== settings())
    .map((link) => [link.textContent, link.getAttribute("href")])
// lens is the place of the glass under the current button, in buttons.
const lens = () => bar().style.getPropertyValue("--i")

test("the owner's bar is the default four pages, the page marked, and «Sozlamalar» last, the way to the settings page", async () => {
  await signIn(ALI)
  setLocation("/customers")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Mahsulotlar" })).toBeInTheDocument()
  expect(tabs()).toEqual([
    ["Bosh sahifa", "/"],
    ["Mijozlar", "/customers"],
    ["Vazifalar", "/tasks"],
    ["Mahsulotlar", "/products"],
  ])
  expect(within(bar()).getByRole("link", { name: "Mijozlar" })).toHaveAttribute("aria-current", "page")
  expect(within(bar()).getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current")
  expect(lens()).toBe("1")
  expect(settings()).toHaveAttribute("href", "/settings")
  expect(settings()).not.toHaveAttribute("aria-current")
  expect(within(bar()).getAllByRole("link").at(-1)).toBe(settings())
})

test("on a page the bar does not hold «Sozlamalar» is marked, and the bar stays", async () => {
  await signIn(ALI)
  setLocation("/services")
  renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  // None of the member's pages is marked: the page is past the bar.
  expect(within(bar()).getAllByRole("link").filter((link) => link !== settings() && link.getAttribute("aria-current"))).toEqual([])
  expect(settings()).toHaveAttribute("aria-current", "page")
  expect(lens()).toBe("4")
})

test("on a page of a hub the bar shows: the warehouse marked when the bar holds it, «Sozlamalar» on the settings' pages", async () => {
  db.members[ALI][0].tabBar = ["home", "warehouse"]
  await signIn(ALI)
  setLocation("/transfers")
  const first = renderWithProviders(<TabBar />)
  expect(await within(bar()).findByRole("link", { name: "Ombor" })).toHaveAttribute("aria-current", "page")
  first.unmount()

  setLocation("/settings/stages")
  renderWithProviders(<TabBar />)
  await within(bar()).findByRole("link", { name: "Ombor" })
  expect(settings()).toHaveAttribute("aria-current", "page")
})

test("inside a section (a record, a form, the profile) the bar steps away", async () => {
  await signIn(ALI)
  setLocation("/customers/7")
  const { container, queryClient } = renderWithProviders(<TabBar />)

  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  expect(screen.queryByRole("navigation", { name: "Bo'limlar" })).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="tab-bar"]')).toHaveAttribute("data-hidden", "true")
})

test("an employee with a role sees the sections the role lets them view", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Vazifalar" })).toBeInTheDocument()
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Vazifalar"])
})

test("the bar holds the member's own pages in their order, filled up to four from the default order", async () => {
  db.members[ALI][0].tabBar = ["purchases", "home", "money_transfers"]
  await signIn(ALI)
  setLocation("/money-transfers")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Xaridlar" })).toBeInTheDocument()
  expect(tabs()).toEqual([
    ["Xaridlar", "/purchases"],
    ["Bosh sahifa", "/"],
    ["O'tkazmalar", "/money-transfers"],
    ["Mijozlar", "/customers"],
  ])
  expect(within(bar()).getByRole("link", { name: "O'tkazmalar" })).toHaveAttribute("aria-current", "page")
  expect(lens()).toBe("2")
})

test("before the session is known the tab bar has the home alone", async () => {
  await signIn(ALI)
  renderWithProviders(<TabBar />)

  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa"])
  expect(await within(bar()).findByRole("link", { name: "Mahsulotlar" })).toBeInTheDocument()
})

test("a section from the bar is switched to at once: a move taken before it, which no page change came of yet, is dropped", async () => {
  await signIn(ALI)
  setLocation("/customers")
  const { user } = renderWithProviders(<TabBar />)

  const tasks = await within(bar()).findByRole("link", { name: "Vazifalar" })
  moveTo("forward")
  await user.click(tasks)
  expect(moved()).toBeUndefined()
})

test("«Sozlamalar» is switched to at once, as a page from the bar", async () => {
  await signIn(ALI)
  setLocation("/customers")
  const { user } = renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  moveTo("forward")
  await user.click(settings())
  expect(moved()).toBeUndefined()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

test("the bar is the prototype's clear liquid glass: no fill or blur of its own (its layers are the styles'), a soft shadow and a hairline round it; the lens likewise", async () => {
  await signIn(ALI)
  setLocation("/customers")
  renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  expect(bar()).toHaveAttribute("data-slot", "tab-bar")
  expect(bar()).toHaveClass("shadow-[0_12px_32px_rgba(40,30,80,.16),0_2px_4px_rgba(40,30,80,.08),0_0_0_.5px_var(--tb-line)]")
  expect(bar()).not.toHaveClass("bg-glass")
  expect(bar().className).not.toMatch(/backdrop-/)
  const glass = bar().querySelector('[data-slot="tab-lens"]')
  expect(glass).not.toHaveClass("bg-muted")
})
