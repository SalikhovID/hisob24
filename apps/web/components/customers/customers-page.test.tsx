import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, seedCustomers, VALI } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { setLocation } from "@/test/navigation"
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
