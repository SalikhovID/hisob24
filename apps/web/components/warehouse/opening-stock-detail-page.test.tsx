import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { enterOpeningStock } from "@/test/stock"
import { OpeningStockDetailPage } from "./opening-stock-detail-page"

const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

// opened enters the opening stock of Asosiy by Ali: 2 Olma at 1 000.
async function opened() {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const opening = await enterOpeningStock({ location_id: asosiy, at: "2026-09-30T09:00:00+05:00", note: "Boshi", items: [{ product_id: catalog.olma.id, quantity: "2", price: "1000" }] })
  return { catalog, asosiy, opening }
}

test("the opening stock page: its facts, its lines summed, and the actions for whoever may edit and delete", async () => {
  const { catalog, opening } = await opened()
  renderWithProviders(<OpeningStockDetailPage id={opening.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Boshlang'ich qoldiq № 1" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 30.09.2026 09:00")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Boshlang'ich qoldiq" })).toHaveAttribute("href", "/opening-stock")
  // What may be done with it are the tiles.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  expect(within(tiles).getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/opening-stock/${opening.id}/edit`)
  expect(facts()).toEqual({
    Lokatsiya: "Asosiy",
    Vaqt: "30.09.2026 09:00",
    // textContent keeps formatAmount's no-break space between the thousands.
    Jami: "2\u00a0000 so'm",
    Izoh: "Boshi",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  // The lines are rows that lead to their products: how much at what price, and the sum.
  const [olma] = within(screen.getByRole("list", { name: "Mahsulotlar" })).getAllByRole("link")
  expect(olma).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  const plain = (text: string | null) => text?.replace(/\s+/g, " ")
  expect(plain(rowParts(olma).sub)).toBe("2 kg × 1 000")
  expect(plain(rowParts(olma).end)).toBe("2 000")
  expect(screen.getByText("Jami: 2 000 so'm")).toBeInTheDocument()
})

test("in another currency the page says the currency and its rate, and what it comes to in so'm", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const at = "2026-10-02T05:00:00Z"
  db.products.push({ id: 802, companyId: 2, kind: "product", name: "Olma", unit: "kg", sku: null, price: null, currencyId: 1, note: null, active: true, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  const asosiy = db.locations.find((l) => l.companyId === 2 && l.name === "Asosiy")!.id
  const opening = await enterOpeningStock({ location_id: asosiy, at: "2026-10-05T09:00:00+05:00", currency_id: 2, items: [{ product_id: 802, quantity: "2", price: "25" }] })
  renderWithProviders(<OpeningStockDetailPage id={opening.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Boshlang'ich qoldiq № 1" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Valyuta: "USD · 1 USD = 12\u00a0800 so'm", Jami: "50 $", "So'mda": "640\u00a0000 so'm" })
  expect(screen.getByText("Jami: 50 $")).toBeInTheDocument()
})

test("deleting the opening stock takes its products out of the stock and leads to the list", async () => {
  const { catalog, asosiy, opening } = await opened()
  const { user } = renderWithProviders(<OpeningStockDetailPage id={opening.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Boshlang'ich qoldiqni o'chirasizmi?" })
  expect(within(dialog).getByText("№ 1 hujjati o'chiriladi, qoldiq olinadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)?.deleted).toBe(true))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(12.5)
  expect(await screen.findByText("Boshlang'ich qoldiq o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/opening-stock", { transitionTypes: ["nav-back"] }))
})

test("an opening stock that is gone, or of a location the member does not work in, is not found", async () => {
  const { opening } = await opened()
  const qoyliq = addLocation(1, "Qo'yliq")
  restrictTo(VALI, 1, [qoyliq.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<OpeningStockDetailPage id={opening.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Hujjat topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Boshlang'ich qoldiq" })).toHaveAttribute("href", "/opening-stock")
})
