import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { company, db, TODAY } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { currentUrl, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { CompaniesPage } from "./companies-page"

function rowsOf(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1)
}

// nameOf is the company a row is about: the link that heads the row.
function nameOf(row: HTMLElement) {
  return within(within(row).getByRole("rowheader")).getByRole("link").textContent
}

// names are the companies the table shows, in order.
function names() {
  return rowsOf(screen.getByRole("table", { name: "Kompaniyalar" })).map(nameOf)
}

test("the companies page lists the companies, newest first, with how they stand", async () => {
  setLocation("/companies")

  renderWithProviders(<CompaniesPage />)

  expect(screen.getByRole("heading", { name: "Kompaniyalar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Yangi kompaniya" })).toHaveAttribute("href", "/companies/new")
  const rows = rowsOf(await screen.findByRole("table", { name: "Kompaniyalar" }))
  expect(rows.map(nameOf)).toEqual(["Olcha Servis", "Nok Market", "Olma Savdo"])
  expect(rows[2]).toHaveTextContent("01.11.2026")
  expect(within(rows[2]).getByText("30 kun qoldi")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Muddati o'tgan")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("link", { name: "Olcha Servis" })).toHaveAttribute("href", "/companies/3")
})

test("each company goes by its name, over the day it was created", async () => {
  setLocation("/companies")

  renderWithProviders(<CompaniesPage />)

  const rows = rowsOf(await screen.findByRole("table", { name: "Kompaniyalar" }))
  expect(rows.map((row) => identityOf(within(row).getByRole("rowheader")))).toEqual([
    ["Olcha Servis", "Yaratilgan 13.09.2026"],
    ["Nok Market", "Yaratilgan 12.09.2026"],
    ["Olma Savdo", "Yaratilgan 11.09.2026"],
  ])
  // The name alone is the link: nothing else is read as part of it.
  expect(within(rows[0]).getAllByRole("link")).toHaveLength(1)
  expect(within(rows[0]).getByRole("link", { name: "Olcha Servis" })).toHaveAttribute("href", "/companies/3")
})

test("the page says how many companies the platform has, and never calls a filtered count that", async () => {
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)

  // The line is there from the start; the count joins it with the list.
  expect(screen.getByText("Platformadagi kompaniyalar")).toBeInTheDocument()
  expect(await screen.findByText("Platformadagi kompaniyalar · 3 ta")).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Faol" }))
  await waitFor(() => expect(names()).toEqual(["Nok Market", "Olma Savdo"]))
  // Two match the tab; the platform still has three. The pager counts the matches.
  expect(screen.getByText("Platformadagi kompaniyalar")).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Hammasi" }))
  expect(await screen.findByText("Platformadagi kompaniyalar · 3 ta")).toBeInTheDocument()
})

test("on a phone a company is a card: how it stands, then when it ends", async () => {
  setLocation("/companies")
  renderWithProviders(<CompaniesPage />)

  const [olcha] = within(await screen.findByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")

  expect(identityOf(olcha)).toEqual(["Olcha Servis", "Yaratilgan 13.09.2026"])
  const line = Array.from(olcha.querySelectorAll('[data-slot="data-list-meta"] > div')).map((pair) => [
    pair.querySelector("dt")?.textContent,
    pair.querySelector("dd")?.textContent,
  ])
  expect(line).toEqual([
    ["Holat", "Muddati o'tgan"],
    ["Tugash sanasi", "25.09.2026"],
  ])
  // The badge needs no name on screen; a bare date would not say what it is.
  expect(within(olcha).getByText("Holat")).toHaveClass("sr-only")
  expect(within(olcha).getByText("Tugash sanasi")).not.toHaveClass("sr-only")
})

test("a filtered count never stands in for the platform's while the full list loads", async () => {
  // The unfiltered answer is held back; the tab's answer (two companies) is on screen meanwhile.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  server.use(
    http.get("*/api/admin/companies", async ({ request }) => {
      if (!new URL(request.url).searchParams.get("status")) await held
    }),
  )
  setLocation("/companies?status=active")
  const { user } = renderWithProviders(<CompaniesPage />)
  await waitFor(() => expect(names()).toEqual(["Nok Market", "Olma Savdo"]))

  await user.click(screen.getByRole("tab", { name: "Hammasi" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies"))

  // Two is how many are active, not how many the platform has.
  expect(screen.getByText("Platformadagi kompaniyalar")).toBeInTheDocument()
  expect(screen.queryByText(/· \d+ ta/)).not.toBeInTheDocument()

  release()
  expect(await screen.findByText("Platformadagi kompaniyalar · 3 ta")).toBeInTheDocument()
})

test("the platform's count stays on screen while pages turn", async () => {
  for (let i = 1; i <= 42; i++) db.companies.push(company(100 + i, `Kompaniya ${i}`, TODAY))
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  server.use(
    http.get("*/api/admin/companies", async ({ request }) => {
      if (new URL(request.url).searchParams.get("page") === "2") await held
    }),
  )
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)
  expect(await screen.findByText("Platformadagi kompaniyalar · 45 ta")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies?page=2"))

  // The second page is still on its way; the count has not blinked.
  expect(screen.getByText("1–20 / 45")).toBeInTheDocument()
  expect(screen.getByText("Platformadagi kompaniyalar · 45 ta")).toBeInTheDocument()

  release()
  expect(await screen.findByText("21–40 / 45")).toBeInTheDocument()
  expect(screen.getByText("Platformadagi kompaniyalar · 45 ta")).toBeInTheDocument()
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

test("the status tabs show the active or the expired companies", async () => {
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)
  await screen.findByRole("table", { name: "Kompaniyalar" })

  await user.click(screen.getByRole("tab", { name: "Muddati o'tgan" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies?status=expired"))
  await waitFor(() => expect(names()).toEqual(["Olcha Servis"]))

  await user.click(screen.getByRole("tab", { name: "Faol" }))
  await waitFor(() => expect(names()).toEqual(["Nok Market", "Olma Savdo"]))
  expect(screen.getByRole("tab", { name: "Faol" })).toHaveAttribute("aria-selected", "true")
})

test("the list goes page by page, twenty at a time", async () => {
  for (let i = 1; i <= 42; i++) db.companies.push(company(100 + i, `Kompaniya ${i}`, TODAY))
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("1–20 / 45")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies?page=2"))
  expect(await screen.findByText("21–40 / 45")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Keyingi" }))
  expect(await screen.findByText("41–45 / 45")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
})

test("while the list loads the page shows placeholders", async () => {
  setLocation("/companies")

  renderWithProviders(<CompaniesPage />)

  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  await screen.findByRole("table", { name: "Kompaniyalar" })
  expect(screen.queryByLabelText("Yuklanmoqda")).not.toBeInTheDocument()
})

test("a search with no match says so", async () => {
  setLocation("/companies?search=behi")

  renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("Kompaniyalar topilmadi")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test("a filter with no match suggests changing it", async () => {
  setLocation("/companies?status=expired&search=olma")

  renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("Kompaniyalar topilmadi")).toBeInTheDocument()
  expect(screen.getByText("Qidiruv yoki filtrni o'zgartirib ko'ring.")).toBeInTheDocument()
})

test("a platform with no company yet says how to add the first", async () => {
  db.companies.length = 0
  setLocation("/companies")

  renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("Kompaniyalar topilmadi")).toBeInTheDocument()
  expect(screen.getByText("Birinchi kompaniyani «Yangi kompaniya» tugmasi orqali qo'shing.")).toBeInTheDocument()
  // There is no filter to change.
  expect(screen.queryByText("Qidiruv yoki filtrni o'zgartirib ko'ring.")).not.toBeInTheDocument()
})

test("while the full list loads after a search that found nothing, the page does not say the platform is empty", async () => {
  // The unfiltered answer is held back; the search's answer (nothing) is on screen meanwhile.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  server.use(
    http.get("*/api/admin/companies", async ({ request }) => {
      if (!new URL(request.url).searchParams.get("search")) await held
    }),
  )
  setLocation("/companies?search=behi")
  const { user } = renderWithProviders(<CompaniesPage />)
  expect(await screen.findByText("Kompaniyalar topilmadi")).toBeInTheDocument()

  await user.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await waitFor(() => expect(currentUrl()).toBe("/companies"))

  // Nothing is known about the full list yet: it is loading, not empty.
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(screen.queryByText("Kompaniyalar topilmadi")).not.toBeInTheDocument()
  expect(screen.queryByText("Birinchi kompaniyani «Yangi kompaniya» tugmasi orqali qo'shing.")).not.toBeInTheDocument()

  release()
  expect(await screen.findByRole("table", { name: "Kompaniyalar" })).toBeInTheDocument()
})

test("when the list cannot load the page says why and tries again", async () => {
  let calls = 0
  server.use(
    http.get("*/api/admin/companies", () => {
      if (calls++ > 0) return
      return HttpResponse.json(
        { error: "internal_error", message: "Ichki xatolik. Birozdan keyin qayta urinib ko'ring" },
        { status: 500 },
      )
    }),
  )
  setLocation("/companies")
  const { user } = renderWithProviders(<CompaniesPage />)

  expect(await screen.findByText("Ichki xatolik. Birozdan keyin qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("table", { name: "Kompaniyalar" })).toBeInTheDocument()
})
