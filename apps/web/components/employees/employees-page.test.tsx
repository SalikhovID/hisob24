import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, membersOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { EmployeesPage } from "./employees-page"

// rows are the members in the table (the page shows them as cards too, for
// phones): the row of each, without the header.
async function rows() {
  const table = await screen.findByRole("table", { name: "Xodimlar" })
  return within(table).getAllByRole("row").slice(1)
}

const phoneAndName = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .slice(0, 2)
    .map((cell) => cell.textContent)

test("the owner sees the company's members: themselves first, then the employees", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await screen.findByRole("heading", { name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  const members = await rows()
  expect(members.map(phoneAndName)).toEqual([
    ["+998 90 123 45 67", "Ali Valiyev"],
    ["+998 90 222 33 44", "Vali Aliyev"],
    ["+998 90 333 44 55", "Sardor Karimov"],
  ])
  expect(within(members[0]).getByText("Egasi")).toBeInTheDocument()
  expect(within(members[0]).getByText("Siz")).toBeInTheDocument()
  expect(within(members[1]).getByText("Xodim")).toBeInTheDocument()
  expect(within(members[1]).queryByText("Siz")).not.toBeInTheDocument()
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
    expect((await rows()).map(phoneAndName)).toContainEqual(["+998 90 777 88 99", "Yangi Xodim"]),
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
    expect((await rows()).map(phoneAndName)).toContainEqual(["+998 90 222 33 44", "Vali (hisobchi)"]),
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
    expect((await rows()).map(phoneAndName)).toEqual([
      ["+998 90 123 45 67", "Ali Valiyev"],
      ["+998 90 333 44 55", "Sardor Karimov"],
    ]),
  )
})
