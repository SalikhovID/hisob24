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

test("what is asked for stands in the page's main part", () => {
  render(frame)

  expect(within(screen.getByRole("main")).getByRole("button", { name: "Kodni olish" })).toBeInTheDocument()
})

test("the panel has no backdrop: the brand is the page's only picture", () => {
  render(frame)

  expect(screen.getByRole("banner").querySelector('[data-slot="logo-24"]')).toBeNull()
  expect(screen.getAllByRole("img")).toHaveLength(1)
})

test("the login is the prototype's card in the middle of the pale grey page: 820px, 12px round, the brand's ink panel at its left and the form at its right; one over the other on a phone", () => {
  render(frame)

  const card = screen.getByRole("banner").parentElement!
  expect(card).toHaveAttribute("data-slot", "login-card")
  expect(card).toHaveClass("max-w-[820px]", "rounded-xl", "bg-card", "md:grid-cols-2")
  expect(card.parentElement).toHaveClass("bg-sidebar", "items-center", "justify-center")
  expect(screen.getByRole("banner")).toHaveClass("bg-brand-panel", "text-brand-panel-foreground", "content-end")
  expect(screen.getByRole("banner").className).not.toContain("--brand-fill")
  expect(screen.getByRole("main")).toHaveClass("content-center")
})

test("the page keeps the card clear of what lies over the screen's top (Telegram's controls in full screen), on a wide screen too", () => {
  render(frame)
  const page = screen.getByRole("banner").parentElement!.parentElement!
  expect(page).toHaveClass("pt-safe-4", "md:pt-safe-6")
})
