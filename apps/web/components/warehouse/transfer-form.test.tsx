import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { addLocation, asosiyOf } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { choose, optionsOf } from "@/test/select"
import { signIn } from "@/test/session"
import { enterTransfer } from "@/test/stock"
import { momentIn } from "@/test/moment"
import { EditTransferPage } from "./edit-transfer-page"
import { NewTransferPage } from "./new-transfer-page"
import { moved } from "@/test/moves"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })

test("a transfer is entered out of the current location: the other location chosen, the products found by name, no prices", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  const qoyliq = addLocation(1, "Qo'yliq")
  await signIn(ALI)
  setLocation("/transfers/new")
  const { user } = renderWithProviders(<NewTransferPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi ko'chirish" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ko'chirishlar" })).toHaveAttribute("href", "/transfers")
  expect(momentIn(document.body)).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  const to = screen.getByLabelText("Qayerga")
  expect(await optionsOf(user, to)).toEqual(["Chilonzor", "Qo'yliq"])
  await choose(user, to, "Qo'yliq")

  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).queryByLabelText("Narx")).not.toBeInTheDocument()
  await user.type(within(first).getByLabelText("Miqdor"), "4,5")
  expect(within(first).getByText("kg")).toBeInTheDocument()
  await user.type(screen.getByLabelText("Izoh"), " Filialga ")
  expect(screen.getByRole("button", { name: "Saqlash" }).closest("[data-slot=main-bar]")).not.toBeNull()
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "transfer")).toBeTruthy())
  const saved = db.transactions.find((t) => t.kind === "transfer")!
  expect(saved).toMatchObject({ number: 1, locationId: asosiyOf(1).id, toLocationId: qoyliq.id, note: "Filialga" })
  expect(db.items.filter((i) => i.transactionId === saved.id).map((i) => [i.productId, i.quantity, i.price])).toEqual([[catalog.olma.id, 4.5, null]])
  expect(await screen.findByText("Ko'chirish qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/transfers/${saved.id}`))
  expect(moved()).toBe("forward")
})

test("the form refuses in the API's words before asking, and tells the API's refusal: more than the location has", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  setLocation("/transfers/new")
  const { user } = renderWithProviders(<NewTransferPage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi ko'chirish" })

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Maqsad lokatsiyani tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Mahsulotni tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Miqdor noto'g'ri")).toBeInTheDocument()

  await choose(user, screen.getByLabelText("Qayerga"), "Chilonzor")
  await pick(user, line(1), "Mahsulot", "ol", /Olma/)
  await user.type(within(line(1)).getByLabelText("Miqdor"), "20")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("«Olma» uchun omborda yetarli qoldiq yo'q")).toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "transfer")).toHaveLength(0)
})

test("with one location there is nowhere to move to: back to the transfers", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/transfers/new")
  renderWithProviders(<NewTransferPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/transfers"))
})

test("editing: the transfer comes filled in, and is saved with fewer of the product", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const asosiy = asosiyOf(1).id
  const chilonzor = addLocation(1, "Chilonzor").id
  await signIn(ALI)
  const transfer = await enterTransfer({ location_id: asosiy, to_location_id: chilonzor, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4" }] })
  setLocation(`/transfers/${transfer.id}/edit`)
  const { user } = renderWithProviders(<EditTransferPage id={transfer.id} />)

  expect(await screen.findByText("№ 1 · Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Ko'chirishni tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ko'chirish № 1" })).toHaveAttribute("href", `/transfers/${transfer.id}`)
  expect(screen.getByLabelText("Qayerga")).toHaveTextContent("Chilonzor")
  expect(momentIn(document.body)).toBe("2026-10-05T09:00")
  expect(within(line(1)).getByText("Olma")).toBeInTheDocument()
  expect(within(line(1)).getByLabelText("Miqdor")).toHaveValue("4.000")
  await user.clear(within(line(1)).getByLabelText("Miqdor"))
  await user.type(within(line(1)).getByLabelText("Miqdor"), "2")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.items.find((i) => i.transactionId === transfer.id)?.quantity).toBe(2))
  expect(await screen.findByText("Ko'chirish saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/transfers/${transfer.id}`))
  expect(moved()).toBe("back")
})
