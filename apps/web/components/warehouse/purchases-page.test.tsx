import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { PurchasesPage } from "./purchases-page"

const table = () => screen.findByRole("table", { name: "Xaridlar" })

test("the owner's purchases of the current location, the newest first, each by its number and supplier, with what it came to", async () => {
  const { purchase } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  const list = await table()
  expect(screen.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 1 ta")).toBeInTheDocument()
  const tabs = screen.getByRole("navigation", { name: "Ombor bo'limi" })
  expect(within(tabs).getByRole("link", { name: "Xaridlar" })).toHaveAttribute("aria-current", "page")
  expect(within(tabs).getByRole("link", { name: "Ta'minotchilar" })).toHaveAttribute("href", "/suppliers")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Xarid", "Jami, so'm", "To'langan, so'm", "Qo'shgan"])
  expect(within(list).getByRole("link", { name: /№ 1 · Bozor/ })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  const row = within(list).getByRole("link", { name: /№ 1 · Bozor/ }).closest("tr")!
  expect(within(row).getByText("01.10.2026 · 2 ta mahsulot")).toBeInTheDocument()
  expect(within(row).getByText("20 001,50")).toBeInTheDocument()
  expect(within(row).getByText("5 000")).toBeInTheDocument()
  expect(within(row).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xarid qo'shish" })).toHaveAttribute("href", "/purchases/new")
})

test("another location is another list: the purchases of Asosiy are not Chilonzor's", async () => {
  seedWarehouse(seedCatalog())
  const chilonzor = addLocation(1, "Chilonzor")
  localStorage.setItem(`location:1:${ALI}`, String(chilonzor.id))
  await signIn(ALI)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  expect(await screen.findByText("Hali xarid yo'q")).toBeInTheDocument()
  expect(screen.getByText("Chilonzor · 0 ta")).toBeInTheDocument()
  expect(screen.getByText("Birinchi xaridni «Xarid qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
})

test("a member with no location to work in is told so, and offered nothing to add", async () => {
  seedWarehouse(seedCatalog())
  restrictTo(VALI, 1, [])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi lokatsiya biriktirishi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Xarid qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test("adding takes the purchases, the suppliers and the products: a role without the suppliers offers no way", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Omborchi", ["purchases.view", "purchases.create", "products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  await table()
  expect(screen.queryByRole("link", { name: "Xarid qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("without the permission the page sends the member home; the page of the address is read", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases?page=2")
  renderWithProviders(<PurchasesPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  expect(asosiyOf(1)).toBeTruthy()
})
