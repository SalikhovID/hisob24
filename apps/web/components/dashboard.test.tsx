import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test, vi } from "vitest"
import { formatDate } from "@/lib/format"
import { setMiniApp } from "@/lib/telegram"
import { ALI, db, seedCatalog, seedOrders, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { press } from "@/test/keypad"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
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
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("link", { name: "Olma Savdo Vali A. · Kuzatuvchi" })).toBeInTheDocument()
})

test("the home lists no sections: the pages the bar does not hold are the settings page's", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByText(/Obuna .* gacha faol/)).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Bo'limlar" })).not.toBeInTheDocument()
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

test("the home shows what the owner may see: what the suppliers are owed, the tiles, the overview, the nearest deadlines", async () => {
  seedOrders()
  seedWarehouse()
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("link", { name: /^Ta'minotchilarga qarz/ })).toBeInTheDocument()
  expect(screen.getByRole("group", { name: "Tezkor amallar" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Umumiy holat" })).toBeInTheDocument()
  expect(await screen.findByRole("link", { name: /^Hisob-faktura/ })).toHaveAttribute("href", expect.stringMatching(/^\/orders\/\d+$/))
})

test("an employee whose role sees the orders alone is headed by the orders of the current location, and switching it switches them", async () => {
  seedOrders()
  addLocation(1, "Chilonzor")
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<Dashboard />)

  const hero = await screen.findByRole("link", { name: /^Faol vazifalar/ })
  await waitFor(() => expect(hero).toHaveTextContent("3 ta"))
  expect(hero).toHaveTextContent("Asosiy")
  expect(screen.queryByRole("group", { name: "Tezkor amallar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /^Ta'minotchilarga qarz/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Lokatsiya: Asosiy" }))
  await user.click(within(await screen.findByRole("dialog", { name: "Lokatsiya" })).getByRole("menuitemradio", { name: "Chilonzor" }))

  await waitFor(() => expect(screen.getByRole("link", { name: /^Faol vazifalar/ })).toHaveTextContent("0 ta"))
  expect(screen.getByRole("link", { name: /^Faol vazifalar/ })).toHaveTextContent("Chilonzor")
})

test("blocks that fail to load say why and can be asked for again; the head stays", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/dashboard", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Tarmoq xatosi")
  expect(screen.getByRole("link", { name: "Olma Savdo Ali V. · Egasi" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("link", { name: /^Ta'minotchilarga qarz/ })).toBeInTheDocument()
})

test("with no order open the nearest deadlines offer to add one, right on the home", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Dashboard />)

  expect(await screen.findByText("Faol vazifa yo'q")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Vazifa qo'shish" }))

  expect(await screen.findByRole("dialog", { name: "Vazifa qo'shish" })).toBeInTheDocument()
})

test("a payment entered from the home shows in what the suppliers are owed at once", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Omborchi", ["purchases.view", "purchases.create", "suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<Dashboard />)
  const hero = await screen.findByRole("link", { name: /^Ta'minotchilarga qarz/ })
  expect(hero).toHaveTextContent("15 001,50 so'm")

  await user.click(screen.getByRole("button", { name: "To'lov" }))
  await user.click(await within(await screen.findByRole("dialog", { name: "Ta'minotchi" })).findByRole("option", { name: /Bozor/ }))
  const payment = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await press(user, payment, "1001,5")
  await user.click(within(payment).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.getByRole("link", { name: /^Ta'minotchilarga qarz/ })).toHaveTextContent("14 000 so'm"))
})

test("on a wide screen the home's head is the location alone, at the right: the way to the profile is the sidebar's", async () => {
  await signIn(ALI)
  const { container } = renderWithProviders(<Dashboard />)

  const head = await waitFor(() => {
    const found = container.querySelector('[data-slot="home-head"]')
    expect(found).not.toBeNull()
    return found as HTMLElement
  })
  expect(head).toHaveClass("md:justify-end")
  expect(head.querySelector('a[href="/profile"]')).toHaveClass("md:hidden")
})
