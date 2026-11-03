import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test, vi } from "vitest"
import { formatDate } from "@/lib/format"
import { setMiniApp } from "@/lib/telegram"
import { ALI, db, nextId, seedOrders, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { enterCashOpening } from "@/test/finance"
import { choose } from "@/test/select"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { Dashboard } from "./dashboard"

// The home heads itself, as the prototype's title: the greeting is the
// page's heading; on a phone the company stands big, who is signed in, their
// role and the location under it. The way to the profile is the sidebar's
// and the settings page's.

// phoneLine is the phone's line under the company.
const phoneLine = (container: HTMLElement) => container.querySelector('[data-slot="home-head-phone"] p:last-child')

test("the home says who is signed in and where: the greeting, the company, the name, the role and the location", async () => {
  await signIn(ALI)
  const { container } = renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { level: 1, name: "Salom, Ali Valiyev" })).toBeInTheDocument()
  await waitFor(() => expect(phoneLine(container)).toHaveTextContent("Ali Valiyev · Egasi · Asosiy"))
  expect(container.querySelector('[data-slot="home-head"] a[href="/profile"]')).toBeNull()
})

test("without a name the greeting and the head use the phone number", async () => {
  db.users[ALI] = null
  await signIn(ALI)
  const { container } = renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { name: "Salom, +998 90 123 45 67" })).toBeInTheDocument()
  expect(phoneLine(container)).toHaveTextContent("+998 90 123 45 67 · Egasi")
})

test("an employee with a role sees the role's name in the head", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { container } = renderWithProviders(<Dashboard />)

  await waitFor(() => expect(phoneLine(container)).toHaveTextContent("Vali Aliyev · Kuzatuvchi"))
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

test("the home shows what the owner may see: what the cash holds, the tiles, the cards, the nearest deadlines", async () => {
  seedOrders()
  seedWarehouse()
  await signIn(ALI)
  const { container } = renderWithProviders(<Dashboard />)

  expect(await screen.findByText("Kassadagi pul")).toBeInTheDocument()
  expect(screen.getByRole("group", { name: "Tezkor amallar" })).toBeInTheDocument()
  expect(container.querySelector('[data-slot="stat-cards"]')).not.toBeNull()
  expect(screen.getByRole("link", { name: /^Faol buyurtmalar/ })).toHaveAttribute("href", "/orders")
  const deadlines = within(await screen.findByRole("list", { name: "Yaqin muddatlar" }))
  expect(deadlines.getAllByRole("link")[0]).toHaveAttribute("href", expect.stringMatching(/^\/orders\/\d+$/))
  expect(screen.queryByRole("heading", { name: "Umumiy holat" })).not.toBeInTheDocument()
})

test("an employee whose role sees the orders alone sees the orders of the current location, and switching it switches them", async () => {
  seedOrders()
  addLocation(1, "Chilonzor")
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<Dashboard />)

  const card = await screen.findByRole("link", { name: /^Faol buyurtmalar/ })
  await waitFor(() => expect(card.querySelector('[data-slot="stat-value"]')).toHaveTextContent("3"))
  expect(screen.queryByRole("group", { name: "Tezkor amallar" })).not.toBeInTheDocument()
  expect(screen.queryByText("Kassadagi pul")).not.toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Lokatsiya: Asosiy" }))
  await user.click(within(await screen.findByRole("dialog", { name: "Lokatsiya" })).getByRole("menuitemradio", { name: "Chilonzor" }))

  await waitFor(() => expect(screen.getByRole("link", { name: /^Faol buyurtmalar/ }).querySelector('[data-slot="stat-value"]')).toHaveTextContent("0"))
})

test("blocks that fail to load say why and can be asked for again; the head stays", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/dashboard", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Tarmoq xatosi")
  expect(screen.getByRole("heading", { level: 1, name: "Salom, Ali Valiyev" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByText("Kassadagi pul")).toBeInTheDocument()
})

test("with no order open the nearest deadlines offer to add one, right on the home", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Dashboard />)

  expect(await screen.findByText("Faol buyurtma yo'q")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Buyurtma qo'shish" }))

  expect(await screen.findByRole("dialog", { name: "Buyurtma qo'shish" })).toBeInTheDocument()
})

test("an expense entered from the home shows in what the cash holds at once", async () => {
  db.financeCategories.push({ id: nextId(), companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  await signIn(ALI)
  await enterCashOpening({ bank_account_id: db.accounts[1][0].id, amount: "100000", at: "2026-10-01T09:00:00+05:00" })
  const { user, container } = renderWithProviders(<Dashboard />)
  const hero = () => container.querySelector('[data-slot="hero"]') as HTMLElement
  await waitFor(() => expect(hero()).toHaveTextContent("100 000"))

  await user.click(screen.getByRole("button", { name: "Xarajat" }))
  const dialog = await screen.findByRole("dialog", { name: "Xarajat qo'shish" })
  await choose(user, within(dialog).getByLabelText("Kategoriya"), "Ijara")
  await user.type(within(dialog).getByLabelText("Summa"), "1500")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(hero()).toHaveTextContent("98 500"))
})
