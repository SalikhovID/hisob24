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
const tabs = () => within(bar()).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])
const more = () => within(bar()).getByRole("button", { name: "Sozlama" })
// lens is the place of the glass under the current button, in buttons.
const lens = () => bar().style.getPropertyValue("--i")

test("the owner's bar is the default four pages, the page marked, and «Sozlama» last", async () => {
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
  expect(more()).toHaveAttribute("aria-haspopup", "dialog")
  expect(more()).toHaveAttribute("aria-expanded", "false")
  expect(more()).not.toHaveAttribute("aria-current")
  expect(within(bar()).getAllByRole("link").at(-1)?.compareDocumentPosition(more())).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

test("on a page the bar does not hold «Sozlama» is marked, and the bar stays", async () => {
  await signIn(ALI)
  setLocation("/services")
  renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  expect(within(bar()).getAllByRole("link").filter((link) => link.getAttribute("aria-current"))).toEqual([])
  expect(more()).toHaveAttribute("aria-current", "page")
  expect(lens()).toBe("4")
})

test("on a page of a hub the bar shows: the warehouse marked when the bar holds it, «Sozlama» on the settings' pages", async () => {
  db.members[ALI][0].tabBar = ["home", "warehouse"]
  await signIn(ALI)
  setLocation("/transfers")
  const first = renderWithProviders(<TabBar />)
  expect(await within(bar()).findByRole("link", { name: "Ombor" })).toHaveAttribute("aria-current", "page")
  first.unmount()

  setLocation("/settings/stages")
  renderWithProviders(<TabBar />)
  await within(bar()).findByRole("link", { name: "Ombor" })
  expect(more()).toHaveAttribute("aria-current", "page")
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

test("the bar holds the member's own pages in their order", async () => {
  db.members[ALI][0].tabBar = ["purchases", "home", "money_transfers"]
  await signIn(ALI)
  setLocation("/money-transfers")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Xaridlar" })).toBeInTheDocument()
  expect(tabs()).toEqual([
    ["Xaridlar", "/purchases"],
    ["Bosh sahifa", "/"],
    ["O'tkazmalar", "/money-transfers"],
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

test("«Sozlama» opens the menu of every page", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  const button = more()
  await user.click(button)
  expect(await screen.findByRole("dialog", { name: "Sozlama" })).toBeInTheDocument()
  expect(button).toHaveAttribute("aria-expanded", "true")
})

test("«Pastki panelni sozlash» leads from «Sozlama» to the bar's pages; what is saved stands in the bar at once", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  await user.click(more())
  const menu = await screen.findByRole("dialog", { name: "Sozlama" })
  await user.click(await within(menu).findByRole("button", { name: "Pastki panelni sozlash" }))
  const sheet = await screen.findByRole("dialog", { name: "Pastki panel" })
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sozlama" })).not.toBeInTheDocument())

  await user.click(await within(sheet).findByRole("button", { name: "Olib tashlash: Vazifalar" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pastki panel" })).not.toBeInTheDocument())
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Mijozlar", "Mahsulotlar"])
})
