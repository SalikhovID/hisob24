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
    .map((link) => link.textContent)

test("the owner sees every section, under the company's name", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Xodimlar" })).toHaveAttribute("href", "/employees")
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
  expect(within(sidebar()).getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("href", "/")
  expect(within(sidebar()).getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(within(sidebar()).getByText("Olma Savdo")).toBeInTheDocument()
})

test("an employee sees no section of the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByText("Olma Savdo")).toBeInTheDocument()
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya"])
})

test("the sidebar keeps the default order whatever the member's tab bar holds", async () => {
  db.members[ALI][0].tabBar = ["employees", "tasks"]
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  expect(sections()).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
})

test("an employee with a role sees the sections the role lets them view", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view", "settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Sozlamalar" })).toBeInTheDocument()
  expect(sections()).toEqual(["Bosh sahifa", "Vazifalar", "Sozlamalar"])
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


test("the sidebar ends with who is signed in: a way to the profile", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Ali Valiyev Egasi" })).toHaveAttribute("href", "/profile")
})

test("with two locations the sidebar holds the switch between them", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("button", { name: "Lokatsiya: Asosiy" })).toBeInTheDocument()
})

test("folded, the way to the profile is the avatar, named for screen readers", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props({ collapsed: true })} />)

  expect(await within(sidebar()).findByRole("link", { name: "Profil: Ali Valiyev" })).toHaveAttribute("href", "/profile")
})

test("a section from the sidebar is switched to at once: a move taken before it, which no page change came of yet, is dropped", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Sidebar {...props()} />)

  const tasks = await within(sidebar()).findByRole("link", { name: "Vazifalar" })
  moveTo("forward")
  await user.click(tasks)
  expect(moved()).toBeUndefined()
})

test("the sidebar is the prototype's floating card of frosted glass: 30px round, 264px wide (64 folded), 16px off the screen's edges", async () => {
  await signIn(ALI)
  const first = renderWithProviders(<Sidebar {...props()} />)

  expect(sidebar()).toHaveClass("surface", "rounded-[30px]", "w-[264px]")
  expect(sidebar()).not.toHaveClass("border-r-[0.5px]")
  expect(sidebar().parentElement).toHaveClass("hidden", "md:flex", "p-4")
  first.unmount()

  renderWithProviders(<Sidebar {...props({ collapsed: true })} />)
  expect(sidebar()).toHaveClass("w-16")
})

test("the sidebar keeps clear of what lies over the top of the screen itself, as the shell no longer does", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(sidebar().parentElement).toHaveClass("pt-safe-4")
})

test("the sidebar is headed by the brand mark before Hisob24's logo", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  const logo = await within(sidebar()).findByRole("img", { name: "Hisob24" })
  const mark = sidebar().querySelector('[data-slot="brand-mark"]')
  expect(mark).not.toBeNull()
  expect(mark!.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test("the current section is the glossy accent, the others the heading's ink; a section is 48px tall, 16px round", async () => {
  await signIn(ALI)
  setLocation("/employees")
  renderWithProviders(<Sidebar {...props()} />)

  const current = await within(sidebar()).findByRole("link", { name: "Xodimlar" })
  const other = within(sidebar()).getByRole("link", { name: "Vazifalar" })
  expect(current).toHaveClass("glossy", "min-h-12", "rounded-2xl")
  expect(current).not.toHaveClass("text-heading")
  expect(other).toHaveClass("text-heading", "hover:bg-muted")
  expect(other).not.toHaveClass("glossy")
})

test("who is signed in is a card at the sidebar's foot: the plain fill, 20px round", async () => {
  await signIn(ALI)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByRole("link", { name: "Ali Valiyev Egasi" })).toHaveClass("bg-muted", "rounded-[20px]")
})
