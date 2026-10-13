import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, seedWarehouse } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { enterOpening } from "@/test/stock"
import { DeleteOpeningDialog } from "./delete-opening-button"

test("an opening balance is deleted after asking: the question opens from its sheet of actions, and closes when answered", async () => {
  const { bozor } = seedWarehouse()
  const onOpenChange = vi.fn()
  await signIn(ALI)
  const opening = await enterOpening(bozor.id, { kind: "prepay", amount: "250000", at: "2026-10-03T09:00:00+05:00" })
  const { user } = renderWithProviders(<DeleteOpeningDialog companyId={1} partyId={bozor.id} opening={opening} open onOpenChange={onOpenChange} />)

  const dialog = await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })
  expect(within(dialog).getByText("Boshlang'ich avans 250 000 so'm (03.10.2026 09:00) o'chiriladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)?.deleted).toBe(true))
  expect(await screen.findByText("Hujjat o'chirildi")).toBeInTheDocument()
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
