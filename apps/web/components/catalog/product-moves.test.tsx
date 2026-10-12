import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse } from "@/mocks/data"
import { addLocation, asosiyOf } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { enterTransfer } from "@/test/stock"
import { ProductMoves } from "./product-moves"

test("a product's moves: every document that moved it, the newest first, with where, with whom and how much, in or out", async () => {
  const catalog = seedCatalog()
  const { purchase } = seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  await signIn(ALI)
  const transfer = await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4" }] })
  renderWithProviders(<ProductMoves companyId={1} productId={catalog.olma.id} unit="kg" />)

  const moves = await screen.findByRole("table", { name: "Harakatlar" })
  expect(screen.getByRole("heading", { level: 2, name: "Harakatlar" })).toBeInTheDocument()
  expect(within(moves).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Vaqt", "Lokatsiya", "Kontragent", "Miqdor"])
  const rows = within(moves).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(3)
  expect(within(rows[0]).getByRole("link", { name: "Ko'chirish № 1" })).toHaveAttribute("href", `/transfers/${transfer.id}`)
  expect(within(rows[0]).getByText("05.10.2026 09:00")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Chilonzor")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Asosiy")).toBeInTheDocument()
  expect(within(rows[0]).getByText("+4 kg")).toBeInTheDocument()
  expect(within(rows[1]).getByText("−4 kg")).toBeInTheDocument()
  expect(within(rows[1]).getByText("Chilonzor")).toBeInTheDocument()
  expect(within(rows[2]).getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(within(rows[2]).getByText("Bozor")).toBeInTheDocument()
  expect(within(rows[2]).getByText("+12,5 kg")).toBeInTheDocument()
})

test("a product never moved says so", async () => {
  const { nok } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductMoves companyId={1} productId={nok.id} unit="dona" />)
  expect(await screen.findByText("Bu mahsulot hali harakat qilmagan")).toBeInTheDocument()
})
