import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose, optionsOf } from "@/test/select"
import { signIn } from "@/test/session"
import { enterConversion } from "@/test/finance"
import { ConversionDialog } from "./conversion-dialog"

function accounts() {
  db.currencies[1].push(2)
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const card = { id: nextId(), name: "Karta", currency_id: 2, is_active: true }
  db.accounts[1].push(kassa2, card)
  return { cash: db.accounts[1][0].id, kassa2, card }
}

test("money is turned from one currency into another: the targets offered are the active accounts in other currencies; the rate is told as the amounts are typed", async () => {
  const { cash, card } = accounts()
  await signIn(ALI)
  const { user } = renderWithProviders(<ConversionDialog companyId={1} accountId={cash} />)

  await user.click(screen.getByRole("button", { name: "Konvertatsiya qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Konvertatsiya qo'shish" })
  expect(within(dialog).getByRole("combobox", { name: "Qayerdan" })).toHaveTextContent("Naqd (so'm)")
  expect(await optionsOf(user, within(dialog).getByRole("combobox", { name: "Qayerga" }))).toEqual(["Karta ($)"])
  await choose(user, within(dialog).getByRole("combobox", { name: "Qayerga" }), "Karta ($)")
  await user.type(within(dialog).getByLabelText("Chiqqan summa, so'm"), "128 000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Maqsad summani kiriting")).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Kirgan summa, $"), "10")
  expect(within(dialog).getByText("1 $ = 12 800 so'm")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "conversion")).toMatchObject({ number: 1, bankAccountId: cash, toBankAccountId: card.id, total: 128000, toTotal: 10 }))
  expect((await screen.findAllByText("Hujjat qo'shildi")).length).toBeGreaterThan(0)
})

test("a conversion is edited from its row, by its icon, with both amounts", async () => {
  const { cash, card } = accounts()
  await signIn(ALI)
  const converted = await enterConversion({ from_account_id: cash, amount: "128000", to_account_id: card.id, to_amount: "10", at: "2026-10-06T09:00:00+05:00" })
  const { user } = renderWithProviders(<ConversionDialog companyId={1} conversion={converted} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: 128 000" }))
  const dialog = await screen.findByRole("dialog", { name: "Konvertatsiyani tahrirlash" })
  expect(within(dialog).getByLabelText("Chiqqan summa, so'm")).toHaveValue("128000.00")
  expect(within(dialog).getByLabelText("Kirgan summa, $")).toHaveValue("10.00")
  await user.clear(within(dialog).getByLabelText("Chiqqan summa, so'm"))
  await user.type(within(dialog).getByLabelText("Chiqqan summa, so'm"), "130000")
  expect(within(dialog).getByText("1 $ = 13 000 so'm")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === converted.id)).toMatchObject({ total: 130000, toTotal: 10 }))
  expect((await screen.findAllByText("Hujjat saqlandi")).length).toBeGreaterThan(0)
})
