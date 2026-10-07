import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { EditPurchasePage } from "./edit-purchase-page"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })

test("a purchase is edited from its fields as they are: a line changed, a line taken out, nothing paid now", async () => {
  const catalog = seedCatalog()
  const { purchase } = seedWarehouse(catalog)
  await signIn(ALI)
  const { user } = renderWithProviders(<EditPurchasePage id={purchase!.id} />)

  // The title stands while the purchase loads; its number says it has come.
  expect(await screen.findByText("№ 1 · Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Xaridni tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(within(screen.getByRole("group", { name: "Ta'minotchi" })).getByText("Bozor")).toBeInTheDocument()
  expect(screen.getByLabelText("Sana")).toHaveValue("2026-10-01")
  expect(within(line(1)).getByText("Olma")).toBeInTheDocument()
  expect(within(line(1)).getByLabelText("Miqdor")).toHaveValue("12.500")
  expect(within(line(1)).getByLabelText("Narx")).toHaveValue("1000.00")
  expect(within(line(2)).getByText("Nok")).toBeInTheDocument()
  expect(within(line(2)).getByLabelText("Miqdor")).toHaveValue("3.000")
  expect(screen.getByLabelText("To'langan")).toHaveValue("5000.00")
  expect(screen.getByLabelText("Izoh")).toHaveValue("Ertalab")
  expect(screen.getByText("20 001,5 so'm")).toBeInTheDocument()

  await user.clear(within(line(1)).getByLabelText("Miqdor"))
  await user.type(within(line(1)).getByLabelText("Miqdor"), "4")
  await user.click(screen.getByRole("button", { name: "2-qatorni olib tashlash" }))
  await user.clear(screen.getByLabelText("To'langan"))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.purchases.find((p) => p.id === purchase!.id)?.items).toEqual([{ productId: catalog.olma.id, quantity: 4, price: 1000 }]))
  expect(db.stock.find((s) => s.productId === catalog.olma.id)?.quantity).toBe(4)
  expect(db.stock.find((s) => s.productId === catalog.nok.id)?.quantity).toBe(0)
  expect(db.payments.find((p) => p.purchaseId === purchase!.id)?.deleted).toBe(true)
  expect(await screen.findByText("Xarid saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/purchases/${purchase!.id}`))
})

test("a purchase that is gone, or outside the member's locations, is not found", async () => {
  await signIn(ALI)
  renderWithProviders(<EditPurchasePage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xarid topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
})
