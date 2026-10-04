import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, nextId, seedCustomers, typesOf, VALI } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { currentUrl, router, setLocation, slowNavigation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { CustomersPage } from "./customers-page"

// rowsOf are the customers in the table (the page shows them as cards too,
// for phones): the row of each, without the header.
const rowsOf = (table: HTMLElement) => within(table).getAllByRole("row").slice(1)
const table = () => screen.findByRole("table", { name: "Mijozlar" })
// A customer is one identity, heading its row: the name over the phone.
const nameAndPhone = (row: HTMLElement) => identityOf(within(row).getByRole("rowheader"))
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent)

test("the customers page lists the company's customers, the newest first, with their answers", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mijozlar" })).toBeInTheDocument()
  const list = await table()
  // The answers of every type, a column for each field name; the field a
  // customer goes by is no column of its own.
  expect(within(list).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
    "Mijoz",
    "Turi",
    "Manba",
    "INN",
    "Qo'shgan",
    "Qo'shilgan",
  ])
  const rows = rowsOf(list)
  expect(rows.map(nameAndPhone)).toEqual([
    ["Malika Yusupova", "+998 95 555 66 77"],
    ["Anor Tekstil MChJ", "+998 93 333 44 55"],
    ["Dilshod Karimov", "+998 91 111 22 33"],
  ])
  expect(rows.map(cellsOf)).toEqual([
    ["Jismoniy", "YouTube", "—", "Sardor Karimov", "02.10.2026"],
    ["Yuridik", "—", "301234567", "Ali Valiyev", "02.10.2026"],
    ["Jismoniy", "Instagram", "—", "Vali Aliyev", "02.10.2026"],
  ])
  // The name is the way into the customer, and the only link of its row.
  expect(within(rows[2]).getAllByRole("link")).toHaveLength(1)
  expect(within(rows[2]).getByRole("link", { name: "Dilshod Karimov" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
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
  expect(screen.queryByRole("table")).not.toBeInTheDocument()

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(rowsOf(await table())).toHaveLength(3)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("a company with no customers says so, and what to do about it", async () => {
  await signIn(ALI)
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Hali mijoz yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing.")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mijozlari · 0 ta")).toBeInTheDocument()
})

test("a customer with no name goes by the phone, which is then not said twice", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  dilshod.values = {}
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  const rows = rowsOf(await table())
  expect(nameAndPhone(rows[2])).toEqual(["+998 91 111 22 33", null])
  expect(within(rows[2]).getByRole("link", { name: "+998 91 111 22 33" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
})

test("an employee sees the company's customers too", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(rowsOf(await table()).map(nameAndPhone)).toHaveLength(3)
})

// names are the customers the table shows, in order.
const names = () => rowsOf(screen.getByRole("table", { name: "Mijozlar" })).map((row) => nameAndPhone(row)[0])
const headers = () =>
  within(screen.getByRole("table", { name: "Mijozlar" }))
    .getAllByRole("columnheader")
    .map((header) => header.textContent)

test("a tab keeps the customers of one type, under that type's own fields, and stays in the address", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy, yuridik] = typesOf(1)
  setLocation("/customers")
  const { user } = renderWithProviders(<CustomersPage />)
  await table()

  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Barchasi", "Jismoniy", "Yuridik"])
  expect(screen.getByRole("tab", { name: "Barchasi" })).toHaveAttribute("aria-selected", "true")

  await user.click(screen.getByRole("tab", { name: "Yuridik" }))
  await waitFor(() => expect(names()).toEqual(["Anor Tekstil MChJ"]))
  expect(currentUrl()).toBe(`/customers?type=${yuridik.id}`)
  // Every customer here is a Yuridik: the type is not said in each row, and
  // the other types' fields are not asked about.
  expect(headers()).toEqual(["Mijoz", "INN", "Qo'shgan", "Qo'shilgan"])
  // One matches the tab; the company still has three. The count is not shown as the company's.
  expect(screen.getByText("Kompaniyangiz mijozlari")).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Jismoniy" }))
  await waitFor(() => expect(names()).toEqual(["Malika Yusupova", "Dilshod Karimov"]))
  expect(currentUrl()).toBe(`/customers?type=${jismoniy.id}`)
  expect(headers()).toEqual(["Mijoz", "Manba", "Qo'shgan", "Qo'shilgan"])

  await user.click(screen.getByRole("tab", { name: "Barchasi" }))
  await waitFor(() => expect(names()).toHaveLength(3))
  expect(currentUrl()).toBe("/customers")
  expect(await screen.findByText("Kompaniyangiz mijozlari · 3 ta")).toBeInTheDocument()
})

test("the list opens under the tab the address names", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy] = typesOf(1)
  setLocation(`/customers?type=${jismoniy.id}`)

  renderWithProviders(<CustomersPage />)

  await table()
  expect(names()).toEqual(["Malika Yusupova", "Dilshod Karimov"])
  expect(screen.getByRole("tab", { name: "Jismoniy" })).toHaveAttribute("aria-selected", "true")
})

test("a tab with no customers says that none were found, not that the company has none", async () => {
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

  await table()
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

  expect(rowsOf(await table())).toHaveLength(20)
  expect(screen.getByText("1–20 / 24")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))

  await waitFor(() => expect(rowsOf(screen.getByRole("table", { name: "Mijozlar" }))).toHaveLength(4))
  expect(currentUrl()).toBe("/customers?page=2")
  expect(screen.getByText("21–24 / 24")).toBeInTheDocument()
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
  await table()
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
  await table()
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

test("a tab chosen while the cleared search is still on its way keeps both changes", async () => {
  await signIn(ALI)
  seedCustomers()
  const [, yuridik] = typesOf(1)
  setLocation("/customers?search=a")
  // The address takes a while to change, as on a slow connection.
  slowNavigation(400)
  const { user } = renderWithProviders(<CustomersPage />)
  await table()

  // The box waits 300 ms before it reports; the tab is chosen meanwhile.
  await user.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await user.click(screen.getByRole("tab", { name: "Yuridik" }))

  await waitFor(() => expect(currentUrl()).toBe(`/customers?type=${yuridik.id}`), { timeout: 3000 })
  await waitFor(() => expect(names()).toEqual(["Anor Tekstil MChJ"]))
})

// ticks are the Ustunlar menu's columns as [name, shown or not].
const ticks = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitemcheckbox")
    .map((item) => [item.textContent, item.getAttribute("aria-checked") === "true"])

test("the Ustunlar menu hides and shows the columns; the choice is kept for the next visit", async () => {
  await signIn(ALI)
  seedCustomers()
  setLocation("/customers")
  const { user, unmount } = renderWithProviders(<CustomersPage />)
  await table()

  await user.click(screen.getByRole("button", { name: "Ustunlar" }))
  const menu = await screen.findByRole("menu")
  // Every column but the customer itself, which is never hidden.
  expect(ticks(menu)).toEqual([
    ["Turi", true],
    ["Manba", true],
    ["INN", true],
    ["Qo'shgan", true],
    ["Qo'shilgan", true],
  ])

  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "INN" }))
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Qo'shgan" }))

  expect(headers()).toEqual(["Mijoz", "Turi", "Manba", "Qo'shilgan"])
  // The menu stays open, so several can be changed in one go.
  expect(ticks(menu)).toEqual([
    ["Turi", true],
    ["Manba", true],
    ["INN", false],
    ["Qo'shgan", false],
    ["Qo'shilgan", true],
  ])
  // A phone's card leaves the column out as well.
  const [card] = within(screen.getByRole("list", { name: "Mijozlar" })).getAllByRole("listitem")
  expect(within(card).queryByText("Sardor Karimov")).not.toBeInTheDocument()

  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "INN" }))
  expect(headers()).toEqual(["Mijoz", "Turi", "Manba", "INN", "Qo'shilgan"])

  unmount()
  renderWithProviders(<CustomersPage />)
  await table()
  expect(headers()).toEqual(["Mijoz", "Turi", "Manba", "INN", "Qo'shilgan"])
})

test("under a tab the menu offers that type's columns; a column hidden there is hidden everywhere", async () => {
  await signIn(ALI)
  seedCustomers()
  const [jismoniy] = typesOf(1)
  setLocation(`/customers?type=${jismoniy.id}`)
  const { user } = renderWithProviders(<CustomersPage />)
  await table()

  await user.click(screen.getByRole("button", { name: "Ustunlar" }))
  const menu = await screen.findByRole("menu")
  expect(ticks(menu).map(([name]) => name)).toEqual(["Manba", "Qo'shgan", "Qo'shilgan"])
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Manba" }))
  expect(headers()).toEqual(["Mijoz", "Qo'shgan", "Qo'shilgan"])
  await user.keyboard("{Escape}")

  await user.click(screen.getByRole("tab", { name: "Barchasi" }))
  await waitFor(() => expect(names()).toHaveLength(3))
  expect(headers()).toEqual(["Mijoz", "Turi", "INN", "Qo'shgan", "Qo'shilgan"])
})

test("the columns one user hides stay shown for another", async () => {
  localStorage.setItem(`customers_hidden_columns:1:${ALI}`, JSON.stringify(["type", "created_by"]))
  await signIn(VALI)
  await chooseCompany(1)
  seedCustomers()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  await table()
  expect(headers()).toEqual(["Mijoz", "Turi", "Manba", "INN", "Qo'shgan", "Qo'shilgan"])
})

// noTypes deletes every customer type of Olma Savdo, as its owner may.
const noTypes = () => db.types.filter((type) => type.companyId === 1).forEach((type) => (type.deleted = true))

test("with no customer types the owner is led to the settings, and no customer can be added", async () => {
  await signIn(ALI)
  noTypes()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Mijoz turlari yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shish uchun avval Sozlamalarda tur yarating.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalarni ochish" })).toHaveAttribute("href", "/settings")
  expect(screen.queryByRole("button", { name: "Mijoz qo'shish" })).not.toBeInTheDocument()
  // Nothing to filter or to search either.
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  expect(screen.queryByText("Hali mijoz yo'q")).not.toBeInTheDocument()
})

test("with no customer types an employee is told whose it is to set them up", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  noTypes()
  setLocation("/customers")

  renderWithProviders(<CustomersPage />)

  expect(await screen.findByText("Mijoz turlari yo'q")).toBeInTheDocument()
  expect(screen.getByText("Kompaniya egasi mijoz turlarini sozlashi kerak.")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Sozlamalarni ochish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Mijoz qo'shish" })).not.toBeInTheDocument()
})
