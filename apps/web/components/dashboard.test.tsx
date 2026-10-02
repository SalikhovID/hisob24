import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { accessToken } from "@/lib/session"
import { ALI, db, SARDOR, VALI, ZARINA } from "@/mocks/data"
import { leave, router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { Dashboard } from "./dashboard"

test("greets the user by name and shows the company they work in", async () => {
  await signIn(ALI)
  renderWithProviders(<Dashboard />)
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()

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

test("a session for an expired company is sent to /expired", async () => {
  // Zarina's only company was chosen at login, and it has expired.
  await signIn(ZARINA)

  renderWithProviders(<Dashboard />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/expired"))
})

test("a session with no company yet is sent to choose one", async () => {
  await signIn(VALI)

  renderWithProviders(<Dashboard />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/select-company"))
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

test("signing out ends the session and leaves for /login", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Dashboard />)

  await user.click(await screen.findByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
})
