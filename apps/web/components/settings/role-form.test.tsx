import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { RoleForm } from "./role-form"

// The matrix is a group per section under its heading, a switch per action in it.
const group = (name: string) => screen.getByRole("group", { name })
const box = (section: string, action: string) => within(group(section)).getByRole("switch", { name: action })

test("the matrix as the prototype's: a heading per section (how many it holds beside it) over its actions' switches; an action brings its section's view with it, and the view taken away takes the actions with it", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<RoleForm companyId={1} />)

  for (const section of ["Mijozlar", "Vazifalar", "Mahsulotlar", "Ta'minotchilar", "Xaridlar", "Sotuv", "Ombor hujjatlari", "Moliya", "Xodimlar", "Sozlamalar"]) {
    expect(group(section)).toBeInTheDocument()
  }
  expect(within(group("Mijozlar")).getAllByRole("switch")).toHaveLength(5)
  expect(within(group("Xodimlar")).queryByRole("switch", { name: "Tarix" })).not.toBeInTheDocument()
  expect(within(group("Xodimlar")).getAllByRole("switch")).toHaveLength(4)
  expect(within(group("Xaridlar")).getAllByRole("switch")).toHaveLength(4)
  expect(within(group("Moliya")).getAllByRole("switch")).toHaveLength(4)
  expect(screen.getByLabelText("Rol nomi")).toHaveAttribute("placeholder", "Masalan, Sotuvchi")
  expect(screen.getByText("Amal yoqilsa «Ko'rish» o'zi yoqiladi. «Ko'rish» o'chirilsa, bo'limning hamma amali tozalanadi.")).toBeInTheDocument()

  await user.click(box("Mijozlar", "Qo'shish"))
  expect(box("Mijozlar", "Qo'shish")).toBeChecked()
  expect(box("Mijozlar", "Ko'rish")).toBeChecked()
  expect(box("Vazifalar", "Ko'rish")).not.toBeChecked()
  expect(screen.getByRole("heading", { level: 2, name: "Mijozlar" }).parentElement).toHaveTextContent("2 ta")

  await user.click(box("Mijozlar", "Ko'rish"))
  expect(box("Mijozlar", "Ko'rish")).not.toBeChecked()
  expect(box("Mijozlar", "Qo'shish")).not.toBeChecked()
})

test("a new role is made with its name and permissions, in the catalog's order, and the roles open", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<RoleForm companyId={1} />)

  await user.type(screen.getByLabelText("Rol nomi"), " Sotuvchi ")
  await user.click(box("Vazifalar", "Ko'rish"))
  await user.click(box("Mijozlar", "Tahrirlash"))
  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings/roles"))
  expect(db.roles.map((role) => [role.name, role.permissions])).toEqual([["Sotuvchi", ["customers.view", "customers.edit", "tasks.view"]]])
  expect(await screen.findByText("Rol yaratildi")).toBeInTheDocument()
})

test("a role needs a name; a name another role has is refused by the API, and the form stays", async () => {
  db.roles.push({ id: 900, companyId: 1, name: "Sotuvchi", permissions: [] })
  await signIn(ALI)
  const { user } = renderWithProviders(<RoleForm companyId={1} />)

  await user.click(screen.getByRole("button", { name: "Yaratish" }))
  expect(await screen.findByText("Nomni kiriting")).toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText("Rol nomi"), "sotuvchi")
  await user.click(screen.getByRole("button", { name: "Yaratish" }))
  expect(await screen.findByText("Bu nomli rol allaqachon bor")).toBeInTheDocument()
  expect(db.roles).toHaveLength(1)
  expect(router.push).not.toHaveBeenCalled()
})
