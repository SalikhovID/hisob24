import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { formatQuantity } from "@/lib/format"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { asosiyOf } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { enterInventory } from "@/test/stock"
import { momentIn, pickDay } from "@/test/moment"
import { EditInventoryPage } from "./edit-inventory-page"
import { NewInventoryPage } from "./new-inventory-page"
import { moved } from "@/test/moves"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })
// expected and difference read a line's figures by their names.
const figure = (row: HTMLElement, name: string) => within(row).getByText(name).nextElementSibling?.textContent

test("a count of the current location: every product in stock added at once with its expected stock, the count typed, the difference shown, then saved", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/inventories/new")
  const { user } = renderWithProviders(<NewInventoryPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi inventarizatsiya" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Inventarizatsiya" })).toHaveAttribute("href", "/inventories")
  expect(momentIn(document.body)).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(line(1)).toHaveAttribute("data-slot", "line-card")
  expect(screen.getByRole("button", { name: "Saqlash" }).closest("[data-slot=main-bar]")).not.toBeNull()

  await user.click(screen.getByRole("button", { name: "Hammasini qo'shish" }))
  await waitFor(() => expect(screen.getByRole("group", { name: "2-qator" })).toBeInTheDocument())
  expect(screen.queryByRole("group", { name: "3-qator" })).not.toBeInTheDocument()
  const nok = line(1)
  expect(within(nok).getByText("Nok")).toBeInTheDocument()
  expect(figure(nok, "Tizim")).toBe(formatQuantity("3.000", "dona"))
  expect(within(nok).getByLabelText("Sanalgan")).toHaveValue("3.000")
  expect(figure(nok, "Farq")).toBe(formatQuantity("0", "dona"))
  const olma = line(2)
  expect(within(olma).getByText("Olma")).toBeInTheDocument()
  expect(figure(olma, "Tizim")).toBe(formatQuantity("12.500", "kg"))
  await user.clear(within(olma).getByLabelText("Sanalgan"))
  await user.type(within(olma).getByLabelText("Sanalgan"), "11")
  expect(figure(olma, "Farq")).toBe(`−${formatQuantity("1.5", "kg")}`)
  await user.type(screen.getByLabelText("Izoh"), " Oylik ")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "inventory")).toBeTruthy())
  const saved = db.transactions.find((t) => t.kind === "inventory")!
  expect(saved).toMatchObject({ number: 1, locationId: asosiyOf(1).id, note: "Oylik" })
  expect(db.items.filter((i) => i.transactionId === saved.id).map((i) => [i.productId, i.expected, i.quantity])).toEqual([
    [catalog.nok.id, 3, 3],
    [catalog.olma.id, 12.5, 11],
  ])
  expect(stockOf(catalog.olma.id, [asosiyOf(1).id])).toBe(11)
  expect(await screen.findByText("Inventarizatsiya qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/inventories/${saved.id}`))
  expect(moved()).toBe("forward")
})

test("a product picked by name shows the stock expected at the moment, which follows the moment typed; the form refuses in the API's words; a lone line is not taken away", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/inventories/new")
  const { user } = renderWithProviders(<NewInventoryPage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi inventarizatsiya" })

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await within(line(1)).findByText("Mahsulotni tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Sanalganni kiriting")).toBeInTheDocument()

  await pick(user, line(1), "Mahsulot", "ol", /Olma/)
  await waitFor(() => expect(figure(line(1), "Tizim")).toBe(formatQuantity("12.500", "kg")))
  // Dated before the purchase, nothing was expected.
  await pickDay(user, document.body, "2026-09-30")
  await waitFor(() => expect(figure(line(1), "Tizim")).toBe(formatQuantity("0", "kg")))

  // A lone line is not taken away.
  expect(screen.queryByRole("button", { name: "1-qatorni olib tashlash" })).not.toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "inventory")).toHaveLength(0)
})

test("editing: the count comes filled in with what the journal expects without it, and is saved with another count", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const inventory = await enterInventory({ location_id: asosiy, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, counted: "10" }] })
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(10)
  setLocation(`/inventories/${inventory.id}/edit`)
  const { user } = renderWithProviders(<EditInventoryPage id={inventory.id} />)

  expect(await screen.findByText("№ 1 · Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Inventarizatsiyani tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Inventarizatsiya № 1" })).toHaveAttribute("href", `/inventories/${inventory.id}`)
  expect(momentIn(document.body)).toBe("2026-10-05T09:00")
  expect(within(line(1)).getByText("Olma")).toBeInTheDocument()
  await waitFor(() => expect(figure(line(1), "Tizim")).toBe(formatQuantity("12.500", "kg")))
  expect(within(line(1)).getByLabelText("Sanalgan")).toHaveValue("10.000")
  await user.clear(within(line(1)).getByLabelText("Sanalgan"))
  await user.type(within(line(1)).getByLabelText("Sanalgan"), "9")
  expect(figure(line(1), "Farq")).toBe(`−${formatQuantity("3.5", "kg")}`)
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.items.find((i) => i.transactionId === inventory.id)?.quantity).toBe(9))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(9)
  expect(await screen.findByText("Inventarizatsiya saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/inventories/${inventory.id}`))
  expect(moved()).toBe("back")
})

test("a counted line is the prototype's card of frosted glass, 24px round", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/inventories/new")
  renderWithProviders(<NewInventoryPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi inventarizatsiya" })).toBeInTheDocument()
  expect(line(1)).toHaveClass("surface", "rounded-[24px]")
  expect(line(1)).not.toHaveClass("bg-card")
})
