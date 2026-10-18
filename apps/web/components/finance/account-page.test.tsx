import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterCashOpening, enterConversion, enterExpense, enterMoneyTransfer } from "@/test/finance"
import { pricedOrder } from "@/test/order-money"
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

// statementRows reads the statement's rows, the days' groups one after
// another: each with its title, the line under it and its end.
async function statementRows() {
  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  return within(statement)
    .getAllByRole("listitem")
    .map((item) => item.firstElementChild as HTMLElement)
}
// statementDays are the days the statement's groups are headed with.
const statementDays = () =>
  within(screen.getByRole("region", { name: "Hisob harakati" }))
    .getAllByRole("list")
    .map((list) => list.getAttribute("aria-label"))
const said = (row: HTMLElement) => [rowParts(row).title, rowParts(row).sub?.replace(/\s+/g, " ") ?? null, rowParts(row).end?.replace(/\s+/g, " ") ?? null]

test("the account page, as the prototype's: what it holds large under its name, the tiles that enter a document into it, its statement in rows, the way to the cash", async () => {
  const { cash } = await books()
  renderWithProviders(<AccountPage id={cash} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Naqd" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kassa" })).toHaveAttribute("href", "/accounts")
  expect(document.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Naqd 617 000 so'm UZS")
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Xarajat", "Kirim", "O'tkazma", "Yana"])

  // The statement: every document that named the account, the newest first,
  // by its day; its time and other side under its name, how it changed what
  // the account holds and what it held after it at its end.
  const rows = await statementRows()
  expect(statementDays()).toEqual(["6-oktabr, seshanba", "5-oktabr, dushanba", "3-oktabr, shanba", "1-oktabr, payshanba"])
  expect(rows.map(said)).toEqual([
    ["Konvertatsiya № 1", "09:00 · Karta", "−128 000 qoldiq 617 000"],
    ["O'tkazma № 1", "09:00 · Kassa 2", "−100 000 qoldiq 745 000"],
    ["Xarajat № 1", "09:00 · Ijara", "−150 000 qoldiq 845 000"],
    // The opening balance and the payment with the purchase share the moment
    // (9:00 on the 1st): the later entered comes first. The first document
    // took the account below zero.
    // In the cash's own statement the opening balance needs no «Kassa».
    ["Boshlang'ich qoldiq", "09:00", "+1 000 000 qoldiq 995 000"],
    ["To'lov · Xarid № 1", "09:00 · Bozor", "−5 000 qoldiq −5 000"],
  ])
  // A cash document is handled in its sheet of actions; a payment leads to
  // the document it was entered with.
  expect(rows.slice(0, 4).map((row) => row.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON", "BUTTON"])
  expect(rows[4]).toHaveAttribute("href", expect.stringMatching(/^\/purchases\/\d+$/))
})

test("a cash document's sheet: the opening balance is edited and deleted there, the others deleted (they are edited on their lists)", async () => {
  const { cash } = await books()
  const { user } = renderWithProviders(<AccountPage id={cash} />)
  const rows = await statementRows()

  await user.click(rows[3])
  const sheet = await screen.findByRole("menu")
  expect(sheet).toHaveTextContent("Boshlang'ich qoldiq · 1 000 000 so'm")
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  await user.click(within(sheet).getByRole("menuitem", { name: "Tahrirlash" }))
  const edit = await screen.findByRole("dialog", { name: "Boshlang'ich qoldiqni tahrirlash" })
  expect(within(edit).getByLabelText("Summa")).toHaveValue("1000000.00")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(rows[2])
  const other = await screen.findByRole("menu")
  expect(within(other).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["O'chirish"])
  await user.click(within(other).getByRole("menuitem", { name: "O'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })).toBeInTheDocument()
})

test("the tiles open the sheets that enter a document into the account; «Yana» has the conversion and the opening balance", async () => {
  const { cash } = await books()
  const { user } = renderWithProviders(<AccountPage id={cash} />)
  const tiles = await screen.findByRole("group", { name: "Amallar" })

  await user.click(within(tiles).getByRole("button", { name: "Xarajat" }))
  const expense = await screen.findByRole("dialog", { name: "Xarajat qo'shish" })
  await waitFor(() => expect(within(expense).getByLabelText("Akkaunt")).toHaveTextContent("Naqd (so'm)"))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(within(tiles).getByRole("button", { name: "Kirim" }))
  expect(await screen.findByRole("dialog", { name: "Kirim qo'shish" })).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(within(tiles).getByRole("button", { name: "O'tkazma" }))
  const transfer = await screen.findByRole("dialog", { name: "O'tkazma qo'shish" })
  await waitFor(() => expect(within(transfer).getByLabelText("Qayerdan")).toHaveTextContent("Naqd (so'm)"))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(within(tiles).getByRole("button", { name: "Yana" }))
  const more = await screen.findByRole("menu")
  expect(within(more).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Konvertatsiya", "Boshlang'ich qoldiq"])
  await user.click(within(more).getByRole("menuitem", { name: "Konvertatsiya" }))
  expect(await screen.findByRole("dialog", { name: "Konvertatsiya qo'shish" })).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(within(tiles).getByRole("button", { name: "Yana" }))
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Boshlang'ich qoldiq" }))
  const opening = await screen.findByRole("dialog", { name: "Kassa boshlang'ich qoldig'i" })
  await waitFor(() => expect(within(opening).getByLabelText("Akkaunt")).toHaveTextContent("Naqd (so'm)"))
})

test("an inactive account says so; nothing is entered into it (the forms do not offer it)", async () => {
  const { kassa2 } = await books()
  db.accounts[1].find((a) => a.id === kassa2.id)!.is_active = false
  renderWithProviders(<AccountPage id={kassa2.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Kassa 2" })).toBeInTheDocument()
  expect(document.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Kassa 2 100 000 so'm UZS Nofaol")
  expect(screen.queryByRole("group", { name: "Amallar" })).not.toBeInTheDocument()
  expect((await statementRows()).map(said)).toEqual([["O'tkazma № 1", "09:00 · Naqd", "+100 000 qoldiq 100 000"]])
})

test("the card: in dollars, what arrived by the conversion, from the cash", async () => {
  const { card } = await books()
  renderWithProviders(<AccountPage id={card.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Karta" })).toBeInTheDocument()
  expect(document.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Karta 10 $ USD")
  expect((await statementRows()).map(said)).toEqual([["Konvertatsiya № 1", "09:00 · Naqd", "+10 qoldiq 10"]])
})

test("whoever may see the finance alone sees the account without a way to change it; another company's account is not found", async () => {
  const { cash } = await books()
  giveRole(VALI, 1, "Kuzatuvchi", ["finance.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  const { unmount } = renderWithProviders(<AccountPage id={cash} />)
  expect(await screen.findByRole("heading", { level: 1, name: "Naqd" })).toBeInTheDocument()
  // No tiles; the cash documents' rows have no sheet; the payment still leads to its purchase.
  const rows = await statementRows()
  expect(screen.queryByRole("group", { name: "Amallar" })).not.toBeInTheDocument()
  expect(rows.slice(0, 4).map((row) => row.tagName)).toEqual(["DIV", "DIV", "DIV", "DIV"])
  expect(rows[4]).toHaveAttribute("href", expect.stringMatching(/^\/purchases\/\d+$/))
  unmount()

  renderWithProviders(<AccountPage id={9102} />)
  expect(await screen.findByRole("heading", { level: 1, name: "Akkaunt topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kassa" })).toHaveAttribute("href", "/accounts")
})

// A payment entered for an order is named by the order's number alone
// (logic/orders.md, 4.3), short enough for a phone, and leads to the order.
test("a payment for an order reads «To'lov · № N» and leads to the order", async () => {
  await signIn(ALI)
  const { order, cash } = await pricedOrder()
  renderWithProviders(<AccountPage id={cash} />)

  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  const [advance] = await within(statement).findAllByRole("link")
  expect(rowParts(advance).title).toBe("To'lov · № 5")
  expect(advance).toHaveAttribute("href", `/orders/${order.id}`)
})
