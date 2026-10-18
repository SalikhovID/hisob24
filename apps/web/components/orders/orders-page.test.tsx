import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { keep } from "@/lib/use-kept"
import { addDays, ALI, db, localToday, nextId, seedOrders, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { choose, optionsOf } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { OrdersPage } from "./orders-page"

// The list is the orders grouped by how far their deadline is, each group a
// list of rows, each row the way into its order.
const list = () => screen.findByRole("region", { name: "Vazifalar" })
const rowsOf = (region: HTMLElement) => within(region).queryAllByRole("link")
const titles = () => rowsOf(screen.getByRole("region", { name: "Vazifalar" })).map((row) => rowParts(row).title)
const groupsOf = (region: HTMLElement) => within(region).getAllByRole("list").map((group) => [group.getAttribute("aria-label"), within(group).getAllByRole("link").map((row) => rowParts(row).title)])

const today = localToday()
// day writes a deadline as a row does: the day and the month.
const day = (days: number) => formatDate(addDays(today, days)).slice(0, 5)

test("the orders list groups the orders by their deadline: the late, today's, this week's, the later and the done, each row with its stage, customer, assignee and deadline", async () => {
  await signIn(ALI)
  const seeded = seedOrders()
  setLocation("/orders?view=list")

  renderWithProviders(<OrdersPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Vazifalar" })).toBeInTheDocument()
  const region = await list()
  expect(groupsOf(region)).toEqual([
    ["Kechikkan", ["Hisob-faktura"]],
    ["Bugun", ["Shartnoma yuborish"]],
    ["Shu hafta", ["Qo'ng'iroq qilish"]],
    ["Bajarilgan", ["Eski buyurtma"]],
  ])
  const rows = rowsOf(region)
  expect(rows.map((row) => [rowParts(row).sub, rowParts(row).end])).toEqual([
    ["Yangi · Malika Yusupova", `${day(-2)} 2 kun kechikdi`],
    ["Jarayonda · Anor Tekstil MChJ", `${day(0)} Bugun`],
    ["Yangi · Dilshod Karimov · Vali A.", `${day(3)} 3 kun qoldi`],
    // A done order says the stage it was done in where the others say how far their deadline is.
    ["Bajarildi · Dilshod Karimov · Ali V.", `${day(-5)} Bajarildi`],
  ])
  expect(rows[3]).toHaveAttribute("href", `/orders/${seeded.old.id}`)
  // A row is the order's link alone: the customer is named, not linked.
  expect(within(rows[2]).queryAllByRole("link")).toHaveLength(0)
  // A late order's deadline is red; a done one's is not.
  expect(rows[0].querySelector('[data-slot="row-end"] .text-destructive')).not.toBeNull()
  expect(rows[3].querySelector('[data-slot="row-end"] .text-destructive')).toBeNull()
  expect(await screen.findByText("4 ta")).toBeInTheDocument()
  expect(screen.getByText("Jami: 4")).toBeInTheDocument()
})

test("a customer with no name goes by its phone", async () => {
  await signIn(ALI)
  const seeded = seedOrders()
  seeded.dilshod.values = {}
  setLocation("/orders?view=list")

  renderWithProviders(<OrdersPage />)

  const rows = rowsOf(await list())
  expect(rowParts(rows[3]).sub).toBe("Bajarildi · +998 91 111 22 33 · Ali V.")
})

test("a type chip keeps the orders of one type and stays in the address", async () => {
  await signIn(ALI)
  const { montaj, buyurtma } = seedOrders()
  setLocation("/orders?view=list")
  const { user } = renderWithProviders(<OrdersPage />)
  await list()

  const types = screen.getByRole("radiogroup", { name: "Vazifa turi" })
  expect(within(types).getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["Barchasi", "Buyurtma", "Montaj"])
  await user.click(within(types).getByRole("radio", { name: "Montaj" }))

  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/orders?view=list&type=${montaj.id}`)

  await user.click(within(types).getByRole("radio", { name: "Buyurtma" }))
  await waitFor(() => expect(titles()).toEqual(["Shartnoma yuborish", "Eski buyurtma"]))
  expect(currentUrl()).toBe(`/orders?view=list&type=${buyurtma.id}`)

  await user.click(within(types).getByRole("radio", { name: "Barchasi" }))
  await waitFor(() => expect(titles()).toHaveLength(4))
  expect(currentUrl()).toBe("/orders?view=list")
})

test("the stage and the assignee are chosen in sheets, narrow the list and stay in the address", async () => {
  await signIn(ALI)
  const { yangi } = seedOrders()
  setLocation("/orders?view=list")
  const { user } = renderWithProviders(<OrdersPage />)
  await list()

  const stage = screen.getByRole("button", { name: "Barcha bosqichlar" })
  expect(await optionsOf(user, stage)).toEqual(["Barcha bosqichlar", "Yangi", "Jarayonda", "Bajarildi"])
  await choose(user, stage, "Yangi")
  await waitFor(() => expect(titles()).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/orders?view=list&stage=${yangi.id}`)
  expect(screen.getByRole("button", { name: "Yangi" })).toHaveAttribute("aria-pressed", "true")

  // The assignees are the company's members now, the signed-in one as "Men".
  const assignee = await screen.findByRole("button", { name: "Barcha mas'ullar" })
  expect(await optionsOf(user, assignee)).toEqual(["Barcha mas'ullar", "Men", "Vali Aliyev", "Sardor Karimov"])
  await choose(user, assignee, "Vali Aliyev")
  await waitFor(() => expect(titles()).toEqual(["Qo'ng'iroq qilish"]))
  expect(currentUrl()).toBe(`/orders?view=list&stage=${yangi.id}&assignee=${VALI}`)

  await choose(user, screen.getByRole("button", { name: "Yangi" }), "Barcha bosqichlar")
  await choose(user, screen.getByRole("button", { name: "Vali A." }), "Men")
  await waitFor(() => expect(titles()).toEqual(["Eski buyurtma"]))
  expect(currentUrl()).toBe(`/orders?view=list&assignee=${ALI}`)
  expect(screen.getByRole("button", { name: "Men" })).toHaveAttribute("aria-pressed", "true")
})

test("the list opens under the filters the address names", async () => {
  await signIn(ALI)
  const { montaj, yangi } = seedOrders()
  setLocation(`/orders?view=list&type=${montaj.id}&stage=${yangi.id}&assignee=${VALI}&search=qo`)

  renderWithProviders(<OrdersPage />)

  await list()
  await waitFor(() => expect(titles()).toEqual(["Qo'ng'iroq qilish"]))
  expect(screen.getByRole("radio", { name: "Montaj" })).toBeChecked()
  expect(screen.getByRole("button", { name: "Yangi" })).toHaveAttribute("aria-pressed", "true")
  expect(await screen.findByRole("button", { name: "Vali A." })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("searchbox", { name: "Qidirish" })).toHaveValue("qo")
})

test("a search narrows the list, starts from the first page and stays in the address", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders?view=list&page=2")
  const { user } = renderWithProviders(<OrdersPage />)
  const box = await screen.findByRole("searchbox", { name: "Qidirish" })
  expect(box).toHaveAttribute("placeholder", "Nomi, mijoz yoki telefon")

  await user.type(box, " hisob ")

  await waitFor(() => expect(currentUrl()).toBe("/orders?view=list&search=hisob"))
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

// many enters n more orders of Olma Savdo, beside the four of the seed, due
// after them.
function many(n: number) {
  const { call } = seedOrders()
  for (let i = 0; i < n; i += 1) {
    db.orders.push({ ...call, id: nextId(), title: `Vazifa ${i}`, deadline: addDays(today, 10), values: { ...call.values } })
  }
}

test("the list goes page by page, twenty at a time", async () => {
  await signIn(ALI)
  many(21)
  setLocation("/orders?view=list")
  const { user } = renderWithProviders(<OrdersPage />)

  expect(rowsOf(await list())).toHaveLength(20)
  expect(screen.getByText("25 tadan 20 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))

  await waitFor(() => expect(rowsOf(screen.getByRole("region", { name: "Vazifalar" }))).toHaveLength(5))
  expect(currentUrl()).toBe("/orders?view=list&page=2")
  expect(screen.getByText("25 tadan 5 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
  expect(screen.getByText("25 ta")).toBeInTheDocument()
})

test("the board opens unless the list was chosen; the choice stays in the address and is kept for the next visit", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders")
  const { user, unmount } = renderWithProviders(<OrdersPage />)

  expect(await screen.findByRole("region", { name: "Kanban" })).toBeInTheDocument()
  const views = screen.getByRole("tablist", { name: "Ko'rinish" })
  expect(within(views).getByRole("tab", { name: "Kanban" })).toHaveAttribute("aria-selected", "true")
  // The stage filter is the list's: on the board every stage is a column.
  expect(screen.queryByRole("button", { name: "Barcha bosqichlar" })).not.toBeInTheDocument()

  await user.click(within(views).getByRole("tab", { name: "Ro'yxat" }))

  await list()
  expect(currentUrl()).toBe("/orders?view=list")
  expect(screen.queryByRole("region", { name: "Kanban" })).not.toBeInTheDocument()
  expect(localStorage.getItem(`tasks_view:1:${ALI}`)).toBe("list")

  // The next visit opens the list, with no view in the address.
  unmount()
  setLocation("/orders")
  renderWithProviders(<OrdersPage />)
  await list()
  expect(currentUrl()).toBe("/orders")

  await user.click(within(screen.getByRole("tablist", { name: "Ko'rinish" })).getByRole("tab", { name: "Kanban" }))
  expect(await screen.findByRole("region", { name: "Kanban" })).toBeInTheDocument()
  expect(currentUrl()).toBe("/orders?view=board")
  expect(localStorage.getItem(`tasks_view:1:${ALI}`)).toBe("board")
})

test("the page says how many orders the location has; while they load, the list's shape holds their place", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders?view=list")

  renderWithProviders(<OrdersPage />)

  expect(await screen.findByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(await screen.findByText("4 ta")).toBeInTheDocument()
  expect(screen.queryByLabelText("Yuklanmoqda")).not.toBeInTheDocument()
})

test("a list that did not load says why and offers to try again", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders?view=list")
  server.use(
    http.get("*/api/app/orders", () =>
      HttpResponse.json({ error: "internal_error", message: "Vazifalar yuklanmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = renderWithProviders(<OrdersPage />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Vazifalar yuklanmadi: ichki xatolik")
  expect(screen.queryByRole("region", { name: "Vazifalar" })).not.toBeInTheDocument()

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(rowsOf(await list())).toHaveLength(4)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("a company with no orders says so, and offers to add the first", async () => {
  await signIn(ALI)
  setLocation("/orders?view=list")

  const { user } = renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Hali vazifa yo'q")).toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Vazifalar" })).not.toBeInTheDocument()
  expect(screen.getByText("0 ta")).toBeInTheDocument()
  const buttons = screen.getAllByRole("button", { name: "Vazifa qo'shish" })
  expect(buttons).toHaveLength(2)
  await user.click(buttons[1])
  expect(await screen.findByRole("dialog", { name: "Vazifa qo'shish" })).toBeInTheDocument()
})

test("an employee sees the company's orders too", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  setLocation("/orders?view=list")

  renderWithProviders(<OrdersPage />)

  expect(rowsOf(await list())).toHaveLength(4)
})

// noStages deletes every stage of Olma Savdo, noTypes every order type, as
// its owner may.
const noStages = () => db.stages.filter((stage) => stage.companyId === 1).forEach((stage) => (stage.deleted = true))
const noTypes = () => db.orderTypes.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))

test("with no stages the owner is led to the settings, and no order can be added", async () => {
  await signIn(ALI)
  noStages()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Sozlama yetishmaydi")).toBeInTheDocument()
  expect(screen.getByText("Avval bosqichlarni sozlang.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings/order-types")
  expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("radiogroup", { name: "Vazifa turi" })).not.toBeInTheDocument()
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
})

test("with no stages, or no order types, an employee is told whose it is to set them up", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  noStages()
  setLocation("/orders")
  const { unmount } = renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Kompaniya egasi bosqichlarni sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Sozlamalarni ochish" })).not.toBeInTheDocument()

  unmount()
  db.stages.forEach((stage) => (stage.deleted = false))
  noTypes()
  renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Kompaniya egasi vazifa turlarini sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
})

test("with no order types the owner is led to the settings", async () => {
  await signIn(ALI)
  noTypes()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Avval vazifa turlarini sozlang.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings/order-types")
})

test.each([
  ["orders.view alone", ["orders.view"], false],
  ["orders.create without a way to a customer", ["orders.view", "orders.create"], false],
  ["orders.create with customers.view", ["orders.view", "orders.create", "customers.view"], true],
])("the way to add an order is there with %s: %s", async (_, permissions, shown) => {
  giveRole(VALI, 1, "Rol", permissions as Parameters<typeof giveRole>[3])
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  setLocation("/orders?view=list")
  renderWithProviders(<OrdersPage />)

  await list()
  if (shown) expect(screen.getByRole("button", { name: "Vazifa qo'shish" })).toBeInTheDocument()
  else expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("an employee whose role holds no orders.view is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/orders?view=list")
  renderWithProviders(<OrdersPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { level: 1, name: "Vazifalar" })).not.toBeInTheDocument()
})

// The orders the page shows are the current location's (logic/locations.md,
// section 6): the one chosen on the home or in the sidebar, kept in the
// browser; the page says which.
test("the list and the board show the current location's orders alone; another location's come when it is chosen", async () => {
  await signIn(ALI)
  const seeded = seedOrders()
  const chilonzor = addLocation(1, "Chilonzor")
  seeded.call.locationId = chilonzor.id
  setLocation("/orders?view=list")
  const first = renderWithProviders(<OrdersPage />)

  await list()
  expect(titles()).toEqual(["Hisob-faktura", "Shartnoma yuborish", "Eski buyurtma"])
  expect(await screen.findByText("Asosiy · 3 ta")).toBeInTheDocument()
  first.unmount()

  keep(`location:1:${ALI}`, String(chilonzor.id))
  setLocation("/orders?view=board")
  renderWithProviders(<OrdersPage />)
  const board = await screen.findByRole("region", { name: "Kanban" })
  const yangi = within(board).getByRole("region", { name: "Yangi" })
  await waitFor(() => expect(within(yangi).getByText("Qo'ng'iroq qilish")).toBeInTheDocument())
  expect(within(yangi).queryByText("Hisob-faktura")).not.toBeInTheDocument()
  expect(await screen.findByText("Chilonzor · 1 ta")).toBeInTheDocument()
})

test("a change of location takes the list back to its first page", async () => {
  await signIn(ALI)
  seedOrders()
  const chilonzor = addLocation(1, "Chilonzor")
  setLocation("/orders?view=list&page=2")
  renderWithProviders(<OrdersPage />)
  await screen.findByRole("heading", { level: 1, name: "Vazifalar" })
  await screen.findByRole("button", { name: "Barcha mas'ullar" })
  expect(currentUrl()).toBe("/orders?view=list&page=2")

  act(() => keep(`location:1:${ALI}`, String(chilonzor.id)))

  await waitFor(() => expect(currentUrl()).toBe("/orders?view=list"))
})

test("a member with no location to work in is told so, and cannot add an order", async () => {
  const gone = addLocation(1, "Yopilgan")
  gone.deleted = true
  restrictTo(VALI, 1, [gone.id])
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  setLocation("/orders?view=list")
  renderWithProviders(<OrdersPage />)

  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi lokatsiya biriktirishi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Vazifa qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Vazifalar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Kanban" })).not.toBeInTheDocument()
})

test("the way to the settings is the empty state's glossy capsule", async () => {
  await signIn(ALI)
  noStages()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  const link = await screen.findByRole("link", { name: "Sozlamalarni ochish" })
  expect(link).toHaveClass("glossy", "rounded-full", "h-[46px]", "px-[22px]")
  expect(link).not.toHaveClass("bg-primary")
})
