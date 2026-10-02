import { screen, waitFor } from "@testing-library/react"
import { http } from "msw"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { PhoneStep } from "./phone-step"

test("the phone field keeps the +998 mask while digits are typed", async () => {
  const { user } = renderWithProviders(<PhoneStep onSent={vi.fn()} />)
  const field = screen.getByRole("textbox", { name: "Telefon raqami" })
  expect(field).toHaveValue("+998 ")

  await user.type(field, "901234567")

  expect(field).toHaveValue("+998 90 123 45 67")
})

test("a complete number asks for a code and moves on", async () => {
  let sent: unknown
  server.use(
    http.post("*/api/app/auth/sms/send", async ({ request }) => {
      sent = await request.clone().json()
    }),
  )
  const onSent = vi.fn()
  const { user } = renderWithProviders(<PhoneStep onSent={onSent} />)

  await user.type(screen.getByRole("textbox", { name: "Telefon raqami" }), "901234567")
  await user.click(screen.getByRole("button", { name: "Kodni olish" }))

  await waitFor(() => expect(onSent).toHaveBeenCalledWith("+998 90 123 45 67", 60))
  expect(sent).toEqual({ phone: "998901234567" })
})
