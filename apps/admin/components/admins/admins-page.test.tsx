import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
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

test("each admin goes by their name, over the Telegram ID they sign in with", async () => {
  addAdmins()
  db.admins.push({ telegram_id: 44, full_name: null, is_active: true, created_at: "2026-10-01T07:00:00Z" })

  renderWithProviders(<AdminsPage />)

  const table = await screen.findByRole("table", { name: "Adminlar" })
  expect(rowsOf(table).map((row) => identityOf(within(row).getByRole("rowheader")))).toEqual([
    ["Owner", "Telegram ID 461603558"],
    ["Ikkinchi", "Telegram ID 42"],
    ["Eski", "Telegram ID 43"],
    // With no name the ID is what the admin goes by, said once.
    ["Telegram ID 44", null],
  ])
  // "Siz" stands by your own name, apart from it: the name stays the name.
  const [you, another] = rowsOf(table).map((row) => within(row).getByRole("rowheader"))
  expect(within(you).getByText("Siz")).toBeInTheDocument()
  expect(within(another).queryByText("Siz")).not.toBeInTheDocument()
  // The ID has no column of its own any more.
  const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent)
  expect(headers).not.toContain("Telegram ID")
  expect(headers[0]).toBe("Ism")
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

test("an admin is turned off after asking; you cannot turn yourself off", async () => {
  addAdmins()
  const { user } = renderWithProviders(<AdminsPage />)

  const [owner, second, old] = rowsOf(await screen.findByRole("table", { name: "Adminlar" }))
  expect(within(owner).queryByRole("button", { name: /O'chirish/ })).not.toBeInTheDocument()
  expect(within(old).queryByRole("button", { name: /O'chirish/ })).not.toBeInTheDocument()
  await user.click(within(second).getByRole("button", { name: "O'chirish: Ikkinchi" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Adminni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Admin o'chirildi")).toBeInTheDocument()
  await waitFor(() =>
    expect(within(rowsOf(screen.getByRole("table", { name: "Adminlar" }))[1]).getByText("Nofaol")).toBeInTheDocument(),
  )
})

test("when the API refuses to turn an admin off, it says why", async () => {
  server.use(
    http.delete("*/api/admin/admins/:telegramId", () =>
      HttpResponse.json({ error: "last_admin", message: "Kamida bitta faol admin qolishi kerak" }, { status: 409 }),
    ),
  )
  addAdmins()
  const { user } = renderWithProviders(<AdminsPage />)

  const [, second] = rowsOf(await screen.findByRole("table", { name: "Adminlar" }))
  await user.click(within(second).getByRole("button", { name: "O'chirish: Ikkinchi" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Adminni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Kamida bitta faol admin qolishi kerak")).toBeInTheDocument()
})
