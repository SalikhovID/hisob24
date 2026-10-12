import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose, optionsOf } from "@/test/select"
import { signIn } from "@/test/session"
import { enterMoneyTransfer } from "@/test/finance"
import { MoneyTransferDialog } from "./money-transfer-dialog"

// accounts gives Olma Savdo a second cash in so'm, a card in dollars and an old cash turned off.
function accounts() {
  db.currencies[1].push(2)
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const card = { id: nextId(), name: "Karta", currency_id: 2, is_active: true }
  const eski = { id: nextId(), name: "Eski", currency_id: 1, is_active: false }
  db.accounts[1].push(kassa2, card, eski)
  return { cash: db.accounts[1][0].id, kassa2, card, eski }
}

test("money is moved from one account to another in the same currency: the targets offered are the other active accounts in the source's currency", async () => {
  const { cash, kassa2 } = accounts()
  await signIn(ALI)
  const { user } = renderWithProviders(<MoneyTransferDialog companyId={1} accountId={cash} />)

  await user.click(screen.getByRole("button", { name: "O'tkazma qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "O'tkazma qo'shish" })
  expect(within(dialog).getByRole("combobox", { name: "Qayerdan" })).toHaveTextContent("Naqd (so'm)")
  expect(await optionsOf(user, within(dialog).getByRole("combobox", { name: "Qayerga" }))).toEqual(["Kassa 2 (so'm)"])
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Maqsad akkauntni tanlang")).toBeInTheDocument()
  await choose(user, within(dialog).getByRole("combobox", { name: "Qayerga" }), "Kassa 2 (so'm)")
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "100 000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "money_transfer")).toMatchObject({ number: 1, bankAccountId: cash, toBankAccountId: kassa2.id, total: 100000 }))
  expect((await screen.findAllByText("Hujjat qo'shildi")).length).toBeGreaterThan(0)
})

test("a transfer is edited from its row, by its icon: the accounts it names stay offered", async () => {
  const { cash, kassa2 } = accounts()
  await signIn(ALI)
  const moved = await enterMoneyTransfer({ from_account_id: cash, to_account_id: kassa2.id, amount: "100000", at: "2026-10-05T09:00:00+05:00" })
  db.accounts[1].find((a) => a.id === kassa2.id)!.is_active = false
  const { user } = renderWithProviders(<MoneyTransferDialog companyId={1} transfer={moved} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: 100 000" }))
  const dialog = await screen.findByRole("dialog", { name: "O'tkazmani tahrirlash" })
  expect(within(dialog).getByRole("combobox", { name: "Qayerga" })).toHaveTextContent("Kassa 2 (so'm)")
  expect(within(dialog).getByLabelText("Summa, so'm")).toHaveValue("100000.00")
  await user.clear(within(dialog).getByLabelText("Summa, so'm"))
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "60000")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === moved.id)).toMatchObject({ total: 60000, toBankAccountId: kassa2.id }))
  expect((await screen.findAllByText("Hujjat saqlandi")).length).toBeGreaterThan(0)
})
