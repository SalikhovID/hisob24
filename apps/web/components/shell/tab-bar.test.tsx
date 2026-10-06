import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { TabBar } from "./tab-bar"

const bar = () => screen.getByRole("navigation", { name: "Bo'limlar" })
const tabs = () => within(bar()).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])

test("the tab bar is the sections the member may open, the page's one marked", async () => {
  await signIn(ALI)
  setLocation("/employees")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Xodimlar" })).toHaveAttribute("aria-current", "page")
  expect(tabs()).toEqual([
    ["Bosh sahifa", "/"],
    ["Mijozlar", "/customers"],
    ["Vazifalar", "/tasks"],
    ["Xodimlar", "/employees"],
    ["Sozlamalar", "/settings"],
  ])
  expect(within(bar()).getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current")
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
  expect(await within(bar()).findByRole("link", { name: "Xodimlar" })).toBeInTheDocument()
})
