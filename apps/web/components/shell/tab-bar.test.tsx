import { act, screen, waitFor, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, expect, test, vi } from "vitest"
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
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
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

test("the bar is the prototype's frosted pill: its own shadow (its frost is the styles'), the names grey and the current one in the text's ink", async () => {
  await signIn(ALI)
  setLocation("/customers")
  renderWithProviders(<TabBar />)

  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  expect(bar()).toHaveAttribute("data-slot", "tab-bar")
  expect(bar()).toHaveClass("shadow-(--tb-shadow)")
  expect(bar().className).not.toMatch(/backdrop-/)
  const current = within(bar()).getByRole("link", { name: "Mijozlar" })
  const other = within(bar()).getByRole("link", { name: "Vazifalar" })
  expect(current).toHaveClass("text-foreground", "font-semibold")
  expect(other).toHaveClass("text-muted-foreground", "font-medium")
  expect(other).not.toHaveClass("text-foreground")
  // The marks are 25px, the current one drawn bolder; the names 11px.
  expect(other).toHaveClass("text-[11px]", "[&_svg]:size-[25px]", "aria-[current=page]:[&_svg]:stroke-[2.2]")
})

// layout stands in for the browser's layout, which jsdom lacks: each button
// of the bar is button wide, and each name as wide as names says at full
// size (any other 40px), narrower in proportion to the names' scale.
function layout(size: { button: number; names: Record<string, number> }) {
  const scale = (el: Element) => Number(el.closest("nav")?.style.getPropertyValue("--name-k") || "1")
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const name = this instanceof HTMLElement && this.dataset.slot === "tab-name"
    const width = this.tagName === "A" ? size.button : name ? (size.names[this.textContent ?? ""] ?? 40) * scale(this) : 0
    return { x: 0, y: 0, top: 0, left: 0, width, height: 0, right: width, bottom: 0, toJSON: () => ({}) }
  })
  return size
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// The default bar's names as wide as Geist sets them at 11px, the current one bolder.
const NAMES = { "Bosh sahifa": 62, Mijozlar: 41, Vazifalar: 45, Mahsulotlar: 62, Sozlamalar: 58 }
const names = () => [...bar().querySelectorAll<HTMLElement>('[data-slot="tab-name"]')]
const nameScale = () => Number(bar().style.getPropertyValue("--name-k"))

test("the names keep 4px clear of their buttons' edges: on a bar too narrow for them they are all set a little smaller, together; a roomy bar keeps them at 11px", async () => {
  await signIn(ALI)
  setLocation("/customers")
  // A 320px phone's buttons are 59px: 51px for a name, and the widest is 62px.
  const size = layout({ button: 59, names: NAMES })
  const first = renderWithProviders(<TabBar />)
  await within(bar()).findByRole("link", { name: "Mahsulotlar" })

  await waitFor(() => expect(nameScale()).toBeCloseTo(51 / 62, 3))
  expect(names()).toHaveLength(5)
  for (const name of names()) expect(name.style.fontSize).toBe("calc(11px * var(--name-k))")
  first.unmount()

  size.button = 72
  renderWithProviders(<TabBar />)
  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  await waitFor(() => expect(nameScale()).toBe(1))
})

test("the names are set no smaller than 9px: there a name may take its button's whole width, and one longer still ends in an ellipsis", async () => {
  db.members[ALI][0].tabBar = ["inventories", "home", "customers", "orders"]
  await signIn(ALI)
  setLocation("/customers")
  layout({ button: 59, names: { ...NAMES, Inventarizatsiya: 86 } })
  renderWithProviders(<TabBar />)
  const long = await within(bar()).findByRole("link", { name: "Inventarizatsiya" })

  await waitFor(() => expect(nameScale()).toBeCloseTo(9 / 11, 3))
  expect(long.querySelector('[data-slot="tab-name"]')).toHaveClass("max-w-full", "truncate")
})

// Observed stands in for the browser's ResizeObserver: the test tells it
// when the bar changed.
class Observed {
  static last: Observed
  constructor(readonly report: ResizeObserverCallback) {
    Observed.last = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  resized() {
    act(() => this.report([], this as unknown as ResizeObserver))
  }
}

test("the names are fitted again when the bar's width changes: a phone turned, a window made narrower", async () => {
  vi.stubGlobal("ResizeObserver", Observed)
  await signIn(ALI)
  setLocation("/customers")
  const size = layout({ button: 72, names: NAMES })
  renderWithProviders(<TabBar />)
  await within(bar()).findByRole("link", { name: "Mahsulotlar" })
  await waitFor(() => expect(nameScale()).toBe(1))

  size.button = 59
  Observed.last.resized()
  expect(nameScale()).toBeCloseTo(51 / 62, 3)
})

