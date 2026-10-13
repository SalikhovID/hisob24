import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { PurchasesPage } from "./purchases-page"

// The purchases are rows grouped by their day, the newest first.
const purchases = () => screen.findByRole("region", { name: "Xaridlar" })
// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("the owner's purchases of the current location, the newest first, each by its number and supplier, with what it came to", async () => {
  const { purchase } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  const list = await purchases()
  expect(screen.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 1 ta")).toBeInTheDocument()
  // The page leads back to the warehouse's hub, which lists its pages.
  expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(screen.queryByRole("navigation", { name: "Ombor bo'limi" })).not.toBeInTheDocument()
  // A day heads its purchases, with what they came to in so'm.
  const day = within(list).getByRole("list", { name: "1-oktabr, payshanba" })
  expect(within(list).getByRole("heading", { name: "1-oktabr, payshanba" }).parentElement).toHaveTextContent("20 001,50")
  const [row] = within(day).getAllByRole("link")
  expect(row).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(parts(row)).toEqual({ title: "№ 1 · Bozor", sub: "2 ta mahsulot · Ali V.", end: "20 001,50 so'm 5 000 to'langan" })
  expect(screen.getByText("Jami: 1")).toBeInTheDocument()
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
  expect(screen.queryByRole("region", { name: "Xaridlar" })).not.toBeInTheDocument()
})

test("adding takes the purchases, the suppliers and the products: a role without the suppliers offers no way", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Omborchi", ["purchases.view", "purchases.create", "products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases")
  renderWithProviders(<PurchasesPage />)

  await purchases()
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
