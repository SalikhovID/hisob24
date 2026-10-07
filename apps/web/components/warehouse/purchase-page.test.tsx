import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { PurchasePage } from "./purchase-page"

// facts reads the "Ma'lumot" list: each name with its value (the lines'
// cards hold terms of their own).
const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

test("the purchase page: its facts, its lines summed, and the actions for whoever may edit and delete", async () => {
  const catalog = seedCatalog()
  const { bozor, purchase } = seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<PurchasePage id={purchase!.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xarid № 1" })).toBeInTheDocument()
  expect(screen.getByText("Bozor · 01.10.2026")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
  expect(screen.getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/purchases/${purchase!.id}/edit`)
  expect(screen.getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(facts()).toEqual({
    "Ta'minotchi": "Bozor",
    Sana: "01.10.2026",
    Lokatsiya: "Asosiy",
    Jami: "20 001,50 so'm",
    "To'langan": "5 000 so'm",
    Izoh: "Ertalab",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  expect(screen.getByRole("link", { name: "Bozor" })).toHaveAttribute("href", `/suppliers/${bozor.id}`)

  const lines = screen.getByRole("table", { name: "Qatorlar" })
  expect(within(lines).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Mahsulot", "Miqdor", "Narx, so'm", "Summa, so'm"])
  expect(within(lines).getByRole("link", { name: "Olma" })).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  const olma = within(lines).getByRole("link", { name: "Olma" }).closest("tr")!
  expect(within(olma).getByText("12,5 kg")).toBeInTheDocument()
  expect(within(olma).getByText("1 000")).toBeInTheDocument()
  expect(within(olma).getByText("12 500")).toBeInTheDocument()
  const nok = within(lines).getByRole("link", { name: "Nok" }).closest("tr")!
  expect(within(nok).getByText("3 dona")).toBeInTheDocument()
  expect(within(nok).getByText("2 500,50")).toBeInTheDocument()
  expect(within(nok).getByText("7 501,50")).toBeInTheDocument()
  expect(screen.getByText("Jami: 20 001,50")).toBeInTheDocument()
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

  await waitFor(() => expect(db.purchases.find((p) => p.id === purchase!.id)?.deleted).toBe(true))
  expect(db.stock.find((s) => s.productId === catalog.olma.id)?.quantity).toBe(0)
  expect(await screen.findByText("Xarid o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/purchases"))
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
