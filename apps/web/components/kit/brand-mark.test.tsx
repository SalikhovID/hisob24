import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { BrandMark } from "./brand-mark"

test("the brand mark is the designer's H24 on the glossy accent, in the accent's other end: a 40px square, 12px round, decoration", () => {
  const { container } = render(<BrandMark />)
  const mark = container.querySelector('[data-slot="brand-mark"]')
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveClass("glossy", "size-10", "rounded-[12px]")
  expect(mark?.querySelector('[data-slot="logo-mark"]')).toHaveClass("text-primary-foreground")
})
