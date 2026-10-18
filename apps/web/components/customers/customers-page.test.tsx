import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { ALI, db, nextId, seedCatalog, seedCustomers, seedWarehouse, typesOf, VALI } from "@/mocks/data"
import { asosiyOf } from "@/test/locations"
import { currentUrl, router, setLocation, slowNavigation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { enterSale } from "@/test/stock"
import { CustomersPage } from "./customers-page"

// The customers are a group of rows, on a phone and a wide screen alike:
// each a link to its customer, its name over its phone and type.
const list = () => screen.findByRole("list", { name: "Mijozlar" })
const rowsOf = (group: HTMLElement) => within(group).getAllByRole("link")
const names = () => rowsOf(screen.getByRole("list", { name: "Mijozlar" })).map((row) => rowParts(row).title)

test("the customers page lists the company's customers, the newest first, each under its name with its phone and type", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mijozlar" })).toBeInTheDocument()
  const rows = rowsOf(await list())
  expect(rows.map((row) => [rowParts(row).title, rowParts(row).sub])).toEqual([
    ["Malika Yusupova", "+998 95 555 66 77 · Jismoniy"],
    ["Anor Tekstil MChJ", "+998 93 333 44 55 · Yuridik"],
    ["Dilshod Karimov", "+998 91 111 22 33 · Jismoniy"],
  ])
  expect(rows[2]).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(screen.getByText("Jami: 3")).toBeInTheDocument()
})

test("the page says how many customers the company has; while they load, the list's shape holds their place", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mijozlari")).toBeInTheDocument()
  expect(await screen.findByText("Kompaniyangiz mijozlari · 3 ta")).toBeInTheDocument()
  expect(screen.queryByLabelText("Yuklanmoqda")).not.toBeInTheDocument()
})

test("a list that did not load says why and offers to try again", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers")
  server.use(
    http.get("*/api/app/customers", () =>
      HttpResponse.json({ error: "internal_error", message: "Mijozlar yuklanmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = renderWithProviders(<CustomersPage />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Mijozlar yuklanmadi: ichki xatolik")
  expect(screen.queryByRole("list", { name: "Mijozlar" })).not.toBeInTheDocument()

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(rowsOf(await list())).toHaveLength(3)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("a company with no customers says so, and offers to add the first", async () => {
  await signIn(ALI)
  setLocation("/customers")
  const { user } = renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Hali mijoz yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijozlar" })).not.toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mijozlari · 0 ta")).toBeInTheDocument()

  const buttons = screen.getAllByRole("button", { name: "Mijoz qo'shish" })
  expect(buttons).toHaveLength(2)
  await user.click(buttons[1])
  expect(await screen.findByRole("dialog", { name: "Mijoz qo'shish" })).toBeInTheDocument()
})

test("the round + adds a customer", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers")
  const { user } = renderWithProviders(<CustomersPage />)
  await list()

  await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))

  expect(await screen.findByRole("dialog", { name: "Mijoz qo'shish" })).toBeInTheDocument()
})

test("a customer with no name goes by the phone, which is then not said twice", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  dilshod.values = {}
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  const rows = rowsOf(await list())
  expect(rowParts(rows[2])).toMatchObject({ title: "+998 91 111 22 33", sub: "Jismoniy" })
  expect(rows[2]).toHaveAttribute("href", `/customers/${dilshod.id}`)
})

test("an employee sees the company's customers too", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(rowsOf(await list())).toHaveLength(3)
})

test("a type chip keeps the customers of one type and stays in the address", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy, yuridik] = typesOf(1)
  setLocation("/customers")
  const { user } = renderWithProviders(<CustomersPage />)
  await list()

  const types = screen.getByRole("radiogroup", { name: "Mijoz turi" })
  expect(within(types).getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["Barchasi", "Jismoniy", "Yuridik"])
  expect(within(types).getByRole("radio", { name: "Barchasi" })).toBeChecked()

  await user.click(within(types).getByRole("radio", { name: "Yuridik" }))
  await waitFor(() => expect(names()).toEqual(["Anor Tekstil MChJ"]))
  expect(currentUrl()).toBe(`/customers?type=${yuridik.id}`)
  // Every customer here is a Yuridik: the type is not said in each row.
  expect(rowParts(rowsOf(screen.getByRole("list", { name: "Mijozlar" }))[0]).sub).toBe("+998 93 333 44 55")
  // One matches the chip; the company still has three. The count is not shown as the company's.
  expect(screen.getByText("Kompaniyangiz mijozlari")).toBeInTheDocument()

  await user.click(within(types).getByRole("radio", { name: "Jismoniy" }))
  await waitFor(() => expect(names()).toEqual(["Malika Yusupova", "Dilshod Karimov"]))
  expect(currentUrl()).toBe(`/customers?type=${jismoniy.id}`)

  await user.click(within(types).getByRole("radio", { name: "Barchasi" }))
  await waitFor(() => expect(names()).toHaveLength(3))
  expect(currentUrl()).toBe("/customers")
  expect(await screen.findByText("Kompaniyangiz mijozlari · 3 ta")).toBeInTheDocument()
})

test("the list opens under the type the address names", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy] = typesOf(1)
  setLocation(`/customers?type=${jismoniy.id}`)

  renderWithProviders(<CustomersPage />)

  await list()
  expect(names()).toEqual(["Malika Yusupova", "Dilshod Karimov"])
  expect(screen.getByRole("radio", { name: "Jismoniy" })).toBeChecked()
})

test("a type with no customers says that none were found, not that the company has none", async () => {
  await signIn(ALI)
  const { anor } = seedCustomers()
  anor.deleted = true
  const [, yuridik] = typesOf(1)
  setLocation(`/customers?type=${yuridik.id}`)

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Mijozlar topilmadi")).toBeInTheDocument()
  expect(screen.getByText("Qidiruv yoki filtrni o'zgartirib ko'ring.")).toBeInTheDocument()
  expect(screen.queryByText("Hali mijoz yo'q")).not.toBeInTheDocument()
})

test("a search narrows the list, starts from the first page and stays in the address", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy] = typesOf(1)
  setLocation(`/customers?type=${jismoniy.id}&page=2`)
  const { user } = renderWithProviders(<CustomersPage />)
  const box = await screen.findByRole("searchbox", { name: "Qidirish" })

  await user.type(box, " malika ")

  await waitFor(() => expect(currentUrl()).toBe(`/customers?type=${jismoniy.id}&search=malika`))
  await waitFor(() => expect(names()).toEqual(["Malika Yusupova"]))
  // A phone as people write it.
  await user.clear(box)
  await user.type(box, "+998 91 111")
  await waitFor(() => expect(names()).toEqual(["Dilshod Karimov"]))

  await user.clear(box)
  await user.type(box, "zzz")
  expect(await screen.findByText("Mijozlar topilmadi")).toBeInTheDocument()
  expect(screen.getByText("Qidiruv yoki filtrni o'zgartirib ko'ring.")).toBeInTheDocument()
})

test("the list opens with the search the address names, in the box too", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers?search=anor")

  renderWithProviders(<CustomersPage />)

  await list()
  expect(names()).toEqual(["Anor Tekstil MChJ"])
  expect(screen.getByRole("searchbox", { name: "Qidirish" })).toHaveValue("anor")
})

// many enters n more customers of Olma Savdo, beside the three of the seed.
function many(n: number) {
  const { dilshod } = seedCustomers()
  for (let i = 0; i < n; i += 1) {
    db.customers.push({ ...dilshod, id: nextId(), phone: `9989000000${String(i).padStart(2, "0")}`, values: { ...dilshod.values } })
  }
}

test("the list goes page by page, twenty at a time", async () => {
  await signIn(ALI)
  many(21)
  setLocation("/customers")
  const { user } = renderWithProviders(<CustomersPage />)

  expect(rowsOf(await list())).toHaveLength(20)
  expect(screen.getByText("24 tadan 20 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page")

  // A page is opened by its number.
  await user.click(screen.getByRole("button", { name: "2" }))

  await waitFor(() => expect(rowsOf(screen.getByRole("list", { name: "Mijozlar" }))).toHaveLength(4))
  expect(currentUrl()).toBe("/customers?page=2")
  expect(screen.getByText("24 tadan 4 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
  // The company's count stays on screen while pages turn.
  expect(screen.getByText("Kompaniyangiz mijozlari · 24 ta")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Oldingi" }))
  await waitFor(() => expect(currentUrl()).toBe("/customers"))
})

test("a search dropped from the address is dropped from the box, and stays dropped", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers?search=anor")
  renderWithProviders(<CustomersPage />)
  await list()
  await waitFor(() => expect(names()).toEqual(["Anor Tekstil MChJ"]))
  const box = screen.getByRole("searchbox", { name: "Qidirish" })
  expect(box).toHaveValue("anor")

  // The menu's link leads to the bare list: the page stays, its address changes.
  act(() => router.push("/customers"))

  await waitFor(() => expect(box).toHaveValue(""))
  await waitFor(() => expect(names()).toHaveLength(3))
  // Past the box's pause, the old search has not been written back.
  await new Promise((resolve) => setTimeout(resolve, 450))
  expect(currentUrl()).toBe("/customers")
})

test("typing that goes on while the address catches up is kept", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers")
  // The address moves a moment after it is asked to, as the real router's does.
  slowNavigation(120)
  const { user } = renderWithProviders(<CustomersPage />)
  await list()
  const box = screen.getByRole("searchbox", { name: "Qidirish" })

  await user.type(box, "a")
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/customers?search=a"))
  // The next key is typed while "a" is still on its way to the address.
  await user.type(box, "n")
  await waitFor(() => expect(currentUrl()).toBe("/customers?search=a"))

  // The address arriving with "a" is the box's own report: it must not wipe the "n".
  expect(box).toHaveValue("an")
  await waitFor(() => expect(currentUrl()).toBe("/customers?search=an"))
})

test("a type chosen while the cleared search is still on its way keeps both changes", async () => {
  await signIn(ALI)
  seedCustomers()
  const [, yuridik] = typesOf(1)
  setLocation("/customers?search=a")
  // The address takes a while to change, as on a slow connection.
  slowNavigation(400)
  const { user } = renderWithProviders(<CustomersPage />)
  await list()

  // The box waits 300 ms before it reports; the type is chosen meanwhile.
  await user.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await user.click(screen.getByRole("radio", { name: "Yuridik" }))

  await waitFor(() => expect(currentUrl()).toBe(`/customers?type=${yuridik.id}`), { timeout: 3000 })
  await waitFor(() => expect(names()).toEqual(["Anor Tekstil MChJ"]))
})

// noTypes deletes every customer type of Olma Savdo, as its owner may.
const noTypes = () => db.types.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))

test("with no customer types the owner is led to the settings, and no customer can be added", async () => {
  await signIn(ALI)
  noTypes()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Sozlama yetishmaydi")).toBeInTheDocument()
  expect(screen.getByText("Avval mijoz turlarini sozlang.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings")
  expect(screen.queryByRole("button", { name: "Mijoz qo'shish" })).not.toBeInTheDocument()
  // Nothing to filter or to search either.
  expect(screen.queryByRole("radiogroup", { name: "Mijoz turi" })).not.toBeInTheDocument()
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  expect(screen.queryByText("Hali mijoz yo'q")).not.toBeInTheDocument()
})

test("with no customer types an employee is told whose it is to set them up", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  noTypes()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Sozlama yetishmaydi")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi mijoz turlarini sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Sozlamalarni ochish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Mijoz qo'shish" })).not.toBeInTheDocument()
})

test("an employee whose role holds customers.view alone sees the list without a way to add", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  seedCustomers()
  setLocation("/customers")
  renderWithProviders(<CustomersPage />)

  expect(rowsOf(await list())).toHaveLength(3)
  expect(screen.queryByRole("button", { name: "Mijoz qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("with no customer type the way to the settings is for whoever may open them", async () => {
  giveRole(VALI, 1, "Sozlovchi", ["customers.view", "customers.create", "settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  db.types.forEach((type) => {
    type.deleted = true
  })
  setLocation("/customers")
  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Avval mijoz turlarini sozlang.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings")
})

test("an employee whose role holds no customers.view is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/customers")
  renderWithProviders(<CustomersPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { level: 1, name: "Mijozlar" })).not.toBeInTheDocument()
})

test("each row says what the customer owes, for whoever may see the sales; one who may not sees nothing of it", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod, malika } = seedCustomers()
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  // Dilshod bought 12 000 worth and paid 5 000; Malika paid 50 000 ahead.
  await enterSale({ location_id: asosiyOf(1).id, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })
  await call(api.POST("/app/customers/{id}/openings", { params: { path: { id: malika.id } }, body: { kind: "prepay", amount: "50000", at: "2026-10-01T09:00:00+05:00" } }))
  setLocation("/customers")
  const { unmount } = renderWithProviders(<CustomersPage />)

  const rows = rowsOf(await list())
  expect(rows.map((row) => rowParts(row).end)).toEqual(["Avans: 50 000 so'm", null, "Qarz: 7 000 so'm"])
  unmount()

  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<CustomersPage />)
  expect(rowsOf(await list()).map((row) => rowParts(row).end)).toEqual([null, null, null])
})

test("the way to the settings is the empty state's glossy capsule", async () => {
  await signIn(ALI)
  noTypes()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  const link = await screen.findByRole("link", { name: "Sozlamalarni ochish" })
  expect(link).toHaveClass("glossy", "rounded-full", "h-[46px]", "px-[22px]")
  expect(link).not.toHaveClass("bg-primary")
})
