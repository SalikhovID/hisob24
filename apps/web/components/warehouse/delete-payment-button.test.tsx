import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, now, nextId, seedWarehouse } from "@/mocks/data"
import { toPayment } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { DeletePaymentButton } from "./delete-payment-button"

test("a payment entered on its own is deleted from the row after asking", async () => {
  const { bozor } = seedWarehouse()
  const at = now()
  const row = { id: nextId(), companyId: 1, supplierId: bozor.id, purchaseId: null, amount: 1200.5, paidOn: "2026-10-03", note: null, by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at }
  db.payments.push(row)
  await signIn(ALI)
  const { user } = renderWithProviders(<DeletePaymentButton companyId={1} payment={toPayment(row)} />)

  await user.click(screen.getByRole("button", { name: "O'chirish: 1\u00a0200,50" }))
  const dialog = await screen.findByRole("alertdialog", { name: "To'lovni o'chirasizmi?" })
  expect(within(dialog).getByText("03.10.2026 kungi 1 200,50 so'm to'lov o'chiriladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.payments.find((p) => p.id === row.id)?.deleted).toBe(true))
  expect(await screen.findByText("To'lov o'chirildi")).toBeInTheDocument()
})
