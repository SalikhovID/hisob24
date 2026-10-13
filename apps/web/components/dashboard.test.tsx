import { act, screen, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { formatDate } from "@/lib/format"
import { setMiniApp } from "@/lib/telegram"
import { ALI, db, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { Dashboard } from "./dashboard"

// The home heads itself, as the prototype's: who is signed in and where is
// the way to the profile; the greeting is the page's heading for a screen
// reader.

test("the home says who is signed in and where: the company, the short name and the role, the way to the profile", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { level: 1, name: "Salom, Ali Valiyev" })).toHaveClass("sr-only")
  expect(screen.getByRole("link", { name: "Olma Savdo Ali V. · Egasi" })).toHaveAttribute("href", "/profile")
})

test("without a name the greeting and the head use the phone number", async () => {
  db.users[ALI] = null
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { name: "Salom, +998 90 123 45 67" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Olma Savdo +998 90 123 45 67 · Egasi" })).toBeInTheDocument()
})

test("an employee with a role sees the role's name in the head", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("link", { name: "Olma Savdo Vali A. · Kuzatuvchi" })).toBeInTheDocument()
})

test("the sections the bar does not hold are a row away each", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  const sections = await screen.findByRole("list", { name: "Bo'limlar" })
  expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/warehouse", "/accounts", "/employees", "/settings"])
})

test("the subscription's end is said at the foot", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  const endDate = db.companies.find((company) => company.id === 1)!.end_date
  expect(await screen.findByText(`Obuna ${formatDate(endDate)} gacha faol`)).toBeInTheDocument()
})

test("with two locations the head holds the switch between them", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("button", { name: "Lokatsiya: Asosiy" })).toBeInTheDocument()
})

test("inside Telegram (Bot API 8.0) the home offers to add the app to the home screen; put away, it stays away", async () => {
  const webApp = fakeWebApp({
    isVersionAtLeast: vi.fn(() => true),
    addToHomeScreen: vi.fn(),
    checkHomeScreenStatus: vi.fn((callback: (status: "unsupported" | "unknown" | "added" | "missed") => void) => callback("missed")),
  })
  setMiniApp(webApp)
  await signIn(ALI)
  const { user, unmount } = renderWithProviders(<Dashboard />)

  await user.click(await screen.findByRole("button", { name: /Hisob24'ni bosh ekranga qo'shing/ }))
  expect(webApp.addToHomeScreen).toHaveBeenCalledTimes(1)
  // Once added, Telegram says so and the offer goes.
  act(() => webApp.fire("homeScreenAdded"))
  expect(screen.queryByRole("button", { name: /bosh ekranga qo'shing/ })).not.toBeInTheDocument()
  unmount()

  webApp.checkHomeScreenStatus = vi.fn((callback: (status: "unsupported" | "unknown" | "added" | "missed") => void) => callback("missed"))
  const again = renderWithProviders(<Dashboard />)
  await again.user.click(await screen.findByRole("button", { name: "Yopish" }))
  expect(screen.queryByRole("button", { name: /bosh ekranga qo'shing/ })).not.toBeInTheDocument()
  again.unmount()
  renderWithProviders(<Dashboard />)
  await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })
  expect(screen.queryByRole("button", { name: /bosh ekranga qo'shing/ })).not.toBeInTheDocument()
})

test("in a browser, or where the app is on the home screen already, there is no offer", async () => {
  await signIn(ALI)
  const browser = renderWithProviders(<Dashboard />)
  await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })
  expect(screen.queryByRole("button", { name: /bosh ekranga qo'shing/ })).not.toBeInTheDocument()
  browser.unmount()

  setMiniApp(fakeWebApp({ isVersionAtLeast: vi.fn(() => true), addToHomeScreen: vi.fn(), checkHomeScreenStatus: vi.fn((callback) => callback("added")) }))
  renderWithProviders(<Dashboard />)
  await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })
  expect(screen.queryByRole("button", { name: /bosh ekranga qo'shing/ })).not.toBeInTheDocument()
})
