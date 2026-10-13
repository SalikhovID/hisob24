import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, nextId } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { enterCashOpening } from "@/test/finance"
import { momentIn } from "@/test/moment"
import { CashOpeningDialog } from "./cash-opening-dialog"

// Opened is the sheet as a page opens it (the account's tile, a document's
// «Tahrirlash»): open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof CashOpeningDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <CashOpeningDialog {...props} open={open} onOpenChange={setOpen} />
}

test("an opening balance of the cash is entered: into the account given, the amount typed the Uzbek way, now unless another moment is chosen, a note", async () => {
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  db.accounts[1].push(kassa2)
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} accountId={kassa2.id} />)

  const dialog = await screen.findByRole("dialog", { name: "Kassa boshlang'ich qoldig'i" })
  // The accounts come with the session: the row says the account once they are known.
  await waitFor(() => expect(within(dialog).getByLabelText("Akkaunt")).toHaveTextContent("Kassa 2 (so'm)"))
  expect(momentIn(dialog)).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summani kiriting")).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Summa"), "1 000 000,5")
  await user.type(within(dialog).getByLabelText("Izoh"), " Boshlanish ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "cash_opening")).toMatchObject({ number: 1, bankAccountId: kassa2.id, total: 1000000.5, note: "Boshlanish", currencyId: 1 }))
  expect((await screen.findAllByText("Hujjat qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("an opening balance is edited from its fields", async () => {
  await signIn(ALI)
  const opening = await enterCashOpening({ bank_account_id: db.accounts[1][0].id, amount: "1000000", at: "2026-10-01T09:00:00+05:00" })
  const { user } = renderWithProviders(<Opened companyId={1} opening={opening} />)

  // A role's name keeps the amount's no-break spaces.
  const dialog = await screen.findByRole("dialog", { name: "Boshlang'ich qoldiqni tahrirlash" })
  expect(within(dialog).getByLabelText("Summa")).toHaveValue("1000000.00")
  expect(momentIn(dialog)).toBe("2026-10-01T09:00")
  await user.clear(within(dialog).getByLabelText("Summa"))
  await user.type(within(dialog).getByLabelText("Summa"), "900000")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)).toMatchObject({ total: 900000 }))
  expect((await screen.findAllByText("Hujjat saqlandi")).length).toBeGreaterThan(0)
})
