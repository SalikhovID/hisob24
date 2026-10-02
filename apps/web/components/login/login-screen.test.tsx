import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { LoginScreen } from "./login-screen"

async function sendCodeTo(digits: string) {
  const rendered = renderWithProviders(<LoginScreen />)
  await rendered.user.type(screen.getByRole("textbox", { name: "Telefon raqami" }), digits)
  await rendered.user.click(screen.getByRole("button", { name: "Kodni olish" }))
  await screen.findByRole("textbox", { name: "Kod" })
  return rendered
}

test("once the code is sent the code step names the number", async () => {
  await sendCodeTo("901234567")

  expect(screen.getByText("Kod +998 90 123 45 67 raqamiga yuborildi")).toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: "Telefon raqami" })).not.toBeInTheDocument()
})

test("changing the number goes back to the phone step with the number kept", async () => {
  const { user } = await sendCodeTo("901234567")

  await user.click(screen.getByRole("button", { name: "Raqamni o'zgartirish" }))

  expect(screen.getByRole("textbox", { name: "Telefon raqami" })).toHaveValue("+998 90 123 45 67")
  expect(screen.queryByRole("textbox", { name: "Kod" })).not.toBeInTheDocument()
})
