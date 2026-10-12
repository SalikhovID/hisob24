import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { enterInventory } from "@/test/stock"
import { InventoryPage } from "./inventory-page"

const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

// counted enters a count of Asosiy by Ali: 10 Olma where 12.5 were expected.
async function counted() {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const inventory = await enterInventory({ location_id: asosiy, at: "2026-10-05T09:00:00+05:00", note: "Oylik", items: [{ product_id: catalog.olma.id, counted: "10" }] })
  return { catalog, asosiy, inventory }
}

test("the inventory page: its facts and its lines with what was expected, counted and the difference", async () => {
  const { catalog, inventory } = await counted()
  renderWithProviders(<InventoryPage id={inventory.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Inventarizatsiya № 1" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 05.10.2026 09:00")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Inventarizatsiya" })).toHaveAttribute("href", "/inventories")
  expect(screen.getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/inventories/${inventory.id}/edit`)
  expect(screen.getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(facts()).toEqual({
    Lokatsiya: "Asosiy",
    Vaqt: "05.10.2026 09:00",
    Izoh: "Oylik",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  const lines = screen.getByRole("table", { name: "Qatorlar" })
  expect(within(lines).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Mahsulot", "Tizim", "Sanalgan", "Farq"])
  const row = within(lines).getByRole("link", { name: "Olma" }).closest("tr")!
  expect(within(lines).getByRole("link", { name: "Olma" })).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  // getByText folds the no-break space before the unit into a plain one.
  expect(within(row).getByText("12,5 kg")).toBeInTheDocument()
  expect(within(row).getByText("10 kg")).toBeInTheDocument()
  expect(within(row).getByText("-2,5 kg")).toBeInTheDocument()
})

test("deleting the inventory takes its differences out of the stock and leads to the list", async () => {
  const { catalog, asosiy, inventory } = await counted()
  const { user } = renderWithProviders(<InventoryPage id={inventory.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Inventarizatsiyani o'chirasizmi?" })
  expect(within(dialog).getByText("№ 1 inventarizatsiyasi o'chiriladi, farqlari qoldiqdan olinadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === inventory.id)?.deleted).toBe(true))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(12.5)
  expect(await screen.findByText("Inventarizatsiya o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/inventories"))
})

test("an inventory that is gone, or of a location the member does not work in, is not found", async () => {
  const { inventory } = await counted()
  const qoyliq = addLocation(1, "Qo'yliq")
  restrictTo(VALI, 1, [qoyliq.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<InventoryPage id={inventory.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Inventarizatsiya topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Inventarizatsiya" })).toHaveAttribute("href", "/inventories")
})
