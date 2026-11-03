import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { BrandMark } from "./brand-mark"

test("the brand mark is the prototype's: the white H24 on the teal square, 22px and 5px round, decoration", () => {
  const { container } = render(<BrandMark />)
  const mark = container.querySelector('[data-slot="brand-mark"]')
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveClass("bg-brand-mark", "text-white", "size-[22px]", "rounded-[5px]")
  expect(mark?.querySelector('[data-slot="logo-mark"]')).toHaveClass("text-white")
})
