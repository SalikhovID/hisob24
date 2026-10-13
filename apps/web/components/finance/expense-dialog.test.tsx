import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, nextId } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose, optionsOf } from "@/test/select"
import { signIn } from "@/test/session"
import { enterExpense } from "@/test/finance"
import { ExpenseDialog } from "./expense-dialog"

// Opened is the sheet as a page opens it (the account's tile, a document's
// «Tahrirlash»): open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof ExpenseDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <ExpenseDialog {...props} open={open} onOpenChange={setOpen} />
}

// categories gives Olma Savdo an expense category and an income category.
function categories() {
  const ijara = { id: nextId(), companyId: 1, name: "Ijara", kind: "expense" as const, position: 1, active: true }
  const eski = { id: nextId(), companyId: 1, name: "Eski", kind: "expense" as const, position: 2, active: false }
  const boshqa = { id: nextId(), companyId: 1, name: "Boshqa kirim", kind: "income" as const, position: 1, active: true }
  db.financeCategories.push(ijara, eski, boshqa)
  return { ijara, eski, boshqa }
}

test("an expense is entered out of the account given, under a category of its kind (the active ones are offered), the amount typed the Uzbek way, now, a note", async () => {
  const { ijara } = categories()
  const cash = db.accounts[1][0].id
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} kind="expense" accountId={cash} />)

  const dialog = await screen.findByRole("dialog", { name: "Xarajat qo'shish" })
  // The accounts come with the session: the row says the account once they are known.
  await waitFor(() => expect(within(dialog).getByLabelText("Akkaunt")).toHaveTextContent("Naqd (so'm)"))
  // The amount stands with its account's currency; the note may be left empty.
  expect(within(dialog).getByText("so'm")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Izoh")).toHaveAttribute("placeholder", "ixtiyoriy")
  expect((within(dialog).getByLabelText("Vaqt") as HTMLInputElement).value).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Kategoriyani tanlang")).toBeInTheDocument()
  expect(await optionsOf(user, within(dialog).getByLabelText("Kategoriya"))).toEqual(["Ijara"])
  await choose(user, within(dialog).getByLabelText("Kategoriya"), "Ijara")
  await user.type(within(dialog).getByLabelText("Summa"), "150 000")
  await user.type(within(dialog).getByLabelText("Izoh"), " Oktabr ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "expense")).toMatchObject({ number: 1, bankAccountId: cash, categoryId: ijara.id, total: 150000, note: "Oktabr" }))
  expect((await screen.findAllByText("Hujjat qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("with no category of the kind yet the dialog says to make one in the settings, and leads there for whoever may", async () => {
  await signIn(ALI)
  const { unmount } = renderWithProviders(<Opened companyId={1} kind="income" settingsAllowed />)
  const dialog = await screen.findByRole("dialog", { name: "Kirim qo'shish" })
  expect(await within(dialog).findByText("Avval Sozlamalarda kirim kategoriyasini yarating.")).toBeInTheDocument()
  expect(within(dialog).getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings?tab=finance")
  unmount()

  renderWithProviders(<Opened companyId={1} kind="income" />)
  const again = await screen.findByRole("dialog", { name: "Kirim qo'shish" })
  expect(await within(again).findByText("Kompaniya egasi Sozlamalarda kirim kategoriyasini yaratishi kerak.")).toBeInTheDocument()
  expect(within(again).queryByRole("link", { name: "Sozlamalarni ochish" })).not.toBeInTheDocument()
})

test("an expense is edited from its fields: its category offered among the active ones and its own", async () => {
  const { ijara, eski } = categories()
  const cash = db.accounts[1][0].id
  await signIn(ALI)
  const rent = await enterExpense({ kind: "expense", bank_account_id: cash, category_id: ijara.id, amount: "150000", at: "2026-10-03T09:00:00+05:00", note: "Oktabr" })
  const { user } = renderWithProviders(<Opened companyId={1} kind="expense" expense={rent} />)

  const dialog = await screen.findByRole("dialog", { name: "Xarajatni tahrirlash" })
  await waitFor(() => expect(within(dialog).getByLabelText("Kategoriya")).toHaveTextContent("Ijara"))
  expect(within(dialog).getByLabelText("Summa")).toHaveValue("150000.00")
  expect(within(dialog).getByLabelText("Vaqt")).toHaveValue("2026-10-03T09:00")
  expect(within(dialog).getByLabelText("Izoh")).toHaveValue("Oktabr")
  expect(await optionsOf(user, within(dialog).getByLabelText("Kategoriya"))).toEqual(["Ijara"])
  await user.clear(within(dialog).getByLabelText("Summa"))
  await user.type(within(dialog).getByLabelText("Summa"), "160000")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === rent.id)).toMatchObject({ total: 160000, categoryId: ijara.id, kind: "expense" }))
  expect((await screen.findAllByText("Hujjat saqlandi")).length).toBeGreaterThan(0)
  expect(eski.active).toBe(false)
})
