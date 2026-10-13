import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, membersOf, nextId, SARDOR, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { EmployeesPage } from "./employees-page"

// rows are the members in the list, each a row that opens the member's sheet.
async function rows() {
  const list = await screen.findByRole("list", { name: "Xodimlar" })
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.firstElementChild as HTMLElement)
}
// said is what a row says: its title (with «Siz»), the line under it and its end, the spaces plain.
const said = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ").trim() ?? null
  const { title, sub, end } = rowParts(row)
  return [plain(title), plain(sub), plain(end)]
}
// sheetOf opens a member's sheet from their row.
async function sheetOf(user: { click: (element: Element) => Promise<void> }, index: number) {
  await user.click((await rows())[index])
  return screen.findByRole("dialog", { name: "Xodim" })
}

test("the owner sees the company's members as the prototype's rows: themselves first, then the employees, each by name with the phone under it and the role at the end", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["customers.view"])
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect((await rows()).map(said)).toEqual([
    ["Ali Valiyev Siz", "+998 90 123 45 67", "Egasi"],
    ["Vali Aliyev", "+998 90 222 33 44", "Sotuvchi"],
    ["Sardor Karimov", "+998 90 333 44 55", "Xodim"],
  ])
  expect(screen.getByText("Kompaniyangiz a'zolari · 3 kishi")).toBeInTheDocument()
  expect(screen.getByText("Jami: 3. Xodim o'z raqami bilan SMS kod yoki Telegram bot orqali kiradi.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xodim qo'shish" })).toBeInTheDocument()
})

test("a member without a name goes by their phone, said once", async () => {
  await signIn(ALI)
  db.users[VALI] = null
  renderWithProviders(<EmployeesPage />)

  const [, vali] = await rows()
  expect(said(vali)).toEqual(["+998 90 222 33 44", null, "Xodim"])
})

test("an employee is sent home: the page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  let asked = false
  server.use(
    http.get("*/api/app/employees", () => {
      asked = true
      return HttpResponse.json([])
    }),
  )
  renderWithProviders(<EmployeesPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { name: "Xodimlar" })).not.toBeInTheDocument()
  expect(asked).toBe(false)
})

test("a list that fails to load says why and can be asked for again", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/employees", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<EmployeesPage />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await rows()).toHaveLength(3)
})

test("an owner with nobody added yet is told how to add someone; with employees there is no such hint", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { unmount } = renderWithProviders(<EmployeesPage />)
  expect(await rows()).toHaveLength(1)
  expect(screen.getByText(/Hali xodim yo'q/)).toBeInTheDocument()
  unmount()

  db.cooldown = false
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)
  expect(await rows()).toHaveLength(3)
  expect(screen.queryByText(/Hali xodim yo'q/)).not.toBeInTheDocument()
})

test("an employee is added from the plus's sheet and joins the list; the sheet opened again starts empty", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  await rows()

  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  let sheet = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  // The owner's own number is a member already: refused, nobody added.
  await user.type(within(sheet).getByLabelText("Telefon"), "901234567")
  await user.type(within(sheet).getByLabelText("Ism"), "Ali")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  await within(sheet).findByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")
  await user.click(within(sheet).getByRole("button", { name: "Yopish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  sheet = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  expect(within(sheet).getByLabelText("Telefon")).toHaveValue("")
  expect(within(sheet).getByLabelText("Ism")).toHaveValue("")
  expect(within(sheet).queryByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).not.toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Telefon"), "907778899")
  await user.type(within(sheet).getByLabelText("Ism"), "Yangi Xodim")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect((await rows()).map(said)).toContainEqual(["Yangi Xodim", "+998 90 777 88 99", "Xodim"]))
})

test("a row opens the member's sheet: an employee is renamed there and the row follows; the owner's sheet changes nothing", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  const owner = await sheetOf(user, 0)
  expect(within(owner).getByRole("heading", { level: 2, name: "Ali Valiyev" })).toBeInTheDocument()
  expect(within(owner).queryByRole("button", { name: /^Ism/ })).not.toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  const vali = await sheetOf(user, 1)
  await user.click(within(vali).getByRole("button", { name: /^Ism/ }))
  const rename = await screen.findByRole("dialog", { name: "Ismni o'zgartirish" })
  await user.clear(within(rename).getByLabelText("Ism"))
  await user.type(within(rename).getByLabelText("Ism"), "Vali (hisobchi)")
  await user.click(within(rename).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ismni o'zgartirish" })).not.toBeInTheDocument())
  // The sheet stays, with the new name; closed, the row under it says it too.
  expect(await within(screen.getByRole("dialog", { name: "Xodim" })).findByRole("heading", { level: 2, name: "Vali (hisobchi)" })).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(said((await rows())[1])[0]).toBe("Vali (hisobchi)")
})

test("an employee is removed from their sheet after asking; cancelling keeps them; the sheet goes with them", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  let sheet = await sheetOf(user, 1)
  await user.click(within(sheet).getByRole("button", { name: "Xodimni o'chirish" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  expect(within(confirm).getByText(/Vali Aliyev Olma Savdo kompaniyasiga kira olmaydi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(screen.getByRole("dialog", { name: "Xodim" })).toBeInTheDocument()

  sheet = screen.getByRole("dialog", { name: "Xodim" })
  await user.click(within(sheet).getByRole("button", { name: "Xodimni o'chirish" }))
  confirm = await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect((await screen.findAllByText("Xodim o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect((await rows()).map((row) => said(row)[0])).toEqual(["Ali Valiyev Siz", "Sardor Karimov"]))
})

test("an employee whose role lets them see the employees sees the list and the sheets, without the actions the role lacks", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["employees.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<EmployeesPage />)

  expect(await rows()).toHaveLength(3)
  expect(screen.queryByRole("button", { name: "Xodim qo'shish" })).not.toBeInTheDocument()
  const sardor = await sheetOf(user, 2)
  expect(within(sardor).queryByRole("button", { name: /^(Ism|Rol|Lokatsiyalar|Xodimni o'chirish)/ })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("the employees actions follow the role: adding and renaming, not deleting; the role is the owner's alone", async () => {
  giveRole(VALI, 1, "HR", ["employees.view", "employees.create", "employees.edit"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<EmployeesPage />)

  await rows()
  expect(screen.getByRole("button", { name: "Xodim qo'shish" })).toBeInTheDocument()
  const sardor = await sheetOf(user, 2)
  expect(within(sardor).getByRole("button", { name: /^Ism/ })).toBeInTheDocument()
  expect(within(sardor).queryByRole("button", { name: "Xodimni o'chirish" })).not.toBeInTheDocument()
  expect(within(sardor).queryByRole("button", { name: /^Rol/ })).not.toBeInTheDocument()
})

test("the owner gives an employee a role from their sheet, and takes it away again: the row follows", async () => {
  const sotuvchi = { id: nextId(), companyId: 1, name: "Sotuvchi", permissions: ["customers.view" as const] }
  db.roles.push(sotuvchi)
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  let sheet = await sheetOf(user, 1)
  await user.click(within(sheet).getByRole("button", { name: /^Rol/ }))
  await user.click(await within(await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })).findByRole("option", { name: /^Sotuvchi/ }))
  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBe(sotuvchi.id))
  // The sheet stays and says the role; closed, the row says it too.
  sheet = screen.getByRole("dialog", { name: "Xodim" })
  await waitFor(() => expect(within(sheet).getByRole("button", { name: /^Rol/ })).toHaveTextContent("Sotuvchi"))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(said((await rows())[1])[2]).toBe("Sotuvchi")

  sheet = await sheetOf(user, 1)
  await user.click(within(sheet).getByRole("button", { name: /^Rol/ }))
  await user.click(await within(await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })).findByRole("option", { name: "Rolsiz" }))
  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBeUndefined())
  await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Xodim" })).getByRole("button", { name: /^Rol/ })).toHaveTextContent("Rolsiz"))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(said((await rows())[1])[2]).toBe("Xodim")
})

test("with two or more locations each row says where the member works: every one, the restriction's live ones, or none; with one it says nothing of them", async () => {
  await signIn(ALI)
  const { unmount } = renderWithProviders(<EmployeesPage />)
  expect((await rows()).map((row) => row.querySelector("[data-slot=row-end-sub]"))).toEqual([null, null, null])
  unmount()

  const chilonzor = addLocation(1, "Chilonzor")
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  restrictTo(VALI, 1, [chilonzor.id, gone.id])
  restrictTo(SARDOR, 1, [gone.id])
  db.cooldown = false
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)
  const where = (row: HTMLElement) => row.querySelector("[data-slot=row-end-sub]")?.textContent
  await waitFor(async () => expect((await rows()).map(where)).toEqual(["Barchasi", "Chilonzor", "—"]))
})

test("the owner restricts an employee from their sheet, and the row says where they work now", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  const sheet = await sheetOf(user, 1)
  await user.click(within(sheet).getByRole("button", { name: /^Lokatsiyalar/ }))
  const places = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  await user.click(within(places).getByRole("switch", { name: "Barcha lokatsiyalar" }))
  await user.click(await within(places).findByRole("checkbox", { name: "Asosiy" }))
  await user.click(within(places).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.locationIds).toEqual([chilonzor.id]))
  await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Xodim" })).getByRole("button", { name: /^Lokatsiyalar/ })).toHaveTextContent("Chilonzor"))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await rows())[1].querySelector("[data-slot=row-end-sub]")).toHaveTextContent("Chilonzor")
})

test("an employee who manages the employees sees the locations, not the way to change them", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(SARDOR, 1, [chilonzor.id])
  giveRole(VALI, 1, "HR", ["employees.view", "employees.create", "employees.edit", "employees.delete"])
  await signIn(VALI)
  await chooseCompany(1)
  const { user } = renderWithProviders(<EmployeesPage />)

  expect((await rows())[2].querySelector("[data-slot=row-end-sub]")).toHaveTextContent("Chilonzor")
  const sardor = await sheetOf(user, 2)
  expect(within(sardor).queryByRole("button", { name: /^Lokatsiyalar/ })).not.toBeInTheDocument()
  expect(within(sardor).getByRole("button", { name: "Xodimni o'chirish" })).toBeInTheDocument()
  expect(membersOf(1)).toHaveLength(3)
})
