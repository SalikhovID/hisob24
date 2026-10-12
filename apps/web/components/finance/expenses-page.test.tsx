import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { enterExpense } from "@/test/finance"
import { ExpensesPage } from "./expenses-page"

// spent gives Olma Savdo its categories and three documents: rent out of
// the cash on the 3rd, the utilities out of the second cash on the 2nd,
// other income into the cash on the 4th.
async function spent() {
  const cash = db.accounts[1][0].id
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  db.accounts[1].push(kassa2)
  const ijara = { id: nextId(), companyId: 1, name: "Ijara", kind: "expense" as const, position: 1, active: true }
  const kommunal = { id: nextId(), companyId: 1, name: "Kommunal", kind: "expense" as const, position: 2, active: true }
  const boshqa = { id: nextId(), companyId: 1, name: "Boshqa kirim", kind: "income" as const, position: 1, active: true }
  db.financeCategories.push(ijara, kommunal, boshqa)
  await signIn(ALI)
  const rent = await enterExpense({ kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "150000", at: "2026-10-03T09:00:00+05:00" })
  const utilities = await enterExpense({ kind: "expense", bank_account_id: kassa2.id, category_id: kommunal.id, amount: "40000.5", at: "2026-10-02T09:00:00+05:00" })
  const income = await enterExpense({ kind: "income", bank_account_id: cash, category_id: boshqa.id, amount: "200000", at: "2026-10-04T09:00:00+05:00" })
  return { cash, kassa2, ijara, kommunal, boshqa, rent, utilities, income }
}

const table = (name: string) => screen.findByRole("table", { name })
const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("rowheader").textContent)

test("the expenses of the kind chosen, the newest first, each under its category and out of its account, with its actions; the kind, the account, the category and the days narrow the list and stay in the address", async () => {
  const { kassa2, kommunal, rent } = await spent()
  setLocation("/expenses")
  const { user } = renderWithProviders(<ExpensesPage />)

  const list = await table("Xarajatlar")
  expect(screen.getByRole("heading", { level: 1, name: "Xarajatlar" })).toBeInTheDocument()
  expect(within(screen.getByRole("navigation", { name: "Moliya bo'limi" })).getByRole("link", { name: "Xarajatlar" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("tab", { name: "Xarajat" })).toHaveAttribute("aria-selected", "true")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Summa", "Qo'shgan", "Amallar"])
  expect(titles(list)).toEqual(["№ 1 · Ijara03.10.2026 09:00 · Naqd", "№ 2 · Kommunal02.10.2026 09:00 · Kassa 2"])
  const rows = within(list).getAllByRole("row").slice(1)
  expect(within(rows[0]).getByText("150 000 so'm")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "Tahrirlash: 150 000" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 150 000" })).toBeInTheDocument()
  expect(within(rows[1]).getByText("40 000,50 so'm")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xarajat qo'shish" })).toBeInTheDocument()
  expect(rent.number).toBe(1)

  // The incomes are a tab away; the address says which.
  await user.click(screen.getByRole("tab", { name: "Kirim" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses?kind=income"))
  expect(titles(await table("Kirimlar"))).toEqual(["№ 1 · Boshqa kirim04.10.2026 09:00 · Naqd"])
  expect(screen.getByRole("button", { name: "Kirim qo'shish" })).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: "Xarajat" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses"))

  // An account, a category, a span of days.
  await choose(user, screen.getByRole("combobox", { name: "Akkaunt" }), "Kassa 2 (so'm)")
  await waitFor(() => expect(currentUrl()).toBe(`/expenses?account_id=${kassa2.id}`))
  await waitFor(() => expect(titles(screen.getByRole("table", { name: "Xarajatlar" }))).toEqual(["№ 2 · Kommunal02.10.2026 09:00 · Kassa 2"]))
  await choose(user, screen.getByRole("combobox", { name: "Akkaunt" }), "Hamma akkauntlar")
  await choose(user, screen.getByRole("combobox", { name: "Kategoriya" }), "Kommunal")
  await waitFor(() => expect(currentUrl()).toBe(`/expenses?category_id=${kommunal.id}`))
  await choose(user, screen.getByRole("combobox", { name: "Kategoriya" }), "Hamma kategoriyalar")
  fireEvent.change(screen.getByLabelText("Sanadan"), { target: { value: "2026-10-03" } })
  await waitFor(() => expect(currentUrl()).toBe("/expenses?from=2026-10-03"))
  await waitFor(() => expect(titles(screen.getByRole("table", { name: "Xarajatlar" }))).toEqual(["№ 1 · Ijara03.10.2026 09:00 · Naqd"]))
  fireEvent.change(screen.getByLabelText("Sanagacha"), { target: { value: "2026-10-02" } })
  await waitFor(() => expect(currentUrl()).toBe("/expenses?from=2026-10-03&to=2026-10-02"))
  expect(await screen.findByText("Sana noto'g'ri")).toBeInTheDocument()
})

test("the list opens as the address says; none of the kind yet says so", async () => {
  const { kassa2 } = await spent()
  // No income went into the second cash.
  setLocation(`/expenses?kind=income&account_id=${kassa2.id}`)
  const { unmount } = renderWithProviders(<ExpensesPage />)
  expect(await screen.findByText("Hech narsa topilmadi")).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Kirim" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("combobox", { name: "Akkaunt" })).toHaveTextContent("Kassa 2 (so'm)")
  unmount()

  db.transactions.length = 0
  setLocation("/expenses")
  renderWithProviders(<ExpensesPage />)
  expect(await screen.findByText("Hali xarajat yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi xarajatni «Xarajat qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
})

test("whoever may not see the finance is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/expenses")
  renderWithProviders(<ExpensesPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
