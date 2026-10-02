import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
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
