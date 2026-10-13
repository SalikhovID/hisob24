import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterInventory } from "@/test/stock"
import { InventoriesPage } from "./inventories-page"

test("the owner's inventories of the current location, the newest first, each by its number, moment and how many products", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const inventory = await enterInventory({ location_id: asosiy, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, counted: "10" }] })
  setLocation("/inventories")
  renderWithProviders(<InventoriesPage />)

  const list = await screen.findByRole("region", { name: "Inventarizatsiya" })
  expect(screen.getByRole("heading", { level: 1, name: "Inventarizatsiya" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 1 ta")).toBeInTheDocument()
  // The page leads back to the warehouse's hub, which lists its pages.
  expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(screen.queryByRole("navigation", { name: "Ombor bo'limi" })).not.toBeInTheDocument()
  // A count is a row under its day: its number, how many products and who counted.
  const [row] = within(within(list).getByRole("list", { name: "5-oktabr, dushanba" })).getAllByRole("link")
  expect(row).toHaveAttribute("href", `/inventories/${inventory.id}`)
  expect(rowParts(row)).toMatchObject({ title: "№ 1", sub: "1 ta mahsulot · Ali V." })
  expect(screen.getByText("Jami: 1")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Inventarizatsiya qo'shish" })).toHaveAttribute("href", "/inventories/new")
})

test("none yet; a member with no location is told so; one without the permission is sent home", async () => {
  db.cooldown = false
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/inventories")
  const { unmount } = renderWithProviders(<InventoriesPage />)
  expect(await screen.findByText("Hali inventarizatsiya yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi inventarizatsiyani «Inventarizatsiya qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
  unmount()

  restrictTo(VALI, 1, [])
  await signIn(VALI)
  await chooseCompany(1)
  const second = renderWithProviders(<InventoriesPage />)
  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Inventarizatsiya qo'shish" })).not.toBeInTheDocument()
  second.unmount()

  restrictTo(VALI, 1, null)
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/inventories")
  renderWithProviders(<InventoriesPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
