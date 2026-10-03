import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import AppLayout from "./layout"

// Every page under (app) opens inside the shell.
test("the app's pages open inside the shell", async () => {
  await signIn(ALI)

  renderWithProviders(
    <AppLayout>
      <p>Sahifa mazmuni</p>
    </AppLayout>,
  )

  expect(await screen.findByText("Sahifa mazmuni")).toBeInTheDocument()
  expect(within(screen.getByRole("complementary", { name: "Menyu" })).getByRole("link", { name: "Bosh sahifa" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Profil" })).toBeInTheDocument()
})
