import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { CompanyPage } from "./company-page"

function cellsOf(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))
}

test("the company page shows the company and its users", async () => {
  renderWithProviders(<CompanyPage id={1} />)

  expect(await screen.findByRole("heading", { name: "Olma Savdo" })).toBeInTheDocument()
  const info = screen.getByRole("region", { name: "Ma'lumot" })
  expect(within(info).getByText("01.11.2026")).toBeInTheDocument()
  expect(within(info).getByText("30 kun qoldi")).toBeInTheDocument()
  expect(within(info).getByText("11.09.2026")).toBeInTheDocument()
  expect(cellsOf(screen.getByRole("table", { name: "Userlar" }))).toEqual([
    ["+998 90 123 45 67", "Ali Valiyev", "Egasi"],
    ["+998 90 222 33 44", "Vali Aliyev", "Xodim"],
  ])
})
