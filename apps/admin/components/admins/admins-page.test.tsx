import { act, screen, waitFor, within } from "@testing-library/react"
import { delay, http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { AdminsPage } from "./admins-page"

// hang never answers: what was sent stays on its way.
const hang = async () => {
  await delay("infinite")
  return new HttpResponse(null)
}

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

test("the list says when each admin was added", async () => {
  addAdmins()

  renderWithProviders(<AdminsPage />)

  const table = await screen.findByRole("table", { name: "Adminlar" })
  expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toContain("Qo'shilgan")
  rowsOf(table).forEach((admin) => expect(within(admin).getByText("01.10.2026")).toBeInTheDocument())
})

test("the page says how many admins the platform has", async () => {
  addAdmins()

  renderWithProviders(<AdminsPage />)

  // The line is there from the start; the count joins it with the list.
  expect(screen.getByText("Platforma adminlari")).toBeInTheDocument()
  expect(await screen.findByText("Platforma adminlari · 3 kishi")).toBeInTheDocument()
})

test("the list ends with its total", async () => {
  addAdmins()

  renderWithProviders(<AdminsPage />)

  expect(rowsOf(await screen.findByRole("table", { name: "Adminlar" }))).toHaveLength(3)
  expect(screen.getByText("Jami: 3")).toBeInTheDocument()
})

test("on a phone an admin is a card: how they stand and when they were added in one line, the action at its top", async () => {
  addAdmins()
  renderWithProviders(<AdminsPage />)
  await screen.findByRole("table", { name: "Adminlar" })

  const [owner, second] = within(screen.getByRole("list", { name: "Adminlar" })).getAllByRole("listitem")

  expect(identityOf(second)).toEqual(["Ikkinchi", "Telegram ID 42"])
  const line = Array.from(second.querySelectorAll('[data-slot="data-list-meta"] > div')).map((pair) => [
    pair.querySelector("dt")?.textContent,
    pair.querySelector("dd")?.textContent,
  ])
  expect(line).toEqual([
    ["Holat", "Faol"],
    ["Qo'shilgan", "01.10.2026"],
  ])
  // The badge needs no name on screen; the date keeps its own.
  expect(within(second).getByText("Holat")).toHaveClass("sr-only")
  expect(within(second).getByText("Qo'shilgan")).not.toHaveClass("sr-only")
  expect(within(second).queryByText("Amallar")).not.toBeInTheDocument()
  const actions = second.querySelector<HTMLElement>('[data-slot="data-list-actions"]')!
  expect(within(actions).getByRole("button", { name: "O'chirish: Ikkinchi" })).toBeInTheDocument()
  // You cannot turn yourself off: no place is kept for actions.
  expect(owner.querySelector('[data-slot="data-list-actions"]')).not.toBeInTheDocument()
})

test("an admin's action says what it does when the keyboard reaches it", async () => {
  addAdmins()
  renderWithProviders(<AdminsPage />)
  const [, second] = rowsOf(await screen.findByRole("table", { name: "Adminlar" }))

  act(() => within(second).getByRole("button", { name: "O'chirish: Ikkinchi" }).focus())

  expect(await screen.findByText("O'chirish")).toBeInTheDocument()
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

test("while a new admin is on its way the dialog's button says so", async () => {
  server.use(http.post("*/api/admin/admins", hang))
  const { user } = renderWithProviders(<AdminsPage />)

  await user.click(screen.getByRole("button", { name: "Admin qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Admin qo'shish" })
  await user.type(within(dialog).getByLabelText("Telegram ID"), "1000000001")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Admin")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  const add = within(dialog).getByRole("button", { name: "Qo'shish" })
  await waitFor(() => expect(add).toBeDisabled())
  expect(add).toHaveAttribute("aria-busy", "true")
})
