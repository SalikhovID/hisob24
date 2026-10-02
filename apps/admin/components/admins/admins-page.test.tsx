import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { AdminsPage } from "./admins-page"

function rowsOf(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1)
}

function addAdmins() {
  db.admins.push(
    { telegram_id: 42, full_name: "Ikkinchi", is_active: true, created_at: "2026-10-01T05:00:00Z" },
    { telegram_id: 43, full_name: "Eski", is_active: false, created_at: "2026-10-01T06:00:00Z" },
  )
}

test("the admins page lists the admins, how they stand, and which one you are", async () => {
  addAdmins()

  renderWithProviders(<AdminsPage />)

  expect(screen.getByRole("heading", { name: "Adminlar" })).toBeInTheDocument()
  const [owner, second, old] = rowsOf(await screen.findByRole("table", { name: "Adminlar" }))
  expect(owner).toHaveTextContent("Owner")
  expect(owner).toHaveTextContent("461603558")
  expect(within(owner).getByText("Siz")).toBeInTheDocument()
  expect(within(second).getByText("Faol")).toBeInTheDocument()
  expect(within(second).queryByText("Siz")).not.toBeInTheDocument()
  expect(within(old).getByText("Nofaol")).toBeInTheDocument()
})
