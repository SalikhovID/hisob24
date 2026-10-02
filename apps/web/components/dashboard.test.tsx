import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db } from "@/mocks/data"
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
