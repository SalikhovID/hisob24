import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, stagesOf, taskTypesOf, typesOf, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { SettingsPage } from "./settings-page"

// rowsOf reads a list of settings as [name, what it holds] of each row.
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) =>
      ["setting-title", "setting-detail"].map((slot) => row.querySelector(`[data-slot="${slot}"]`)?.textContent ?? null),
    )

const typeList = () => screen.findByRole("list", { name: "Mijoz turlari" })
const dropdownList = () => screen.findByRole("list", { name: "Dropdownlar" })

test("the owner opens on the customers tab and sees the customer types with their fields", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(screen.getAllByLabelText("Yuklanmoqda").length).toBeGreaterThan(0)
  // The settings are three tabs; the customers' is the one open by default.
  const tabs = screen.getByRole("tablist", { name: "Sozlamalar bo'limlari" })
  expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Mijozlar", "Vazifalar", "Dropdownlar"])
  expect(within(tabs).getByRole("tab", { name: "Mijozlar" })).toHaveAttribute("aria-selected", "true")

  const types = await typeList()
  expect(rowsOf(types)).toEqual([
    ["Jismoniy", "F.I.Sh., Manba"],
    ["Yuridik", "Nomi, INN"],
  ])
  const [jismoniy] = typesOf(1)
  expect(within(types).getByRole("link", { name: "Jismoniy" })).toHaveAttribute("href", `/settings/customer-types/${jismoniy.id}`)
  expect(screen.getByRole("heading", { level: 2, name: "Mijoz turlari" })).toBeInTheDocument()
  // The other tabs' lists are not on the page.
  expect(screen.queryByRole("list", { name: "Dropdownlar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { level: 2, name: "Bosqichlar" })).not.toBeInTheDocument()
})

test("the dropdowns tab shows the dropdowns with their options", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=dropdowns")
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("tab", { name: "Dropdownlar" })).toHaveAttribute("aria-selected", "true")
  const dropdowns = await dropdownList()
  expect(rowsOf(dropdowns)).toEqual([["Manba", "Instagram, LinkedIn, YouTube"]])
  const [manba] = dropdownsOf(1)
  expect(within(dropdowns).getByRole("link", { name: "Manba" })).toHaveAttribute("href", `/settings/dropdowns/${manba.id}`)
  expect(screen.getByRole("heading", { level: 2, name: "Dropdownlar" })).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()
})

test("a tab opens its settings and goes into the address", async () => {
  await signIn(ALI)
  setLocation("/settings")
  const { user } = renderWithProviders(<SettingsPage />)
  await typeList()

  await user.click(screen.getByRole("tab", { name: "Vazifalar" }))
  expect(currentUrl()).toBe("/settings?tab=tasks")
  expect(await taskTypeList()).toBeInTheDocument()
  expect(await stageList()).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Dropdownlar" }))
  expect(currentUrl()).toBe("/settings?tab=dropdowns")
  expect(await dropdownList()).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Bosqichlar" })).not.toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Mijozlar" }))
  expect(currentUrl()).toBe("/settings")
  expect(await typeList()).toBeInTheDocument()
})

test("an employee is sent home: the settings are the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  let asked = false
  server.use(
    http.get("*/api/app/customer-types", () => {
      asked = true
      return HttpResponse.json([])
    }),
  )
  renderWithProviders(<SettingsPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { name: "Sozlamalar" })).not.toBeInTheDocument()
  expect(asked).toBe(false)
})

test("a list that fails to load says why and can be asked for again", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  server.use(http.get("*/api/app/task-stages", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  // The other list of the tab is there all the same.
  expect(rowsOf(await taskTypeList())).toHaveLength(1)
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(rowsOf(await stageList())).toHaveLength(3)
})

test("an empty list says what it is for", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.types.forEach((type) => (type.deleted = true))
  const { user } = renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Hali tur yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Dropdownlar" }))
  expect(await screen.findByText("Hali dropdown yo'q")).toBeInTheDocument()
  expect(screen.getByText("Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi.")).toBeInTheDocument()
})

const names = (list: HTMLElement) => rowsOf(list).map(([name]) => name)

test("a customer type is added from the dialog and joins the list", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SettingsPage />)
  await typeList()

  await user.click(screen.getByRole("button", { name: "Tur qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Tur qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Hamkor")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Tur qo'shildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await typeList())).toEqual(["Jismoniy", "Yuridik", "Hamkor"]))
})

test("the add-type dialog says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SettingsPage />)
  await typeList()
  await user.click(screen.getByRole("button", { name: "Tur qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Tur qo'shish" })

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "jismoniy")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli tur allaqachon bor")).toBeInTheDocument()
  // The dialog stays open with the reason; nothing was added.
  expect(screen.getByRole("dialog", { name: "Tur qo'shish" })).toBeInTheDocument()
  expect(typesOf(1)).toHaveLength(2)
})

test("a customer type is renamed from its row", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SettingsPage />)
  const types = await typeList()

  await user.click(within(types).getByRole("button", { name: "Nomini o'zgartirish: Yuridik" }))
  const dialog = await screen.findByRole("dialog", { name: "Tur nomini o'zgartirish" })
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("Yuridik")
  await user.clear(name)
  await user.type(name, "Firma")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Tur nomi o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await typeList())).toEqual(["Jismoniy", "Firma"]))
})

test("a customer type is deleted after asking; cancelling keeps it", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await typeList()).getByRole("button", { name: "O'chirish: Yuridik" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Yuridik» turi va uning maydonlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(names(await typeList())).toEqual(["Jismoniy", "Yuridik"])

  await user.click(within(await typeList()).getByRole("button", { name: "O'chirish: Yuridik" }))
  confirm = await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Tur o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await typeList())).toEqual(["Jismoniy"]))
})

test("a customer type the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  server.use(
    http.delete("*/api/app/customer-types/:id", () =>
      HttpResponse.json({ error: "type_in_use", message: "Bu turda 3 ta mijoz bor" }, { status: 409 }),
    ),
  )
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await typeList()).getByRole("button", { name: "O'chirish: Jismoniy" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Bu turda 3 ta mijoz bor")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(names(await typeList())).toEqual(["Jismoniy", "Yuridik"])
})

const handleOf = (list: HTMLElement, name: string) =>
  within(list).getByRole("button", { name: `${name}: tartibini o'zgartirish` })

test("the customer types are put in order from the keyboard, and the order is saved", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SettingsPage />)

  handleOf(await typeList(), "Yuridik").focus()
  await user.keyboard("{ArrowUp}")

  expect(names(await typeList())).toEqual(["Yuridik", "Jismoniy"])
  await waitFor(() => expect(typesOf(1).map((type) => type.name)).toEqual(["Yuridik", "Jismoniy"]))
})

test("an order the API refuses is taken back, and the reason is said", async () => {
  await signIn(ALI)
  server.use(
    http.put("*/api/app/customer-types/order", () =>
      HttpResponse.json({ error: "order_changed", message: "Ro'yxat o'zgargan. Sahifani yangilang" }, { status: 409 }),
    ),
  )
  const { user } = renderWithProviders(<SettingsPage />)

  handleOf(await typeList(), "Yuridik").focus()
  await user.keyboard("{ArrowUp}")

  expect(await screen.findByText("Ro'yxat o'zgargan. Sahifani yangilang")).toBeInTheDocument()
  await waitFor(async () => expect(names(await typeList())).toEqual(["Jismoniy", "Yuridik"]))
})

test("a dropdown is added from the dialog and joins the list", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=dropdowns")
  const { user } = renderWithProviders(<SettingsPage />)
  await dropdownList()

  await user.click(screen.getByRole("button", { name: "Dropdown qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Dropdown qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Holat")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Dropdown qo'shildi")).toBeInTheDocument()
  await waitFor(async () => expect(rowsOf(await dropdownList())).toEqual([["Manba", "Instagram, LinkedIn, YouTube"], ["Holat", null]]))
})

test("a dropdown is renamed from its row", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=dropdowns")
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await dropdownList()).getByRole("button", { name: "Nomini o'zgartirish: Manba" }))
  const dialog = await screen.findByRole("dialog", { name: "Dropdown nomini o'zgartirish" })
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("Manba")
  await user.clear(name)
  await user.type(name, "Qayerdan")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Dropdown nomi o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await dropdownList())).toEqual(["Qayerdan"]))
})

test("a dropdown a field uses is not deleted, and the reason is said; one that is free is", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=dropdowns")
  db.dropdowns.push({ id: 900, companyId: 1, name: "Holat", options: [] })
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await dropdownList()).getByRole("button", { name: "O'chirish: Manba" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Manba» va uning variantlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Bu dropdown 1 ta maydonda ishlatilgan")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(names(await dropdownList())).toEqual(["Manba", "Holat"])

  await user.click(within(await dropdownList()).getByRole("button", { name: "O'chirish: Holat" }))
  confirm = await screen.findByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Dropdown o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await dropdownList())).toEqual(["Manba"]))
})

const taskTypeList = () => screen.findByRole("list", { name: "Vazifa turlari" })
const stageList = () => screen.findByRole("list", { name: "Bosqichlar" })

test("the owner sees the task types and the stages, each stage with its color and the final one marked", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Mijozlar va vazifalar sozlamalari")).toBeInTheDocument()
  // The address opened the tasks' tab.
  expect(screen.getByRole("tab", { name: "Vazifalar" })).toHaveAttribute("aria-selected", "true")
  const types = await taskTypeList()
  expect(rowsOf(types)).toEqual([["Vazifa", null]])
  const [vazifa] = taskTypesOf(1)
  expect(within(types).getByRole("link", { name: "Vazifa" })).toHaveAttribute("href", `/settings/task-types/${vazifa.id}`)
  const stages = await stageList()
  expect(names(stages)).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  const rows = within(stages).getAllByRole("listitem")
  // The color is said for a screen reader; the final mark stands on the done
  // stage alone.
  expect(within(rows[0]).getByText("Ko'k")).toHaveClass("sr-only")
  expect(within(rows[1]).getByText("Sariq")).toHaveClass("sr-only")
  expect(within(rows[2]).getByText("Yakuniy")).toBeInTheDocument()
  expect(within(rows[0]).queryByText("Yakuniy")).not.toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Vazifa turlari" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Bosqichlar" })).toBeInTheDocument()
})

test("a stage is added from the dialog with its color and the final mark, and joins the list", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)
  await stageList()

  await user.click(screen.getByRole("button", { name: "Bosqich qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Bosqich qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Kutilmoqda")
  await user.click(within(within(dialog).getByRole("radiogroup", { name: "Rangi" })).getByRole("radio", { name: "Moviy" }))
  await user.click(within(dialog).getByRole("checkbox", { name: "Yakuniy bosqich" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Bosqich qo'shildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await stageList())).toEqual(["Yangi", "Jarayonda", "Bajarildi", "Kutilmoqda"]))
  expect(db.stages.find((s) => s.name === "Kutilmoqda")).toMatchObject({ color: "teal", done: true, companyId: 1 })
})

test("the add-stage dialog says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)
  await stageList()
  await user.click(screen.getByRole("button", { name: "Bosqich qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Bosqich qo'shish" })

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()
  expect(within(dialog).getByText("Rangni tanlang")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "yangi")
  await user.click(within(dialog).getByRole("radio", { name: "Qizil" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli bosqich allaqachon bor")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Bosqich qo'shish" })).toBeInTheDocument()
  expect(stagesOf(1)).toHaveLength(3)
})

test("a stage is edited from its row: its name, color and final mark come filled in", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await stageList()).getByRole("button", { name: "Tahrirlash: Jarayonda" }))
  const dialog = await screen.findByRole("dialog", { name: "Bosqichni tahrirlash" })
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("Jarayonda")
  expect(within(dialog).getByRole("radio", { name: "Sariq" })).toBeChecked()
  expect(within(dialog).getByRole("checkbox", { name: "Yakuniy bosqich" })).not.toBeChecked()
  await user.clear(name)
  await user.type(name, "Ishda")
  await user.click(within(dialog).getByRole("radio", { name: "Binafsha" }))
  await user.click(within(dialog).getByRole("checkbox", { name: "Yakuniy bosqich" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Bosqich saqlandi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await stageList())).toEqual(["Yangi", "Ishda", "Bajarildi"]))
  expect(db.stages.find((s) => s.name === "Ishda")).toMatchObject({ color: "violet", done: true })
})

test("a stage is deleted after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)

  await user.click(within(await stageList()).getByRole("button", { name: "O'chirish: Yangi" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Bosqichni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Yangi» bosqichi o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Bosqich o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await stageList())).toEqual(["Jarayonda", "Bajarildi"]))

  server.use(
    http.delete("*/api/app/task-stages/:id", () =>
      HttpResponse.json({ error: "stage_in_use", message: "Bu bosqichda 2 ta vazifa bor" }, { status: 409 }),
    ),
  )
  await user.click(within(await stageList()).getByRole("button", { name: "O'chirish: Jarayonda" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Bu bosqichda 2 ta vazifa bor")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(names(await stageList())).toEqual(["Jarayonda", "Bajarildi"])
})

test("the stages are put in order from the keyboard, and the order is saved", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)

  handleOf(await stageList(), "Bajarildi").focus()
  await user.keyboard("{ArrowUp}")

  expect(names(await stageList())).toEqual(["Yangi", "Bajarildi", "Jarayonda"])
  await waitFor(() => expect(stagesOf(1).map((s) => s.name)).toEqual(["Yangi", "Bajarildi", "Jarayonda"]))
})

test("a task type is added, renamed and deleted from the settings", async () => {
  await signIn(ALI)
  setLocation("/settings?tab=tasks")
  const { user } = renderWithProviders(<SettingsPage />)
  await taskTypeList()

  await user.click(screen.getByRole("button", { name: "Vazifa turi qo'shish" }))
  let dialog = await screen.findByRole("dialog", { name: "Vazifa turi qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Buyurtma")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Vazifa turi qo'shildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await taskTypeList())).toEqual(["Vazifa", "Buyurtma"]))

  await user.click(within(await taskTypeList()).getByRole("button", { name: "Nomini o'zgartirish: Vazifa" }))
  dialog = await screen.findByRole("dialog", { name: "Vazifa turi nomini o'zgartirish" })
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("Vazifa")
  await user.clear(name)
  await user.type(name, "Umumiy")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Vazifa turi nomi o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await taskTypeList())).toEqual(["Umumiy", "Buyurtma"]))

  await user.click(within(await taskTypeList()).getByRole("button", { name: "O'chirish: Buyurtma" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Vazifa turini o'chirasizmi?" })
  expect(within(confirm).getByText(/«Buyurtma» turi va uning maydonlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Vazifa turi o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(names(await taskTypeList())).toEqual(["Umumiy"]))
  expect(taskTypesOf(1).map((t) => t.name)).toEqual(["Umumiy"])
})

test("the empty task settings say what they are for", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.stages.forEach((stage) => (stage.deleted = true))
  db.taskTypes.forEach((type) => (type.deleted = true))
  setLocation("/settings?tab=tasks")
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Hali bosqich yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa qo'shish uchun kamida bitta bosqich kerak.")).toBeInTheDocument()
  expect(await screen.findByText("Hali vazifa turi yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
})
