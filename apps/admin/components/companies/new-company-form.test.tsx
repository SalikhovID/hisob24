import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { NewCompanyForm } from "./new-company-form"

test("the new company form says what is missing", async () => {
  const { user } = renderWithProviders(<NewCompanyForm />)

  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  expect(await screen.findByText("Kompaniya nomini kiriting")).toBeInTheDocument()
  expect(screen.getByText("Tugash sanasini tanlang")).toBeInTheDocument()
  expect(screen.getByText("Egasining telefon raqami noto'g'ri")).toBeInTheDocument()
  expect(screen.getByText("Egasining ismini kiriting")).toBeInTheDocument()
  expect(screen.getByLabelText("Kompaniya nomi")).toHaveAttribute("aria-invalid", "true")
})
