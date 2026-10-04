import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Logo } from "./logo"

test("Logo is Hisob24's name as a picture, drawn in the color of the text around it", () => {
  render(<Logo />)

  expect(screen.getByRole("img", { name: "Hisob24" })).toHaveAttribute("fill", "currentColor")
})
