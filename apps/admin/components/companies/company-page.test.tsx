import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { db, OWNER_ID } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { renderWithProviders } from "@/test/render"
import { CompanyPage } from "./company-page"

// cellsOf reads a table row by row: the row's header first, then its cells.
function cellsOf(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [within(row).getByRole("rowheader"), ...within(row).getAllByRole("cell")].map((cell) => cell.textContent),
    )
}

// usersOf reads the users table row by row: who it is (the name over the
// phone), then the role and the joining day.
function usersOf(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [
      ...identityOf(within(row).getByRole("rowheader")),
      ...within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ])
}

test("the company page shows the company and its users", async () => {
  renderWithProviders(<CompanyPage id={1} />)

  expect(await screen.findByRole("heading", { name: "Olma Savdo" })).toBeInTheDocument()
  const info = screen.getByRole("region", { name: "Ma'lumot" })
  expect(within(info).getByText("01.11.2026")).toBeInTheDocument()
  expect(within(info).getByText("30 kun qoldi")).toBeInTheDocument()
  expect(within(info).getByText("11.09.2026")).toBeInTheDocument()
  const users = screen.getByRole("table", { name: "Userlar" })
  expect(within(users).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
    "A'zo",
    "Rol",
    "Qo'shilgan",
  ])
  expect(usersOf(users)).toEqual([
    ["Ali Valiyev", "+998 90 123 45 67", "Egasi", "20.09.2026"],
    ["Vali Aliyev", "+998 90 222 33 44", "Xodim", "20.09.2026"],
  ])
})

test("an unknown company is not found, with the way back to the list", async () => {
  renderWithProviders(<CompanyPage id={999} />)

  expect(await screen.findByRole("heading", { name: "Kompaniya topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kompaniyalar ro'yxatiga" })).toHaveAttribute("href", "/companies")
  expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument()
})

test("the owner is replaced from the dialog: the new one leads the list, the one before stays as a Xodim", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Egasini almashtirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Egasini almashtirish" })
  expect(within(dialog).getByText(/Oldingi egasi xodim bo'lib qoladi/)).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Telefon"), "90 777 88 99")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Egasi")
  await user.click(within(dialog).getByRole("button", { name: "Almashtirish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Kompaniya egasi almashtirildi")).toBeInTheDocument()
  await waitFor(() =>
    expect(usersOf(screen.getByRole("table", { name: "Userlar" }))).toEqual([
      ["Yangi Egasi", "+998 90 777 88 99", "Egasi", "20.09.2026"],
      ["Ali Valiyev", "+998 90 123 45 67", "Xodim", "20.09.2026"],
      ["Vali Aliyev", "+998 90 222 33 44", "Xodim", "20.09.2026"],
    ]),
  )
})

test("an employee made the owner is promoted under the name given, not listed twice", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Egasini almashtirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Egasini almashtirish" })
  await user.type(within(dialog).getByLabelText("Telefon"), "+998 90 222 33 44")
  await user.type(within(dialog).getByLabelText("Ism"), "Vali Egasi")
  await user.click(within(dialog).getByRole("button", { name: "Almashtirish" }))

  await waitFor(() =>
    expect(usersOf(screen.getByRole("table", { name: "Userlar" }))).toEqual([
      ["Vali Egasi", "+998 90 222 33 44", "Egasi", "20.09.2026"],
      ["Ali Valiyev", "+998 90 123 45 67", "Xodim", "20.09.2026"],
    ]),
  )
})

test("the replace-owner dialog says what is missing", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Egasini almashtirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Egasini almashtirish" })
  await user.click(within(dialog).getByRole("button", { name: "Almashtirish" }))

  expect(await within(dialog).findByText("Telefon raqami noto'g'ri")).toBeInTheDocument()
  expect(within(dialog).getByText("Ismni kiriting")).toBeInTheDocument()
})

test("the billing history lists the payments, newest first", async () => {
  db.billings[1] = [
    {
      id: 11,
      company_id: 1,
      days: 7,
      amount: null,
      prev_end_date: "2026-11-01",
      new_end_date: "2026-11-08",
      note: null,
      created_by: OWNER_ID,
      created_at: "2026-10-02T06:00:00Z",
    },
    {
      id: 10,
      company_id: 1,
      days: 30,
      amount: "150000.50",
      prev_end_date: "2026-10-02",
      new_end_date: "2026-11-01",
      note: "Naqd",
      created_by: OWNER_ID,
      created_at: "2026-09-02T06:00:00Z",
    },
  ]

  renderWithProviders(<CompanyPage id={1} />)

  expect(cellsOf(await screen.findByRole("table", { name: "Billing tarixi" }))).toEqual([
    ["02.10.2026", "+7 kun", "—", "01.11.2026 → 08.11.2026", "—"],
    ["02.09.2026", "+30 kun", "150\u00a0000,50", "02.10.2026 → 01.11.2026", "Naqd"],
  ])
})

test("a company without payments says so", async () => {
  renderWithProviders(<CompanyPage id={2} />)

  expect(await screen.findByText("Hali to'lovlar yo'q")).toBeInTheDocument()
})

test.each([
  { name: "a running company", id: 1, days: "30", preview: "01.12.2026" },
  { name: "an expired company counts from today", id: 3, days: "10", preview: "12.10.2026" },
])("the billing dialog previews the new end date: $name", async ({ id, days, preview }) => {
  const { user } = renderWithProviders(<CompanyPage id={id} />)

  await user.click(await screen.findByRole("button", { name: "Billing qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Billing qo'shish" })
  await user.type(within(dialog).getByLabelText("Kunlar soni"), days)

  expect(within(dialog).getByText(/Yangi tugash sanasi/)).toHaveTextContent(`Yangi tugash sanasi: ${preview}`)
})

test("a payment from the dialog moves the end date and joins the history", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Billing qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Billing qo'shish" })
  await user.type(within(dialog).getByLabelText("Kunlar soni"), "30")
  await user.type(within(dialog).getByLabelText("Summa"), "150000.50")
  await user.type(within(dialog).getByLabelText("Izoh"), "Naqd")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("To'lov qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Ma'lumot" })).getByText("01.12.2026")).toBeInTheDocument())
  const [newest] = cellsOf(await screen.findByRole("table", { name: "Billing tarixi" }))
  expect(newest.slice(1)).toEqual(["+30 kun", "150 000,50", "01.11.2026 → 01.12.2026", "Naqd"])
})

test("the billing dialog refuses a bad day count or amount", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Billing qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Billing qo'shish" })
  await user.type(within(dialog).getByLabelText("Summa"), "1.234")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  expect(await within(dialog).findByText("Kunlar soni 1 dan 3650 gacha bo'lishi kerak")).toBeInTheDocument()
  expect(within(dialog).getByText("Summa noto'g'ri: masalan 150000 yoki 150000.50")).toBeInTheDocument()
})

test("blocking a company asks first and marks it blocked; activating takes it back", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Bloklash" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Kompaniyani bloklaysizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "Bloklash" }))

  const info = screen.getByRole("region", { name: "Ma'lumot" })
  expect(await within(info).findByText("Bloklangan")).toBeInTheDocument()
  expect(await screen.findByText("Kompaniya bloklandi")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Faollashtirish" }))
  expect(await within(info).findByText("30 kun qoldi")).toBeInTheDocument()
})

test("the company is renamed from a dialog", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Nomini o'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Nomini o'zgartirish" })
  const name = within(dialog).getByLabelText("Kompaniya nomi")
  expect(name).toHaveValue("Olma Savdo")
  await user.clear(name)
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("Kompaniya nomini kiriting")).toBeInTheDocument()

  await user.type(name, "Olma Savdo MChJ")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await screen.findByRole("heading", { name: "Olma Savdo MChJ" })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})
