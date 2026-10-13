import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { FinanceCategoriesPage } from "./finance-categories-page"

const namesOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector('[data-slot="row-title"] > span')?.textContent)
const expenses = () => screen.getByRole("list", { name: "Xarajat kategoriyalari" })
// actOn opens a category's sheet of actions and takes one.
async function actOn(user: { click: (element: Element) => Promise<void> }, name: string, action: string) {
  await user.click(within(expenses()).getByRole("button", { name: new RegExp(`^${name}`) }))
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: action }))
}

test("the owner's categories as the prototype's page: the kind segmented, its categories as rows; added from the plus's sheet (a name taken refused), renamed, turned off and deleted from a row's sheet of actions", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<FinanceCategoriesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Moliya kategoriyalari" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.getByRole("tab", { name: "Xarajat" })).toHaveAttribute("aria-selected", "true")
  expect(await screen.findByText("Hali kategoriya yo'q")).toBeInTheDocument()
  expect(screen.getByText("Xarajat kiritish uchun kamida bitta kategoriya kerak.")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  let sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Ijara")
  await user.type(within(sheet).getByLabelText("Nomi"), " Ijara ")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect((await screen.findAllByText("Kategoriya qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(namesOf(expenses())).toEqual(["Ijara"]))
  expect(screen.getByRole("heading", { level: 2, name: "1 ta kategoriya" })).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(sheet).getByLabelText("Nomi"), "ijara")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli kategoriya allaqachon bor")).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  // The incomes are a segment away; the same name is free there.
  await user.click(screen.getByRole("tab", { name: "Kirim" }))
  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Foiz")
  await user.type(within(sheet).getByLabelText("Nomi"), "Ijara")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  await waitFor(async () => expect(namesOf(await screen.findByRole("list", { name: "Kirim kategoriyalari" }))).toEqual(["Ijara"]))
  await user.click(screen.getByRole("tab", { name: "Xarajat" }))
  await screen.findByRole("list", { name: "Xarajat kategoriyalari" })

  await actOn(user, "Ijara", "Nomini o'zgartirish")
  sheet = await screen.findByRole("dialog", { name: "Kategoriya nomini o'zgartirish" })
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Ofis ijarasi")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(namesOf(expenses())).toEqual(["Ofis ijarasi"]))

  await actOn(user, "Ofis ijarasi", "Nofaol qilish")
  expect((await screen.findAllByText("Kategoriya nofaol qilindi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(within(expenses()).getByText("Nofaol")).toBeInTheDocument())
  expect(db.financeCategories.find((c) => c.name === "Ofis ijarasi")?.active).toBe(false)

  await actOn(user, "Ofis ijarasi", "O'chirish")
  await user.click(within(await screen.findByRole("alertdialog", { name: "Kategoriyani o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Kategoriya o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("list", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument())
  expect(db.financeCategories.find((c) => c.name === "Ofis ijarasi")?.deleted).toBe(true)
})

test("settings.view alone reads the categories without the way to change them", async () => {
  db.financeCategories.push({ id: 7001, companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<FinanceCategoriesPage />)

  expect(namesOf(await screen.findByRole("list", { name: "Xarajat kategoriyalari" }))).toEqual(["Ijara"])
  expect(within(expenses()).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Kategoriya qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Tartiblash" })).not.toBeInTheDocument()
})
