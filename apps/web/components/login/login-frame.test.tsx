import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { Logo } from "@/components/logo"
import { LoginFrame } from "./login-frame"

const frame = (
  <LoginFrame brand={<Logo />} tagline="Biznesingiz uchun hisob tizimi">
    <button type="button">Kodni olish</button>
  </LoginFrame>
)

test("the frame is headed by the brand it is given, on the brand's panel", () => {
  render(frame)

  const heading = within(screen.getByRole("banner")).getByRole("heading", { level: 1, name: "Hisob24" })
  expect(within(heading).getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
})

test("the panel says what the product is", () => {
  render(frame)

  expect(within(screen.getByRole("banner")).getByText("Biznesingiz uchun hisob tizimi")).toBeInTheDocument()
})
