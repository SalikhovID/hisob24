import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { accessToken } from "@/lib/session"
import { setMiniApp } from "@/lib/telegram"
import { ALI, db, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { leave } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { ProfilePage } from "./profile-page"

test("the profile is the prototype's: «Profil», who is signed in (their name, phone and role), the company and till when its subscription runs", async () => {
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Profil" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Ali Valiyev" })).toBeInTheDocument()
  expect(screen.getByText("+998 90 123 45 67 · Egasi")).toBeInTheDocument()
  const company = screen.getByRole("group", { name: "Kompaniya" })
  expect(within(company).getByText("Olma Savdo")).toBeInTheDocument()
  expect(within(company).getByText(/^.+ gacha faol$/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlama" })).toHaveAttribute("href", "/settings")
})

test("the profile holds no sections and no way to the bar's pages: they are the settings page's", async () => {
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  await screen.findByRole("heading", { level: 1, name: "Profil" })
  expect(screen.queryByRole("list", { name: "Bo'limlar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /Pastki menyu/ })).not.toBeInTheDocument()
})

test("someone with another company to work in can switch to it; with one there is nothing to switch to", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const first = renderWithProviders(<ProfilePage />)
  expect(await screen.findByRole("link", { name: "Kompaniyani almashtirish" })).toHaveAttribute("href", "/select-company")
  first.unmount()

  await signIn(ALI)
  renderWithProviders(<ProfilePage />)
  await screen.findByRole("heading", { level: 1, name: "Profil" })
  expect(screen.queryByRole("link", { name: "Kompaniyani almashtirish" })).not.toBeInTheDocument()
})

test("with two locations the current one is chosen from the list of them, as the prototype's radios", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  const list = await screen.findByRole("radiogroup", { name: "Lokatsiya" })
  expect(within(list).getByRole("radio", { name: "Asosiy" })).toHaveAttribute("aria-checked", "true")
  await user.click(within(list).getByRole("radio", { name: "Chilonzor" }))

  await waitFor(() => expect(within(list).getByRole("radio", { name: "Chilonzor" })).toHaveAttribute("aria-checked", "true"))
  expect(localStorage.getItem(`location:1:${ALI}`)).toBe(String(chilonzor.id))
})

test("the theme is one of the three, side by side: Tizim, Yorug', Qorong'i", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  const themes = await screen.findByRole("tablist", { name: "Mavzu" })
  expect(within(themes).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Tizim", "Yorug'", "Qorong'i"])
  await user.click(within(themes).getByRole("tab", { name: "Qorong'i" }))

  await waitFor(() => expect(document.documentElement).toHaveClass("dark"))
})

test("signing out ends the session and leaves for /login", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ProfilePage />)

  await user.click(await screen.findByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
})

test("inside Telegram there is no sign-out or theme: the Mini App signs in by the Telegram account itself", async () => {
  setMiniApp(fakeWebApp())
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  await screen.findByRole("heading", { level: 1, name: "Profil" })
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("tablist", { name: "Mavzu" })).not.toBeInTheDocument()
  expect(screen.getByText("Mini App'da chiqish yo'q: Telegram akkauntingiz bilan avtomatik kirasiz.")).toBeInTheDocument()
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

test("a subscription that runs into another year says the year on the profile too", async () => {
  db.companies.find((company) => company.id === 1)!.end_date = `${new Date().getFullYear() + 1}-12-31`
  await signIn(ALI)
  renderWithProviders(<ProfilePage />)

  expect(await screen.findByText(`${new Date().getFullYear() + 1}-yil 31-dekabr gacha faol`)).toBeInTheDocument()
})
