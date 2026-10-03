import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import EmployeesRoute from "./page"

test("/employees is the company's members", async () => {
  await signIn(ALI)

  renderWithProviders(<EmployeesRoute />)

  expect(await screen.findByRole("heading", { name: "Xodimlar" })).toBeInTheDocument()
  expect(await screen.findByRole("table", { name: "Xodimlar" })).toBeInTheDocument()
})
