import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, SARDOR, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { Dashboard } from "./dashboard"

// The shell around the dashboard holds the top bar (sign-out, theme), shows
// the loading and the failure, and sends away a session without a usable
// company: components/shell/*.test.tsx.

test("greets the user by name and shows the company they work in", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })).toBeInTheDocument()
  expect(screen.getByText("Olma Savdo")).toBeInTheDocument()
  expect(screen.getByText("Egasi")).toBeInTheDocument()
})

test("without a name the greeting uses the phone number", async () => {
  db.users[ALI] = null
  await signIn(ALI)

  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("heading", { name: "Salom, +998 90 123 45 67" })).toBeInTheDocument()
})

test("someone with another company to work in can switch to it", async () => {
  await signIn(VALI)
  await chooseCompany(1)

  renderWithProviders(<Dashboard />)

  expect(await screen.findByRole("link", { name: "Kompaniyani almashtirish" })).toHaveAttribute(
    "href",
    "/select-company",
  )
})

test.each([
  ["one company", ALI, null],
  ["the others expired or blocked", SARDOR, 1],
])("with %s there is nothing to switch to", async (_, phone, company) => {
  await signIn(phone)
  if (company !== null) await chooseCompany(company)

  renderWithProviders(<Dashboard />)

  await screen.findByRole("heading", { name: /^Salom/ })
  expect(screen.queryByRole("link", { name: "Kompaniyani almashtirish" })).not.toBeInTheDocument()
})

test("the dashboard is its content alone: the shell holds the top bar", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)

  await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })
  expect(screen.queryByRole("banner")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Mavzuni almashtirish" })).not.toBeInTheDocument()
})
