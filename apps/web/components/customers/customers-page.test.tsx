import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCustomers } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
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
