import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { company, db, TODAY } from "@/mocks/data"
import { currentUrl, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { CompaniesPage } from "./companies-page"

function rowsOf(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1)
}

// names are the companies the table shows, in order.
function names() {
  return rowsOf(screen.getByRole("table", { name: "Kompaniyalar" })).map(
    (row) => within(row).getAllByRole("cell")[0].textContent,
  )
}

test("the companies page lists the companies, newest first, with how they stand", async () => {
  setLocation("/companies")

  renderWithProviders(<CompaniesPage />)

  expect(screen.getByRole("heading", { name: "Kompaniyalar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Yangi kompaniya" })).toHaveAttribute("href", "/companies/new")
  const rows = rowsOf(await screen.findByRole("table", { name: "Kompaniyalar" }))
  expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
    "Olcha Servis",
    "Nok Market",
    "Olma Savdo",
  ])
  expect(rows[2]).toHaveTextContent("01.11.2026")
  expect(within(rows[2]).getByText("30 kun qoldi")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Muddati o'tgan")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("link", { name: "Olcha Servis" })).toHaveAttribute("href", "/companies/3")
})

test("searching narrows the list, starts from the first page and stays in the address", async () => {
  setLocation("/companies?page=2")
  const { user } = renderWithProviders(<CompaniesPage />)

  await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "olma")

  await waitFor(() => expect(currentUrl()).toBe("/companies?search=olma"))
  await waitFor(() =>
    expect(rowsOf(screen.getByRole("table", { name: "Kompaniyalar" })).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Olma Savdo"),
    ]),
  )
})

test("the status tabs show the active or the expired companies", async () => {
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)
  await screen.findByRole("table", { name: "Kompaniyalar" })

  await user.click(screen.getByRole("tab", { name: "Muddati o'tgan" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies?status=expired"))
  await waitFor(() => expect(names()).toEqual(["Olcha Servis"]))

  await user.click(screen.getByRole("tab", { name: "Faol" }))
  await waitFor(() => expect(names()).toEqual(["Nok Market", "Olma Savdo"]))
  expect(screen.getByRole("tab", { name: "Faol" })).toHaveAttribute("aria-selected", "true")
})

test("the list goes page by page, twenty at a time", async () => {
  for (let i = 1; i <= 42; i++) db.companies.push(company(100 + i, `Kompaniya ${i}`, TODAY))
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("1–20 / 45")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies?page=2"))
  expect(await screen.findByText("21–40 / 45")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))
  expect(await screen.findByText("41–45 / 45")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
})
