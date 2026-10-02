import { screen, waitFor, within } from "@testing-library/react"
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

test("an unknown company is not found, with the way back to the list", async () => {
  renderWithProviders(<CompanyPage id={999} />)

  expect(await screen.findByRole("heading", { name: "Kompaniya topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kompaniyalar ro'yxatiga" })).toHaveAttribute("href", "/companies")
  expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument()
})

test("a user is added from the dialog and joins the list", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "User qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "User qo'shish" })
  await user.type(within(dialog).getByLabelText("Telefon"), "90 777 88 99")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Menejer")
  await user.selectOptions(within(dialog).getByLabelText("Rol"), "manager")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("User qo'shildi")).toBeInTheDocument()
  await waitFor(() =>
    expect(cellsOf(screen.getByRole("table", { name: "Userlar" }))).toContainEqual([
      "+998 90 777 88 99",
      "Yangi Menejer",
      "Menejer",
    ]),
  )
})

test("the add-user dialog says what is missing", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "User qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "User qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  expect(await within(dialog).findByText("Telefon raqami noto'g'ri")).toBeInTheDocument()
  expect(within(dialog).getByText("Ismni kiriting")).toBeInTheDocument()
})
