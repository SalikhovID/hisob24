import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { TabBar } from "./tab-bar"

const bar = () => screen.getByRole("navigation", { name: "Bo'limlar" })
const tabs = () => within(bar()).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])

test("the owner's bar is the first four sections and «Yana», which holds the rest; the page's section is marked where it is", async () => {
  await signIn(ALI)
  setLocation("/employees")
  const { user } = renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("button", { name: "Yana" })).toHaveAttribute("aria-current", "page")
  expect(tabs()).toEqual([
    ["Bosh sahifa", "/"],
    ["Mijozlar", "/customers"],
    ["Vazifalar", "/tasks"],
    ["Mahsulotlar", "/products"],
  ])
  expect(within(bar()).getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current")

  await user.click(within(bar()).getByRole("button", { name: "Yana" }))
  const sheet = await screen.findByRole("dialog", { name: "Yana" })
  expect(within(sheet).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Ombor", "/purchases"],
    ["Xodimlar", "/employees"],
    ["Sozlamalar", "/settings"],
  ])
  expect(within(sheet).getByRole("link", { name: "Xodimlar" })).toHaveAttribute("aria-current", "page")
  expect(within(sheet).getByRole("link", { name: "Ombor" })).not.toHaveAttribute("aria-current")
  expect(within(sheet).getByRole("button", { name: "Menyuni sozlash" })).toBeInTheDocument()
})

test("«Menyuni sozlash» in «Yana» opens the dialog that sets the order", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBar />)

  await user.click(await within(bar()).findByRole("button", { name: "Yana" }))
  await user.click(within(await screen.findByRole("dialog", { name: "Yana" })).getByRole("button", { name: "Menyuni sozlash" }))

  expect(await screen.findByRole("dialog", { name: "Menyuni sozlash" })).toBeInTheDocument()
  expect(screen.queryByRole("dialog", { name: "Yana" })).not.toBeInTheDocument()
})

test("an employee without a role has five sections: all in the bar, no «Yana»", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/purchases")
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor"])
  expect(within(bar()).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()
})

test("the bar follows the member's own order", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Sozlamalar" })).toBeInTheDocument()
  expect(tabs().map(([label]) => label)).toEqual(["Sozlamalar", "Vazifalar", "Bosh sahifa", "Mijozlar"])
})

test("an employee with a role sees the sections the role lets them view", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Vazifalar" })).toBeInTheDocument()
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Vazifalar"])
})

test("before the session is known the tab bar has the home alone", async () => {
  await signIn(ALI)
  renderWithProviders(<TabBar />)

  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa"])
  expect(await within(bar()).findByRole("link", { name: "Mahsulotlar" })).toBeInTheDocument()
})
