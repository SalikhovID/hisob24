import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, membersOf, nextId, SARDOR, seedTasks, VALI } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { EmployeesPage } from "./employees-page"

// rows are the members in the table (the page shows them as cards too, for
// phones): the row of each, without the header.
async function rows() {
  const table = await screen.findByRole("table", { name: "Xodimlar" })
  return within(table).getAllByRole("row").slice(1)
}

// A member is one identity, heading its row: the name over the phone.
const nameAndPhone = (row: HTMLElement) => identityOf(within(row).getByRole("rowheader"))

test("the owner sees the company's members: themselves first, then the employees", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await screen.findByRole("heading", { name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  const members = await rows()
  expect(members.map(nameAndPhone)).toEqual([
    ["Ali Valiyev", "+998 90 123 45 67"],
    ["Vali Aliyev", "+998 90 222 33 44"],
    ["Sardor Karimov", "+998 90 333 44 55"],
  ])
  const headers = within(screen.getByRole("table", { name: "Xodimlar" })).getAllByRole("columnheader")
  expect(headers[0]).toHaveTextContent("A'zo")
  expect(headers.map((header) => header.textContent)).not.toContain("Telefon")
  expect(within(members[0]).getByText("Egasi")).toBeInTheDocument()
  // "Siz" says who the row is, so it stands by the name; the role column
  // holds the role alone.
  expect(within(within(members[0]).getByRole("rowheader")).getByText("Siz")).toBeInTheDocument()
  expect(within(members[0]).getAllByText("Siz")).toHaveLength(1)
  expect(within(members[1]).getByText("Xodim")).toBeInTheDocument()
  expect(within(members[1]).queryByText("Siz")).not.toBeInTheDocument()
})

test("a member without a name goes by their phone", async () => {
  await signIn(ALI)
  db.users[VALI] = null
  renderWithProviders(<EmployeesPage />)

  const [, vali] = await rows()
  expect(nameAndPhone(vali)).toEqual(["+998 90 222 33 44", null])
  expect(within(vali).getAllByText("+998 90 222 33 44")).toHaveLength(1)
})

test("the list says when each member joined", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  const members = await rows()
  const headers = within(screen.getByRole("table", { name: "Xodimlar" })).getAllByRole("columnheader")
  expect(headers.map((header) => header.textContent)).toContain("Qo'shilgan")
  members.forEach((member) => expect(within(member).getByText("02.10.2026")).toBeInTheDocument())
})

test("the page says how many members the company has", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  await rows()

  expect(screen.getByText("Kompaniyangiz a'zolari · 3 kishi")).toBeInTheDocument()
})

test("the list ends with its total", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await rows()).toHaveLength(3)

  expect(screen.getByText("Jami: 3")).toBeInTheDocument()
})

test("on a phone a member is a card: role and date in one line, the actions at its top", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)
  await rows()

  const [owner, vali] = within(screen.getByRole("list", { name: "Xodimlar" })).getAllByRole("listitem")

  expect(identityOf(vali)).toEqual(["Vali Aliyev", "+998 90 222 33 44"])
  const inline = Array.from(vali.querySelectorAll('[data-slot="data-list-meta"] > div')).map((pair) => [
    pair.querySelector("dt")?.textContent,
    pair.querySelector("dd")?.textContent,
  ])
  expect(inline).toEqual([
    ["Rol", "Xodim"],
    ["Qo'shilgan", "02.10.2026"],
  ])
  // The badge needs no name on screen; the date keeps its own.
  expect(within(vali).getByText("Rol")).toHaveClass("sr-only")
  expect(within(vali).getByText("Qo'shilgan")).not.toHaveClass("sr-only")
  expect(within(vali).queryByText("Amallar")).not.toBeInTheDocument()
  const actions = vali.querySelector<HTMLElement>('[data-slot="data-list-actions"]')!
  expect(within(actions).getByRole("button", { name: "Ismni o'zgartirish: Vali Aliyev" })).toBeInTheDocument()
  expect(within(actions).getByRole("button", { name: "O'chirish: Vali Aliyev" })).toBeInTheDocument()
  // Nothing can be done with the owner here: no place is kept for actions.
  expect(owner.querySelector('[data-slot="data-list-actions"]')).not.toBeInTheDocument()
})

test("an employee's actions say what they do when the keyboard reaches them", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)
  const [, vali] = await rows()

  act(() => within(vali).getByRole("button", { name: "Ismni o'zgartirish: Vali Aliyev" }).focus())
  expect(await screen.findByText("Ismni o'zgartirish")).toBeInTheDocument()

  act(() => within(vali).getByRole("button", { name: "O'chirish: Vali Aliyev" }).focus())
  expect(await screen.findByText("O'chirish")).toBeInTheDocument()
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

test("an owner with nobody added yet is told how to add someone", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  renderWithProviders(<EmployeesPage />)

  expect(await rows()).toHaveLength(1)
  expect(screen.getByText(/Hali xodim yo'q/)).toBeInTheDocument()
})

test("with employees there is no such hint", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await rows()).toHaveLength(3)
  expect(screen.queryByText(/Hali xodim yo'q/)).not.toBeInTheDocument()
})

test("an employee is added from the dialog and joins the list", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  await rows()

  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "907778899")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Xodim")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Xodim qo'shildi")).toBeInTheDocument()
  await waitFor(async () =>
    expect((await rows()).map(nameAndPhone)).toContainEqual(["Yangi Xodim", "+998 90 777 88 99"]),
  )
  expect(within((await rows())[3]).getByText("Xodim")).toBeInTheDocument()
})

test("the add-employee dialog says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  await rows()
  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" })

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Telefon raqamini to'liq kiriting")).toBeInTheDocument()
  expect(within(dialog).getByText("Ismni kiriting")).toBeInTheDocument()

  // The owner's own number is a member already.
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "901234567")
  await user.type(within(dialog).getByLabelText("Ism"), "Ali")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).toBeInTheDocument()
  // The dialog stays open with the reason; nobody was added.
  expect(screen.getByRole("dialog", { name: "Xodim qo'shish" })).toBeInTheDocument()
  expect(membersOf(1)).toHaveLength(3)
})

test("a dialog opened again starts empty, with the last refusal gone", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  await rows()
  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  let dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "901234567")
  await user.type(within(dialog).getByLabelText("Ism"), "Ali")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await within(dialog).findByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")

  await user.click(within(dialog).getByRole("button", { name: "Yopish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }))
  dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" })

  expect(within(dialog).getByLabelText("Telefon raqami")).toHaveValue("")
  expect(within(dialog).getByLabelText("Ism")).toHaveValue("")
  expect(within(dialog).queryByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).not.toBeInTheDocument()
})

test("an employee is renamed from the dialog; the owner is not to be renamed here", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  const [owner, vali] = await rows()
  expect(within(owner).queryByRole("button", { name: /Ismni o'zgartirish/ })).not.toBeInTheDocument()

  await user.click(within(vali).getByRole("button", { name: "Ismni o'zgartirish: Vali Aliyev" }))
  const dialog = await screen.findByRole("dialog", { name: "Ismni o'zgartirish" })
  const name = within(dialog).getByLabelText("Ism")
  expect(name).toHaveValue("Vali Aliyev")
  expect(within(dialog).getByText("+998 90 222 33 44")).toBeInTheDocument()
  await user.clear(name)
  await user.type(name, "Vali (hisobchi)")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Ism o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () =>
    expect((await rows()).map(nameAndPhone)).toContainEqual(["Vali (hisobchi)", "+998 90 222 33 44"]),
  )
})

test("an employee is removed after asking; cancelling keeps them; the owner is not to be removed here", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)
  const [owner, vali] = await rows()
  expect(within(owner).queryByRole("button", { name: /O'chirish/ })).not.toBeInTheDocument()

  await user.click(within(vali).getByRole("button", { name: "O'chirish: Vali Aliyev" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  expect(within(confirm).getByText(/Vali Aliyev Olma Savdo kompaniyasiga kira olmaydi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(await rows()).toHaveLength(3)

  await user.click(within((await rows())[1]).getByRole("button", { name: "O'chirish: Vali Aliyev" }))
  confirm = await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Xodim o'chirildi")).toBeInTheDocument()
  await waitFor(async () =>
    expect((await rows()).map(nameAndPhone)).toEqual([
      ["Ali Valiyev", "+998 90 123 45 67"],
      ["Sardor Karimov", "+998 90 333 44 55"],
    ]),
  )
})

test("the list names the role each employee holds", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["customers.view"])
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  const [owner, vali, sardor] = await rows()
  expect(within(owner).getByText("Egasi")).toBeInTheDocument()
  expect(within(vali).getByText("Sotuvchi")).toBeInTheDocument()
  expect(within(vali).queryByText("Xodim")).not.toBeInTheDocument()
  expect(within(sardor).getByText("Xodim")).toBeInTheDocument()
})

test("an employee whose role lets them see the employees sees the list, without the actions the role lacks", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["employees.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<EmployeesPage />)

  const members = await rows()
  expect(members).toHaveLength(3)
  expect(screen.queryByRole("button", { name: "Xodim qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Ismni o'zgartirish/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^O'chirish/ })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("the employees actions follow the role: adding and renaming here, not deleting", async () => {
  giveRole(VALI, 1, "HR", ["employees.view", "employees.create", "employees.edit"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<EmployeesPage />)

  const [, , sardor] = await rows()
  expect(screen.getByRole("button", { name: "Xodim qo'shish" })).toBeInTheDocument()
  expect(within(sardor).getByRole("button", { name: /Ismni o'zgartirish/ })).toBeInTheDocument()
  expect(within(sardor).queryByRole("button", { name: /^O'chirish/ })).not.toBeInTheDocument()
})

const roleButton = (row: HTMLElement) => within(row).getByRole("button", { name: "Rolni o'zgartirish: Vali Aliyev" })

test("the owner gives an employee a role, and takes it away again", async () => {
  const sotuvchi = { id: nextId(), companyId: 1, name: "Sotuvchi", permissions: ["customers.view" as const] }
  db.roles.push(sotuvchi)
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  await user.click(roleButton((await rows())[1]))
  const dialog = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  expect(within(dialog).getByText("Vali Aliyev · +998 90 222 33 44")).toBeInTheDocument()
  const box = within(dialog).getByRole("combobox", { name: "Rol" })
  expect(box).toHaveTextContent("Rolsiz")
  expect(within(dialog).getByText("Rolsiz xodim mijozlar va vazifalar bilan ishlaydi.")).toBeInTheDocument()
  await choose(user, box, "Sotuvchi")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Rol o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(within((await rows())[1]).getByText("Sotuvchi")).toBeInTheDocument())
  expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBe(sotuvchi.id)

  await user.click(roleButton((await rows())[1]))
  const again = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  const box2 = within(again).getByRole("combobox", { name: "Rol" })
  expect(box2).toHaveTextContent("Sotuvchi")
  await choose(user, box2, "Rolsiz")
  await user.click(within(again).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.roleId).toBeUndefined())
  await waitFor(async () => expect(within((await rows())[1]).getByText("Xodim")).toBeInTheDocument())
})

test("with no role to give, the dialog says so and leads to the settings", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  await user.click(roleButton((await rows())[1]))
  const dialog = await screen.findByRole("dialog", { name: "Rolni o'zgartirish" })
  expect(await within(dialog).findByText(/Hali rol yo'q/)).toBeInTheDocument()
  expect(within(dialog).getByRole("link", { name: "Sozlamalarda rol yarating" })).toHaveAttribute("href", "/settings?tab=roles")
})

test("the role button is the owner's alone, and never on the owner's own row", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)
  const [owner, vali] = await rows()
  expect(within(owner).queryByRole("button", { name: /^Rolni o'zgartirish/ })).not.toBeInTheDocument()
  expect(within(vali).getByRole("button", { name: "Rolni o'zgartirish: Vali Aliyev" })).toBeInTheDocument()
})

test("an employee who manages the employees sees no role button", async () => {
  giveRole(VALI, 1, "HR", ["employees.view", "employees.create", "employees.edit", "employees.delete"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<EmployeesPage />)

  const [, , sardor] = await rows()
  expect(within(sardor).getByRole("button", { name: /^O'chirish/ })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^Rolni o'zgartirish/ })).not.toBeInTheDocument()
})

// The locations each member works in, and the owner's way to restrict an
// employee to some (logic/locations.md, section 5).
const locationsButton = (row: HTMLElement) => within(row).getByRole("button", { name: "Lokatsiyalarni o'zgartirish: Vali Aliyev" })
// locationsOf reads a member's locations from the table: the cell under
// "Lokatsiyalar".
function locationsOf(row: HTMLElement) {
  const headers = within(screen.getByRole("table", { name: "Xodimlar" }))
    .getAllByRole("columnheader")
    .map((header) => header.textContent)
  return within(row).getAllByRole("cell")[headers.indexOf("Lokatsiyalar") - 1].textContent
}

test("with one location the list says nothing of locations", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  await rows()
  expect(within(screen.getByRole("table", { name: "Xodimlar" })).queryByRole("columnheader", { name: "Lokatsiyalar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^Lokatsiyalarni o'zgartirish/ })).not.toBeInTheDocument()
})

test("with two or more locations the list says each member's: every one, the restriction's live ones, or none", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  restrictTo(VALI, 1, [chilonzor.id, gone.id])
  restrictTo(SARDOR, 1, [gone.id])
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  const members = await rows()
  expect(locationsOf(members[0])).toBe("Barchasi")
  expect(locationsOf(members[1])).toBe("Chilonzor")
  expect(locationsOf(members[2])).toBe("—")
  // The restriction is the owner's to set, and never on the owner's own row.
  expect(within(members[0]).queryByRole("button", { name: /^Lokatsiyalarni o'zgartirish/ })).not.toBeInTheDocument()
  expect(locationsButton(members[1])).toBeInTheDocument()
})

test("the owner restricts an employee to some locations, and lifts the restriction again", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<EmployeesPage />)

  await user.click(locationsButton((await rows())[1]))
  const dialog = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  expect(within(dialog).getByText("Vali Aliyev · +998 90 222 33 44")).toBeInTheDocument()
  expect(within(dialog).getByText("Xodim faqat belgilangan lokatsiyalarning vazifalarini ko'radi va qo'shadi.")).toBeInTheDocument()
  const all = within(dialog).getByRole("checkbox", { name: "Barcha lokatsiyalar" })
  expect(all).toBeChecked()
  // Base UI's checkbox is a button that says it is disabled either way.
  const disabled = (box: HTMLElement) => box.hasAttribute("disabled") || box.getAttribute("aria-disabled") === "true"
  expect(disabled(within(dialog).getByRole("checkbox", { name: "Asosiy" }))).toBe(true)
  await user.click(all)
  expect(disabled(within(dialog).getByRole("checkbox", { name: "Asosiy" }))).toBe(false)
  // Nothing chosen: refused in the API's words, before anything is sent.
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("Kamida bitta lokatsiyani tanlang")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("checkbox", { name: "Chilonzor" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Lokatsiyalar o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(locationsOf((await rows())[1])).toBe("Chilonzor"))
  expect(db.members[VALI].find((m) => m.companyId === 1)?.locationIds).toEqual([chilonzor.id])

  await user.click(locationsButton((await rows())[1]))
  const again = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  expect(within(again).getByRole("checkbox", { name: "Barcha lokatsiyalar" })).not.toBeChecked()
  expect(within(again).getByRole("checkbox", { name: "Chilonzor" })).toBeChecked()
  expect(within(again).getByRole("checkbox", { name: "Asosiy" })).not.toBeChecked()
  await user.click(within(again).getByRole("checkbox", { name: "Barcha lokatsiyalar" }))
  await user.click(within(again).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.locationIds).toBeUndefined())
  await waitFor(async () => expect(locationsOf((await rows())[1])).toBe("Barchasi"))
})

test("the dialog warns of the tasks the employee is assigned in the locations left out", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const seeded = seedTasks()
  // Vali is assigned "Qo'ng'iroq qilish" already; "Shartnoma yuborish" too.
  seeded.contract.assignee = VALI
  seeded.contract.assigneeName = "Vali Aliyev"
  const { user } = renderWithProviders(<EmployeesPage />)

  await user.click(locationsButton((await rows())[1]))
  const dialog = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  await user.click(within(dialog).getByRole("checkbox", { name: "Barcha lokatsiyalar" }))
  await user.click(within(dialog).getByRole("checkbox", { name: "Chilonzor" }))
  expect(await within(dialog).findByText("Boshqa lokatsiyalarda 2 ta vazifaga mas'ul")).toBeInTheDocument()

  await user.click(within(dialog).getByRole("checkbox", { name: "Asosiy" }))
  await waitFor(() => expect(within(dialog).queryByText(/Boshqa lokatsiyalarda/)).not.toBeInTheDocument())
  expect(asosiyOf(1).name).toBe("Asosiy")
})

test("an employee who manages the employees sees the locations, not the way to change them", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(SARDOR, 1, [chilonzor.id])
  giveRole(VALI, 1, "HR", ["employees.view", "employees.create", "employees.edit", "employees.delete"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<EmployeesPage />)

  const members = await rows()
  expect(locationsOf(members[2])).toBe("Chilonzor")
  expect(screen.queryByRole("button", { name: /^Lokatsiyalarni o'zgartirish/ })).not.toBeInTheDocument()
})
