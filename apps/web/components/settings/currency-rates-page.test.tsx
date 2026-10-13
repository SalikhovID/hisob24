import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { CurrencyRatesPage } from "./currency-rates-page"

// getByText matches a node's text with its spaces collapsed, so the
// thousands are written here with a plain space, not the no-break one.
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const { title, sub, end } = rowParts(item.firstElementChild as HTMLElement)
      const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
      return [plain(title), plain(sub), plain(end)]
    })

test("a company in the so'm alone is told its admin turns the rest on", async () => {
  await signIn(ALI)
  renderWithProviders(<CurrencyRatesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Valyuta kurslari" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(await screen.findByText("Kompaniyada boshqa valyuta yo'q")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Kurslarni yangilash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
})

test("the rates in force and their history as the prototype's rows; a new rate from the plus's sheet goes on top and into /app/me", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<CurrencyRatesPage />)

  const current = await screen.findByRole("list", { name: "Joriy kurslar" })
  expect(rowsOf(current)).toEqual([["USD — AQSH dollari", "1 USD = 12 800 so'm", null]])
  const history = await screen.findByRole("list", { name: "Kurslar tarixi" })
  expect(rowsOf(history)).toEqual([[expect.stringMatching(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/), "Vali Aliyev", "USD 12 800"]])

  await user.click(screen.getByRole("button", { name: "Kurslarni yangilash" }))
  const sheet = await screen.findByRole("dialog", { name: "Kurslarni yangilash" })
  const field = within(sheet).getByLabelText("1 USD")
  expect(field).toHaveValue("12800")
  expect(within(sheet).getByText("so'm")).toBeInTheDocument()
  await user.clear(field)
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect(await within(sheet).findByText("Kursni kiriting")).toBeInTheDocument()
  await user.type(field, "abc")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect(await within(sheet).findByText("Kurs noto'g'ri")).toBeInTheDocument()
  await user.clear(field)
  await user.type(field, "12 900,5")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))

  expect((await screen.findAllByText("Kurslar saqlandi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(() => expect(within(screen.getByRole("list", { name: "Joriy kurslar" })).getByText("1 USD = 12 900,5 so'm")).toBeInTheDocument())
  expect(db.rates.filter((r) => r.companyId === 2).map((r) => r.usd)).toEqual(["12800.0000", "12900.5000"])
  await waitFor(() => expect(within(screen.getByRole("list", { name: "Kurslar tarixi" })).getAllByRole("listitem")).toHaveLength(2))
})

test("settings.view alone reads the rates without the way to change them", async () => {
  db.currencies[1].push(2)
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<CurrencyRatesPage />)

  expect(await screen.findByRole("list", { name: "Joriy kurslar" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Kurslarni yangilash" })).not.toBeInTheDocument()
})
