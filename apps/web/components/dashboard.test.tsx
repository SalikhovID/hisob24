import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, ZARINA } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
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
