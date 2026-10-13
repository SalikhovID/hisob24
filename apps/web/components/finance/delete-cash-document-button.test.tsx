import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, nextId } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { enterCashOpening, enterExpense } from "@/test/finance"
import { DeleteCashDocumentButton } from "./delete-cash-document-button"

test("a cash document is deleted from its row after asking; the endpoint is its kind's", async () => {
  await signIn(ALI)
  const opening = await enterCashOpening({ bank_account_id: db.accounts[1][0].id, amount: "1000000", at: "2026-10-01T09:00:00+05:00" })
  const { user } = renderWithProviders(<DeleteCashDocumentButton companyId={1} document={{ id: opening.id, kind: "cash_opening", amount: opening.amount, currency_id: 1, at: opening.at }} />)

  await user.click(screen.getByRole("button", { name: "O'chirish: 1\u00a0000\u00a0000" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })
  expect(within(dialog).getByText("01.10.2026 09:00 dagi 1 000 000 so'm kassa boshlang'ich qoldig'i o'chiriladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)?.deleted).toBe(true))
  expect((await screen.findAllByText("Hujjat o'chirildi")).length).toBeGreaterThan(0)
})

test("an expense goes through the expenses' endpoint", async () => {
  db.financeCategories.push({ id: nextId(), companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  await signIn(ALI)
  const rent = await enterExpense({ kind: "expense", bank_account_id: db.accounts[1][0].id, category_id: db.financeCategories[0].id, amount: "150000", at: "2026-10-03T09:00:00+05:00" })
  const { user } = renderWithProviders(<DeleteCashDocumentButton companyId={1} document={{ id: rent.id, kind: "expense", amount: rent.amount, currency_id: 1, at: rent.at }} />)

  await user.click(screen.getByRole("button", { name: "O'chirish: 150\u00a0000" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })
  expect(within(dialog).getByText("03.10.2026 09:00 dagi 150 000 so'm xarajat o'chiriladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(db.transactions.find((t) => t.id === rent.id)?.deleted).toBe(true))
})

test("the question opens from outside too (a document's sheet of actions), with no button, and closes when answered", async () => {
  const cash = db.accounts[1][0].id
  await signIn(ALI)
  const opening = await enterCashOpening({ bank_account_id: cash, amount: "1000000", at: "2026-10-01T09:00:00+05:00" })
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(
    <DeleteCashDocumentButton companyId={1} document={{ id: opening.id, kind: "cash_opening", amount: opening.amount, currency_id: 1, at: opening.at }} open onOpenChange={onOpenChange} />,
  )

  const dialog = await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })
  expect(screen.queryByRole("button", { name: /^O'chirish: / })).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)?.deleted).toBe(true))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
