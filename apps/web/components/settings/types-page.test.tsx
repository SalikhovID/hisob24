import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, orderTypesOf, typesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TypesPage } from "./types-page"

// rowsOf reads a list of the settings as [name, what it holds] of each row.
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const { title, sub } = rowParts(item.firstElementChild as HTMLElement)
      return [title, sub]
    })
const names = (list: HTMLElement) => rowsOf(list).map(([name]) => name)
const typeList = () => screen.findByRole("list", { name: "Mijoz turlari" })

test("the customer types as the prototype's rows: each by name with its fields under it, leading to its page; the heading counts them, the way back is to the settings", async () => {
  await signIn(ALI)
  renderWithProviders(<TypesPage kind="customer" />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mijoz turlari" })).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shishda tanlanadi. Har turning o'z maydonlari bor.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  const types = await typeList()
  expect(screen.getByRole("heading", { level: 2, name: "2 ta tur" })).toBeInTheDocument()
  expect(rowsOf(types)).toEqual([
    ["Jismoniy", "F.I.Sh., Manba"],
    ["Yuridik", "Nomi, INN"],
  ])
  expect(within(types).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(typesOf(1).map((type) => `/settings/customer-types/${type.id}`))
  expect(screen.getByRole("button", { name: "Tur qo'shish" })).toBeInTheDocument()
})

test("a customer type is added from the plus's sheet and joins the list, with no field yet; a refusal stays in the sheet", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TypesPage kind="customer" />)
  await typeList()

  await user.click(screen.getByRole("button", { name: "Tur qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Tur qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Yuridik")
  await user.type(within(sheet).getByLabelText("Nomi"), "jismoniy")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli tur allaqachon bor")).toBeInTheDocument()
  expect(typesOf(1)).toHaveLength(2)
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Hamkor")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Tur qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(rowsOf(await typeList()).at(-1)).toEqual(["Hamkor", "Maydon yo'q"]))
})

test("the customer types are put in order in the «Tartiblash» mode from the keyboard and the order is saved; an order the API refuses is taken back, with the reason", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TypesPage kind="customer" />)
  await typeList()

  await user.click(screen.getByRole("button", { name: "Tartiblash" }))
  act(() => within(screen.getByRole("list", { name: "Mijoz turlari" })).getByRole("button", { name: "Yuridik: tartibini o'zgartirish" }).focus())
  await user.keyboard("{ArrowUp}")
  expect(names(await typeList())).toEqual(["Yuridik", "Jismoniy"])
  await waitFor(() => expect(typesOf(1).map((type) => type.name)).toEqual(["Yuridik", "Jismoniy"]))

  server.use(
    http.put("*/api/app/customer-types/order", () =>
      HttpResponse.json({ error: "order_changed", message: "Ro'yxat o'zgargan. Sahifani yangilang" }, { status: 409 }),
    ),
  )
  act(() => within(screen.getByRole("list", { name: "Mijoz turlari" })).getByRole("button", { name: "Jismoniy: tartibini o'zgartirish" }).focus())
  await user.keyboard("{ArrowUp}")
  expect((await screen.findAllByText("Ro'yxat o'zgargan. Sahifani yangilang")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(names(await typeList())).toEqual(["Yuridik", "Jismoniy"]))
})

test("an empty list says what it is for; a list that fails to load says why and can be asked for again", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.types.forEach((type) => (type.deleted = true))
  const { unmount } = renderWithProviders(<TypesPage kind="customer" />)
  expect(await screen.findByText("Hali tur yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()
  unmount()

  server.use(http.get("*/api/app/order-types", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<TypesPage kind="order" />)
  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("list", { name: "Buyurtma turlari" })).toBeInTheDocument()
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
  renderWithProviders(<TypesPage kind="customer" />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(asked).toBe(false)
})

test("settings.view alone reads the rows, with no plus and no ordering; settings.create and settings.edit bring them", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { unmount } = renderWithProviders(<TypesPage kind="customer" />)
  expect(rowsOf(await typeList())).toHaveLength(2)
  expect(screen.queryByRole("button", { name: "Tur qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Tartiblash" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
  unmount()

  db.roles.find((role) => role.name === "Kuzatuvchi")!.permissions = ["settings.view", "settings.create", "settings.edit"]
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TypesPage kind="customer" />)
  await typeList()
  expect(screen.getByRole("button", { name: "Tur qo'shish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Tartiblash" })).toBeInTheDocument()
})

test("the order types: the same rows and sheet, in their own words; with none yet they say what they are for", async () => {
  await signIn(ALI)
  const { user, unmount } = renderWithProviders(<TypesPage kind="order" />)

  expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma turlari" })).toBeInTheDocument()
  const types = await screen.findByRole("list", { name: "Buyurtma turlari" })
  const [buyurtma] = orderTypesOf(1)
  expect(rowsOf(types)).toEqual([["Buyurtma", buyurtma.fields.map((field) => field.label).join(", ") || "Maydon yo'q"]])
  expect(within(types).getByRole("link")).toHaveAttribute("href", `/settings/order-types/${buyurtma.id}`)
  await user.click(screen.getByRole("button", { name: "Buyurtma turi qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Buyurtma turi qo'shish" })
  expect(within(sheet).getByText("Masalan: Ta'mir, Yetkazib berish. Maydonlari tur sahifasida qo'shiladi.")).toBeInTheDocument()
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Ta'mir")
  await user.type(within(sheet).getByLabelText("Nomi"), "Montaj")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect((await screen.findAllByText("Buyurtma turi qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(names(await screen.findByRole("list", { name: "Buyurtma turlari" }))).toEqual(["Buyurtma", "Montaj"]))
  unmount()

  db.orderTypes.forEach((type) => (type.deleted = true))
  renderWithProviders(<TypesPage kind="order" />)
  expect(await screen.findByText("Hali buyurtma turi yo'q")).toBeInTheDocument()
  expect(screen.getByText("Buyurtma qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
})
