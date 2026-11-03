import { screen, waitFor, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { expect, test, vi } from "vitest"
import { moveTo } from "@/lib/moves"
import { ALI, db, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { addLocation } from "@/test/locations"
import { moved } from "@/test/moves"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { Sidebar, type SidebarProps } from "./sidebar"

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

const props = (overrides: Partial<SidebarProps> = {}): SidebarProps => ({
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  ...overrides,
})

const sidebar = () => screen.getByRole("complementary", { name: "Menyu" })
const sections = (within_: HTMLElement = sidebar()) =>
  within(within(within_).getByRole("navigation", { name: "Bo'limlar" }))
    .getAllByRole("link")
    .filter((link) => link.dataset.slot === "side-item")
    .map((link) => link.textContent)

test("the owner sees every section, under the company's name", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Xodimlar" })).toHaveAttribute("href", "/employees")
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
  expect(within(sidebar()).getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("href", "/")
  expect(within(sidebar()).getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(within(sidebar()).getByText("Olma Savdo")).toBeInTheDocument()
})

test("an employee sees no section of the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByText("Olma Savdo")).toBeInTheDocument()
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya"])
})

test("the sidebar keeps the default order whatever the member's tab bar holds", async () => {
  db.members[ALI][0].tabBar = ["employees", "orders"]
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
})

test("an employee with a role sees the sections the role lets them view", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view", "settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Sozlamalar" })).toBeInTheDocument()
  expect(sections()).toEqual(["Bosh sahifa", "Buyurtmalar", "Sozlamalar"])
})

test("the section the page belongs to is marked", async () => {
  await signIn(ALI)
  setLocation("/employees")
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Xodimlar" })).toHaveAttribute("aria-current", "page")
  expect(within(sidebar()).getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current")
})

test("the fold button asks to fold the sidebar", async () => {
  await signIn(ALI)
  const onToggleCollapsed = vi.fn()
  const { user } = renderWithProviders(<Sidebar {...props({ onToggleCollapsed })} />)

  await user.click(within(sidebar()).getByRole("button", { name: "Menyuni yig'ish" }))

  expect(onToggleCollapsed).toHaveBeenCalledOnce()
})

test("folded, the sidebar shows icons that keep their names, and a button to unfold", async () => {
  await signIn(ALI)
  const onToggleCollapsed = vi.fn()
  const { user } = renderWithProviders(<Sidebar {...props({ collapsed: true, onToggleCollapsed })} />)

  const employees = await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  expect(employees).toHaveTextContent("")
  expect(within(sidebar()).queryByText("Olma Savdo")).not.toBeInTheDocument()
  expect(within(sidebar()).queryByRole("button", { name: "Menyuni yig'ish" })).not.toBeInTheDocument()

  await user.click(within(sidebar()).getByRole("button", { name: "Menyuni yoyish" }))
  expect(onToggleCollapsed).toHaveBeenCalledOnce()
})

test("the sidebar is headed by Hisob24's logo, the company's name after it", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  const name = await within(sidebar()).findByText("Olma Savdo")
  const logo = within(sidebar()).getByRole("img", { name: "Hisob24" })
  expect(logo.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test("with no company chosen yet the sidebar shows the logo alone: the name is not said twice", async () => {
  await signIn(VALI)
  const { queryClient } = renderWithProviders(<Sidebar {...props()} />)
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))

  expect(within(sidebar()).getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
  expect(within(sidebar()).queryByText("Hisob24")).not.toBeInTheDocument()
})

test("folded, the sidebar is headed by the logo's mark, inside the button that unfolds it", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props({ collapsed: true })} />)
  await within(sidebar()).findByRole("link", { name: "Xodimlar" })

  const unfold = within(sidebar()).getByRole("button", { name: "Menyuni yoyish" })
  expect(unfold.querySelector('[data-slot="logo-mark"]')).not.toBeNull()
  expect(within(sidebar()).queryByRole("img", { name: "Hisob24" })).not.toBeInTheDocument()
})


test("under the brand the company stands with who is signed in and their role: a way to the profile", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Olma Savdo Ali Valiyev · Egasi" })).toHaveAttribute("href", "/profile")
})

test("the location switch is the top bar's: the sidebar holds none", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  expect(within(sidebar()).queryByRole("button", { name: /^Lokatsiya/ })).not.toBeInTheDocument()
})

test("folded, the way to the profile is the avatar, named for screen readers", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props({ collapsed: true })} />)

  expect(await within(sidebar()).findByRole("link", { name: "Profil: Ali Valiyev" })).toHaveAttribute("href", "/profile")
})

test("a section from the sidebar is switched to at once: a move taken before it, which no page change came of yet, is dropped", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Sidebar {...props()} />)

  const orders = await within(sidebar()).findByRole("link", { name: "Buyurtmalar" })
  moveTo("forward")
  await user.click(orders)
  expect(moved()).toBeUndefined()
})

test("the sidebar is the prototype's pane at the screen's left edge: 224px (64 folded), the pale grey, a hairline at its right", async () => {
  await signIn(ALI)
  const first = renderWithProviders(<Sidebar {...props()} />)

  expect(sidebar()).toHaveClass("w-[224px]", "bg-sidebar", "border-r", "border-border")
  expect(sidebar().parentElement).toHaveClass("hidden", "md:flex")
  first.unmount()

  renderWithProviders(<Sidebar {...props({ collapsed: true })} />)
  expect(sidebar()).toHaveClass("w-16")
})

test("the sidebar keeps clear of what lies over the top of the screen itself", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(sidebar()).toHaveClass("pt-safe-3.5")
})

test("the sidebar is headed by the brand mark before Hisob24's logo", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  const logo = await within(sidebar()).findByRole("img", { name: "Hisob24" })
  const mark = sidebar().querySelector('[data-slot="brand-mark"]')
  expect(mark).not.toBeNull()
  expect(mark!.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test("a section is the prototype's 32px row; the current one stands white and ringed, its icon in the accent", async () => {
  await signIn(ALI)
  setLocation("/employees")
  renderWithProviders(<Sidebar {...props()} />)

  const current = await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  const other = within(sidebar()).getByRole("link", { name: "Buyurtmalar" })
  expect(current).toHaveClass("h-8", "rounded-lg", "bg-card", "shadow-[var(--card-shadow),0_0_0_1px_var(--border)]", "[&_svg]:text-primary")
  expect(other).toHaveClass("h-8", "hover:bg-ink-1", "[&_svg]:text-icon")
  expect(other).not.toHaveClass("bg-card")
})

test("the current section with pages of its own lists them under it, the page's one in the accent's tint", async () => {
  await signIn(ALI)
  setLocation("/services")
  renderWithProviders(<Sidebar {...props()} />)

  const nav = within(await within(sidebar()).findByRole("navigation", { name: "Bo'limlar" }))
  const services = await nav.findByRole("link", { name: "Xizmatlar" })
  expect(services).toHaveAttribute("href", "/services")
  expect(services).toHaveAttribute("aria-current", "page")
  expect(services).toHaveClass("bg-primary-soft", "text-accent-text")
  expect(nav.getByRole("link", { name: "Mahsulotlar", current: false })).toHaveAttribute("data-slot", "side-subitem")
  // Another section's pages stay folded.
  expect(nav.queryByRole("link", { name: "Kassa" })).not.toBeInTheDocument()
})

test("at its foot the sidebar says till when the subscription runs and offers the way out, which asks first", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByText(/^Obuna .+ gacha faol$/)).toBeInTheDocument()
  await user.click(within(sidebar()).getByRole("button", { name: "Chiqish" }))
  expect(await screen.findByRole("alertdialog", { name: "Tizimdan chiqasizmi?" })).toBeInTheDocument()
})

test("a subscription that runs into another year says the year, or it would read as this one's", async () => {
  db.companies.find((company) => company.id === 1)!.end_date = `${new Date().getFullYear() + 1}-12-31`
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByText(`Obuna ${new Date().getFullYear() + 1}-yil 31-dekabr gacha faol`)).toBeInTheDocument()
})
