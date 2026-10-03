import { screen, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { Sidebar, type SidebarProps } from "./sidebar"

const props = (overrides: Partial<SidebarProps> = {}): SidebarProps => ({
  open: false,
  onOpenChange: vi.fn(),
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
  expect(sections()).toEqual(["Bosh sahifa", "Xodimlar"])
  expect(within(sidebar()).getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("href", "/")
  expect(within(sidebar()).getByText("Olma Savdo")).toBeInTheDocument()
})

test("an employee sees no section of the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Sidebar {...props()} />)

  expect(await within(sidebar()).findByText("Olma Savdo")).toBeInTheDocument()
  expect(sections()).toEqual(["Bosh sahifa"])
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
