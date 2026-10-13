import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { accessToken } from "@/lib/session"
import { setMiniApp } from "@/lib/telegram"
import { ALI, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { leave } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { ProfilePage } from "./profile-page"

test("the profile says who is signed in and the company they work in, with their role", async () => {
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Ali Valiyev" })).toBeInTheDocument()
  expect(screen.getByText("+998 90 123 45 67")).toBeInTheDocument()
  const company = screen.getByRole("list", { name: "Kompaniya" })
  expect(within(company).getByText("Olma Savdo")).toBeInTheDocument()
  expect(within(company).getByText("Egasi")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("href", "/")
})

test("the sections the bar does not hold are here, each a way in", async () => {
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  const sections = await screen.findByRole("list", { name: "Bo'limlar" })
  expect(within(sections).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Ombor", "/warehouse"],
    ["Moliya", "/accounts"],
    ["Xodimlar", "/employees"],
    ["Sozlamalar", "/settings"],
  ])
})

test("the order of the bar is a row away, with how many sections it holds", async () => {
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  expect(await screen.findByRole("link", { name: "Pastki menyu 5 ta bo'lim" })).toHaveAttribute("href", "/profile/menu")
})

test("someone with another company to work in can switch to it; with one there is nothing to switch to", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const first = renderWithProviders(<ProfilePage />)
  expect(await screen.findByRole("link", { name: "Kompaniyani almashtirish" })).toHaveAttribute("href", "/select-company")
  first.unmount()

  await signIn(ALI)
  renderWithProviders(<ProfilePage />)
  await screen.findByRole("heading", { level: 1, name: "Ali Valiyev" })
  expect(screen.queryByRole("link", { name: "Kompaniyani almashtirish" })).not.toBeInTheDocument()
})

test("with two locations the current one is chosen here too", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  await user.click(await screen.findByRole("button", { name: "Lokatsiya Asosiy" }))
  await user.click(within(await screen.findByRole("dialog", { name: "Lokatsiya" })).getByRole("menuitemradio", { name: "Chilonzor" }))

  expect(await screen.findByRole("button", { name: "Lokatsiya Chilonzor" })).toBeInTheDocument()
  expect(localStorage.getItem(`location:1:${ALI}`)).toBe(String(chilonzor.id))
})

test("the theme is chosen from a sheet", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  await user.click(await screen.findByRole("button", { name: /^Mavzu/ }))
  await user.click(within(await screen.findByRole("dialog", { name: "Mavzu" })).getByRole("menuitemradio", { name: "Qorong'i" }))

  await waitFor(() => expect(document.documentElement).toHaveClass("dark"))
})

test("signing out ends the session and leaves for /login", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  await user.click(await screen.findByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
})

test("inside Telegram there is no sign-out or theme: closing the Mini App is the way out", async () => {
  setMiniApp(fakeWebApp())
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  await screen.findByRole("heading", { level: 1, name: "Ali Valiyev" })
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^Mavzu/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Telegram ichida chiqish uchun ilovani yoping/)).toBeInTheDocument()
})

test("inside a Telegram that can, the profile offers the home screen too; put away, it goes", async () => {
  const webApp = fakeWebApp({
    isVersionAtLeast: vi.fn(() => true),
    addToHomeScreen: vi.fn(),
    checkHomeScreenStatus: vi.fn((callback: (status: "unsupported" | "unknown" | "added" | "missed") => void) => callback("missed")),
  })
  setMiniApp(webApp)
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  const card = await screen.findByRole("list", { name: "Bosh ekran" })
  expect(within(card).getByText("Hisob24'ni bir bosishda oching")).toBeInTheDocument()
  await user.click(within(card).getByRole("button", { name: "Qo'shish" }))
  expect(webApp.addToHomeScreen).toHaveBeenCalledTimes(1)
  await user.click(within(card).getByRole("button", { name: "Yashirish" }))
  expect(screen.queryByRole("list", { name: "Bosh ekran" })).not.toBeInTheDocument()
})
