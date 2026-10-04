import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { OtpLogin } from "./otp-login"

test("the login page says how to get a code and links the bot", () => {
  renderWithProviders(<OtpLogin botUsername="hisob24_admin_bot" />)

  expect(screen.getByText(/Kodni olish uchun botga/)).toHaveTextContent("Kodni olish uchun botga /login yozing")
  expect(screen.getByRole("link", { name: "@hisob24_admin_bot" })).toHaveAttribute(
    "href",
    "https://t.me/hisob24_admin_bot",
  )
})

test("without a bot username the page still says what to do", () => {
  renderWithProviders(<OtpLogin botUsername="" />)

  expect(screen.getByText(/Kodni olish uchun botga/)).toBeInTheDocument()
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
})

test("the sixth digit sends the code and opens the panel", async () => {
  let sent: unknown
  server.use(
    http.post("*/api/admin/auth/otp", async ({ request }) => {
      sent = await request.json()
      return HttpResponse.json({ telegram_id: 461603558, full_name: "Owner" })
    }),
  )
  const { user } = renderWithProviders(<OtpLogin botUsername="" />)

  await user.type(screen.getByRole("textbox", { name: "Kod" }), "123456")

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/companies"))
  expect(sent).toEqual({ code: "123456" })
})

test("a wrong code is cleared and the API's message shown", async () => {
  const { user } = renderWithProviders(<OtpLogin botUsername="" />)
  const input = screen.getByRole("textbox", { name: "Kod" })

  await user.type(input, "000000")

  expect(await screen.findByRole("alert")).toHaveTextContent("Kod noto'g'ri yoki muddati o'tgan")
  expect(input).toHaveValue("")
  expect(router.replace).not.toHaveBeenCalled()
})

test("too many attempts show the API's message", async () => {
  server.use(
    http.post("*/api/admin/auth/otp", () =>
      HttpResponse.json(
        { error: "too_many_requests", message: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring" },
        { status: 429 },
      ),
    ),
  )
  const { user } = renderWithProviders(<OtpLogin botUsername="" />)

  await user.type(screen.getByRole("textbox", { name: "Kod" }), "123456")

  expect(await screen.findByRole("alert")).toHaveTextContent("Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring")
})

test("typing a new code hides the old error", async () => {
  const { user } = renderWithProviders(<OtpLogin botUsername="" />)
  const input = screen.getByRole("textbox", { name: "Kod" })
  await user.type(input, "000000")
  await screen.findByRole("alert")

  await user.type(input, "1")

  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("the login is headed by the brand", () => {
  renderWithProviders(<OtpLogin botUsername="" />)

  const heading = screen.getByRole("heading", { level: 1, name: "Hisob24 Admin" })
  expect(within(heading).getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
})
