import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { asosiyOf } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { enterOpeningStock } from "@/test/stock"
import { EditOpeningStockPage } from "./edit-opening-stock-page"
import { NewOpeningStockPage } from "./new-opening-stock-page"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })

test("an opening stock is entered into the current location like a purchase without a supplier: the products, their quantities and prices, summed", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/opening-stock/new")
  const { user } = renderWithProviders(<NewOpeningStockPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi boshlang'ich qoldiq" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Boshlang'ich qoldiq" })).toHaveAttribute("href", "/opening-stock")
  expect((screen.getByLabelText("Vaqt") as HTMLInputElement).value).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(screen.queryByRole("combobox", { name: "Ta'minotchi" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "To'lov qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("combobox", { name: "Valyuta" })).not.toBeInTheDocument()

  const first = line(1)
  await user.type(within(first).getByRole("combobox", { name: "Mahsulot" }), "n")
  await user.click(within(await screen.findByRole("listbox", { name: "Mahsulot takliflari" })).getByRole("option", { name: /Nok/ }))
  expect(within(first).getByLabelText("Narx")).toHaveValue("2500.50")
  await user.clear(within(first).getByLabelText("Narx"))
  await user.type(within(first).getByLabelText("Narx"), "2000")
  await user.type(within(first).getByLabelText("Miqdor"), "4")
  expect(screen.getByText("8 000 so'm")).toBeInTheDocument()
  await user.type(screen.getByLabelText("Izoh"), " Boshi ")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "opening_stock")).toBeTruthy())
  const saved = db.transactions.find((t) => t.kind === "opening_stock")!
  expect(saved).toMatchObject({ number: 1, locationId: asosiyOf(1).id, currencyId: 1, total: 8000, note: "Boshi" })
  expect(db.items.filter((i) => i.transactionId === saved.id).map((i) => [i.productId, i.quantity, i.price])).toEqual([[catalog.nok.id, 4, 2000]])
  expect(stockOf(catalog.nok.id, [asosiyOf(1).id])).toBe(7)
  expect(await screen.findByText("Boshlang'ich qoldiq qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/opening-stock/${saved.id}`))
})

test("with more than the so'm the currency and the rate are asked, and the total is in it; the form refuses in the API's words", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const at = "2026-10-02T05:00:00Z"
  db.products.push({ id: 802, companyId: 2, kind: "product", name: "Olma", unit: "kg", sku: null, price: null, currencyId: 1, note: null, active: true, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  setLocation("/opening-stock/new")
  const { user } = renderWithProviders(<NewOpeningStockPage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi boshlang'ich qoldiq" })

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await within(line(1)).findByText("Mahsulotni tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Miqdor noto'g'ri")).toBeInTheDocument()
  expect(within(line(1)).getByText("Narx noto'g'ri")).toBeInTheDocument()

  expect(screen.getByRole("combobox", { name: "Valyuta" })).toHaveTextContent("UZS — O'zbek so'mi")
  await choose(user, screen.getByRole("combobox", { name: "Valyuta" }), "USD — AQSH dollari")
  expect(await screen.findByLabelText("1 USD = ? so'm")).toHaveValue("12800")
  await user.type(within(line(1)).getByRole("combobox", { name: "Mahsulot" }), "ol")
  await user.click(within(await screen.findByRole("listbox", { name: "Mahsulot takliflari" })).getByRole("option", { name: /Olma/ }))
  await user.type(within(line(1)).getByLabelText("Miqdor"), "2")
  await user.type(within(line(1)).getByLabelText("Narx"), "25")
  expect(screen.getByText("50 $")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "opening_stock")).toBeTruthy())
  expect(db.transactions.find((t) => t.kind === "opening_stock")).toMatchObject({ companyId: 2, currencyId: 2, rateId: 9001, total: 50 })
})

test("editing: the document comes filled in, and is saved with another price", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const opening = await enterOpeningStock({ location_id: asosiy, at: "2026-09-30T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "2", price: "1000" }] })
  setLocation(`/opening-stock/${opening.id}/edit`)
  const { user } = renderWithProviders(<EditOpeningStockPage id={opening.id} />)

  expect(await screen.findByText("№ 1 · Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Boshlang'ich qoldiqni tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Boshlang'ich qoldiq № 1" })).toHaveAttribute("href", `/opening-stock/${opening.id}`)
  expect(screen.getByLabelText("Vaqt")).toHaveValue("2026-09-30T09:00")
  expect(within(line(1)).getByText("Olma")).toBeInTheDocument()
  expect(within(line(1)).getByLabelText("Miqdor")).toHaveValue("2.000")
  expect(within(line(1)).getByLabelText("Narx")).toHaveValue("1000.00")
  await user.clear(within(line(1)).getByLabelText("Narx"))
  await user.type(within(line(1)).getByLabelText("Narx"), "1100")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)?.total).toBe(2200))
  expect(await screen.findByText("Boshlang'ich qoldiq saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/opening-stock/${opening.id}`))
})
