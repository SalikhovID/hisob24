import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, typesOf, VALI } from "@/mocks/data"
import { fieldsOf } from "@/test/fields"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { CustomerTypePage } from "./customer-type-page"

const fieldList = () => screen.findByRole("list", { name: "Maydonlar" })
// fieldRow is a field's row: it opens the field's sheet.
const fieldRow = async (label: string) => within(await fieldList()).getByRole("button", { name: new RegExp(`^${label}`) })

test("the owner sees the type's fields as the prototype's rows: each by name with its marks beside it and its kind under it; the ways to rename and delete the type", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yuridik" })).toBeInTheDocument()
  expect(screen.getByText("Mijoz turi · 2 ta maydon")).toBeInTheDocument()
  expect(fieldsOf(await fieldList())).toEqual([
    { label: "Nomi", kind: "Matn", marks: ["Mijoz nomi", "Majburiy"] },
    { label: "INN", kind: "Butun son", marks: ["Majburiy", "Takrorlanmas"] },
  ])
  expect(screen.getByRole("link", { name: "Mijoz turlari" })).toHaveAttribute("href", "/settings/customer-types")
  expect(
    screen.getByText("Telefon har mijozda bor va majburiy: uni maydon qilib qo'shish shart emas. Birinchi matn maydoni ro'yxatda mijoz nomi bo'lib ko'rinadi."),
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Maydon qo'shish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Nomini o'zgartirish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Turni o'chirish" })).toBeInTheDocument()
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

test("a type that is not there says so and leads back to the types", async () => {
  await signIn(ALI)
  renderWithProviders(<CustomerTypePage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Tur topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu tur o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mijoz turlari" })).toHaveAttribute("href", "/settings/customer-types")
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

test("a field is added from the plus's sheet: a choice asks for its dropdown, text and numbers may be told not to repeat", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)
  await fieldList()

  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  expect(within(sheet).getByRole("switch", { name: "Takrorlanmasin" })).toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Nomi"), "Manba")
  await choose(user, within(sheet).getByLabelText("Turi"), "Checkbox (bir nechta tanlov)")
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await choose(user, within(sheet).getByLabelText("Dropdown"), "Manba")
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList())[2]).toEqual({ label: "Manba", kind: "Checkbox (bir nechta tanlov) · Manba", marks: ["Majburiy"] }))
  expect(screen.getByText("Mijoz turi · 3 ta maydon")).toBeInTheDocument()
})

test("a text field is added with its marks; the sheet says why the API refused", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)
  await fieldList()
  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })

  await user.type(within(sheet).getByLabelText("Nomi"), "inn")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli maydon allaqachon bor")).toBeInTheDocument()
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Guvohnoma")
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("switch", { name: "Takrorlanmasin" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList())[2]).toEqual({ label: "Guvohnoma", kind: "Matn", marks: ["Majburiy", "Takrorlanmas"] }))
})

test("with no dropdown yet, a choice field says where to make one", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<CustomerTypePage id={typesOf(2)[0].id} />)
  await fieldList()
  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })

  await choose(user, within(sheet).getByLabelText("Turi"), "Radio (bitta tanlov)")
  expect(within(sheet).getByText("Hali dropdown yo'q: avval Sozlamalarda dropdown yarating.")).toBeInTheDocument()
})

test("a field's row opens its sheet: the name and the marks change, the kind is said and stays", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  await user.click(await fieldRow("INN"))
  const sheet = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(within(sheet).getByText("Butun son")).toBeInTheDocument()
  const name = within(sheet).getByLabelText("Nomi")
  expect(name).toHaveValue("INN")
  expect(within(sheet).getByRole("switch", { name: "Majburiy" })).toBeChecked()
  expect(within(sheet).getByRole("switch", { name: "Takrorlanmasin" })).toBeChecked()
  await user.clear(name)
  await user.type(name, "STIR")
  await user.click(within(sheet).getByRole("switch", { name: "Takrorlanmasin" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Maydon saqlandi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(fieldsOf(await fieldList())[1]).toEqual({ label: "STIR", kind: "Butun son", marks: ["Majburiy"] }))
})

test("a choice field's sheet has no mark for text and numbers", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  await user.click(await fieldRow("Manba"))
  const sheet = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(await within(sheet).findByText("Dropdown (bitta tanlov) · Manba")).toBeInTheDocument()
  expect(within(sheet).getByRole("switch", { name: "Majburiy" })).not.toBeChecked()
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
})

test("a field is deleted from its sheet after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  const { user } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  await user.click(await fieldRow("INN"))
  await user.click(within(await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })).getByRole("button", { name: "Maydonni o'chirish" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })
  expect(within(confirm).getByText(/«INN» maydoni formadan olib tashlanadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Maydon o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Nomi"]))

  server.use(
    http.delete("*/api/app/customer-types/:id/fields/:fieldId", () =>
      HttpResponse.json({ error: "field_in_use", message: "Bu maydon 4 ta mijozda to'ldirilgan" }, { status: 409 }),
    ),
  )
  await user.click(await fieldRow("Nomi"))
  await user.click(within(await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })).getByRole("button", { name: "Maydonni o'chirish" }))
  confirm = await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu maydon 4 ta mijozda to'ldirilgan")).length).toBeGreaterThan(0)
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Nomi"])
})

test("the fields are put in order in the «Tartiblash» mode: the first text field is the customer's name", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  db.types.find((type) => type.id === jismoniy.id)!.fields.push({ id: 900, label: "Laqabi", kind: "string", required: false, unique: false, dropdownId: null })
  const { user } = renderWithProviders(<CustomerTypePage id={jismoniy.id} />)
  const list = await fieldList()
  expect(fieldsOf(list).map((field) => [field.label, field.marks.includes("Mijoz nomi")])).toEqual([
    ["F.I.Sh.", true],
    ["Manba", false],
    ["Laqabi", false],
  ])

  await user.click(screen.getByRole("button", { name: "Tartiblash" }))
  act(() => within(screen.getByRole("list", { name: "Maydonlar" })).getByRole("button", { name: "Laqabi: tartibini o'zgartirish" }).focus())
  await user.keyboard("{Home}")

  expect(fieldsOf(await fieldList()).map((field) => [field.label, field.marks.includes("Mijoz nomi")])).toEqual([
    ["Laqabi", true],
    ["F.I.Sh.", false],
    ["Manba", false],
  ])
  await waitFor(() => expect(typesOf(1)[0].fields.map((field) => field.label)).toEqual(["Laqabi", "F.I.Sh.", "Manba"]))
})

test("the type is renamed from its page, and deleted from it after asking: back to the types; one the API will not delete stays, with the reason", async () => {
  await signIn(ALI)
  const [jismoniy, yuridik] = typesOf(1)
  const { user, unmount } = renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  await user.click(await screen.findByRole("button", { name: "Nomini o'zgartirish" }))
  const sheet = await screen.findByRole("dialog", { name: "Tur nomini o'zgartirish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveValue("Yuridik")
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Firma")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect((await screen.findAllByText("Tur nomi o'zgartirildi")).length).toBeGreaterThan(0)
  expect(await screen.findByRole("heading", { level: 1, name: "Firma" })).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Turni o'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Firma» turi va uning maydonlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/settings/customer-types"))
  expect(typesOf(1).map((type) => type.name)).toEqual(["Jismoniy"])
  unmount()

  server.use(
    http.delete("*/api/app/customer-types/:id", () => HttpResponse.json({ error: "type_in_use", message: "Bu turda 3 ta mijoz bor" }, { status: 409 })),
  )
  renderWithProviders(<CustomerTypePage id={jismoniy.id} />)
  await user.click(await screen.findByRole("button", { name: "Turni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu turda 3 ta mijoz bor")).length).toBeGreaterThan(0)
  expect(typesOf(1)).toHaveLength(1)
})

test("an employee whose role holds settings.view alone sees the fields without a way to change them", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const [, yuridik] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yuridik" })).toBeInTheDocument()
  const list = await fieldList()
  expect(fieldsOf(list)).toHaveLength(2)
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  for (const name of ["Maydon qo'shish", "Tartiblash", "Nomini o'zgartirish", "Turni o'chirish"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  }
  expect(router.replace).not.toHaveBeenCalled()
})
