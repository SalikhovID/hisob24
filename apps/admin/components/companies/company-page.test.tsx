import { screen, waitFor, within } from "@testing-library/react"
import { delay, http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { db, OWNER_ID } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { CompanyPage } from "./company-page"

// hang never answers: what was sent stays on its way.
const hang = async () => {
  await delay("infinite")
  return new HttpResponse(null)
}

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

test("a user with no name goes by the phone, said once, with an icon for an avatar", async () => {
  db.members[1].push({ phone: "998905556677", full_name: null, role: "user", role_id: null, role_name: null, created_at: "2026-09-21T05:00:00Z" })

  renderWithProviders(<CompanyPage id={1} />)

  const users = await screen.findByRole("table", { name: "Userlar" })
  expect(usersOf(users)[2]).toEqual(["+998 90 555 66 77", null, "Xodim", "21.09.2026"])
  // No name, no initials: digits of the phone are not letters of a name.
  const nameless = within(users).getAllByRole("row")[3]
  expect(nameless.querySelector('[data-slot="avatar"]')).toHaveTextContent("")
})

test("on a phone a user is a card: the role, then the joining day under its name", async () => {
  renderWithProviders(<CompanyPage id={1} />)

  const [owner] = within(await screen.findByRole("list", { name: "Userlar" })).getAllByRole("listitem")

  expect(identityOf(owner)).toEqual(["Ali Valiyev", "+998 90 123 45 67"])
  const line = Array.from(owner.querySelectorAll('[data-slot="data-list-meta"] > div')).map((pair) => [
    pair.querySelector("dt")?.textContent,
    pair.querySelector("dd")?.textContent,
  ])
  expect(line).toEqual([
    ["Rol", "Egasi"],
    ["Qo'shilgan", "20.09.2026"],
  ])
  expect(within(owner).getByText("Rol")).toHaveClass("sr-only")
  expect(within(owner).getByText("Qo'shilgan")).not.toHaveClass("sr-only")
  // Nothing more: no labeled rows, no actions.
  expect(Array.from(owner.children).map((part) => part.getAttribute("data-slot"))).toEqual([
    "data-list-title",
    "data-list-meta",
  ])
})

test("the users list ends with its total", async () => {
  renderWithProviders(<CompanyPage id={1} />)

  const users = await screen.findByRole("region", { name: "Userlar" })

  expect(within(users).getByText("Jami: 2")).toBeInTheDocument()
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

test("on a phone a payment is a card: the day and the amount, then the days and the period, the note last", async () => {
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
  // A card's part is a list of names and values.
  const pairs = (card: HTMLElement, slot: string) =>
    Array.from(card.querySelectorAll(`[data-slot="${slot}"] > div`)).map((pair) => [
      pair.querySelector("dt")?.textContent,
      pair.querySelector("dd")?.textContent,
    ])
  const cardOf = (card: HTMLElement) => ({
    title: card.querySelector('[data-slot="data-list-title"]')?.textContent,
    aside: pairs(card, "data-list-aside"),
    line: pairs(card, "data-list-meta"),
    note: pairs(card, "data-list-note"),
  })

  renderWithProviders(<CompanyPage id={1} />)

  const [bare, full] = within(await screen.findByRole("list", { name: "Billing tarixi" })).getAllByRole("listitem")
  expect(cardOf(full)).toEqual({
    title: "02.09.2026",
    aside: [["Summa", "150\u00a0000,50"]],
    line: [
      ["Kunlar", "+30 kun"],
      ["Davr", "02.10.2026 → 01.11.2026"],
    ],
    note: [["Izoh", "Naqd"]],
  })
  // A payment with no amount and no note keeps no place for them: no dash on a card.
  expect(cardOf(bare)).toEqual({
    title: "02.10.2026",
    aside: [],
    line: [
      ["Kunlar", "+7 kun"],
      ["Davr", "01.11.2026 → 08.11.2026"],
    ],
    note: [],
  })
  expect(within(bare).queryByText("—")).not.toBeInTheDocument()
})

test("the billing history ends with its total", async () => {
  db.billings[1] = [
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

  await screen.findByRole("table", { name: "Billing tarixi" })
  expect(within(screen.getByRole("region", { name: "Billing tarixi" })).getByText("Jami: 1")).toBeInTheDocument()
})

test("a company without payments says so", async () => {
  renderWithProviders(<CompanyPage id={2} />)

  expect(await screen.findByText("Hali to'lovlar yo'q")).toBeInTheDocument()
})

test("a company without payments says how to add the first", async () => {
  renderWithProviders(<CompanyPage id={2} />)

  expect(await screen.findByText("Hali to'lovlar yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi to'lovni «Billing qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
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

test("the billing dialog's preview is announced whole: the date with its name, not the bare date", async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Billing qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Billing qo'shish" })

  const preview = within(dialog).getByText(/Yangi tugash sanasi/)
  expect(preview).toHaveAttribute("aria-live", "polite")
  // Only the date changes as the days are typed; without this a screen
  // reader would read out the changed part alone.
  expect(preview).toHaveAttribute("aria-atomic", "true")
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

test("while a new name is on its way the dialog's button says so", async () => {
  server.use(http.patch("*/api/admin/companies/:id", hang))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Nomini o'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Nomini o'zgartirish" })
  await user.type(within(dialog).getByLabelText("Kompaniya nomi"), " MChJ")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  const save = within(dialog).getByRole("button", { name: "Saqlash" })
  await waitFor(() => expect(save).toHaveAttribute("aria-disabled", "true"))
  expect(save).toHaveAttribute("aria-busy", "true")
})

test("while the block is on its way the confirmation's button says so", async () => {
  server.use(http.patch("*/api/admin/companies/:id", hang))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Bloklash" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Kompaniyani bloklaysizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "Bloklash" }))

  const block = within(confirm).getByRole("button", { name: "Bloklash" })
  await waitFor(() => expect(block).toHaveAttribute("aria-disabled", "true"))
  expect(block).toHaveAttribute("aria-busy", "true")
})

test("while the activation is on its way its button says so", async () => {
  db.companies[0].is_active = false
  server.use(http.patch("*/api/admin/companies/:id", hang))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Faollashtirish" }))

  const activate = screen.getByRole("button", { name: "Faollashtirish" })
  await waitFor(() => expect(activate).toHaveAttribute("aria-disabled", "true"))
  expect(activate).toHaveAttribute("aria-busy", "true")
})

test("while the new owner is on its way the dialog's button says so", async () => {
  server.use(http.put("*/api/admin/companies/:id/owner", hang))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Egasini almashtirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Egasini almashtirish" })
  await user.type(within(dialog).getByLabelText("Telefon"), "90 777 88 99")
  await user.type(within(dialog).getByLabelText("Ism"), "Yangi Egasi")
  await user.click(within(dialog).getByRole("button", { name: "Almashtirish" }))

  const replace = within(dialog).getByRole("button", { name: "Almashtirish" })
  await waitFor(() => expect(replace).toHaveAttribute("aria-disabled", "true"))
  expect(replace).toHaveAttribute("aria-busy", "true")
})

test("while a payment is on its way the dialog's button says so", async () => {
  server.use(http.post("*/api/admin/companies/:id/billings", hang))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Billing qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Billing qo'shish" })
  await user.type(within(dialog).getByLabelText("Kunlar soni"), "30")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  const add = within(dialog).getByRole("button", { name: "Qo'shish" })
  await waitFor(() => expect(add).toHaveAttribute("aria-disabled", "true"))
  expect(add).toHaveAttribute("aria-busy", "true")
})

// refuse answers with a failure in the API's shape. Each test gives its own
// words: toasts outlive a test (sonner keeps them outside React), so a
// message shared by two tests would be found in the second whatever it did.
const refuse = (message: string) => () => HttpResponse.json({ error: "internal_error", message }, { status: 500 })

test("when the block fails the page says why, and the company is not shown as blocked", async () => {
  server.use(http.patch("*/api/admin/companies/:id", refuse("Bloklab bo'lmadi: ichki xatolik")))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Bloklash" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Kompaniyani bloklaysizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "Bloklash" }))

  expect(await screen.findByText("Bloklab bo'lmadi: ichki xatolik")).toBeInTheDocument()
  // The question is over; the company stands as it stood.
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(within(screen.getByRole("region", { name: "Ma'lumot" })).getByText("30 kun qoldi")).toBeInTheDocument()
})

test("when the activation fails the page says why, and the company stays blocked", async () => {
  db.companies[0].is_active = false
  server.use(http.patch("*/api/admin/companies/:id", refuse("Faollashtirib bo'lmadi: ichki xatolik")))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await user.click(await screen.findByRole("button", { name: "Faollashtirish" }))

  expect(await screen.findByText("Faollashtirib bo'lmadi: ichki xatolik")).toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Ma'lumot" })).getByText("Bloklangan")).toBeInTheDocument()
})
