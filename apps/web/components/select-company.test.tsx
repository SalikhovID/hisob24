import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { SARDOR, VALI } from "@/mocks/data"
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

test("expired and blocked companies are shown with a badge but cannot be chosen", async () => {
  await signIn(SARDOR)
  renderWithProviders(<SelectCompany />)

  const anor = await screen.findByRole("button", { name: /Anor Servis/ })

  expect(anor).toBeDisabled()
  expect(anor).toHaveTextContent("Muddati o'tgan")
  const behi = screen.getByRole("button", { name: /Behi Blok/ })
  expect(behi).toBeDisabled()
  expect(behi).toHaveTextContent("Bloklangan")
  const olma = screen.getByRole("button", { name: /Olma Savdo/ })
  expect(olma).toBeEnabled()
  expect(olma).not.toHaveTextContent(/Muddati o'tgan|Bloklangan/)
})
