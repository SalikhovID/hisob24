import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { addDays, ALI, db, localToday, seedTasks, stagesOf, taskTypesOf, typesOf, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { TasksPage } from "./tasks-page"

// openDialog opens the page and its dialog for a new task.
async function openDialog(href = "/tasks?view=list") {
  setLocation(href)
  const rendered = renderWithProviders(<TasksPage />)
  await rendered.user.click(await screen.findByRole("button", { name: "Vazifa qo'shish" }))
  return { ...rendered, dialog: await screen.findByRole("dialog", { name: "Vazifa qo'shish" }) }
}

const today = localToday()

// setDate fills a date input, which is not typed into.
const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

// titles are the tasks the table shows, in order.
const titles = () =>
  within(screen.getByRole("table", { name: "Vazifalar" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("rowheader").textContent)

test("the dialog: the type on top, the customer on the left and the task on the right; it opens in the first stage, with the deadline empty and nobody assigned", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedTasks()
  const { user, dialog } = await openDialog()

  expect(dialog).toHaveClass("sm:max-w-3xl")
  expect(within(dialog).getByText("Turni tanlang, mijozni biriktiring va vazifani to'ldiring.")).toBeInTheDocument()
  const types = within(dialog).getByRole("radiogroup", { name: "Vazifa turi" })
  expect(within(types).getAllByRole("radio").map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
    ["Vazifa", "true"],
    ["Buyurtma", "false"],
  ])
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  expect(within(customer).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Jismoniy", "Yuridik"])
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toHaveValue("")
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("")
  expect(within(customer).getByLabelText("Manba")).toHaveValue("")
  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  expect(within(task).getByLabelText("Nomi")).toHaveValue("")
  expect(within(task).getByLabelText("Muddat")).toHaveAttribute("type", "date")
  expect(within(task).getByLabelText("Muddat")).toHaveValue("")
  const [yangi] = stagesOf(1)
  expect(within(task).getByLabelText("Bosqich")).toHaveValue(String(yangi.id))
  const assignee = within(task).getByLabelText("Mas'ul")
  await waitFor(() =>
    expect(within(assignee).getAllByRole("option").map((option) => option.textContent)).toEqual(["Tanlanmagan", "Ali Valiyev", "Vali Aliyev", "Sardor Karimov"]),
  )
  expect(assignee).toHaveValue("")
  // The type's fields are the form's, under the task's own.
  expect(within(task).queryByLabelText("Izoh")).not.toBeInTheDocument()
  await user.click(within(types).getByRole("radio", { name: "Buyurtma" }))
  expect(within(task).getByLabelText("Izoh")).toHaveValue("")
  expect(within(task).getByLabelText("Summa")).toHaveValue("")
  expect(within(task).getByRole("group", { name: "Kanal" })).toBeInTheDocument()
})

test("a task with a new customer is entered in one go, and the list shows it at once", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { buyurtma, izoh, summa, jarayonda } = seedTasks()
  const [jismoniy] = typesOf(1)
  const [fish] = jismoniy.fields
  const { user, dialog } = await openDialog()

  await user.click(within(dialog).getByRole("radio", { name: "Buyurtma" }))
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "901112233")
  await user.type(within(customer).getByLabelText("F.I.Sh."), "Yangi Mijoz")
  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  await user.type(within(task).getByLabelText("Nomi"), " Shartnoma imzolash ")
  setDate(within(task).getByLabelText("Muddat"), addDays(today, 7))
  await user.selectOptions(within(task).getByLabelText("Bosqich"), "Jarayonda")
  await user.selectOptions(within(task).getByLabelText("Mas'ul"), "Vali Aliyev")
  await user.type(within(task).getByLabelText("Izoh"), "Ertalab")
  await user.type(within(task).getByLabelText("Summa"), "45000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Vazifa qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(titles()).toContain("Shartnoma imzolash"))
  const entered = db.tasks.at(-1)!
  expect(entered).toMatchObject({
    typeId: buyurtma.id,
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

test("a customer that is there is taken from the suggestions: its fields fill in and lock, and the task is entered for it", async () => {
  await signIn(ALI)
  const { dilshod } = seedTasks()
  // Its name is gone (its source stays): a required field left empty does
  // not stand in the way of a task for a customer that is there.
  const [, manba] = db.types.find((type) => type.companyId === 1)!.fields
  dilshod.values = { [manba.id]: db.dropdowns[0].options[0].id }
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  const phone = within(customer).getByRole("combobox", { name: "Telefon raqami" })

  await user.type(phone, "911")
  await user.click(await screen.findByRole("option", { name: /91 111 22 33/ }))

  expect(phone).toHaveValue("91 111 22 33")
  expect(phone).toBeDisabled()
  expect(within(customer).getByRole("radio", { name: "Jismoniy" })).toHaveAttribute("aria-checked", "true")
  expect(within(customer).getByRole("radio", { name: "Yuridik" })).toHaveAttribute("aria-disabled", "true")
  expect(within(customer).getByLabelText("F.I.Sh.")).toBeDisabled()
  expect(within(customer).getByLabelText("Manba")).toBeDisabled()
  expect(within(customer).getByLabelText("Manba")).toHaveValue(String(db.dropdowns[0].options[0].id))
  const linked = within(customer).getByRole("region", { name: "Mavjud mijoz" })
  expect(within(linked).getByText("+998 91 111 22 33")).toBeInTheDocument()
  expect(within(linked).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${dilshod.id}`)

  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  await user.type(within(task).getByLabelText("Nomi"), "Qayta qo'ng'iroq")
  setDate(within(task).getByLabelText("Muddat"), today)
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.tasks.at(-1)).toMatchObject({ title: "Qayta qo'ng'iroq", customerId: dilshod.id })
  expect(db.customers.filter((c) => c.companyId === 1)).toHaveLength(3)
})

test("Boshqa mijoz lets the customer go: the fields unlock and empty", async () => {
  await signIn(ALI)
  seedTasks()
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911")
  await user.click(await screen.findByRole("option", { name: /Dilshod Karimov/ }))
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("Dilshod Karimov")

  await user.click(within(customer).getByRole("button", { name: "Boshqa mijoz" }))

  expect(within(customer).queryByRole("region", { name: "Mavjud mijoz" })).not.toBeInTheDocument()
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toHaveValue("")
  expect(within(customer).getByRole("combobox", { name: "Telefon raqami" })).toBeEnabled()
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("")
  expect(within(customer).getByLabelText("F.I.Sh.")).toBeEnabled()
})

test("what is wrong with the form is said in the API's words, all at once", async () => {
  await signIn(ALI)
  seedTasks()
  const { user, dialog } = await openDialog()
  await user.click(within(dialog).getByRole("radio", { name: "Buyurtma" }))
  await user.type(within(dialog).getByRole("combobox", { name: "Telefon raqami" }), "90 111")

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  for (const message of [
    "Vazifa nomini kiriting",
    "Muddatni kiriting",
    "Telefon raqamini to'liq kiriting",
    "«F.I.Sh.» maydonini to'ldiring",
    "«Izoh» maydonini to'ldiring",
  ]) {
    expect(await within(dialog).findByText(message)).toBeInTheDocument()
  }
  expect(db.tasks).toHaveLength(4)
})

test("a phone that another customer has leads to that customer: linked at a press, or opened", async () => {
  await signIn(ALI)
  const { dilshod } = seedTasks()
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  // The whole number is typed, the suggestion put away unused: Escape
  // closes the suggestions, not the dialog.
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911112233")
  await screen.findByRole("listbox", { name: "Mijoz takliflari" })
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Vazifa qo'shish" })).toBeInTheDocument()
  await user.type(within(customer).getByLabelText("F.I.Sh."), "Boshqa Dilshod")
  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  await user.type(within(task).getByLabelText("Nomi"), "Takror")
  setDate(within(task).getByLabelText("Muddat"), today)

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  expect(await within(dialog).findByText("Bu raqamli mijoz allaqachon bor")).toBeInTheDocument()
  expect(within(dialog).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(db.tasks).toHaveLength(4)
  expect(db.customers.filter((c) => c.companyId === 1)).toHaveLength(3)

  await user.click(within(dialog).getByRole("button", { name: "Shu mijozni biriktirish" }))

  expect(await within(customer).findByRole("region", { name: "Mavjud mijoz" })).toBeInTheDocument()
  expect(within(customer).getByLabelText("F.I.Sh.")).toHaveValue("Dilshod Karimov")
  expect(within(dialog).queryByText("Bu raqamli mijoz allaqachon bor")).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.tasks.at(-1)).toMatchObject({ title: "Takror", customerId: dilshod.id })
})

test("with no customer types only a customer that is there will do", async () => {
  await signIn(ALI)
  const { dilshod } = seedTasks()
  db.types.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))
  const { user, dialog } = await openDialog()
  const customer = within(dialog).getByRole("group", { name: "Mijoz" })

  expect(within(customer).getByText("Mijoz turlari yo'q: faqat mavjud mijozni biriktirish mumkin.")).toBeInTheDocument()
  expect(within(customer).queryByRole("radiogroup")).not.toBeInTheDocument()
  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  await user.type(within(task).getByLabelText("Nomi"), "Mavjud mijozga")
  setDate(within(task).getByLabelText("Muddat"), today)
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Mijozni tanlang")).toBeInTheDocument()

  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911")
  await user.click(await screen.findByRole("option", { name: /91 111 22 33/ }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.tasks.at(-1)).toMatchObject({ title: "Mavjud mijozga", customerId: dilshod.id })
})

test("the + of a column opens the dialog for that stage; under a tab it opens with that tab's type; it opens empty every time", async () => {
  await signIn(ALI)
  const { jarayonda, buyurtma } = seedTasks()
  setLocation(`/tasks?type=${buyurtma.id}`)
  const { user } = renderWithProviders(<TasksPage />)
  await screen.findByRole("region", { name: "Kanban" })

  await user.click(await screen.findByRole("button", { name: "Vazifa qo'shish: Jarayonda" }))

  const dialog = await screen.findByRole("dialog", { name: "Vazifa qo'shish" })
  expect(within(dialog).getByLabelText("Bosqich")).toHaveValue(String(jarayonda.id))
  expect(within(dialog).getByRole("radio", { name: "Buyurtma" })).toHaveAttribute("aria-checked", "true")
  await user.type(within(dialog).getByLabelText("Nomi"), "Yarim yozilgan")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "Vazifa qo'shish" }))
  const again = await screen.findByRole("dialog", { name: "Vazifa qo'shish" })
  expect(within(again).getByLabelText("Nomi")).toHaveValue("")
  const [yangi] = stagesOf(1)
  expect(within(again).getByLabelText("Bosqich")).toHaveValue(String(yangi.id))
  expect(taskTypesOf(1)).toHaveLength(2)
  expect(typesOf(1)).toHaveLength(2)
})
