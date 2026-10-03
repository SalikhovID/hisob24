import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { EmployeesPage } from "./employees-page"

// rows are the members in the table (the page shows them as cards too, for
// phones): the row of each, without the header.
async function rows() {
  const table = await screen.findByRole("table", { name: "Xodimlar" })
  return within(table).getAllByRole("row").slice(1)
}

const phoneAndName = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .slice(0, 2)
    .map((cell) => cell.textContent)

test("the owner sees the company's members: themselves first, then the employees", async () => {
  await signIn(ALI)
  renderWithProviders(<EmployeesPage />)

  expect(await screen.findByRole("heading", { name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  const members = await rows()
  expect(members.map(phoneAndName)).toEqual([
    ["+998 90 123 45 67", "Ali Valiyev"],
    ["+998 90 222 33 44", "Vali Aliyev"],
    ["+998 90 333 44 55", "Sardor Karimov"],
  ])
  expect(within(members[0]).getByText("Egasi")).toBeInTheDocument()
  expect(within(members[0]).getByText("Siz")).toBeInTheDocument()
  expect(within(members[1]).getByText("Xodim")).toBeInTheDocument()
  expect(within(members[1]).queryByText("Siz")).not.toBeInTheDocument()
})
