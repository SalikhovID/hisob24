import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Badge } from "./badge"

test("a badge is neutral unless told, and says its variant for the styles", () => {
  const { rerender } = render(<Badge>Xodim</Badge>)
  expect(screen.getByText("Xodim")).toHaveAttribute("data-variant", "neutral")

  rerender(<Badge variant="red">Muddati o&apos;tgan</Badge>)
  expect(screen.getByText("Muddati o'tgan")).toHaveAttribute("data-variant", "red")
})

test("a badge may lead with a dot, which is decoration", () => {
  render(
    <Badge variant="accent" dot>
      Egasi
    </Badge>,
  )
  const badge = screen.getByText("Egasi")
  const dot = badge.querySelector('[data-slot="badge-dot"]')
  expect(dot).toHaveAttribute("aria-hidden", "true")
  expect(badge).toHaveTextContent(/^Egasi$/)
})

test("the names from before still work, for the pages not yet moved over", () => {
  render(<Badge variant="secondary">Jismoniy</Badge>)
  expect(screen.getByText("Jismoniy")).toHaveAttribute("data-variant", "secondary")
})
