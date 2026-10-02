import { screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { PhoneStep } from "./phone-step"

test("the phone field keeps the +998 mask while digits are typed", async () => {
  const { user } = renderWithProviders(<PhoneStep onSent={vi.fn()} />)
  const field = screen.getByRole("textbox", { name: "Telefon raqami" })
  expect(field).toHaveValue("+998 ")

  await user.type(field, "901234567")

  expect(field).toHaveValue("+998 90 123 45 67")
})
