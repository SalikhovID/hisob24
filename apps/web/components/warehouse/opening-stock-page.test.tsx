import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterOpeningStock } from "@/test/stock"
import { OpeningStockPage } from "./opening-stock-page"

test("the owner's opening stock of the current location, the newest first, each by its number, moment, how many products and what it came to", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const opening = await enterOpeningStock({ location_id: asosiy, at: "2026-09-30T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "12.5", price: "1000" }] })
  setLocation("/opening-stock")
  renderWithProviders(<OpeningStockPage />)

  const list = await screen.findByRole("table", { name: "Boshlang'ich qoldiq" })
  expect(screen.getByRole("heading", { level: 1, name: "Boshlang'ich qoldiq" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 1 ta")).toBeInTheDocument()
  // The page leads back to the warehouse's hub, which lists its pages.
  expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(screen.queryByRole("navigation", { name: "Ombor bo'limi" })).not.toBeInTheDocument()
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Jami", "Qo'shgan"])
  expect(within(list).getByRole("link", { name: /№ 1/ })).toHaveAttribute("href", `/opening-stock/${opening.id}`)
  const row = within(list).getByRole("link", { name: /№ 1/ }).closest("tr")!
  expect(within(row).getByText("30.09.2026 09:00 · 1 ta mahsulot")).toBeInTheDocument()
  expect(within(row).getByText("12 500 so'm")).toBeInTheDocument()
  expect(within(row).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Boshlang'ich qoldiq qo'shish" })).toHaveAttribute("href", "/opening-stock/new")
})

test("none yet; a member with no location is told so; one without the permission is sent home", async () => {
  db.cooldown = false
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/opening-stock")
  const { unmount } = renderWithProviders(<OpeningStockPage />)
  expect(await screen.findByText("Hali boshlang'ich qoldiq yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchisini «Boshlang'ich qoldiq qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
  unmount()

  restrictTo(VALI, 1, [])
  await signIn(VALI)
  await chooseCompany(1)
  const second = renderWithProviders(<OpeningStockPage />)
  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  second.unmount()

  restrictTo(VALI, 1, null)
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/opening-stock")
  renderWithProviders(<OpeningStockPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
