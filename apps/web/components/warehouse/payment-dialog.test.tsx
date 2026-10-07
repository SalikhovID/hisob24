import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, now, nextId, seedWarehouse } from "@/mocks/data"
import { toPayment } from "@/mocks/warehouse"
import { today } from "@/lib/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { PaymentDialog } from "./payment-dialog"

test("a payment is entered: the amount typed the Uzbek way, today unless another day is chosen, a note", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<PaymentDialog companyId={1} supplierId={bozor.id} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  expect(within(dialog).getByLabelText("Sana")).toHaveValue(today())
  await user.type(within(dialog).getByLabelText("Summa"), "1 200,5")
  await user.type(within(dialog).getByLabelText("Izoh"), " Naqd ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.payments.find((p) => p.supplierId === bozor.id)).toMatchObject({ amount: 1200.5, paidOn: today(), note: "Naqd", purchaseId: null }))
  expect(await screen.findByText("To'lov qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the form refuses in the API's words before asking", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<PaymentDialog companyId={1} supplierId={bozor.id} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summani kiriting")).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Summa"), "0")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summa noto'g'ri")).toBeInTheDocument()
  expect(db.payments).toHaveLength(0)
})

test("a payment entered on its own is edited from the row, by its icon", async () => {
  const { bozor } = seedWarehouse()
  const at = now()
  const row = { id: nextId(), companyId: 1, supplierId: bozor.id, purchaseId: null, amount: 1200.5, paidOn: "2026-10-03", note: "Naqd", by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at }
  db.payments.push(row)
  await signIn(ALI)
  const { user } = renderWithProviders(<PaymentDialog companyId={1} supplierId={bozor.id} payment={toPayment(row)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: 1\u00a0200,50" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lovni tahrirlash" })
  expect(within(dialog).getByLabelText("Summa")).toHaveValue("1200.50")
  expect(within(dialog).getByLabelText("Sana")).toHaveValue("2026-10-03")
  await user.clear(within(dialog).getByLabelText("Summa"))
  await user.type(within(dialog).getByLabelText("Summa"), "1500")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.payments.find((p) => p.id === row.id)).toMatchObject({ amount: 1500, note: "Naqd" }))
  expect(await screen.findByText("To'lov saqlandi")).toBeInTheDocument()
})
