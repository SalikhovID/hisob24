import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { keep } from "@/lib/use-kept"
import { addDays, ALI, db, localToday, SARDOR, seedOrders, orderTypesOf, typesOf, VALI } from "@/mocks/data"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { choose, optionsOf } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { OrdersPage } from "./orders-page"

// openDialog opens the page and its dialog for a new order.
async function openDialog(href = "/orders?view=list") {
  setLocation(href)
  const rendered = renderWithProviders(<OrdersPage />)
  // The round + heads the page; an empty list offers one more below.
  await rendered.user.click((await screen.findAllByRole("button", { name: "Buyurtma qo'shish" }))[0])
  return { ...rendered, dialog: await screen.findByRole("dialog", { name: "Buyurtma qo'shish" }) }
}

const today = localToday()

// setDate fills a date input, which is not typed into.
const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

// titles are the orders the list shows, in order.
const titles = () =>
  within(screen.getByRole("region", { name: "Buyurtmalar" }))
    .getAllByRole("link")
    .map((row) => rowParts(row).title)

test("the sheet: the type on top, the customer and then the order; it opens in the first stage, with the deadline empty and nobody assigned", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  const { user, dialog } = await openDialog()

  expect(within(dialog).getByText("Turni tanlang, mijozni biriktiring va buyurtmani to'ldiring.")).toBeInTheDocument()
  const types = within(dialog).getByRole("radiogroup", { name: "Buyurtma turi" })
  expect(within(types).getAllByRole("radio").map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
    ["Buyurtma", "true"],
    ["Montaj", "false"],
  ])
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  expect(within(customer).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Jismoniy", "Yuridik"])
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toHaveValue("")
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("")
  expect(within(customer).getByLabelText("Manba")).toHaveTextContent("Tanlanmagan")
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  expect(within(order).getByLabelText("Nomi")).toHaveValue("")
  expect(within(order).getByLabelText("Muddat")).toHaveAttribute("type", "date")
  expect(within(order).getByLabelText("Muddat")).toHaveValue("")
  expect(within(order).getByLabelText("Bosqich")).toHaveTextContent("Yangi")
  // The assignees are the company's members, once they are known.
  const assignee = within(order).getByLabelText("Mas'ul")
  expect(assignee).toHaveTextContent("Tanlanmagan")
  await user.click(assignee)
  await waitFor(() =>
    expect(within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tanlanmagan",
      "Ali Valiyev",
      "Vali Aliyev",
      "Sardor Karimov",
    ]),
  )
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
  // The type's fields are the form's, under the order's own.
  expect(within(order).queryByLabelText("Izoh")).not.toBeInTheDocument()
  await user.click(within(types).getByRole("radio", { name: "Montaj" }))
  expect(within(order).getByLabelText("Izoh")).toHaveValue("")
  expect(within(order).getByLabelText("Summa")).toHaveValue("")
  expect(within(order).getByRole("group", { name: "Kanal" })).toBeInTheDocument()
})

test("an order with a new customer is entered in one go, and the list shows it at once", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { montaj, izoh, summa, jarayonda } = seedOrders()
  const [jismoniy] = typesOf(1)
  const [fish] = jismoniy.fields
  const { user, dialog } = await openDialog()

  await user.click(within(dialog).getByRole("radio", { name: "Montaj" }))
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "901112233")
  await user.type(within(customer).getByLabelText("F.I.Sh."), "Yangi Mijoz")
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  await user.type(within(order).getByLabelText("Nomi"), " Shartnoma imzolash ")
  setDate(within(order).getByLabelText("Muddat"), addDays(today, 7))
  await choose(user, within(order).getByLabelText("Bosqich"), "Jarayonda")
  await choose(user, within(order).getByLabelText("Mas'ul"), "Vali Aliyev")
  await user.type(within(order).getByLabelText("Izoh"), "Ertalab")
  await user.type(within(order).getByLabelText("Summa"), "45000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Buyurtma qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(titles()).toContain("Shartnoma imzolash"))
  const entered = db.orders.at(-1)!
  expect(entered).toMatchObject({
    typeId: montaj.id,
    stageId: jarayonda.id,
    title: "Shartnoma imzolash",
    deadline: addDays(today, 7),
    assignee: VALI,
    values: { [izoh.id]: "Ertalab", [summa.id]: 45000 },
    by: VALI,
  })
  expect(db.customers.at(-1)).toMatchObject({ typeId: jismoniy.id, phone: "998901112233", values: { [fish.id]: "Yangi Mijoz" } })
  expect(entered.customerId).toBe(db.customers.at(-1)!.id)
})

test("a customer that is there is taken from the suggestions: it stands in a card of its own, and the order is entered for it", async () => {
  await signIn(ALI)
  const { dilshod } = seedOrders()
  // Its name is gone (its source stays): a required field left empty does
  // not stand in the way of an order for a customer that is there.
  const [, manba] = db.types.find((type) => type.companyId === 1)!.fields
  dilshod.values = { [manba.id]: db.dropdowns[0].options[0].id }
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  const phone = within(customer).getByRole("combobox", { name: "Telefon raqami" })

  await user.type(phone, "911")
  await user.click(await screen.findByRole("option", { name: /91 111 22 33/ }))

  // The customer that is there stands in a card of its own: its phone, its
  // type and its answers are not asked about any more.
  const linked = within(customer).getByRole("region", { name: "Mavjud mijoz" })
  expect(within(linked).getByText("+998 91 111 22 33")).toBeInTheDocument()
  expect(within(linked).getByText("Jismoniy")).toBeInTheDocument()
  expect(within(customer).queryByRole("combobox", { name: "Telefon raqami" })).not.toBeInTheDocument()
  expect(within(customer).queryByRole("radiogroup", { name: "Mijoz turi" })).not.toBeInTheDocument()
  expect(within(customer).queryByLabelText("F.I.Sh.")).not.toBeInTheDocument()
  expect(within(linked).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${dilshod.id}`)

  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  await user.type(within(order).getByLabelText("Nomi"), "Qayta qo'ng'iroq")
  setDate(within(order).getByLabelText("Muddat"), today)
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.orders.at(-1)).toMatchObject({ title: "Qayta qo'ng'iroq", customerId: dilshod.id })
  expect(db.customers.filter((c) => c.companyId === 1)).toHaveLength(3)
})

test("Boshqa mijoz lets the customer go: the phone and the fields come back, empty", async () => {
  await signIn(ALI)
  seedOrders()
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911")
  await user.click(await screen.findByRole("option", { name: /Dilshod Karimov/ }))
  expect(within(within(customer).getByRole("region", { name: "Mavjud mijoz" })).getByText("Dilshod Karimov")).toBeInTheDocument()

  await user.click(within(customer).getByRole("button", { name: "Boshqa mijoz" }))

  expect(within(customer).queryByRole("region", { name: "Mavjud mijoz" })).not.toBeInTheDocument()
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toHaveValue("")
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toBeEnabled()
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("")
  expect(within(customer).getByLabelText("F.I.Sh.")).toBeEnabled()
})

test("what is wrong with the form is said in the API's words, all at once", async () => {
  await signIn(ALI)
  seedOrders()
  const { user, dialog } = await openDialog()
  await user.click(within(dialog).getByRole("radio", { name: "Montaj" }))
  await user.type(within(dialog).getByRole("combobox", { name: "Telefon raqami" }), "90 111")

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  for (const message of [
    "Buyurtma nomini kiriting",
    "Muddatni kiriting",
    "Telefon raqamini to'liq kiriting",
    "«F.I.Sh.» maydonini to'ldiring",
    "«Izoh» maydonini to'ldiring",
  ]) {
    expect(await within(dialog).findByText(message)).toBeInTheDocument()
  }
  expect(db.orders).toHaveLength(4)
})

test("a phone that another customer has leads to that customer: linked at a press, or opened", async () => {
  await signIn(ALI)
  const { dilshod } = seedOrders()
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  // The whole number is typed, the suggestion put away unused: Escape
  // closes the suggestions, not the dialog.
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911112233")
  await screen.findByRole("listbox", { name: "Mijoz takliflari" })
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Buyurtma qo'shish" })).toBeInTheDocument()
  await user.type(within(customer).getByLabelText("F.I.Sh."), "Boshqa Dilshod")
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  await user.type(within(order).getByLabelText("Nomi"), "Takror")
  setDate(within(order).getByLabelText("Muddat"), today)

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  expect(await within(dialog).findByText("Bu raqamli mijoz allaqachon bor")).toBeInTheDocument()
  expect(within(dialog).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(db.orders).toHaveLength(4)
  expect(db.customers.filter((c) => c.companyId === 1)).toHaveLength(3)

  await user.click(within(dialog).getByRole("button", { name: "Shu mijozni biriktirish" }))

  const linked = await within(customer).findByRole("region", { name: "Mavjud mijoz" })
  expect(within(linked).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(dialog).queryByText("Bu raqamli mijoz allaqachon bor")).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.orders.at(-1)).toMatchObject({ title: "Takror", customerId: dilshod.id })
})

test("with no customer types only a customer that is there will do", async () => {
  await signIn(ALI)
  const { dilshod } = seedOrders()
  db.types.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })

  expect(within(customer).getByText("Mijoz turlari yo'q: faqat mavjud mijozni biriktirish mumkin.")).toBeInTheDocument()
  expect(within(customer).queryByRole("radiogroup")).not.toBeInTheDocument()
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  await user.type(within(order).getByLabelText("Nomi"), "Mavjud mijozga")
  setDate(within(order).getByLabelText("Muddat"), today)
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Mijozni tanlang")).toBeInTheDocument()

  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911")
  await user.click(await screen.findByRole("option", { name: /91 111 22 33/ }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.orders.at(-1)).toMatchObject({ title: "Mavjud mijozga", customerId: dilshod.id })
})

test("the + of a column opens the dialog for that stage; under a tab it opens with that tab's type; it opens empty every time", async () => {
  await signIn(ALI)
  const { montaj } = seedOrders()
  setLocation(`/orders?type=${montaj.id}`)
  const { user } = renderWithProviders(<OrdersPage />)
  await screen.findByRole("region", { name: "Kanban" })

  await user.click(await screen.findByRole("button", { name: "Buyurtma qo'shish: Jarayonda" }))

  const dialog = await screen.findByRole("dialog", { name: "Buyurtma qo'shish" })
  expect(within(dialog).getByLabelText("Bosqich")).toHaveTextContent("Jarayonda")
  expect(within(dialog).getByRole("radio", { name: "Montaj" })).toHaveAttribute("aria-checked", "true")
  await user.type(within(dialog).getByLabelText("Nomi"), "Yarim yozilgan")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "Buyurtma qo'shish" }))
  const again = await screen.findByRole("dialog", { name: "Buyurtma qo'shish" })
  expect(within(again).getByLabelText("Nomi")).toHaveValue("")
  expect(within(again).getByLabelText("Bosqich")).toHaveTextContent("Yangi")
  expect(orderTypesOf(1)).toHaveLength(2)
  expect(typesOf(1)).toHaveLength(2)
})

test("without customers.create the dialog takes a customer that is there alone: no type, no fields, a word on why", async () => {
  giveRole(VALI, 1, "Operator", ["orders.view", "orders.create", "customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  const { dialog } = await openDialog()

  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  expect(within(customer).queryByRole("radiogroup", { name: "Mijoz turi" })).not.toBeInTheDocument()
  expect(within(customer).getByText("Yangi mijoz qo'shish ruxsatingiz yo'q: mavjud mijozni biriktiring.")).toBeInTheDocument()
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toBeInTheDocument()
  expect(within(customer).queryByLabelText("F.I.Sh.")).not.toBeInTheDocument()
})

// An order is entered into the current location, and assigned among the
// members who work there (logic/locations.md, section 6).
test("an order is entered into the current location, and assigned among the members who work there", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(SARDOR, 1, [asosiyOf(1).id])
  await signIn(ALI)
  seedOrders()
  keep(`location:1:${ALI}`, String(chilonzor.id))
  const { user, dialog } = await openDialog()

  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "901112233")
  await user.type(within(customer).getByLabelText("F.I.Sh."), "Yangi Mijoz")
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  // Sardor works in Asosiy alone: not offered for an order in Chilonzor.
  expect(await optionsOf(user, within(order).getByLabelText("Mas'ul"))).toEqual(["Tanlanmagan", "Ali Valiyev", "Vali Aliyev"])
  await user.type(within(order).getByLabelText("Nomi"), "Chilonzorda")
  setDate(within(order).getByLabelText("Muddat"), addDays(today, 2))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.orders.at(-1)).toMatchObject({ title: "Chilonzorda", locationId: chilonzor.id })
})
