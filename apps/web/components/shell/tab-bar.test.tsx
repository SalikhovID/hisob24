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

test("the owner's bar is the home and the first four sections, the page's section marked; the rest are the profile's", async () => {
  await signIn(ALI)
  setLocation("/customers")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Sotuv" })).toBeInTheDocument()
  expect(tabs()).toEqual([
    ["Bosh sahifa", "/"],
    ["Mijozlar", "/customers"],
    ["Vazifalar", "/tasks"],
    ["Mahsulotlar", "/products"],
    ["Sotuv", "/sales"],
  ])
  expect(within(bar()).getByRole("link", { name: "Mijozlar" })).toHaveAttribute("aria-current", "page")
  expect(within(bar()).getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current")
  expect(within(bar()).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()
})

test("a segmented section's tabs are its page: on the services the products are marked", async () => {
  await signIn(ALI)
  setLocation("/services")
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("aria-current", "page")
})

test("on a section the bar does not hold no tab is marked, and the bar stays", async () => {
  await signIn(ALI)
  setLocation("/employees")
  renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Sotuv" })
  expect(within(bar()).getAllByRole("link").filter((link) => link.getAttribute("aria-current"))).toEqual([])
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

test("the bar follows the member's own order, the home first", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  renderWithProviders(<TabBar />)

  expect(await within(bar()).findByRole("link", { name: "Sozlamalar" })).toBeInTheDocument()
  expect(tabs().map(([label]) => label)).toEqual(["Bosh sahifa", "Sozlamalar", "Vazifalar", "Mijozlar", "Mahsulotlar"])
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
