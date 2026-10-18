import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, orderTypesOf, VALI } from "@/mocks/data"
import { fieldsOf } from "@/test/fields"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { OrderTypePage } from "./order-type-page"
import { moved } from "@/test/moves"

const fieldList = () => screen.findByRole("list", { name: "Maydonlar" })
const fieldRow = async (label: string) => within(await fieldList()).getByRole("button", { name: new RegExp(`^${label}`) })

// withFields gives Olma Savdo's ready type a text field and a choice over
// Manba, and returns the type.
function withFields() {
  const [buyurtma] = db.orderTypes
  buyurtma.fields.push(
    { id: 901, label: "Izoh", kind: "string", required: true, dropdownId: null },
    { id: 902, label: "Manba", kind: "dropdown", required: false, dropdownId: db.dropdowns[0].id },
  )
  return buyurtma
}

test("the owner sees the type's fields as the prototype's rows, the order's own words under them, and the way back to the order types", async () => {
  await signIn(ALI)
  const buyurtma = withFields()
  renderWithProviders(<OrderTypePage id={buyurtma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma" })).toBeInTheDocument()
  expect(screen.getByText("Vazifa turi · 2 ta maydon")).toBeInTheDocument()
  await waitFor(async () =>
    expect(fieldsOf(await fieldList())).toEqual([
      { label: "Izoh", kind: "Matn", marks: ["Majburiy"] },
      { label: "Manba", kind: "Dropdown (bitta tanlov) · Manba", marks: [] },
    ]),
  )
  expect(screen.getByRole("link", { name: "Vazifa turlari" })).toHaveAttribute("href", "/settings/order-types")
  expect(screen.getByText("Nomi, muddat va mijoz har vazifada bor va majburiy, mas'ul ixtiyoriy: ularni maydon qilib qo'shish shart emas.")).toBeInTheDocument()
})

test("a type that is not there, or with no fields, says so; one that fails to load can be asked for again", async () => {
  await signIn(ALI)
  const { unmount } = renderWithProviders(<OrderTypePage id={999} />)
  expect(await screen.findByRole("heading", { level: 1, name: "Tur topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Vazifa turlari" })).toHaveAttribute("href", "/settings/order-types")
  unmount()

  const [buyurtma] = orderTypesOf(1)
  const empty = renderWithProviders(<OrderTypePage id={buyurtma.id} />)
  expect(await screen.findByText("Bu turda maydon yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa nomi, muddati, mijozi va mas'uli bilan qo'shiladi.")).toBeInTheDocument()
  expect(screen.getByText("Vazifa turi · 0 ta maydon")).toBeInTheDocument()
  empty.unmount()

  server.use(http.get("*/api/app/order-types", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<OrderTypePage id={buyurtma.id} />)
  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma" })).toBeInTheDocument()
})

test("an employee is sent home: a type's page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<OrderTypePage id={orderTypesOf(1)[0].id} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("a field is added from the plus's sheet: a choice asks for its dropdown, and an order field is never told not to repeat", async () => {
  await signIn(ALI)
  const [buyurtma] = orderTypesOf(1)
  const { user } = renderWithProviders(<OrderTypePage id={buyurtma.id} />)
  await screen.findByText("Bu turda maydon yo'q")

  await user.click(screen.getByRole("button", { name: "Maydon qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Nomi"), "Manba")
  await choose(user, within(sheet).getByLabelText("Turi"), "Checkbox (bir nechta tanlov)")
  await choose(user, within(sheet).getByLabelText("Dropdown"), "Manba")
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList())).toEqual([{ label: "Manba", kind: "Checkbox (bir nechta tanlov) · Manba", marks: ["Majburiy"] }]))
  expect(screen.getByText("Vazifa turi · 1 ta maydon")).toBeInTheDocument()
  expect(db.orderTypes[0].fields[0]).not.toHaveProperty("unique")
})

test("a field's row opens its sheet: the name and the mark change, the kind is said and stays; deleted from it after asking, a refusal with its reason", async () => {
  await signIn(ALI)
  const buyurtma = withFields()
  const { user } = renderWithProviders(<OrderTypePage id={buyurtma.id} />)

  await user.click(await fieldRow("Izoh"))
  let sheet = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(within(sheet).getByText("Matn")).toBeInTheDocument()
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Tavsif")
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList())[0]).toEqual({ label: "Tavsif", kind: "Matn", marks: [] }))

  await user.click(await fieldRow("Manba"))
  sheet = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  await user.click(within(sheet).getByRole("button", { name: "Maydonni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Tavsif"]))

  server.use(
    http.delete("*/api/app/order-types/:id/fields/:fieldId", () =>
      HttpResponse.json({ error: "field_in_use", message: "Bu maydon 4 ta buyurtmada to'ldirilgan" }, { status: 409 }),
    ),
  )
  await user.click(await fieldRow("Tavsif"))
  await user.click(within(await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })).getByRole("button", { name: "Maydonni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Maydonni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu maydon 4 ta buyurtmada to'ldirilgan")).length).toBeGreaterThan(0)
})

test("the fields are put in order in the «Tartiblash» mode, and the order is saved", async () => {
  await signIn(ALI)
  const buyurtma = withFields()
  const { user } = renderWithProviders(<OrderTypePage id={buyurtma.id} />)
  expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Izoh", "Manba"])

  await user.click(screen.getByRole("button", { name: "Tartiblash" }))
  act(() => within(screen.getByRole("list", { name: "Maydonlar" })).getByRole("button", { name: "Manba: tartibini o'zgartirish" }).focus())
  await user.keyboard("{Home}")

  expect(fieldsOf(await fieldList()).map((field) => field.label)).toEqual(["Manba", "Izoh"])
  await waitFor(() => expect(orderTypesOf(1)[0].fields.map((field) => field.label)).toEqual(["Manba", "Izoh"]))
})

test("the order type is renamed from its page, and deleted from it after asking: back to the order types", async () => {
  await signIn(ALI)
  const [buyurtma] = orderTypesOf(1)
  const { user } = renderWithProviders(<OrderTypePage id={buyurtma.id} />)

  await user.click(await screen.findByRole("button", { name: "Nomini o'zgartirish" }))
  const sheet = await screen.findByRole("dialog", { name: "Vazifa turi nomini o'zgartirish" })
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Umumiy")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect((await screen.findAllByText("Vazifa turi nomi o'zgartirildi")).length).toBeGreaterThan(0)
  expect(await screen.findByRole("heading", { level: 1, name: "Umumiy" })).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Turni o'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Vazifa turini o'chirasizmi?" })
  expect(within(confirm).getByText(/«Umumiy» turi va uning maydonlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/settings/order-types"))
  expect(moved()).toBe("back")
  expect(orderTypesOf(1)).toHaveLength(0)
})

test("an employee whose role holds settings.view alone sees the fields without a way to change them", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  const buyurtma = withFields()
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<OrderTypePage id={buyurtma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma" })).toBeInTheDocument()
  const list = await fieldList()
  expect(fieldsOf(list)).toHaveLength(2)
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  for (const name of ["Maydon qo'shish", "Tartiblash", "Nomini o'zgartirish", "Turni o'chirish"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  }
  expect(router.replace).not.toHaveBeenCalled()
})
