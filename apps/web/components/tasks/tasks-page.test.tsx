import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { addDays, ALI, db, localToday, nextId, seedTasks, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose, optionsOf } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TasksPage } from "./tasks-page"

// rowsOf are the tasks in the table (the page shows them as cards too, for
// phones): the row of each, without the header.
const rowsOf = (table: HTMLElement) => within(table).getAllByRole("row").slice(1)
const table = () => screen.findByRole("table", { name: "Vazifalar" })
const titleOf = (row: HTMLElement) => within(row).getByRole("rowheader").textContent
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent)
// titles are the tasks the table shows, in order.
const titles = () => rowsOf(screen.getByRole("table", { name: "Vazifalar" })).map(titleOf)
const headers = () =>
  within(screen.getByRole("table", { name: "Vazifalar" }))
    .getAllByRole("columnheader")
    .map((header) => header.textContent)

const today = localToday()
// due writes a deadline as the list does: the day and how far off it is.
const due = (days: number, relative: string | null) =>
  relative === null ? formatDate(addDays(today, days)) : `${formatDate(addDays(today, days))} · ${relative}`

test("the tasks list shows the company's tasks, the one due soonest first, with their customer, stage, deadline, assignee and answers", async () => {
  await signIn(ALI)
  const seeded = seedTasks()
  setLocation("/tasks?view=list")

  renderWithProviders(<TasksPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Vazifalar" })).toBeInTheDocument()
  const list = await table()
  // The answers of every type, a column for each field name.
  expect(headers()).toEqual(["Vazifa", "Mijoz", "Turi", "Bosqich", "Muddat", "Mas'ul", "Izoh", "Summa", "Kanal", "Qo'shgan", "Qo'shilgan"])
  const rows = rowsOf(list)
  expect(rows.map(titleOf)).toEqual(["Eski buyurtma", "Hisob-faktura", "Shartnoma yuborish", "Qo'ng'iroq qilish"])
  // Each title is the way into the task; each customer the way into the customer.
  expect(within(rows[0]).getByRole("link", { name: "Eski buyurtma" })).toHaveAttribute("href", `/tasks/${seeded.old.id}`)
  expect(within(rows[0]).getByRole("link", { name: "Dilshod Karimov" })).toHaveAttribute("href", `/customers/${seeded.dilshod.id}`)
  expect(within(rows[0]).getByText("+998 91 111 22 33")).toBeInTheDocument()
  expect(rows.map((row) => cellsOf(row).slice(1))).toEqual([
    // A done task's deadline is the day alone, however late.
    ["Vazifa", "Bajarildi", due(-5, null), "Ali Valiyev", "—", "—", "—", "Ali Valiyev", "02.10.2026"],
    ["Buyurtma", "Yangi", due(-2, "2 kun kechikdi"), "—", "Kechikkan", "—", "—", "Sardor Karimov", "02.10.2026"],
    ["Vazifa", "Jarayonda", due(0, "Bugun"), "—", "—", "—", "—", "Vali Aliyev", "02.10.2026"],
    ["Buyurtma", "Yangi", due(3, "3 kun qoldi"), "Vali Aliyev", "Ertalab qo'ng'iroq", "45000", "Instagram, LinkedIn", "Ali Valiyev", "02.10.2026"],
  ])
  // A task that is late and not done is marked; a done one is not. The done
  // one's deadline is found by its slot: as a date alone it may read the
  // same as the row's "Qo'shilgan" day.
  expect(within(rows[1]).getByText("2 kun kechikdi").closest("[data-slot=deadline]")).toHaveClass("text-destructive")
  expect(rows[0].querySelector("[data-slot=deadline]")).not.toHaveClass("text-destructive")
  expect(await screen.findByText("Kompaniyangiz vazifalari · 4 ta")).toBeInTheDocument()
})

test("a customer with no name goes by its phone, which is then not said twice", async () => {
  await signIn(ALI)
  const seeded = seedTasks()
  seeded.dilshod.values = {}
  setLocation("/tasks?view=list")

  renderWithProviders(<TasksPage />)

  const rows = rowsOf(await table())
  expect(within(rows[0]).getByRole("link", { name: "+998 91 111 22 33" })).toHaveAttribute("href", `/customers/${seeded.dilshod.id}`)
  expect(within(rows[0]).getAllByText("+998 91 111 22 33")).toHaveLength(1)
})

test("a tab keeps the tasks of one type, under that type's own fields, and stays in the address", async () => {
  await signIn(ALI)
  const { buyurtma, vazifa } = seedTasks()
  setLocation("/tasks?view=list")
  const { user } = renderWithProviders(<TasksPage />)
  await table()

  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Barchasi", "Vazifa", "Buyurtma"])
  await user.click(screen.getByRole("tab", { name: "Buyurtma" }))

  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/tasks?view=list&type=${buyurtma.id}`)
  // Every task here is a Buyurtma: the type is not said in each row, and
  // the other types' fields are not asked about.
  expect(headers()).toEqual(["Vazifa", "Mijoz", "Bosqich", "Muddat", "Mas'ul", "Izoh", "Summa", "Kanal", "Qo'shgan", "Qo'shilgan"])
  expect(screen.getByText("Kompaniyangiz vazifalari")).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Vazifa" }))
  await waitFor(() => expect(titles()).toEqual(["Eski buyurtma", "Shartnoma yuborish"]))
  expect(currentUrl()).toBe(`/tasks?view=list&type=${vazifa.id}`)
  expect(headers()).toEqual(["Vazifa", "Mijoz", "Bosqich", "Muddat", "Mas'ul", "Qo'shgan", "Qo'shilgan"])

  await user.click(screen.getByRole("tab", { name: "Barchasi" }))
  await waitFor(() => expect(titles()).toHaveLength(4))
  expect(currentUrl()).toBe("/tasks?view=list")
})

test("the stage and the assignee narrow the list and stay in the address", async () => {
  await signIn(ALI)
  const { yangi } = seedTasks()
  setLocation("/tasks?view=list")
  const { user } = renderWithProviders(<TasksPage />)
  await table()

  const stage = screen.getByRole("combobox", { name: "Bosqich" })
  expect(stage).toHaveTextContent("Barcha bosqichlar")
  expect(await optionsOf(user, stage)).toEqual(["Barcha bosqichlar", "Yangi", "Jarayonda", "Bajarildi"])
  await choose(user, stage, "Yangi")
  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/tasks?view=list&stage=${yangi.id}`)

  // The assignees are the company's members now, the signed-in one as "Men".
  const assignee = await screen.findByRole("combobox", { name: "Mas'ul" })
  await user.click(assignee)
  await waitFor(() =>
    expect(within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Barcha mas'ullar",
      "Men",
      "Vali Aliyev",
      "Sardor Karimov",
    ]),
  )
  await user.click(screen.getByRole("option", { name: "Vali Aliyev" }))
  await waitFor(() => expect(titles()).toEqual(["Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/tasks?view=list&stage=${yangi.id}&assignee=${VALI}`)

  await choose(user, stage, "Barcha bosqichlar")
  await choose(user, assignee, "Men")
  await waitFor(() => expect(titles()).toEqual(["Eski buyurtma"]))
  expect(currentUrl()).toBe(`/tasks?view=list&assignee=${ALI}`)
  expect(screen.getByText("Kompaniyangiz vazifalari")).toBeInTheDocument()
})

test("the list opens under the filters the address names", async () => {
  await signIn(ALI)
  const { buyurtma, yangi } = seedTasks()
  setLocation(`/tasks?view=list&type=${buyurtma.id}&stage=${yangi.id}&assignee=${VALI}&search=qo`)

  renderWithProviders(<TasksPage />)

  await table()
  expect(titles()).toEqual(["Qo'ng'iroq qilish"])
  expect(screen.getByRole("tab", { name: "Buyurtma" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("combobox", { name: "Bosqich" })).toHaveTextContent("Yangi")
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Mas'ul" })).toHaveTextContent("Vali Aliyev"))
  expect(screen.getByRole("searchbox", { name: "Qidirish" })).toHaveValue("qo")
})

test("a search narrows the list, starts from the first page and stays in the address", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks?view=list&page=2")
  const { user } = renderWithProviders(<TasksPage />)
  const box = await screen.findByRole("searchbox", { name: "Qidirish" })
  expect(box).toHaveAttribute("placeholder", "Nomi, mijoz yoki telefon")

  await user.type(box, " hisob ")

  await waitFor(() => expect(currentUrl()).toBe("/tasks?view=list&search=hisob"))
  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura"]))
  // The customer's name, and a phone as people write it.
  await user.clear(box)
  await user.type(box, "anor")
  await waitFor(() => expect(titles()).toEqual(["Shartnoma yuborish"]))
  await user.clear(box)
  await user.type(box, "+998 95 555")
  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura"]))

  await user.clear(box)
  await user.type(box, "zzz")
  expect(await screen.findByText("Vazifalar topilmadi")).toBeInTheDocument()
  expect(screen.getByText("Qidiruv yoki filtrni o'zgartirib ko'ring.")).toBeInTheDocument()
})

// many enters n more tasks of Olma Savdo, beside the four of the seed, due
// after them.
function many(n: number) {
  const { call } = seedTasks()
  for (let i = 0; i < n; i += 1) {
    db.tasks.push({ ...call, id: nextId(), title: `Vazifa ${i}`, deadline: addDays(today, 10), values: { ...call.values } })
  }
}

test("the list goes page by page, twenty at a time", async () => {
  await signIn(ALI)
  many(21)
  setLocation("/tasks?view=list")
  const { user } = renderWithProviders(<TasksPage />)

  expect(rowsOf(await table())).toHaveLength(20)
  expect(screen.getByText("25 tadan 20 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))

  await waitFor(() => expect(rowsOf(screen.getByRole("table", { name: "Vazifalar" }))).toHaveLength(5))
  expect(currentUrl()).toBe("/tasks?view=list&page=2")
  expect(screen.getByText("25 tadan 5 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
  expect(screen.getByText("Kompaniyangiz vazifalari · 25 ta")).toBeInTheDocument()
})

// ticks are the Ustunlar menu's columns as [name, shown or not].
const ticks = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitemcheckbox")
    .map((item) => [item.textContent, item.getAttribute("aria-checked") === "true"])

test("the Ustunlar menu hides and shows the columns; the choice is kept for the next visit, apart from the customers'", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks?view=list")
  const { user, unmount } = renderWithProviders(<TasksPage />)
  await table()

  await user.click(screen.getByRole("button", { name: "Ustunlar" }))
  const menu = await screen.findByRole("menu")
  // Every column but the task itself, which is never hidden.
  expect(ticks(menu).map(([name]) => name)).toEqual(["Mijoz", "Turi", "Bosqich", "Muddat", "Mas'ul", "Izoh", "Summa", "Kanal", "Qo'shgan", "Qo'shilgan"])

  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Mas'ul" }))
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Qo'shilgan" }))

  expect(headers()).toEqual(["Vazifa", "Mijoz", "Turi", "Bosqich", "Muddat", "Izoh", "Summa", "Kanal", "Qo'shgan"])
  expect(JSON.parse(localStorage.getItem(`tasks_hidden_columns:1:${ALI}`)!)).toEqual(["assignee", "created_at"])
  expect(localStorage.getItem(`customers_hidden_columns:1:${ALI}`)).toBeNull()

  unmount()
  renderWithProviders(<TasksPage />)
  await table()
  expect(headers()).toEqual(["Vazifa", "Mijoz", "Turi", "Bosqich", "Muddat", "Izoh", "Summa", "Kanal", "Qo'shgan"])
})

test("the board opens unless the list was chosen; the choice stays in the address and is kept for the next visit", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks")
  const { user, unmount } = renderWithProviders(<TasksPage />)

  expect(await screen.findByRole("region", { name: "Kanban" })).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  const views = screen.getByRole("radiogroup", { name: "Ko'rinish" })
  expect(within(views).getByRole("radio", { name: "Kanban" })).toHaveAttribute("aria-checked", "true")
  // The stage filter and the columns menu are the list's.
  expect(screen.queryByRole("combobox", { name: "Bosqich" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Ustunlar" })).not.toBeInTheDocument()

  await user.click(within(views).getByRole("radio", { name: "Ro'yxat" }))

  await table()
  expect(currentUrl()).toBe("/tasks?view=list")
  expect(screen.queryByRole("region", { name: "Kanban" })).not.toBeInTheDocument()
  expect(localStorage.getItem(`tasks_view:1:${ALI}`)).toBe("list")

  // The next visit opens the list, with no view in the address.
  unmount()
  setLocation("/tasks")
  renderWithProviders(<TasksPage />)
  await table()
  expect(currentUrl()).toBe("/tasks")

  await user.click(within(screen.getByRole("radiogroup", { name: "Ko'rinish" })).getByRole("radio", { name: "Kanban" }))
  expect(await screen.findByRole("region", { name: "Kanban" })).toBeInTheDocument()
  expect(currentUrl()).toBe("/tasks?view=board")
  expect(localStorage.getItem(`tasks_view:1:${ALI}`)).toBe("board")
})

test("the page says how many tasks the company has; while they load, the list's shape holds their place", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks?view=list")

  renderWithProviders(<TasksPage />)

  expect(await screen.findByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz vazifalari")).toBeInTheDocument()
  expect(await screen.findByText("Kompaniyangiz vazifalari · 4 ta")).toBeInTheDocument()
  expect(screen.queryByLabelText("Yuklanmoqda")).not.toBeInTheDocument()
})

test("a list that did not load says why and offers to try again", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks?view=list")
  server.use(
    http.get("*/api/app/tasks", () =>
      HttpResponse.json({ error: "internal_error", message: "Vazifalar yuklanmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = renderWithProviders(<TasksPage />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Vazifalar yuklanmadi: ichki xatolik")
  expect(screen.queryByRole("table")).not.toBeInTheDocument()

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(rowsOf(await table())).toHaveLength(4)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("a company with no tasks says so, and what to do about it", async () => {
  await signIn(ALI)
  setLocation("/tasks?view=list")

  renderWithProviders(<TasksPage />)

  expect(await screen.findByText("Hali vazifa yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi vazifani «Vazifa qo'shish» tugmasi orqali qo'shing.")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz vazifalari · 0 ta")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Vazifa qo'shish" })).toBeInTheDocument()
})

test("an employee sees the company's tasks too", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedTasks()
  setLocation("/tasks?view=list")

  renderWithProviders(<TasksPage />)

  expect(rowsOf(await table())).toHaveLength(4)
})

// noStages deletes every stage of Olma Savdo, noTypes every task type, as
// its owner may.
const noStages = () => db.stages.filter((stage) => stage.companyId === 1).forEach((stage) => (stage.deleted = true))
const noTypes = () => db.taskTypes.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))

test("with no stages the owner is led to the settings, and no task can be added", async () => {
  await signIn(ALI)
  noStages()
  setLocation("/tasks")

  renderWithProviders(<TasksPage />)

  expect(await screen.findByText("Bosqichlar yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa qo'shish uchun avval Sozlamalarda bosqich yarating.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings?tab=tasks")
  expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
})

test("with no stages, or no task types, an employee is told whose it is to set them up", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  noStages()
  setLocation("/tasks")
  const { unmount } = renderWithProviders(<TasksPage />)

  expect(await screen.findByText("Bosqichlar yo'q")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi bosqichlarni sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Sozlamalarni ochish" })).not.toBeInTheDocument()

  unmount()
  db.stages.forEach((stage) => (stage.deleted = false))
  noTypes()
  renderWithProviders(<TasksPage />)

  expect(await screen.findByText("Vazifa turlari yo'q")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi vazifa turlarini sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
})

test("with no task types the owner is led to the settings", async () => {
  await signIn(ALI)
  noTypes()
  setLocation("/tasks")

  renderWithProviders(<TasksPage />)

  expect(await screen.findByText("Vazifa turlari yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa qo'shish uchun avval Sozlamalarda tur yarating.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings?tab=tasks")
})

test.each([
  ["tasks.view alone", ["tasks.view"], false],
  ["tasks.create without a way to a customer", ["tasks.view", "tasks.create"], false],
  ["tasks.create with customers.view", ["tasks.view", "tasks.create", "customers.view"], true],
])("the way to add a task is there with %s: %s", async (_, permissions, shown) => {
  giveRole(VALI, 1, "Rol", permissions as Parameters<typeof giveRole>[3])
  await signIn(VALI)
  await chooseCompany(1)
  seedTasks()
  setLocation("/tasks?view=list")
  renderWithProviders(<TasksPage />)

  await table()
  if (shown) expect(screen.getByRole("button", { name: "Vazifa qo'shish" })).toBeInTheDocument()
  else expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("an employee whose role holds no tasks.view is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/tasks?view=list")
  renderWithProviders(<TasksPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { level: 1, name: "Vazifalar" })).not.toBeInTheDocument()
})
