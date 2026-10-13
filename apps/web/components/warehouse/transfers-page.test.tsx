import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterTransfer } from "@/test/stock"
import { TransfersPage } from "./transfers-page"

const table = () => screen.findByRole("table", { name: "Ko'chirishlar" })

test("the owner's transfers out of or into the current location, the newest first, each by its number and ends, with its direction", async () => {
  const { olma } = seedCatalog()
  seedWarehouse({ olma, nok: olma })
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  await signIn(ALI)
  const transfer = await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "4" }] })
  setLocation("/transfers")
  renderWithProviders(<TransfersPage />)

  const list = await table()
  expect(screen.getByRole("heading", { level: 1, name: "Ko'chirishlar" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 1 ta")).toBeInTheDocument()
  // The page leads back to the warehouse's hub, which lists its pages.
  expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(screen.queryByRole("navigation", { name: "Ombor bo'limi" })).not.toBeInTheDocument()
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Ko'chirish", "Yo'nalish", "Qo'shgan"])
  expect(within(list).getByRole("link", { name: /№ 1 · Asosiy → Chilonzor/ })).toHaveAttribute("href", `/transfers/${transfer.id}`)
  const row = within(list).getByRole("link", { name: /№ 1/ }).closest("tr")!
  expect(within(row).getByText("05.10.2026 09:00 · 1 ta mahsulot")).toBeInTheDocument()
  expect(within(row).getByText("Chiqim")).toBeInTheDocument()
  expect(within(row).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ko'chirish qo'shish" })).toHaveAttribute("href", "/transfers/new")
})

test("seen from the other end the same transfer is an arrival", async () => {
  const { olma } = seedCatalog()
  seedWarehouse({ olma, nok: olma })
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  localStorage.setItem(`location:1:${ALI}`, String(chilonzor))
  await signIn(ALI)
  await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: olma.id, quantity: "4" }] })
  setLocation("/transfers")
  renderWithProviders(<TransfersPage />)

  const list = await table()
  expect(screen.getByText("Chilonzor · 1 ta")).toBeInTheDocument()
  expect(within(list).getByText("Kirim")).toBeInTheDocument()
})

test("with one location there is nothing to move to: no way to add, and the empty list says so", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/transfers")
  renderWithProviders(<TransfersPage />)

  expect(await screen.findByText("Hali ko'chirish yo'q")).toBeInTheDocument()
  expect(screen.getByText("Ko'chirish uchun kamida ikkita lokatsiya kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Ko'chirish qo'shish" })).not.toBeInTheDocument()
})

test("a member with no location to work in is told so; one without the permission is sent home", async () => {
  db.cooldown = false
  seedWarehouse(seedCatalog())
  restrictTo(VALI, 1, [])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/transfers")
  const { unmount } = renderWithProviders(<TransfersPage />)
  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  unmount()

  restrictTo(VALI, 1, null)
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/transfers")
  renderWithProviders(<TransfersPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
