import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { RolesPage } from "./roles-page"

const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const { title, sub, end } = rowParts(item.firstElementChild as HTMLElement)
      return [title, sub, end]
    })

test("the owner's roles as the prototype's rows: each by name, the sections it opens under it, who holds it at its end; the plus leads to a new one", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["customers.view", "customers.create", "tasks.view"])
  db.roles.push({ id: nextId(), companyId: 1, name: "Kuzatuvchi", permissions: ["tasks.view"] })
  await signIn(ALI)
  renderWithProviders(<RolesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Rollar" })).toBeInTheDocument()
  expect(screen.getByText("Rol xodimga qaysi bo'limlarda nima qilishi mumkinligini belgilaydi.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  const roles = await screen.findByRole("list", { name: "Rollar" })
  expect(rowsOf(roles)).toEqual([
    ["Kuzatuvchi", "Vazifalar", "Hech kimda"],
    ["Sotuvchi", "Mijozlar, Vazifalar", "1 ta xodim"],
  ])
  const sotuvchi = db.roles.find((role) => role.name === "Sotuvchi")!
  expect(within(roles).getAllByRole("link")[1]).toHaveAttribute("href", `/settings/roles/${sotuvchi.id}`)
  expect(screen.getByRole("link", { name: "Rol qo'shish" })).toHaveAttribute("href", "/settings/roles/new")
})

test("with no role yet the page says what a role is for", async () => {
  await signIn(ALI)
  renderWithProviders(<RolesPage />)

  expect(await screen.findByText("Hali rol yo'q")).toBeInTheDocument()
  expect(screen.getByText("Xodimga rol berilsa, u faqat shu rol ruxsatlari bilan ishlaydi.")).toBeInTheDocument()
})

test("an employee who may open the settings is sent home: the roles are the owner's", async () => {
  giveRole(VALI, 1, "Sozlovchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<RolesPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("list", { name: "Rollar" })).not.toBeInTheDocument()
})
