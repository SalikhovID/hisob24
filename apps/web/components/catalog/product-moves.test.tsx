import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse } from "@/mocks/data"
import { addLocation, asosiyOf } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { signIn } from "@/test/session"
import { enterTransfer } from "@/test/stock"
import { pricedOrder } from "@/test/order-money"
import { ProductMoves } from "./product-moves"

// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("a product's moves: every document that moved it, the newest first, with where, with whom and how much, in or out", async () => {
  const catalog = seedCatalog()
  const { purchase } = seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  await signIn(ALI)
  const transfer = await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4" }] })
  renderWithProviders(<ProductMoves companyId={1} productId={catalog.olma.id} unit="kg" />)

  const moves = await screen.findByRole("list", { name: "Harakatlar" })
  expect(screen.getByRole("heading", { level: 2, name: "Harakatlar" })).toBeInTheDocument()
  // Each move is a row that leads to its document: the moment, the location
  // (with two or more), the counterpart under it; how much, in or out, at its end.
  const rows = within(moves).getAllByRole("link")
  expect(rows.map(parts)).toEqual([
    { title: "Ko'chirish № 1", sub: "05.10.2026 09:00 · Chilonzor · Asosiy", end: "+4 kg" },
    { title: "Ko'chirish № 1", sub: "05.10.2026 09:00 · Asosiy · Chilonzor", end: "−4 kg" },
    { title: "Xarid № 1", sub: "01.10.2026 09:00 · Asosiy · Bozor", end: "+12,5 kg" },
  ])
  expect(rows[0]).toHaveAttribute("href", `/transfers/${transfer.id}`)
  expect(rows[2]).toHaveAttribute("href", `/purchases/${purchase!.id}`)
})

test("a product never moved says so", async () => {
  const { nok } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductMoves companyId={1} productId={nok.id} unit="dona" />)
  expect(await screen.findByText("Bu mahsulot hali harakat qilmagan")).toBeInTheDocument()
})

test("an order that took the product is named by its title, with the customer, and leads to the order", async () => {
  await signIn(ALI)
  const { order, olma } = await pricedOrder()
  renderWithProviders(<ProductMoves companyId={1} productId={olma.id} unit="kg" />)

  const moves = await screen.findByRole("list", { name: "Harakatlar" })
  const [taken] = within(moves).getAllByRole("link")
  expect(parts(taken)).toMatchObject({ title: "Buyurtma · Montaj", end: "−2 kg" })
  expect(parts(taken).sub).toContain("Dilshod Karimov")
  expect(taken).toHaveAttribute("href", `/orders/${order.id}`)
})

