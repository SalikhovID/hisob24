import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { enterConversion, enterMoneyTransfer } from "@/test/finance"
import { MoneyTransfersPage } from "./money-transfers-page"

async function moved() {
  db.currencies[1].push(2)
  const cash = db.accounts[1][0].id
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const card = { id: nextId(), name: "Karta", currency_id: 2, is_active: true }
  db.accounts[1].push(kassa2, card)
  await signIn(ALI)
  const transfer = await enterMoneyTransfer({ from_account_id: cash, to_account_id: kassa2.id, amount: "100000", at: "2026-10-05T09:00:00+05:00" })
  const conversion = await enterConversion({ from_account_id: cash, amount: "128000", to_account_id: card.id, to_amount: "10", at: "2026-10-06T09:00:00+05:00" })
  return { cash, kassa2, card, transfer, conversion }
}

const table = () => screen.findByRole("table", { name: "O'tkazmalar" })

test("the transfers and the conversions in one list, the newest first, each with where it came from and went to; an account narrows the list and stays in the address", async () => {
  const { kassa2 } = await moved()
  setLocation("/money-transfers")
  const { user } = renderWithProviders(<MoneyTransfersPage />)

  const list = await table()
  expect(screen.getByRole("heading", { level: 1, name: "O'tkazmalar" })).toBeInTheDocument()
  expect(within(screen.getByRole("navigation", { name: "Moliya bo'limi" })).getByRole("link", { name: "O'tkazmalar" })).toHaveAttribute("aria-current", "page")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Qayerdan", "Qayerga", "Qo'shgan", "Amallar"])
  const rows = within(list).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByRole("rowheader")).toHaveTextContent("Konvertatsiya № 106.10.2026 09:00")
  expect(within(rows[0]).getByText("Naqd")).toBeInTheDocument()
  expect(within(rows[0]).getByText("128 000 so'm")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Karta")).toBeInTheDocument()
  expect(within(rows[0]).getByText("10 $")).toBeInTheDocument()
  expect(within(rows[0]).getByText("1 $ = 12 800 so'm")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "Tahrirlash: 128 000" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 128 000" })).toBeInTheDocument()
  expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("O'tkazma № 105.10.2026 09:00")
  expect(within(rows[1]).getByText("Kassa 2")).toBeInTheDocument()
  expect(within(rows[1]).getAllByText("100 000 so'm")).toHaveLength(2)
  expect(within(rows[1]).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "O'tkazma qo'shish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Konvertatsiya qo'shish" })).toBeInTheDocument()

  await choose(user, screen.getByRole("combobox", { name: "Akkaunt" }), "Kassa 2 (so'm)")
  await waitFor(() => expect(currentUrl()).toBe(`/money-transfers?account_id=${kassa2.id}`))
  await waitFor(() => expect(within(screen.getByRole("table", { name: "O'tkazmalar" })).getAllByRole("row").slice(1)).toHaveLength(1))
})

test("none yet says so; whoever may not see the finance is sent home", async () => {
  await signIn(ALI)
  setLocation("/money-transfers")
  const { unmount } = renderWithProviders(<MoneyTransfersPage />)
  expect(await screen.findByText("Hali o'tkazma yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi o'tkazmani «O'tkazma qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
  unmount()

  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<MoneyTransfersPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
