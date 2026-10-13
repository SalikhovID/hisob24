import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { enterTransfer } from "@/test/stock"
import { TransferPage } from "./transfer-page"
import { moved as pageMove } from "@/test/moves"

const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

// moved enters a transfer of 4 Olma from Asosiy to Chilonzor by Ali.
async function moved() {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  await signIn(ALI)
  const transfer = await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", note: "Filialga", items: [{ product_id: catalog.olma.id, quantity: "4" }] })
  return { catalog, asosiy, chilonzor, transfer }
}

test("the transfer page: its facts, its lines, and the actions for whoever may edit and delete", async () => {
  const { catalog, transfer } = await moved()
  renderWithProviders(<TransferPage id={transfer.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Ko'chirish № 1" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy → Chilonzor · 05.10.2026 09:00")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ko'chirishlar" })).toHaveAttribute("href", "/transfers")
  // What may be done with it are the tiles.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  expect(within(tiles).getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/transfers/${transfer.id}/edit`)
  expect(facts()).toEqual({
    Qayerdan: "Asosiy",
    Qayerga: "Chilonzor",
    Vaqt: "05.10.2026 09:00",
    Izoh: "Filialga",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  // The lines are rows that lead to their products, each with how much moved.
  const [olma] = within(screen.getByRole("list", { name: "Mahsulotlar" })).getAllByRole("link")
  expect(olma).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  expect(rowParts(olma)).toMatchObject({ title: "Olma", end: "4\u00a0kg" })
})

test("seen from its destination alone the transfer is read, not changed", async () => {
  const { chilonzor, transfer } = await moved()
  restrictTo(VALI, 1, [chilonzor])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TransferPage id={transfer.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Ko'chirish № 1" })).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Tahrirlash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "O'chirish" })).not.toBeInTheDocument()
})

test("deleting the transfer brings the products back to the source and leads to the list", async () => {
  const { catalog, asosiy, chilonzor, transfer } = await moved()
  const { user } = renderWithProviders(<TransferPage id={transfer.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Ko'chirishni o'chirasizmi?" })
  expect(within(dialog).getByText("№ 1 ko'chirishi o'chiriladi, tovar manbaga qaytadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === transfer.id)?.deleted).toBe(true))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(12.5)
  expect(stockOf(catalog.olma.id, [chilonzor])).toBe(0)
  expect(await screen.findByText("Ko'chirish o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/transfers"))
  expect(pageMove()).toBe("back")
})

test("a transfer that is gone, or between locations the member does not work in, is not found", async () => {
  const { transfer } = await moved()
  const qoyliq = addLocation(1, "Qo'yliq")
  restrictTo(VALI, 1, [qoyliq.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TransferPage id={transfer.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Ko'chirish topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ko'chirishlar" })).toHaveAttribute("href", "/transfers")
})
