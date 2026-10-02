import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { Expired } from "./expired"

test("says the subscription is over and who can extend it", () => {
  renderWithProviders(<Expired />)

  expect(screen.getByRole("heading", { name: "Obuna muddati tugagan" })).toBeInTheDocument()
  expect(
    screen.getByText("Kompaniya obunasini uzaytirish uchun administrator bilan bog'laning."),
  ).toBeInTheDocument()
})
