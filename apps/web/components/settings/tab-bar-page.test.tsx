import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TabBarPage } from "./tab-bar-page"

// names reads a list's pages by name, in their order.
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector('[data-slot="row-title"], [data-slot="preview-name"]')?.textContent)
const preview = () => screen.getByRole("list", { name: "Ko'rinishi" })
const pages = () => screen.getByRole("list", { name: "Paneldagi tugmalar" })
const rest = ["Xizmatlar", "Xaridlar", "Ko'chirishlar", "Inventarizatsiya", "Boshlang'ich qoldiq", "Ta'minotchilar", "Xarajatlar", "O'tkazmalar"]

test("the bar's editor shows the bar as it is: a picture of it with «Sozlamalar» locked at its end, then every page in the bar's order, the first four on the bar", async () => {
  await signIn(ALI)
  renderWithProviders(<TabBarPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Pastki panel" })).toBeInTheDocument()
  expect(await screen.findByText("4 ta tugmani o'zingizga moslang. Sozlamalar doim oxirida.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(names(preview())).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sozlamalar"])
  expect(screen.getByRole("heading", { level: 2, name: "Paneldagi tugmalar" })).toBeInTheDocument()
  expect(screen.getByText("4 / 4")).toBeInTheDocument()
  expect(names(pages())).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sotuv", "Ombor", "Kassa", "Xodimlar", ...rest])
  // The first four go off the bar with ✓, the rest come on with +; a line
  // of words stands between them.
  expect(within(pages()).getByRole("button", { name: "Paneldan olib tashlash: Mahsulotlar" })).toBeInTheDocument()
  expect(within(pages()).getByRole("button", { name: "Panelga qo'shish: Sotuv" })).toBeInTheDocument()
  expect(pages().querySelector('[data-slot="sortable-divider"]')).toHaveTextContent("Panelda emas · Sozlamalar sahifasida")
  expect(screen.getByText("Doim oxirida")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Standart holat" })).toBeDisabled()
  expect(screen.getByText(/Tutqichdan sudrab tartibini o'zgartiring/)).toBeInTheDocument()
})

test("✓ takes a page off the bar, the first page past it taking its place; + puts a page on the bar in its last one's place", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBarPage />)

  await user.click(await screen.findByRole("button", { name: "Paneldan olib tashlash: Buyurtmalar" }))
  expect(names(preview())).toEqual(["Bosh sahifa", "Mijozlar", "Sotuv", "Mahsulotlar", "Sozlamalar"])
  await user.click(screen.getByRole("button", { name: "Panelga qo'shish: Xaridlar" }))
  expect(names(preview())).toEqual(["Bosh sahifa", "Mijozlar", "Sotuv", "Xaridlar", "Sozlamalar"])
  expect(names(pages()).slice(0, 5)).toEqual(["Bosh sahifa", "Mijozlar", "Sotuv", "Xaridlar", "Buyurtmalar"])
  expect(screen.getByRole("button", { name: "Standart holat" })).toBeEnabled()
})

test("with no page past the bar to take its place a page stays on it, and the editor says so", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<TabBarPage />)

  expect(await screen.findByText("2 ta tugmani o'zingizga moslang. Sozlamalar doim oxirida.")).toBeInTheDocument()
  expect(screen.getByText("2 / 2")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Paneldan olib tashlash: Buyurtmalar" }))
  expect(await screen.findByText("Almashtirish uchun boshqa sahifa yo'q")).toBeInTheDocument()
  expect(names(preview())).toEqual(["Bosh sahifa", "Buyurtmalar", "Sozlamalar"])
})

test("«Saqlash» keeps the bar's four pages, says so and goes back to the settings", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBarPage />)

  await user.click(await screen.findByRole("button", { name: "Panelga qo'shish: Xaridlar" }))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Pastki panel saqlandi")).toBeInTheDocument()
  expect(db.members[ALI][0].tabBar).toEqual(["home", "customers", "orders", "purchases"])
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings"))
})

test("«Standart holat» puts the default bar back: kept so, no bar of the member's own is saved", async () => {
  db.members[ALI][0].tabBar = ["purchases", "home"]
  await signIn(ALI)
  let sent: unknown
  server.use(
    http.put("*/api/app/me/tab-bar", async ({ request }) => {
      sent = await request.json()
      return HttpResponse.json({ error: "stop" }, { status: 500 })
    }),
  )
  const { user } = renderWithProviders(<TabBarPage />)

  expect(await screen.findByRole("button", { name: "Paneldan olib tashlash: Xaridlar" })).toBeInTheDocument()
  expect(names(preview())).toEqual(["Xaridlar", "Bosh sahifa", "Mijozlar", "Buyurtmalar", "Sozlamalar"])
  await user.click(screen.getByRole("button", { name: "Standart holat" }))
  expect(names(preview())).toEqual(["Bosh sahifa", "Mijozlar", "Buyurtmalar", "Mahsulotlar", "Sozlamalar"])
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(sent).toEqual({ pages: null }))
})

test("a bar the API refuses says why, and the editor stays", async () => {
  await signIn(ALI)
  server.use(http.put("*/api/app/me/tab-bar", () => HttpResponse.json({ error: "validation_error", message: "Panelda ko'pi bilan 4 ta sahifa" }, { status: 400 })))
  const { user } = renderWithProviders(<TabBarPage />)

  await user.click(await screen.findByRole("button", { name: "Panelga qo'shish: Xaridlar" }))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Panelda ko'pi bilan 4 ta sahifa")).toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()
})
