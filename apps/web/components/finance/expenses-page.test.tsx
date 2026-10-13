import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
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

// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}
// day is the rows of a day's group in the list.
const day = (list: HTMLElement, name: string) => within(within(list).getByRole("list", { name })).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)

test("the expenses of the kind chosen as the prototype's list: by their day, the newest first, each by its number and category, its time, account and who entered it under it, the amount at its end; the kind, the account and the category narrow it and stay in the address", async () => {
  const { kassa2, kommunal } = await spent()
  setLocation("/expenses")
  const { user } = renderWithProviders(<ExpensesPage />)

  const list = await screen.findByRole("region", { name: "Xarajatlar" })
  expect(screen.getByRole("heading", { level: 1, name: "Xarajatlar" })).toBeInTheDocument()
  expect(within(screen.getByRole("navigation", { name: "Moliya bo'limi" })).getByRole("link", { name: "Xarajatlar" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("tab", { name: "Xarajat" })).toHaveAttribute("aria-selected", "true")
  expect(day(list, "3-oktabr, shanba").map(parts)).toEqual([{ title: "№ 1 · Ijara", sub: "09:00 · Naqd · Ali V.", end: "150 000 so'm" }])
  expect(day(list, "2-oktabr, juma").map(parts)).toEqual([{ title: "№ 2 · Kommunal", sub: "09:00 · Kassa 2 · Ali V.", end: "40 000,50 so'm" }])
  expect(screen.getByText("Jami: 2")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xarajat qo'shish" })).toBeInTheDocument()

  // The incomes are a tab away; the address says which.
  await user.click(screen.getByRole("tab", { name: "Kirim" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses?kind=income"))
  expect(day(await screen.findByRole("region", { name: "Kirimlar" }), "4-oktabr, yakshanba").map((row) => parts(row).title)).toEqual(["№ 1 · Boshqa kirim"])
  expect(screen.getByRole("button", { name: "Kirim qo'shish" })).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: "Xarajat" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses"))

  // An account and a category, each picked in its sheet; the chip says the one picked.
  await choose(user, await screen.findByRole("button", { name: "Akkaunt" }), "Kassa 2 (so'm)")
  await waitFor(() => expect(currentUrl()).toBe(`/expenses?account_id=${kassa2.id}`))
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Xarajatlar" })).getAllByRole("listitem").map((item) => parts(item.firstElementChild as HTMLElement).title)).toEqual(["№ 2 · Kommunal"]))
  expect(screen.getByRole("button", { name: "Kassa 2" })).toHaveAttribute("aria-pressed", "true")
  await choose(user, screen.getByRole("button", { name: "Kassa 2" }), "Hamma akkauntlar")
  await waitFor(() => expect(currentUrl()).toBe("/expenses"))
  await choose(user, screen.getByRole("button", { name: "Kategoriya" }), "Kommunal")
  await waitFor(() => expect(currentUrl()).toBe(`/expenses?category_id=${kommunal.id}`))
  await choose(user, screen.getByRole("button", { name: "Kommunal" }), "Hamma kategoriyalar")
  await waitFor(() => expect(currentUrl()).toBe("/expenses"))
})

test("the days: each bound picked in the calendar sheet, let go there too; a span turned around is refused", async () => {
  await spent()
  setLocation("/expenses?from=2026-10-03")
  const { user, unmount } = renderWithProviders(<ExpensesPage />)

  const list = await screen.findByRole("region", { name: "Xarajatlar" })
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1))
  await user.click(screen.getByRole("button", { name: "03.10.2026 dan" }))
  const from = await screen.findByRole("dialog", { name: "Sanadan" })
  await user.click(within(from).getByRole("button", { name: "02.10.2026" }))
  await user.click(within(from).getByRole("button", { name: "Tanlash" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses?from=2026-10-02"))
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Xarajatlar" })).getAllByRole("listitem")).toHaveLength(2))
  await user.click(screen.getByRole("button", { name: "02.10.2026 dan" }))
  await user.click(within(await screen.findByRole("dialog", { name: "Sanadan" })).getByRole("button", { name: "Hamma kunlar" }))
  await waitFor(() => expect(currentUrl()).toBe("/expenses"))
  expect(screen.getByRole("button", { name: "Sanagacha" })).toHaveAttribute("aria-pressed", "false")
  unmount()

  setLocation("/expenses?from=2026-10-03&to=2026-10-02")
  renderWithProviders(<ExpensesPage />)
  expect(await screen.findByText("Sana noto'g'ri")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "02.10.2026 gacha" })).toHaveAttribute("aria-pressed", "true")
})

test("a row opens the sheet of its actions: editing in the expense's sheet, deleting after asking", async () => {
  await spent()
  setLocation("/expenses")
  const { user } = renderWithProviders(<ExpensesPage />)
  const [rent] = day(await screen.findByRole("region", { name: "Xarajatlar" }), "3-oktabr, shanba")

  await user.click(rent)
  const sheet = await screen.findByRole("menu")
  expect(sheet).toHaveTextContent("№ 1 · Ijara · 150 000 so'm")
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  await user.click(within(sheet).getByRole("menuitem", { name: "Tahrirlash" }))
  const edit = await screen.findByRole("dialog", { name: "Xarajatni tahrirlash" })
  expect(within(edit).getByLabelText("Summa")).toHaveValue("150000.00")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(rent)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "O'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })).toBeInTheDocument()
})

test("the plus opens the sheet of the kind chosen", async () => {
  await spent()
  setLocation("/expenses?kind=income")
  const { user } = renderWithProviders(<ExpensesPage />)
  await user.click(await screen.findByRole("button", { name: "Kirim qo'shish" }))
  expect(await screen.findByRole("dialog", { name: "Kirim qo'shish" })).toBeInTheDocument()
})

test("the list opens as the address says; none of the kind yet says so", async () => {
  const { kassa2 } = await spent()
  // No income went into the second cash.
  setLocation(`/expenses?kind=income&account_id=${kassa2.id}`)
  const { unmount } = renderWithProviders(<ExpensesPage />)
  expect(await screen.findByText("Hech narsa topilmadi")).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Kirim" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("button", { name: "Kassa 2" })).toHaveAttribute("aria-pressed", "true")
  unmount()

  db.transactions.length = 0
  setLocation("/expenses")
  renderWithProviders(<ExpensesPage />)
  expect(await screen.findByText("Hali xarajat yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi xarajatni «Xarajat qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
})

test("whoever may see the finance alone sees the rows without their sheet and no plus", async () => {
  await spent()
  giveRole(VALI, 1, "Kuzatuvchi", ["finance.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/expenses")
  renderWithProviders(<ExpensesPage />)
  const [rent] = day(await screen.findByRole("region", { name: "Xarajatlar" }), "3-oktabr, shanba")
  expect(rent.tagName).toBe("DIV")
  expect(screen.queryByRole("button", { name: "Xarajat qo'shish" })).not.toBeInTheDocument()
})

test("whoever may not see the finance is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/expenses")
  renderWithProviders(<ExpensesPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
