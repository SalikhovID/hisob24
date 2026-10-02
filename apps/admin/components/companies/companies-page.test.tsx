import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { currentUrl, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { CompaniesPage } from "./companies-page"

function rowsOf(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1)
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
