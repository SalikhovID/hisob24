import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedPayment, seedWarehouse } from "@/mocks/data"
import { toPayment } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { PaymentDialog } from "./payment-dialog"

test("a payment is entered: out of the cash, the amount typed the Uzbek way, now unless another moment is chosen, a note", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<PaymentDialog companyId={1} supplierId={bozor.id} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  expect(within(dialog).getByRole("combobox", { name: "Akkaunt" })).toHaveTextContent("Naqd (so'm)")
  expect((within(dialog).getByLabelText("Vaqt") as HTMLInputElement).value).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(within(dialog).queryByLabelText(/= \? so'm/)).not.toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "1 200,5")
  await user.type(within(dialog).getByLabelText("Izoh"), " Naqd ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "supplier_payment" && t.supplierId === bozor.id)).toMatchObject({ total: 1200.5, note: "Naqd", linkedId: null, bankAccountId: db.accounts[1][0].id, currencyId: 1 }))
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
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "0")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summa noto'g'ri")).toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "supplier_payment")).toHaveLength(0)
})

test("a payment entered on its own is edited from the row, by its icon", async () => {
  const { bozor } = seedWarehouse()
  const row = seedPayment(bozor.id, 1200.5, "2026-10-03T04:00:00Z", "Naqd")
  await signIn(ALI)
  const { user } = renderWithProviders(<PaymentDialog companyId={1} supplierId={bozor.id} payment={toPayment(row)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: 1 200,50" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lovni tahrirlash" })
  expect(within(dialog).getByLabelText("Summa, so'm")).toHaveValue("1200.50")
  expect(within(dialog).getByLabelText("Vaqt")).toHaveValue("2026-10-03T09:00")
  await user.clear(within(dialog).getByLabelText("Summa, so'm"))
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "1500")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === row.id)).toMatchObject({ total: 1500, note: "Naqd" }))
  expect(await screen.findByText("To'lov saqlandi")).toBeInTheDocument()
})
