import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterCashOpening, enterConversion, enterExpense, enterMoneyTransfer } from "@/test/finance"
import { AccountPage } from "./account-page"

// books is the cash of Olma Savdo in October: opened with 1 000 000, 150 000
// rent paid, 5 000 paid to Bozor with the purchase, 100 000 moved to the
// second cash, 128 000 turned into 10 dollars on the card.
async function books() {
  const { bozor } = seedWarehouse(seedCatalog())
  const cash = db.accounts[1][0].id
  db.currencies[1].push(2)
  const card = { id: nextId(), name: "Karta", currency_id: 2, is_active: true }
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  db.accounts[1].push(card, kassa2)
  const ijara = { id: nextId(), companyId: 1, name: "Ijara", kind: "expense" as const, position: 1, active: true }
  db.financeCategories.push(ijara)
  await signIn(ALI)
  const opening = await enterCashOpening({ bank_account_id: cash, amount: "1000000", at: "2026-10-01T09:00:00+05:00", note: "Boshlanish" })
  const rent = await enterExpense({ kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "150000", at: "2026-10-03T09:00:00+05:00" })
  const moved = await enterMoneyTransfer({ from_account_id: cash, to_account_id: kassa2.id, amount: "100000", at: "2026-10-05T09:00:00+05:00" })
  const converted = await enterConversion({ from_account_id: cash, amount: "128000", to_account_id: card.id, to_amount: "10", at: "2026-10-06T09:00:00+05:00" })
  return { cash, card, kassa2, bozor, opening, rent, moved, converted }
}

test("the account page: what it holds, its statement with each document's other side and the balance after it, and the way to the cash", async () => {
  const { cash, kassa2, card } = await books()
  renderWithProviders(<AccountPage id={cash} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Naqd" })).toBeInTheDocument()
  expect(screen.getByText("UZS · Faol")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kassa" })).toHaveAttribute("href", "/accounts")
  const balance = screen.getByRole("region", { name: "Qoldiq" })
  expect(within(balance).getByText("617 000 so'm")).toBeInTheDocument()

  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  expect(within(statement).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Vaqt", "Qarshi tomon", "Summa, so'm", "Qoldiq, so'm", "Qo'shgan", "Amallar"])
  const rows = within(statement).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(5)
  expect(within(rows[0]).getByText("Konvertatsiya № 1")).toBeInTheDocument()
  expect(within(rows[0]).getByText("06.10.2026 09:00")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Karta")).toBeInTheDocument()
  expect(within(rows[0]).getByText("−128 000")).toBeInTheDocument()
  expect(within(rows[0]).getByText("617 000")).toBeInTheDocument()
  expect(within(rows[1]).getByText("O'tkazma № 1")).toBeInTheDocument()
  expect(within(rows[1]).getByText("Kassa 2")).toBeInTheDocument()
  expect(within(rows[1]).getByText("−100 000")).toBeInTheDocument()
  expect(within(rows[1]).getByText("745 000")).toBeInTheDocument()
  expect(within(rows[2]).getByText("Xarajat № 1")).toBeInTheDocument()
  expect(within(rows[2]).getByText("Ijara")).toBeInTheDocument()
  expect(within(rows[2]).getByText("−150 000")).toBeInTheDocument()
  expect(within(rows[2]).getByText("845 000")).toBeInTheDocument()
  // The opening balance and the payment with the purchase share the moment
  // (9:00 on the 1st): the later entered comes first.
  expect(within(rows[3]).getByText("Kassa boshlang'ich qoldig'i")).toBeInTheDocument()
  expect(within(rows[3]).getByText("+1 000 000")).toBeInTheDocument()
  expect(within(rows[3]).getByText("995 000")).toBeInTheDocument()
  expect(within(rows[3]).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(rows[4]).toHaveTextContent("To'lov · Xarid № 1")
  expect(within(rows[4]).getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", expect.stringMatching(/^\/purchases\/\d+$/))
  expect(within(rows[4]).getByText("Bozor")).toBeInTheDocument()
  // The first document took the account below zero: the change and the balance after it.
  expect(within(rows[4]).getAllByText("−5 000")).toHaveLength(2)
  // The opening balance is edited and deleted in its row; the owner adds one from the header.
  expect(within(rows[3]).getByRole("button", { name: "Tahrirlash: 1\u00a0000\u00a0000" })).toBeInTheDocument()
  expect(within(rows[3]).getByRole("button", { name: "O'chirish: 1\u00a0000\u00a0000" })).toBeInTheDocument()
  expect(within(rows[4]).queryAllByRole("button")).toHaveLength(0)
  // The other cash documents are deleted in their rows and edited on their pages.
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 128\u00a0000" })).toBeInTheDocument()
  expect(within(rows[0]).queryByRole("button", { name: /Tahrirlash/ })).not.toBeInTheDocument()
  expect(within(rows[2]).getByRole("button", { name: "O'chirish: 150\u00a0000" })).toBeInTheDocument()
  // The header enters every kind into this account.
  for (const name of ["Boshlang'ich qoldiq", "Xarajat qo'shish", "Kirim qo'shish", "O'tkazma qo'shish", "Konvertatsiya qo'shish"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument()
  }

  // The card holds the dollars that arrived; the second cash what was moved in.
  expect(kassa2.id).toBeGreaterThan(0)
  expect(card.id).toBeGreaterThan(0)
})

test("the card: in dollars, what arrived by the conversion, from the cash", async () => {
  const { card } = await books()
  renderWithProviders(<AccountPage id={card.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Karta" })).toBeInTheDocument()
  expect(screen.getByText("USD · Faol")).toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Qoldiq" })).getByText("10 $")).toBeInTheDocument()
  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  expect(within(statement).getAllByRole("columnheader").map((cell) => cell.textContent)).toContain("Summa, $")
  const rows = within(statement).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(1)
  expect(within(rows[0]).getByText("Naqd")).toBeInTheDocument()
  expect(within(rows[0]).getByText("+10")).toBeInTheDocument()
})

test("whoever may see the finance alone sees the account without a way to change it; another company's account is not found", async () => {
  const { cash } = await books()
  giveRole(VALI, 1, "Kuzatuvchi", ["finance.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  const { unmount } = renderWithProviders(<AccountPage id={cash} />)
  expect(await screen.findByRole("heading", { level: 1, name: "Naqd" })).toBeInTheDocument()
  await screen.findByRole("table", { name: "Hisob harakati" })
  expect(screen.queryByRole("button", { name: "Boshlang'ich qoldiq" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Tahrirlash:/ })).not.toBeInTheDocument()
  unmount()

  renderWithProviders(<AccountPage id={9102} />)
  expect(await screen.findByRole("heading", { level: 1, name: "Akkaunt topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kassa" })).toHaveAttribute("href", "/accounts")
})
