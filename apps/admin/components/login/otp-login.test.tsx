import { screen, waitFor } from "@testing-library/react"
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
