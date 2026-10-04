import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Logo, Logo24, LogoMark } from "./logo"

test("Logo is Hisob24's name as a picture, drawn in the color of the text around it", () => {
  render(<Logo />)

  expect(screen.getByRole("img", { name: "Hisob24" })).toHaveAttribute("fill", "currentColor")
})

test("Logo takes the size it is given", () => {
  render(<Logo className="h-8" />)

  expect(screen.getByRole("img", { name: "Hisob24" })).toHaveClass("h-8")
})

test("LogoMark is the short mark, a decoration: what it stands beside carries the name", () => {
  const { container } = render(<LogoMark />)

  const mark = container.querySelector('[data-slot="logo-mark"]')
  expect(mark).not.toBeNull()
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveAttribute("fill", "currentColor")
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
})

test("LogoMark takes the size it is given", () => {
  const { container } = render(<LogoMark className="w-9" />)

  expect(container.querySelector('[data-slot="logo-mark"]')).toHaveClass("w-9")
})

test("Logo24 is the mark's number alone, a decoration", () => {
  const { container } = render(<Logo24 />)

  const number = container.querySelector('[data-slot="logo-24"]')
  expect(number).not.toBeNull()
  expect(number).toHaveAttribute("aria-hidden", "true")
  expect(number).toHaveAttribute("fill", "currentColor")
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
})

test("Logo24 takes the size it is given", () => {
  const { container } = render(<Logo24 className="w-96" />)

  expect(container.querySelector('[data-slot="logo-24"]')).toHaveClass("w-96")
})
