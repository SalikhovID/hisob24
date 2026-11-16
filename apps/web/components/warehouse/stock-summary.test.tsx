import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { StockSummary } from "./stock-summary"

test("the «Qoldiq» table: a product a row by name, its category, its stock in each location of the member's, the sum and its value at the last purchase price", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  db.productCategories.push({ id: 7001, companyId: 1, name: "Mevalar", position: 1 })
  catalog.olma.categoryId = 7001
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<StockSummary companyId={1} />)

  const table = await screen.findByRole("table", { name: "Qoldiq" })
  await waitFor(() => expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Mahsulot", "Kategoriya", "Asosiy", "Chilonzor", "Jami", "Qiymati"]))
  const row = within(table).getAllByRole("row").find((r) => within(r).queryByText("Olma"))!
  const cells = within(row).getAllByRole("cell")
  expect(cells[0]).toHaveTextContent("OL-1")
  expect(cells[1]).toHaveTextContent("Mevalar")
  expect(cells[2]).toHaveTextContent("12,5 kg")
  expect(cells[3]).toHaveTextContent("0 kg")
  expect(cells[4]).toHaveTextContent("12,5 kg")
  expect(cells[5]).toHaveTextContent("12 500 so'm")
  const eski = within(table).getAllByRole("row").find((r) => within(r).queryByText("Eski mahsulot"))!
  expect(within(eski).getByText("Nofaol")).toBeInTheDocument()
  expect(within(eski).getAllByRole("cell")[1]).toHaveTextContent("—")
  expect(within(eski).getAllByRole("cell")[5]).toHaveTextContent("—")
})

test("on a phone each product is a row: the stock by location under its name, the current location's at its right", async () => {
  seedWarehouse(seedCatalog())
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<StockSummary companyId={1} />)

  const list = await screen.findByRole("list", { name: "Qoldiq" })
  const olma = await within(list).findByText("Olma")
  const row = olma.closest("li") as HTMLElement
  expect(row).toHaveTextContent("Asosiy 12,5 · Chilonzor 0")
  expect(row).toHaveTextContent("12,5 kg")
})

test("a search narrows the table by the name or the SKU", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<StockSummary companyId={1} />)
  await screen.findByRole("table", { name: "Qoldiq" })

  await user.type(screen.getByRole("searchbox"), "ol-1")

  await waitFor(() =>
    expect(within(screen.getByRole("table", { name: "Qoldiq" })).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      expect.stringContaining("Olma"),
    ]),
  )
})
