import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, seedPayment, seedWarehouse } from "@/mocks/data"
import { toPayment } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { DeletePaymentDialog } from "./delete-payment-button"

test("a payment entered on its own is deleted after asking: the question opens from its sheet of actions, and closes when answered", async () => {
  const { bozor } = seedWarehouse()
  const row = seedPayment(bozor.id, 1200.5, "2026-10-03T04:00:00Z")
  const onOpenChange = vi.fn()
  await signIn(ALI)
  const { user } = renderWithProviders(<DeletePaymentDialog companyId={1} partyId={bozor.id} payment={toPayment(row)} open onOpenChange={onOpenChange} />)

  const dialog = await screen.findByRole("alertdialog", { name: "To'lovni o'chirasizmi?" })
  expect(within(dialog).getByText("03.10.2026 09:00 dagi 1 200,50 so'm to'lov o'chiriladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === row.id)?.deleted).toBe(true))
  expect(await screen.findByText("To'lov o'chirildi")).toBeInTheDocument()
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
