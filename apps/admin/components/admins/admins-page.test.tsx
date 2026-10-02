import { screen, waitFor, within } from "@testing-library/react"
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

test("an admin is added from the dialog and joins the list", async () => {
  const { user } = renderWithProviders(<AdminsPage />)

  await user.click(screen.getByRole("button", { name: "Admin qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Admin qo'shish" })
  await user.type(within(dialog).getByLabelText("Telegram ID"), "1000000001")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Admin")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Admin qo'shildi")).toBeInTheDocument()
  const table = screen.getByRole("table", { name: "Adminlar" })
  expect(await within(table).findByText("Yangi Admin")).toBeInTheDocument()
})

test("the add-admin dialog says what is missing, and why the API refused", async () => {
  const { user } = renderWithProviders(<AdminsPage />)

  await user.click(screen.getByRole("button", { name: "Admin qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Admin qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Telegram ID musbat butun son bo'lishi kerak")).toBeInTheDocument()
  expect(within(dialog).getByText("Adminning ismini kiriting")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Telegram ID"), "461603558")
  await user.type(within(dialog).getByLabelText("Ism"), "Owner")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu admin allaqachon faol")).toBeInTheDocument()
})
