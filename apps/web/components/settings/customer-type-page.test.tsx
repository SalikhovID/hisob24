import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, typesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { CustomerTypePage } from "./customer-type-page"

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

test("the owner sees the type's fields: what each asks, of what kind, with its marks", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yuridik" })).toBeInTheDocument()
  expect(screen.getByText("Mijoz turi · 2 ta maydon")).toBeInTheDocument()
  expect(fieldsOf(await fieldList())).toEqual([
    { label: "Nomi", kind: "Matn", marks: ["Mijoz nomi", "Majburiy"] },
    { label: "INN", kind: "Butun son", marks: ["Majburiy", "Takrorlanmas"] },
  ])
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.getByText(/Telefon har doim bor va majburiy/)).toBeInTheDocument()
})

test("a choice field says which dropdown it takes its options from", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  await waitFor(async () =>
    expect(fieldsOf(await fieldList())).toEqual([
      { label: "F.I.Sh.", kind: "Matn", marks: ["Mijoz nomi", "Majburiy"] },
      { label: "Manba", kind: "Dropdown (bitta tanlov) · Manba", marks: [] },
    ]),
  )
})

test("a type that is not there says so and leads back", async () => {
  await signIn(ALI)
  renderWithProviders(<CustomerTypePage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Tur topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu tur o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.queryByRole("list", { name: "Maydonlar" })).not.toBeInTheDocument()
})

test("a type with no fields says what that means", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  db.types.find((type) => type.id === jismoniy.id)!.fields = []
  renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  expect(await screen.findByText("Bu turda maydon yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz faqat telefon raqami bilan qo'shiladi.")).toBeInTheDocument()
  expect(screen.getByText("Mijoz turi · 0 ta maydon")).toBeInTheDocument()
})

test("the type's page says why it failed to load and can be asked for again", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  server.use(http.get("*/api/app/customer-types", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("heading", { level: 1, name: "Jismoniy" })).toBeInTheDocument()
})

test("an employee is sent home: a type's page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<CustomerTypePage id={typesOf(1)[0].id} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("a field is added from the dialog: a choice asks for its dropdown, text and numbers may be told not to repeat", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)
  await fieldList()

  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  // Text by default: no dropdown is asked for, and it may be told not to repeat.
  expect(within(dialog).getByLabelText("Turi")).toHaveValue("string")
  expect(within(dialog).queryByLabelText("Dropdown")).not.toBeInTheDocument()
  expect(within(dialog).getByRole("checkbox", { name: "Takrorlanmasin" })).toBeInTheDocument()

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
    expect(fieldsOf(await fieldList())[2]).toEqual({
      label: "Manba",
      kind: "Checkbox (bir nechta tanlov) · Manba",
      marks: ["Majburiy"],
    }),
  )
  expect(screen.getByText("Mijoz turi · 3 ta maydon")).toBeInTheDocument()
})

test("a text field is added with its marks; the dialog says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)
  await fieldList()
  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydon qo'shish" })

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "inn")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli maydon allaqachon bor")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Maydon qo'shish" })).toBeInTheDocument()

  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Guvohnoma")
  await user.click(within(dialog).getByRole("checkbox", { name: "Majburiy" }))
  await user.click(within(dialog).getByRole("checkbox", { name: "Takrorlanmasin" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () =>
    expect(fieldsOf(await fieldList())[2]).toEqual({ label: "Guvohnoma", kind: "Matn", marks: ["Majburiy", "Takrorlanmas"] }),
  )
})

test("with no dropdown yet, a choice field says where to make one", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<CustomerTypePage id={typesOf(2)[0].id} />)
  await fieldList()
  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydon qo'shish" })

  await user.selectOptions(within(dialog).getByLabelText("Turi"), "Radio (bitta tanlov)")

  expect(within(dialog).getByText("Hali dropdown yo'q: avval Sozlamalarda dropdown yarating.")).toBeInTheDocument()
})

test("a field's name and marks are changed from its row; its kind stays as it is", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  await user.click(within(await fieldList()).getByRole("button", { name: "Tahrirlash: INN" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(within(dialog).getByText("Butun son")).toBeInTheDocument()
  expect(within(dialog).queryByLabelText("Turi")).not.toBeInTheDocument()
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("INN")
  expect(within(dialog).getByRole("checkbox", { name: "Majburiy" })).toBeChecked()
  expect(within(dialog).getByRole("checkbox", { name: "Takrorlanmasin" })).toBeChecked()

  await user.clear(name)
  await user.type(name, "STIR")
  await user.click(within(dialog).getByRole("checkbox", { name: "Takrorlanmasin" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Maydon saqlandi")).toBeInTheDocument()
  await waitFor(async () =>
    expect(fieldsOf(await fieldList())[1]).toEqual({ label: "STIR", kind: "Butun son", marks: ["Majburiy"] }),
  )
})

test("a choice field is edited without the mark that is for text and numbers", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  await user.click(within(await fieldList()).getByRole("button", { name: "Tahrirlash: Manba" }))
  const dialog = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })

  expect(within(dialog).getByText("Dropdown (bitta tanlov) · Manba")).toBeInTheDocument()
  expect(within(dialog).getByRole("checkbox", { name: "Majburiy" })).not.toBeChecked()
  expect(within(dialog).queryByRole("checkbox", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
})
