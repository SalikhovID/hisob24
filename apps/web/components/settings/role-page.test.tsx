import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { NewRolePage, RolePage } from "./role-page"

const group = (name: string) => screen.getByRole("group", { name })
const box = (section: string, action: string) => within(group(section)).getByRole("checkbox", { name: action })

// open puts the test on a role's page.
function open(id: number) {
  setLocation(`/settings/roles/${id}`, { id: String(id) })
  return renderWithProviders(<RolePage id={id} />)
}

test("a role's page opens with its name and permissions; saving replaces them and the roles tab opens", async () => {
  const role = giveRole(VALI, 1, "Sotuvchi", ["customers.view", "customers.create"])
  await signIn(ALI)
  const { user } = open(role.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Sotuvchi" })).toBeInTheDocument()
  expect(screen.getByText("Rol · 1 ta xodim")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings?tab=roles")
  expect(screen.getByLabelText("Rol nomi")).toHaveValue("Sotuvchi")
  expect(box("Mijozlar", "Qo'shish")).toBeChecked()
  expect(box("Mijozlar", "Ko'rish")).toBeChecked()
  expect(box("Vazifalar", "Ko'rish")).not.toBeChecked()

  await user.clear(screen.getByLabelText("Rol nomi"))
  await user.type(screen.getByLabelText("Rol nomi"), "Katta sotuvchi")
  await user.click(box("Vazifalar", "Ko'rish"))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings?tab=roles"))
  expect(db.roles.find((candidate) => candidate.id === role.id)).toMatchObject({
    name: "Katta sotuvchi",
    permissions: ["customers.view", "customers.create", "tasks.view"],
  })
  expect(await screen.findByText("Rol saqlandi")).toBeInTheDocument()
})

test("a role nobody holds is deleted from its page, and the roles tab opens", async () => {
  db.roles.push({ id: 900, companyId: 1, name: "Bo'sh", permissions: [] })
  await signIn(ALI)
  const { user } = open(900)

  await screen.findByRole("heading", { level: 1, name: "Bo'sh" })
  expect(screen.getByText("Rol · Hech kimda")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "O'chirish: Bo'sh" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Rolni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings?tab=roles"))
  expect(db.roles).toEqual([])
})

test("a role that is gone, or another company's, is not found", async () => {
  db.roles.push({ id: 901, companyId: 2, name: "Begona", permissions: [] })
  await signIn(ALI)
  open(901)

  expect(await screen.findByRole("heading", { level: 1, name: "Rol topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu rol o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings?tab=roles")
})

test("the page of a new role", async () => {
  await signIn(ALI)
  setLocation("/settings/roles/new")
  renderWithProviders(<NewRolePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi rol" })).toBeInTheDocument()
  expect(screen.getByLabelText("Rol nomi")).toHaveValue("")
  expect(screen.getByRole("button", { name: "Yaratish" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings?tab=roles")
})

test("an employee is sent home: the roles are the owner's", async () => {
  const role = giveRole(VALI, 1, "Sotuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  open(role.id)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByLabelText("Rol nomi")).not.toBeInTheDocument()
})
