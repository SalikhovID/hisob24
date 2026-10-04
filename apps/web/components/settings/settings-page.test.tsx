import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, typesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
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

test("the owner sees the customer types with their fields and the dropdowns with their options", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(screen.getAllByLabelText("Yuklanmoqda").length).toBeGreaterThan(0)

  const types = await typeList()
  expect(rowsOf(types)).toEqual([
    ["Jismoniy", "F.I.Sh., Manba"],
    ["Yuridik", "Nomi, INN"],
  ])
  const [jismoniy] = typesOf(1)
  expect(within(types).getByRole("link", { name: "Jismoniy" })).toHaveAttribute("href", `/settings/customer-types/${jismoniy.id}`)

  const dropdowns = await dropdownList()
  expect(rowsOf(dropdowns)).toEqual([["Manba", "Instagram, LinkedIn, YouTube"]])
  const [manba] = dropdownsOf(1)
  expect(within(dropdowns).getByRole("link", { name: "Manba" })).toHaveAttribute("href", `/settings/dropdowns/${manba.id}`)
  expect(screen.getByRole("heading", { level: 2, name: "Mijoz turlari" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Dropdownlar" })).toBeInTheDocument()
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
  server.use(http.get("*/api/app/customer-dropdowns", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  // The other list is there all the same.
  expect(rowsOf(await typeList())).toHaveLength(2)
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(rowsOf(await dropdownList())).toHaveLength(1)
})

test("an empty list says what it is for", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.types.forEach((type) => (type.deleted = true))
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Hali tur yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
  expect(await screen.findByText("Hali dropdown yo'q")).toBeInTheDocument()
  expect(screen.getByText("Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()
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
