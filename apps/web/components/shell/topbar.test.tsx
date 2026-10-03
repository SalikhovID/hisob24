import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { accessToken } from "@/lib/session"
import { setMiniApp } from "@/lib/telegram"
import { ALI, SARDOR, VALI } from "@/mocks/data"
import { leave } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { Topbar } from "./topbar"

test("the menu button asks for the sections, and the profile menu says who is signed in", async () => {
  await signIn(ALI)
  const onMenuClick = vi.fn()
  const { user } = renderWithProviders(<Topbar onMenuClick={onMenuClick} />)

  await user.click(screen.getByRole("button", { name: "Menyu" }))
  expect(onMenuClick).toHaveBeenCalledOnce()

  await user.click(screen.getByRole("button", { name: "Profil" }))
  const menu = await screen.findByRole("menu")
  expect(await within(menu).findByText("Ali Valiyev")).toBeInTheDocument()
  expect(within(menu).getByText("+998 90 123 45 67")).toBeInTheDocument()
})

test("signing out from the profile menu ends the session and leaves for /login", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Topbar onMenuClick={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "Profil" }))
  await user.click(await screen.findByRole("menuitem", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
})

test("someone with another company to work in can switch to it from the profile menu", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<Topbar onMenuClick={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "Profil" }))

  expect(await screen.findByRole("menuitem", { name: "Kompaniyani almashtirish" })).toHaveAttribute("href", "/select-company")
})

test.each([
  ["one company", ALI, null],
  ["the others expired or blocked", SARDOR, 1],
])("with %s the profile menu offers no switch", async (_, phone, company) => {
  await signIn(phone)
  if (company !== null) await chooseCompany(company)
  const { user } = renderWithProviders(<Topbar onMenuClick={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "Profil" }))

  expect(await screen.findByRole("menuitem", { name: "Chiqish" })).toBeInTheDocument()
  await within(screen.getByRole("menu")).findByText(/\+998/)
  expect(screen.queryByRole("menuitem", { name: "Kompaniyani almashtirish" })).not.toBeInTheDocument()
})

test("the theme button switches between light and dark", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Topbar onMenuClick={vi.fn()} />)
  const toggle = screen.getByRole("button", { name: "Mavzuni almashtirish" })

  await user.click(toggle)
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"))
  await user.click(toggle)
  await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"))
})

test("inside Telegram there is no sign-out or theme button: closing the Mini App is the way out", async () => {
  setMiniApp(fakeWebApp())
  await signIn(ALI)
  const { user } = renderWithProviders(<Topbar onMenuClick={vi.fn()} />)

  expect(screen.queryByRole("button", { name: "Mavzuni almashtirish" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Profil" }))
  expect(await within(await screen.findByRole("menu")).findByText("Ali Valiyev")).toBeInTheDocument()
  expect(screen.queryByRole("menuitem", { name: "Chiqish" })).not.toBeInTheDocument()
})
