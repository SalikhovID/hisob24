import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { allPermissions } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { ALI, db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { FinanceCategories } from "./finance-categories-page"

const namesOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) => row.querySelector('[data-slot="setting-title"]')?.textContent)

const viewOnly: Permission[] = ["settings.view"]

test("the owner adds expense and income categories, renames one, turns one off and deletes one", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<FinanceCategories companyId={1} permissions={allPermissions} />)

  expect(await screen.findByRole("heading", { level: 2, name: "Xarajat kategoriyalari" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Kirim kategoriyalari" })).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByText("Hali kategoriya yo'q")).toHaveLength(2))

  const [addExpense, addIncome] = screen.getAllByRole("button", { name: "Kategoriya qo'shish" })
  await user.click(addExpense)
  let dialog = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), " Ijara ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await screen.findByText("Kategoriya qo'shildi")).toBeInTheDocument()
  expect(namesOf(await screen.findByRole("list", { name: "Xarajat kategoriyalari" }))).toEqual(["Ijara"])

  await user.click(addExpense)
  dialog = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "ijara")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli kategoriya allaqachon bor")).toBeInTheDocument()
  await user.keyboard("{Escape}")

  await user.click(addIncome)
  dialog = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Ijara")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(namesOf(await screen.findByRole("list", { name: "Kirim kategoriyalari" }))).toEqual(["Ijara"])

  const expenses = () => screen.getByRole("list", { name: "Xarajat kategoriyalari" })
  await user.click(within(expenses()).getByRole("button", { name: "Nomini o'zgartirish: Ijara" }))
  dialog = await screen.findByRole("dialog", { name: "Kategoriya nomini o'zgartirish" })
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Ofis ijarasi")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(namesOf(expenses())).toEqual(["Ofis ijarasi"]))

  await user.click(within(expenses()).getByRole("button", { name: "Nofaol qilish: Ofis ijarasi" }))
  expect(await screen.findByText("Kategoriya nofaol qilindi")).toBeInTheDocument()
  await waitFor(() => expect(within(expenses()).getByText("Nofaol")).toBeInTheDocument())
  expect(db.financeCategories.find((c) => c.name === "Ofis ijarasi")?.active).toBe(false)

  await user.click(within(expenses()).getByRole("button", { name: "O'chirish: Ofis ijarasi" }))
  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Kategoriya o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("list", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument())
  expect(db.financeCategories.find((c) => c.name === "Ofis ijarasi")?.deleted).toBe(true)
})

test("settings.view alone reads the categories without the way to change them", async () => {
  db.financeCategories.push({ id: 7001, companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  await signIn(ALI)
  renderWithProviders(<FinanceCategories companyId={1} permissions={viewOnly} />)

  expect(namesOf(await screen.findByRole("list", { name: "Xarajat kategoriyalari" }))).toEqual(["Ijara"])
  expect(screen.queryByRole("button", { name: "Kategoriya qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Nomini o'zgartirish/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /O'chirish/ })).not.toBeInTheDocument()
})
