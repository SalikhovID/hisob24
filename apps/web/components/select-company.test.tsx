import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { SelectCompany } from "./select-company"

test("lists the companies to choose from with the role in each", async () => {
  await signIn(VALI)
  renderWithProviders(<SelectCompany />)
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()

  const nok = await screen.findByRole("button", { name: /Nok Market/ })

  expect(screen.getByRole("heading", { name: "Kompaniyani tanlang" })).toBeInTheDocument()
  expect(nok).toHaveTextContent("Egasi")
  expect(nok).toBeEnabled()
  expect(screen.getByRole("button", { name: /Olma Savdo/ })).toHaveTextContent("Menejer")
})
