import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { allPermissions } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { ALI, db, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { CurrencyRates } from "./currency-rates-page"

const viewOnly: Permission[] = ["settings.view"]

// getByText matches a node's text with its spaces collapsed, so the
// thousands are written here with a plain space, not the no-break one.

test("a company in the so'm alone is told its admin turns the rest on", async () => {
  await signIn(ALI)
  renderWithProviders(<CurrencyRates companyId={1} permissions={allPermissions} />)

  expect(await screen.findByText("Kompaniyada boshqa valyuta yo'q")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Kurslarni yangilash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
})

test("the rates in force and their history; a new rate goes on top and into /app/me", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<CurrencyRates companyId={2} permissions={allPermissions} />)

  const current = await screen.findByRole("list", { name: "Joriy kurslar" })
  expect(within(current).getByText("USD — AQSH dollari")).toBeInTheDocument()
  expect(within(current).getByText("1 USD = 12 800 so'm")).toBeInTheDocument()
  const history = await screen.findByRole("table", { name: "Kurslar tarixi" })
  expect(within(history).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Sana", "USD", "Kiritgan"])
  expect(within(history).getByText("12 800")).toBeInTheDocument()
  expect(within(history).getByText("Vali Aliyev")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Kurslarni yangilash" }))
  const dialog = await screen.findByRole("dialog", { name: "Kurslarni yangilash" })
  const field = within(dialog).getByLabelText("1 USD = ? so'm")
  expect(field).toHaveValue("12800")
  await user.clear(field)
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("Kursni kiriting")).toBeInTheDocument()
  await user.type(field, "abc")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("Kurs noto'g'ri")).toBeInTheDocument()
  await user.clear(field)
  await user.type(field, "12 900,5")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await screen.findByText("Kurslar saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(() => expect(within(screen.getByRole("list", { name: "Joriy kurslar" })).getByText("1 USD = 12 900,5 so'm")).toBeInTheDocument())
  expect(db.rates.filter((r) => r.companyId === 2).map((r) => r.usd)).toEqual(["12800.0000", "12900.5000"])
  await waitFor(() => expect(within(screen.getByRole("table", { name: "Kurslar tarixi" })).getAllByRole("row")).toHaveLength(3))
})

test("settings.view alone reads the rates without the way to change them", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  renderWithProviders(<CurrencyRates companyId={2} permissions={viewOnly} />)

  expect(await screen.findByRole("list", { name: "Joriy kurslar" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Kurslarni yangilash" })).not.toBeInTheDocument()
})
