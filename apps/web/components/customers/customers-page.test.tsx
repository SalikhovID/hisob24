import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, seedCustomers, typesOf, VALI } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { currentUrl, setLocation } from "@/test/navigation"
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
