import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { TG_ALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { fakeWebApp } from "@/test/telegram"
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

  expect(screen.getByRole("textbox", { name: "Telefon raqami" })).toHaveValue("90 123 45 67")
  expect(screen.queryByRole("textbox", { name: "Kod" })).not.toBeInTheDocument()
})

test("inside Telegram the login needs no phone and no code", async () => {
  window.Telegram = { WebApp: fakeWebApp({}, TG_ALI) }

  renderWithProviders(<LoginScreen />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("textbox", { name: "Telefon raqami" })).not.toBeInTheDocument()
})

test("when the Telegram sign-in fails the SMS form takes over and says why", async () => {
  window.Telegram = { WebApp: fakeWebApp({ initData: "user=%7B%22id%22%3A1001%7D&auth_date=1790000000&hash=bad" }) }

  renderWithProviders(<LoginScreen />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching")
  expect(screen.getByRole("textbox", { name: "Telefon raqami" })).toBeInTheDocument()
})
