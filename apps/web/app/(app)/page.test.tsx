import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import Home from "./page"

// The dashboard is the app's home page.
test("the root page is the dashboard", async () => {
  await signIn(ALI)

  renderWithProviders(<Home />)

  expect(await screen.findByRole("heading", { name: "Salom, Ali Valiyev" })).toBeInTheDocument()
})
