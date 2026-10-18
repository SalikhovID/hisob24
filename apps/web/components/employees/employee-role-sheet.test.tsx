import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { afterEach, expect, test } from "vitest"
import { ALI, db, membersOf, nextId, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { EmployeeRoleSheet } from "./employee-role-sheet"

// Opened is the picker as the employee's sheet opens it: open from the
// start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof EmployeeRoleSheet>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <EmployeeRoleSheet {...props} open={open} onOpenChange={setOpen} />
}

const vali = () => membersOf(1).find((m) => m.phone === VALI)!
const options = (sheet: HTMLElement) => within(sheet).getAllByRole("option").map((option) => option.textContent)
afterEach(() => server.events.removeAllListeners())

test("the owner gives an employee a role in the prototype's picker: «Rolsiz» first, each role with the sections it opens; a press saves it", async () => {
  const sotuvchi = { id: nextId(), companyId: 1, name: "Sotuvchi", permissions: ["customers.view" as const, "orders.view" as const] }
  db.roles.push(sotuvchi)
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} employee={vali()} />)

  const sheet = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  await waitFor(() => expect(options(sheet)).toEqual(["Rolsiz", "Sotuvchi Mijozlar, Vazifalar"]))
  expect(within(sheet).getByRole("option", { name: "Rolsiz" })).toHaveAttribute("aria-selected", "true")
  expect(within(sheet).getByText("Rolsiz xodim mijozlar va vazifalar bilan ishlaydi.")).toBeInTheDocument()
  await user.click(within(sheet).getByRole("option", { name: /^Sotuvchi/ }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBe(sotuvchi.id))
  expect((await screen.findAllByText("Rol o'zgartirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("«Rolsiz» takes the role away; the role held already, pressed again, asks nothing", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["customers.view"])
  await signIn(ALI)
  const asked: string[] = []
  server.events.on("request:start", ({ request }) => {
    if (request.method === "PUT") asked.push(new URL(request.url).pathname)
  })
  const { user, unmount } = renderWithProviders(<Opened companyId={1} employee={vali()} />)

  let sheet = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  await user.click(await within(sheet).findByRole("option", { name: /^Sotuvchi/ }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(asked).toEqual([])
  unmount()

  renderWithProviders(<Opened companyId={1} employee={vali()} />)
  sheet = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  await within(sheet).findByRole("option", { name: /^Sotuvchi/ })
  await user.click(within(sheet).getByRole("option", { name: "Rolsiz" }))
  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBeUndefined())
})

test("with no role to give, the picker says so and leads to the settings", async () => {
  await signIn(ALI)
  renderWithProviders(<Opened companyId={1} employee={vali()} />)

  const sheet = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  expect(await within(sheet).findByText(/Hali rol yo'q/)).toBeInTheDocument()
  expect(within(sheet).getByRole("link", { name: "Sozlamalarda rol yarating" })).toHaveAttribute("href", "/settings/roles")
  expect(options(sheet)).toEqual(["Rolsiz"])
})
