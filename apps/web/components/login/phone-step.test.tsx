import { screen, waitFor } from "@testing-library/react"
import { http } from "msw"
import { expect, test, vi } from "vitest"
import { api, call } from "@/lib/api"
import { ALI } from "@/mocks/data"
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

test("an incomplete number is not sent", async () => {
  let requests = 0
  server.use(
    http.post("*/api/app/auth/sms/send", () => {
      requests += 1
    }),
  )
  const onSent = vi.fn()
  const { user } = renderWithProviders(<PhoneStep onSent={onSent} />)

  await user.type(screen.getByRole("textbox", { name: "Telefon raqami" }), "90123")
  await user.click(screen.getByRole("button", { name: "Kodni olish" }))

  expect(await screen.findByText("Telefon raqamini to'liq kiriting")).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Telefon raqami" })).toHaveAttribute("aria-invalid", "true")
  expect(requests).toBe(0)
  expect(onSent).not.toHaveBeenCalled()
})

test("a second code within a minute shows the API's message", async () => {
  await call(api.POST("/app/auth/sms/send", { body: { phone: ALI } }))
  const onSent = vi.fn()
  const { user } = renderWithProviders(<PhoneStep onSent={onSent} />)

  await user.type(screen.getByRole("textbox", { name: "Telefon raqami" }), "901234567")
  await user.click(screen.getByRole("button", { name: "Kodni olish" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Kodni qayta olish uchun bir daqiqa kuting")
  expect(onSent).not.toHaveBeenCalled()
})
