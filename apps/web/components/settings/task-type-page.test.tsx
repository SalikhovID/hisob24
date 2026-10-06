import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, taskTypesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TaskTypePage } from "./task-type-page"

const fieldList = () => screen.findByRole("list", { name: "Maydonlar" })

// fieldsOf reads the list as each field's name, kind and marks.
const fieldsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) => ({
      label: row.querySelector('[data-slot="setting-title"]')?.textContent,
      kind: row.querySelector('[data-slot="setting-detail"]')?.textContent,
      marks: Array.from(row.querySelectorAll('[data-slot="badge"]')).map((mark) => mark.textContent),
    }))

// withFields gives Olma Savdo's ready type a text field and a choice over
// Manba, and returns the type.
function withFields() {
  const [vazifa] = db.taskTypes
  vazifa.fields.push(
    { id: 901, label: "Izoh", kind: "string", required: true, dropdownId: null },
    { id: 902, label: "Manba", kind: "dropdown", required: false, dropdownId: db.dropdowns[0].id },
  )
  return vazifa
}

test("the owner sees the type's fields: what each asks, of what kind, with its mark", async () => {
  await signIn(ALI)
  const vazifa = withFields()
  renderWithProviders(<TaskTypePage id={vazifa.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Vazifa" })).toBeInTheDocument()
  expect(screen.getByText("Vazifa turi · 2 ta maydon")).toBeInTheDocument()
  await waitFor(async () =>
    expect(fieldsOf(await fieldList())).toEqual([
      { label: "Izoh", kind: "Matn", marks: ["Majburiy"] },
      { label: "Manba", kind: "Dropdown (bitta tanlov) · Manba", marks: [] },
    ]),
  )
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.getByText(/Nomi, muddat va mijoz har vazifada bor va majburiy/)).toBeInTheDocument()
})

test("a type that is not there says so and leads back", async () => {
  await signIn(ALI)
  renderWithProviders(<TaskTypePage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Tur topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu tur o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.queryByRole("list", { name: "Maydonlar" })).not.toBeInTheDocument()
})

test("a type with no fields says what that means", async () => {
  await signIn(ALI)
  const [vazifa] = taskTypesOf(1)
  renderWithProviders(<TaskTypePage id={vazifa.id} />)

  expect(await screen.findByText("Bu turda maydon yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa nomi, muddati, mijozi va mas'uli bilan qo'shiladi.")).toBeInTheDocument()
  expect(screen.getByText("Vazifa turi · 0 ta maydon")).toBeInTheDocument()
})

test("the type's page says why it failed to load and can be asked for again", async () => {
  await signIn(ALI)
  const [vazifa] = taskTypesOf(1)
  server.use(http.get("*/api/app/task-types", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("heading", { level: 1, name: "Vazifa" })).toBeInTheDocument()
})

test("an employee is sent home: a type's page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TaskTypePage id={taskTypesOf(1)[0].id} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("a field is added from the dialog: a choice asks for its dropdown, and a task field is never told not to repeat", async () => {
  await signIn(ALI)
  const [vazifa] = taskTypesOf(1)
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)
  await screen.findByText("Bu turda maydon yo'q")

  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  expect(within(dialog).getByLabelText("Turi")).toHaveValue("string")
  expect(within(dialog).queryByLabelText("Dropdown")).not.toBeInTheDocument()
  expect(within(dialog).queryByRole("checkbox", { name: "Takrorlanmasin" })).not.toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "Manba")
  await user.selectOptions(within(dialog).getByLabelText("Turi"), "Checkbox (bir nechta tanlov)")
  expect(within(dialog).queryByRole("checkbox", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Dropdownni tanlang")).toBeInTheDocument()

  await user.selectOptions(within(dialog).getByLabelText("Dropdown"), "Manba")
  await user.click(within(dialog).getByRole("checkbox", { name: "Majburiy" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Maydon qo'shildi")).toBeInTheDocument()
  await waitFor(async () =>
    expect(fieldsOf(await fieldList())).toEqual([{ label: "Manba", kind: "Checkbox (bir nechta tanlov) · Manba", marks: ["Majburiy"] }]),
  )
  expect(screen.getByText("Vazifa turi · 1 ta maydon")).toBeInTheDocument()
  expect(db.taskTypes[0].fields[0]).not.toHaveProperty("unique")
})

test("a text field is added with its mark; the dialog says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  const vazifa = withFields()
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)
  await fieldList()
  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydon qo'shish" })

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "izoh")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli maydon allaqachon bor")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Maydon qo'shish" })).toBeInTheDocument()

  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Summa")
  await user.selectOptions(within(dialog).getByLabelText("Turi"), "Butun son")
  await user.click(within(dialog).getByRole("checkbox", { name: "Majburiy" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList())[2]).toEqual({ label: "Summa", kind: "Butun son", marks: ["Majburiy"] }))
})

test("a field's name and mark are changed from its row; its kind stays as it is", async () => {
  await signIn(ALI)
  const vazifa = withFields()
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)

  await user.click(within(await fieldList()).getByRole("button", { name: "Tahrirlash: Izoh" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(within(dialog).getByText("Matn")).toBeInTheDocument()
  expect(within(dialog).queryByLabelText("Turi")).not.toBeInTheDocument()
  expect(within(dialog).queryByRole("checkbox", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("Izoh")
  expect(within(dialog).getByRole("checkbox", { name: "Majburiy" })).toBeChecked()

  await user.clear(name)
  await user.type(name, "Tavsif")
  await user.click(within(dialog).getByRole("checkbox", { name: "Majburiy" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Maydon saqlandi")).toBeInTheDocument()
  await waitFor(async () => expect(fieldsOf(await fieldList())[0]).toEqual({ label: "Tavsif", kind: "Matn", marks: [] }))
})

test("a field is deleted after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  const vazifa = withFields()
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)

  await user.click(within(await fieldList()).getByRole("button", { name: "O'chirish: Manba" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Manba» maydoni formadan olib tashlanadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Maydon o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Izoh"]))

  server.use(
    http.delete("*/api/app/task-types/:id/fields/:fieldId", () =>
      HttpResponse.json({ error: "field_in_use", message: "Bu maydon 4 ta vazifada to'ldirilgan" }, { status: 409 }),
    ),
  )
  await user.click(within(await fieldList()).getByRole("button", { name: "O'chirish: Izoh" }))
  confirm = await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Bu maydon 4 ta vazifada to'ldirilgan")).toBeInTheDocument()
  expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Izoh"])
})

test("the fields are put in order from the keyboard, and the order is saved", async () => {
  await signIn(ALI)
  const vazifa = withFields()
  const { user } = renderWithProviders(<TaskTypePage id={vazifa.id} />)
  const list = await fieldList()
  expect(fieldsOf(list).map((field) => field.label)).toEqual(["Izoh", "Manba"])

  within(list).getByRole("button", { name: "Manba: tartibini o'zgartirish" }).focus()
  await user.keyboard("{Home}")

  expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Manba", "Izoh"])
  await waitFor(() => expect(taskTypesOf(1)[0].fields.map((field) => field.label)).toEqual(["Manba", "Izoh"]))
})
