import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterCashOpening, enterExpense } from "@/test/finance"
import { AccountsPage } from "./accounts-page"

test("the cash: every account with what it holds in its own currency, the active first and the one turned off last; each leads to its page", async () => {
  const cash = db.accounts[1][0].id
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const eski = { id: nextId(), name: "Eski", currency_id: 1, is_active: false }
  db.accounts[1].push(eski, kassa2)
  db.financeCategories.push({ id: nextId(), companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  await signIn(ALI)
  await enterCashOpening({ bank_account_id: cash, amount: "1000000", at: "2026-10-01T09:00:00+05:00" })
  await enterExpense({ kind: "expense", bank_account_id: kassa2.id, category_id: db.financeCategories[0].id, amount: "150000", at: "2026-10-03T09:00:00+05:00" })
  setLocation("/accounts")
  renderWithProviders(<AccountsPage />)

  const list = await screen.findByRole("table", { name: "Akkauntlar" })
  expect(screen.getByRole("heading", { level: 1, name: "Kassa" })).toBeInTheDocument()
  const tabs = screen.getByRole("navigation", { name: "Moliya bo'limi" })
  expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual(["Kassa", "Xarajatlar", "O'tkazmalar"])
  expect(within(tabs).getByRole("link", { name: "Kassa" })).toHaveAttribute("aria-current", "page")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Akkaunt", "Valyuta", "Qoldiq"])
  const rows = within(list).getAllByRole("row").slice(1)
  // The name is the way into the account; the one turned off says so beside it.
  expect(rows.map((row) => within(row).getByRole("link").getAttribute("href"))).toEqual([`/accounts/${cash}`, `/accounts/${kassa2.id}`, `/accounts/${eski.id}`])
  expect(within(rows[1]).getByRole("link", { name: "Kassa 2" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("link", { name: "Naqd" })).toHaveAttribute("href", `/accounts/${cash}`)
  expect(within(rows[0]).getByText("UZS")).toBeInTheDocument()
  expect(within(rows[0]).getByText("1 000 000 so'm")).toBeInTheDocument()
  expect(within(rows[1]).getByText("−150 000 so'm")).toBeInTheDocument()
  expect(within(rows[2]).getByText("Nofaol")).toBeInTheDocument()
  expect(within(rows[2]).getByText("0 so'm")).toBeInTheDocument()
})

test("whoever may not see the finance is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/accounts")
  renderWithProviders(<AccountsPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
