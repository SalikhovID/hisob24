import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { addLocation, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { PurchasePage } from "./purchase-page"
import { moved } from "@/test/moves"

// facts reads the "Ma'lumot" list: each name with its value (the lines'
// cards hold terms of their own).
const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}
const read = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim()

test("the purchase page: its figure, its lines summed, its payments, its facts, and the tiles for whoever may edit and delete", async () => {
  const catalog = seedCatalog()
  const { bozor, purchase } = seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<PurchasePage id={purchase!.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xarid № 1" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
  // The purchase opens with its total, what is left to pay, the supplier and the moment.
  expect(read(document.querySelector("[data-slot=hero]"))).toBe("Xarid № 1 20 001,50 so'm Qoldi 15 001,50 Bozor · 01.10.2026 09:00")
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Tahrirlash", "Ta'minotchi", "O'chirish"])
  expect(within(tiles).getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/purchases/${purchase!.id}/edit`)
  expect(within(tiles).getByRole("link", { name: "Ta'minotchi" })).toHaveAttribute("href", `/suppliers/${bozor.id}`)
  expect(facts()).toEqual({
    "Ta'minotchi": "Bozor",
    Vaqt: "01.10.2026 09:00",
    Lokatsiya: "Asosiy",
    Jami: "20 001,50 so'm",
    "To'langan": "5 000 so'm",
    Izoh: "Ertalab",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  expect(screen.getByRole("link", { name: "Bozor" })).toHaveAttribute("href", `/suppliers/${bozor.id}`)

  // The lines are rows that lead to their products: how much at what price, and the sum.
  const lines = within(screen.getByRole("list", { name: "Mahsulotlar" })).getAllByRole("link")
  expect(lines.map(parts)).toEqual([
    { title: "Olma", sub: "12,5 kg × 1 000", end: "12 500" },
    { title: "Nok", sub: "3 dona × 2 500,50", end: "7 501,50" },
  ])
  expect(lines[0]).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  expect(screen.getByText("Jami: 20 001,50 so'm")).toBeInTheDocument()
  const [payment] = within(screen.getByRole("list", { name: "To'lovlar" })).getAllByRole("listitem")
  expect(parts(payment.firstElementChild as HTMLElement)).toEqual({ title: "Naqd", sub: null, end: "5 000 so'm" })
})

test("with one location the location is not said; whoever may see alone has no action", async () => {
  const { purchase } = seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Kuzatuvchi", ["purchases.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<PurchasePage id={purchase!.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xarid № 1" })).toBeInTheDocument()
  expect(facts()).not.toHaveProperty("Lokatsiya")
  expect(screen.queryByRole("link", { name: "Tahrirlash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "O'chirish" })).not.toBeInTheDocument()
  // The supplier's tile takes the suppliers' permission.
  expect(screen.queryByRole("link", { name: "Ta'minotchi" })).not.toBeInTheDocument()
})

test("deleting the purchase gives the stock back and leads to the list", async () => {
  const catalog = seedCatalog()
  const { purchase } = seedWarehouse(catalog)
  await signIn(ALI)
  const { user } = renderWithProviders(<PurchasePage id={purchase!.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Xaridni o'chirasizmi?" })
  expect(within(dialog).getByText("№ 1 xaridi o'chiriladi, qoldiq qaytariladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === purchase!.id)?.deleted).toBe(true))
  expect(stockOf(catalog.olma.id, [db.locations.find((l) => l.companyId === 1)!.id])).toBe(0)
  expect(await screen.findByText("Xarid o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/purchases"))
  expect(moved()).toBe("back")
})

test("a purchase that is gone, or outside the member's locations, is not found", async () => {
  const { purchase } = seedWarehouse(seedCatalog())
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<PurchasePage id={purchase!.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xarid topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
})
